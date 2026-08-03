using System.Security.Cryptography;
using System.Text;
using LittleLinksFleet.Models;
using Npgsql;

namespace LittleLinksFleet.Services
{
    /// <summary>
    /// Opens the envelope the API sealed.
    ///
    /// The API holds only the RSA public half, so it can produce a sealed
    /// credential and can never read one back — not even for the account's
    /// own owner. This class is the only place in the entire system where a
    /// Second Life password exists in plaintext, and it exists there for the
    /// few milliseconds between unwrapping and handing it to the login call.
    ///
    ///     wrapped_key --RSA-OAEP(private)--> content key
    ///     ciphertext + nonce + tag --AES-256-GCM(content key)--> password
    ///
    /// Rules this file must keep:
    ///   * Never log a password, a content key, or the private key.
    ///   * Never expose a decrypt method that takes caller-supplied
    ///     ciphertext — it must only ever read the credentials table, so it
    ///     cannot be turned into a decryption oracle.
    ///   * Zero the content key after use.
    /// </summary>
    public sealed class CredentialStore : IAsyncDisposable
    {
        private readonly NpgsqlDataSource _db;
        private readonly RSA _privateKey;

        public CredentialStore(string databaseUrl, string privateKeyPem)
        {
            _db = NpgsqlDataSource.Create(NormaliseConnectionString(databaseUrl));

            _privateKey = RSA.Create();
            try
            {
                _privateKey.ImportFromPem(privateKeyPem);
            }
            catch (Exception ex)
            {
                throw new InvalidOperationException(
                    "The fleet private key is not a valid PEM private key. Generate a matching pair with "
                    + "tools/generate-fleet-keypair.js and give the API the PUBLIC half only.", ex);
            }

            if (_privateKey.KeySize < 2048)
                throw new InvalidOperationException($"Fleet private key is only {_privateKey.KeySize} bits; refusing to run.");
        }

        /// <summary>
        /// Accepts the postgres:// URL form the rest of the stack uses and
        /// converts it to the keyword form Npgsql wants. A plain keyword
        /// string is passed through untouched.
        /// </summary>
        private static string NormaliseConnectionString(string url)
        {
            if (!url.StartsWith("postgres://", StringComparison.OrdinalIgnoreCase)
             && !url.StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase))
                return url;

            var uri = new Uri(url);
            var userInfo = uri.UserInfo.Split(':', 2);
            var builder = new NpgsqlConnectionStringBuilder
            {
                Host = uri.Host,
                Port = uri.Port > 0 ? uri.Port : 5432,
                Database = uri.AbsolutePath.TrimStart('/'),
                Username = Uri.UnescapeDataString(userInfo[0]),
                Password = userInfo.Length > 1 ? Uri.UnescapeDataString(userInfo[1]) : "",
            };

            // Managed Postgres (Neon, RDS) requires TLS. Honour an explicit
            // sslmode in the query string, otherwise require it — defaulting
            // to plaintext would send these passwords over the wire in clear.
            // Parsed by hand rather than with HttpUtility to keep this
            // project free of a System.Web dependency.
            string sslMode = null;
            foreach (var pair in uri.Query.TrimStart('?').Split('&', StringSplitOptions.RemoveEmptyEntries))
            {
                var kv = pair.Split('=', 2);
                if (kv.Length == 2 && kv[0].Equals("sslmode", StringComparison.OrdinalIgnoreCase))
                    sslMode = Uri.UnescapeDataString(kv[1]);
            }
            builder.SslMode = sslMode?.ToLowerInvariant() switch
            {
                "disable"    => SslMode.Disable,
                "allow"      => SslMode.Allow,
                "prefer"     => SslMode.Prefer,
                "verify-ca"  => SslMode.VerifyCA,
                "verify-full"=> SslMode.VerifyFull,
                _            => SslMode.Require,
            };
            return builder.ConnectionString;
        }

        /// <summary>
        /// Fetch and decrypt one bot's login. Returns null when the bot has
        /// no credential row, when it was sealed for a different key, or
        /// when the envelope fails to open.
        /// </summary>
        public async Task<BotCredential> LoadAsync(string botKey, CancellationToken ct)
        {
            if (!Guid.TryParse(botKey, out var id)) return null;

            const string sql = @"
                SELECT login_first, login_last, secret_ciphertext, secret_nonce,
                       secret_tag, wrapped_key, fleet_key_id
                  FROM public.littlelinks_bot_credentials
                 WHERE bot_key = @bot";

            await using var cmd = _db.CreateCommand(sql);
            cmd.Parameters.AddWithValue("bot", id);

            await using var reader = await cmd.ExecuteReaderAsync(ct);
            if (!await reader.ReadAsync(ct))
            {
                Console.Error.WriteLine($"[cred] {botKey} has no credential row — the parent has not linked a login yet.");
                return null;
            }

            var first      = reader.GetString(0);
            var last       = reader.GetString(1);
            var ciphertext = reader.GetString(2);
            var nonce      = reader.GetString(3);
            var tag        = reader.GetString(4);
            var wrapped    = reader.IsDBNull(5) ? null : reader.GetString(5);
            var keyId      = reader.IsDBNull(6) ? "" : reader.GetString(6);

            if (string.IsNullOrWhiteSpace(wrapped))
            {
                // Pre-envelope rows, if any ever existed, are not openable
                // by this worker and must not be guessed at.
                Console.Error.WriteLine($"[cred] {botKey} has no wrapped_key (key id '{keyId}') — re-link the login from the portal.");
                return null;
            }

            try
            {
                return new BotCredential
                {
                    First = first,
                    Last = string.IsNullOrWhiteSpace(last) ? "Resident" : last,
                    Password = OpenEnvelope(wrapped, nonce, ciphertext, tag),
                };
            }
            catch (CryptographicException)
            {
                // Wrong key, or a tampered row. Both are "cannot log in",
                // and neither should print anything about the ciphertext.
                Console.Error.WriteLine(
                    $"[cred] {botKey}: envelope did not open (sealed for key id '{keyId}'). "
                    + "Check LITTLELINKS_FLEET_PRIVATE_KEY matches the public key the API was given.");
                return null;
            }
        }

        /// <summary>
        /// Unwrap and open one envelope. Mirrors sealBotSecret() in
        /// db/littlelinksCrypto.js exactly: RSA-OAEP(SHA-256) to recover the
        /// content key, then AES-256-GCM to recover the password.
        ///
        /// INTERNAL, not public, and that matters. A public method taking
        /// caller-supplied ciphertext would turn this class into a
        /// decryption oracle — anything that could call it could open any
        /// credential it could read. It is internal purely so the crypto can
        /// be tested against real API output without a database, and the
        /// only production caller is LoadAsync above.
        /// </summary>
        internal string OpenEnvelope(string wrappedKeyB64, string nonceB64, string ciphertextB64, string tagB64)
        {
            byte[] contentKey = null;
            try
            {
                contentKey = _privateKey.Decrypt(
                    Convert.FromBase64String(wrappedKeyB64), RSAEncryptionPadding.OaepSHA256);

                return AesGcmOpen(contentKey,
                                  Convert.FromBase64String(nonceB64),
                                  Convert.FromBase64String(ciphertextB64),
                                  Convert.FromBase64String(tagB64));
            }
            finally
            {
                if (contentKey != null) CryptographicOperations.ZeroMemory(contentKey);
            }
        }

        private static string AesGcmOpen(byte[] key, byte[] nonce, byte[] ciphertext, byte[] tag)
        {
            var plaintext = new byte[ciphertext.Length];
            // The tag-size overload is the non-obsolete one on .NET 8; the
            // single-argument constructor warns as SYSLIB0053.
            using var aes = new AesGcm(key, tag.Length);
            aes.Decrypt(nonce, ciphertext, tag, plaintext);
            try
            {
                return Encoding.UTF8.GetString(plaintext);
            }
            finally
            {
                CryptographicOperations.ZeroMemory(plaintext);
            }
        }

        public async ValueTask DisposeAsync()
        {
            _privateKey.Dispose();
            await _db.DisposeAsync();
        }
    }
}
