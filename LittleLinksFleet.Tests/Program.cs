using System.Security.Cryptography;
using System.Text.Json;
using LittleLinksFleet.Services;

namespace LittleLinksFleet.Tests
{
    /// <summary>
    /// Proves the compiled fleet can open an envelope produced by the live
    /// API code (db/littlelinksCrypto.js).
    ///
    /// This is the one failure the rest of the system cannot survive or
    /// detect: if the C# and Node halves disagree by a single parameter —
    /// OAEP hash, tag length, base64 vs hex — every bot login fails with
    /// "envelope did not open" and no amount of checking the Second Life
    /// password will explain it. So it is tested against real API output
    /// rather than against a C#-generated fixture, which would only prove
    /// C# agrees with itself.
    ///
    /// Input is a JSON file written by tools/seal-fixture.js:
    ///     { privateKeyPem, password, sealed: { ciphertext, nonce, tag, wrappedKey } }
    ///
    ///     dotnet run --project LittleLinksFleet.Tests -- fixture.json
    /// </summary>
    internal static class Program
    {
        private static int _failures;

        private static void Check(string name, bool ok, string detail = "")
        {
            Console.WriteLine($"  {(ok ? "PASS" : "FAIL")}  {name}{(detail.Length > 0 ? $" — {detail}" : "")}");
            if (!ok) _failures++;
        }

        private static int Main(string[] args)
        {
            if (args.Length < 1)
            {
                Console.Error.WriteLine("usage: LittleLinksFleet.Tests <fixture.json>");
                return 2;
            }

            var doc = JsonDocument.Parse(File.ReadAllText(args[0])).RootElement;
            var privateKeyPem = doc.GetProperty("privateKeyPem").GetString();
            var expected = doc.GetProperty("password").GetString();
            var env = doc.GetProperty("sealed");

            var wrapped = env.GetProperty("wrappedKey").GetString();
            var nonce = env.GetProperty("nonce").GetString();
            var ciphertext = env.GetProperty("ciphertext").GetString();
            var tag = env.GetProperty("tag").GetString();

            Console.WriteLine("LittleLinks fleet — envelope interop against live API output");
            Console.WriteLine();

            // The connection string is never dialled: NpgsqlDataSource.Create
            // is lazy, and OpenEnvelope touches only the RSA key.
            var store = new CredentialStore("postgres://u:p@127.0.0.1:5432/none?sslmode=disable", privateKeyPem);

            // 1. The real envelope opens to the real password.
            try
            {
                var opened = store.OpenEnvelope(wrapped, nonce, ciphertext, tag);
                Check("opens a Node-sealed envelope", opened == expected,
                      opened == expected ? $"recovered {opened.Length} chars incl. non-ASCII" : "plaintext mismatch");
            }
            catch (Exception ex)
            {
                Check("opens a Node-sealed envelope", false, ex.GetType().Name + ": " + ex.Message);
            }

            // 2. A tampered GCM tag must throw, not return garbage. This is
            //    what stops a database-level edit silently changing a login.
            try
            {
                var badTag = Convert.FromBase64String(tag);
                badTag[0] ^= 0xff;
                store.OpenEnvelope(wrapped, nonce, ciphertext, Convert.ToBase64String(badTag));
                Check("rejects a tampered auth tag", false, "it decrypted anyway");
            }
            catch (CryptographicException)
            {
                Check("rejects a tampered auth tag", true, "CryptographicException, as LoadAsync catches");
            }

            // 3. A credential sealed for a different fleet key must not open.
            try
            {
                using var other = RSA.Create(2048);
                var otherStore = new CredentialStore(
                    "postgres://u:p@127.0.0.1:5432/none?sslmode=disable",
                    other.ExportPkcs8PrivateKeyPem());
                otherStore.OpenEnvelope(wrapped, nonce, ciphertext, tag);
                Check("rejects a wrong fleet key", false, "it decrypted anyway");
            }
            catch (CryptographicException)
            {
                Check("rejects a wrong fleet key", true, "CryptographicException");
            }

            // 4. A key that is not a key at all must fail at construction
            //    with the operator-facing message, not deep inside a login.
            try
            {
                _ = new CredentialStore("postgres://u:p@127.0.0.1:5432/none?sslmode=disable", "not a pem");
                Check("rejects a malformed private key", false, "it constructed anyway");
            }
            catch (InvalidOperationException ex)
            {
                Check("rejects a malformed private key", ex.Message.Contains("generate-fleet-keypair"),
                      "points the operator at the keygen tool");
            }

            Console.WriteLine();
            Console.WriteLine(_failures == 0 ? "ALL CHECKS PASSED" : $"{_failures} CHECK(S) FAILED");
            return _failures == 0 ? 0 : 1;
        }
    }
}
