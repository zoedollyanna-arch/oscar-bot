using System.Text;
using LibreMetaverse;
using LittleLinksFleet.Models;

namespace LittleLinksFleet.Services
{
    /// <summary>
    /// One baby avatar: its Second Life session, its HUD, its command queue.
    ///
    /// The supervisor owns a dictionary of these and never touches a
    /// GridClient itself. Each session runs three independent loops on its
    /// own task — connection, commands, heartbeat — so a hung teleport on
    /// one baby cannot stall another baby's feed.
    ///
    /// Why the HUD is re-worn on every login rather than once at setup:
    /// a bot that reconnects overnight after a grid restart would otherwise
    /// come back naked of HUD and silently stop reporting stats, and the
    /// parent would wake up to a baby whose bars never moved. Wearing is
    /// idempotent, so doing it every time costs nothing and removes a whole
    /// class of "it worked yesterday" support tickets.
    /// </summary>
    public sealed class BotSession : IAsyncDisposable
    {
        private readonly ClaimedBot _bot;
        private readonly FleetConfig _cfg;
        private readonly ApiClient _api;
        private readonly CredentialStore _creds;

        private readonly CancellationTokenSource _cts;
        private GridClient _client;
        private volatile bool _connected;
        private volatile bool _hudAttached;
        private int _loginFailures;
        private DateTime _lastInventorySync = DateTime.MinValue;

        private Task _connectionLoop, _commandLoop, _heartbeatLoop;

        /// <summary>Set when the API says desired_state is no longer 'online'.</summary>
        private volatile bool _shutdownRequested;

        public string BotKey => _bot.BotKey;
        public string Label => _bot.Label;
        public bool Online => _connected && _client is { Network.Connected: true };
        public bool Finished => _shutdownRequested && !Online;

        public string Region => _client?.Network?.CurrentSim?.Name ?? "";
        public string Position
        {
            get
            {
                if (_client?.Self == null) return "";
                var p = _client.Self.SimPosition;
                return $"{p.X:0},{p.Y:0},{p.Z:0}";
            }
        }

        public BotSession(ClaimedBot bot, FleetConfig cfg, ApiClient api, CredentialStore creds, CancellationToken parent)
        {
            _bot = bot;
            _cfg = cfg;
            _api = api;
            _creds = creds;
            _cts = CancellationTokenSource.CreateLinkedTokenSource(parent);
        }

        public void Start()
        {
            _connectionLoop = Task.Run(() => ConnectionLoopAsync(_cts.Token));
            _commandLoop    = Task.Run(() => CommandLoopAsync(_cts.Token));
            _heartbeatLoop  = Task.Run(() => HeartbeatLoopAsync(_cts.Token));
        }

        /* ═════════════════════════ Connection ═══════════════════════ */

        private async Task ConnectionLoopAsync(CancellationToken ct)
        {
            while (!ct.IsCancellationRequested && !_shutdownRequested)
            {
                if (!Online)
                {
                    await _api.StatusAsync(BotKey, "connecting", "logging in", "", "", false, "", ct);

                    if (await TryLoginAsync(ct))
                    {
                        _loginFailures = 0;
                        await AfterLoginAsync(ct);
                    }
                    else
                    {
                        _loginFailures++;
                        // Second Life throttles repeated failed logins hard,
                        // and hammering it turns a wrong password into a
                        // temporary IP block that affects every other baby
                        // on this worker. Back off steeply, cap at 5 min.
                        var wait = Math.Min(15 * (int)Math.Pow(2, Math.Min(_loginFailures - 1, 5)), 300);
                        await _api.StatusAsync(BotKey, "error", $"login failed ({_loginFailures})", "", "", false,
                            _client?.Network?.LoginMessage ?? "login rejected", ct);
                        Console.Error.WriteLine($"[{Label}] login failed ({_loginFailures}); retrying in {wait}s");
                        await Delay(wait, ct);
                        continue;
                    }
                }
                await Delay(5, ct);
            }

            await LogoutAsync();
        }

        private async Task<bool> TryLoginAsync(CancellationToken ct)
        {
            var cred = await _creds.LoadAsync(BotKey, ct);
            if (cred == null)
            {
                await _api.StatusAsync(BotKey, "error", "no usable credential", "", "", false,
                    "No login is linked for this baby. Add one from the parent portal.", ct);
                // Nothing to retry quickly — a missing credential needs a
                // human. Wait long enough not to spin the log.
                await Delay(120, ct);
                return false;
            }

            Wire();

            var start = string.IsNullOrWhiteSpace(_bot.StartLocation) ? _cfg.DefaultStartLocation : _bot.StartLocation;
            var lp = _client.Network.DefaultLoginParams(cred.First, cred.Last, cred.Password, "LittleLinks", "1.0.0");
            lp.Start = ResolveStart(start);

            Console.WriteLine($"[{Label}] logging in as {cred.First} {cred.Last} -> {start}");

            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
            timeout.CancelAfter(TimeSpan.FromSeconds(60));
            try
            {
                var ok = await _client.Network.LoginAsync(lp, timeout.Token);
                if (!ok)
                {
                    Console.Error.WriteLine($"[{Label}] rejected: {_client.Network.LoginMessage}");
                    return false;
                }
                _connected = true;
                Console.WriteLine($"[{Label}] online in {Region} at {Position}");
                return true;
            }
            catch (OperationCanceledException) when (!ct.IsCancellationRequested)
            {
                Console.Error.WriteLine($"[{Label}] login timed out");
                return false;
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"[{Label}] login error: {ex.Message}");
                return false;
            }
            finally
            {
                // The plaintext password lived on this object; drop the
                // reference as soon as the login attempt is over.
                cred.Password = "";
            }
        }

        private void Wire()
        {
            _client = new GridClient();

            // Babies are driven, not autonomous: everything that would make
            // the client chatty on the wire is off. This matters at scale —
            // twenty avatars each decoding every object update on a busy sim
            // is what makes a fleet host fall over.
            //
            // Note this fork groups settings into nested objects
            // (Settings.World, Settings.Agent, …) rather than the flat
            // ALL_CAPS fields older libomv code uses.
            _client.Settings.Agent.MultipleSims = false;
            _client.Settings.Agent.SendUpdates = true;

            // Do not let the library push an appearance automatically.
            //
            // AppearanceManager hooks CapabilitiesReceived and, on a
            // server-baking region like Second Life, immediately sends the
            // agent's outfit built from the Current Outfit Folder. When the
            // region has not served the inventory capability the COF reads
            // back empty, so what gets sent is a *partial* outfit — and the
            // sim then detaches everything missing from it. That is why
            // logging a baby on and off was stripping items the parent had
            // dressed her in.
            //
            // Re-enabled in AfterLoginAsync only once the COF is proven
            // readable. Until then Second Life keeps the appearance it
            // already has stored, which is the correct one.
            _client.Settings.Agent.SendAppearance = false;
            _client.Settings.World.AlwaysDecodeObjects = false;
            _client.Settings.World.AlwaysRequestObjects = false;
            _client.Settings.World.TrackObjects = false;
            _client.Settings.World.TrackAvatars = false;
            _client.Settings.World.StoreLandPatches = false;
            _client.Settings.Parcel.TrackParcels = false;
            _client.Settings.Parcel.AlwaysRequestAcl = false;
            _client.Settings.Parcel.AlwaysRequestDwell = false;
            _client.Settings.AssetCache.Enabled = true;

            _client.Network.Disconnected += (_, e) =>
            {
                _connected = false;
                _hudAttached = false;
                Console.WriteLine($"[{Label}] disconnected: {e.Reason} {e.Message}");
                _ = _api.StatusAsync(BotKey, "offline", $"disconnected: {e.Reason}", "", "", false, e.Message ?? "",
                                     CancellationToken.None);
            };
        }

        /// <summary>
        /// Fetch inventory, wear the HUD, report online. Failures here are
        /// reported but do not tear the session down — a baby that is logged
        /// in without its HUD is still better than one that is not logged in,
        /// and the parent can see the problem in the portal.
        /// </summary>
        private async Task AfterLoginAsync(CancellationToken ct)
        {
            // Report online FIRST. The avatar is in world the moment login
            // returns; making that visible wait on an inventory walk meant a
            // slow or stalled walk left the portal showing "connecting"
            // forever for a baby who was demonstrably standing in a region.
            await _api.StatusAsync(BotKey, "online", "online", Region, Position, false, "", ct);

            try
            {
                // Settle: inventory caps are not ready the instant login
                // returns, and asking too early yields an empty root.
                await Delay(10, ct);

                // Cheapest correct path first. A baby whose HUD was already
                // attached when its owner logged out comes back wearing it,
                // and asking the worn set is one call — no folder walk, and
                // it cannot be defeated by a slow inventory fetch.
                // Up to three passes. A region that declines the inventory
                // capability immediately after login ("cap not found") often
                // serves it a minute later, and both the worn-set check and
                // the folder walk come back empty until it does. Concluding
                // "HUD not found" from that transient state marks a perfectly
                // healthy baby as broken in the parent's portal.
                List<InventoryItem> items = new();
                var inventoryReady = false;

                for (var attempt = 1; attempt <= 3; attempt++)
                {
                    if (await HudAlreadyWornAsync(ct)) { _hudAttached = true; break; }

                    items = await FetchInventoryAsync(ct);
                    if (items.Count > 0)
                    {
                        inventoryReady = true;
                        _hudAttached = await WearHudAsync(items, ct);
                        break;
                    }

                    if (attempt < 3)
                    {
                        Console.WriteLine($"[{Label}] inventory not available yet (attempt {attempt}/3); retrying in 30s");
                        await Delay(30, ct);
                    }
                }

                // "HUD not found" and "could not look" are different failures
                // and want different answers from the parent: one means send
                // the baby a HUD, the other means wait or move region.
                var detail = _hudAttached  ? "online with HUD"
                           : inventoryReady ? "online, HUD not found"
                                            : "online, inventory unavailable";
                var error  = _hudAttached  ? ""
                           : inventoryReady ? $"No attachable inventory object matching \"{_cfg.HudItemName}\"."
                                            : "Second Life did not serve this region's inventory capability, so the HUD could not be located. Retrying automatically.";

                await _api.StatusAsync(BotKey, "online", detail, Region, Position, _hudAttached, error, ct);

                // Now, and only now, hand appearance back to the library. A
                // non-empty COF or a successful inventory walk both prove the
                // region is serving inventory, so an outfit built from it will
                // be complete rather than a partial one that strips the baby.
                if (_lastWornCount > 0 || inventoryReady)
                {
                    _client.Settings.Agent.SendAppearance = true;
                    try
                    {
                        // Bounded wait, not a bounded bake. A server-side bake
                        // can legitimately take a while and there is no reason
                        // to cancel it -- but nothing after this point may sit
                        // behind it, which is the same mistake that once left a
                        // logged-in baby reporting "connecting" forever.
                        var appearance = _client.Appearance.RequestSetAppearance(false);
                        var finished = await Task.WhenAny(appearance, Task.Delay(TimeSpan.FromSeconds(90), ct));

                        if (finished == appearance)
                        {
                            await appearance;
                            Console.WriteLine($"[{Label}] appearance enabled ({_lastWornCount} worn items seen)");
                        }
                        else
                        {
                            Console.WriteLine($"[{Label}] appearance still baking after 90s; carrying on without it");
                        }
                    }
                    catch (Exception ex) when (ex is not OperationCanceledException)
                    {
                        Console.Error.WriteLine($"[{Label}] appearance request failed: {ex.Message}");
                    }
                }
                else
                {
                    Console.Error.WriteLine(
                        $"[{Label}] leaving appearance untouched - the outfit folder could not be read, " +
                        "and sending a partial outfit would detach items the parent dressed her in");
                }

                // Inventory is a convenience for the wardrobe screen, not a
                // precondition for the baby being usable. Best effort, and
                // never allowed to hold up anything above it.
                await SyncInventoryAsync(items, ct);
                _lastInventorySync = DateTime.UtcNow;
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                Console.Error.WriteLine($"[{Label}] post-login setup failed: {ex.Message}");
                await _api.StatusAsync(BotKey, "online", "online, setup incomplete",
                    Region, Position, _hudAttached, ex.Message, ct);
            }
        }

        private async Task LogoutAsync()
        {
            try
            {
                if (_client?.Network?.Connected == true) _client.Network.Logout();
            }
            catch { /* shutting down anyway */ }
            _connected = false;
            await _api.StatusAsync(BotKey, "offline", "worker released", "", "", false, "", CancellationToken.None);
        }

        /* ═══════════════════════════ Inventory ══════════════════════ */

        /// <summary>
        /// Walk the whole inventory tree. Capped at 3000 items and depth 12:
        /// a parent with an enormous inventory should get a slow wardrobe,
        /// not a worker that spends ten minutes fetching folders and misses
        /// every heartbeat while it does.
        /// </summary>
        /// <summary>
        /// Is the HUD already attached? One call, no folder walk.
        ///
        /// This is the normal case, not an edge case: parents attach the HUD
        /// to the baby and log out, and Second Life restores attachments on
        /// the next login. Checking it first also means a baby stays usable
        /// when the inventory fetch is slow or comes back empty.
        /// </summary>
        /// <summary>
        /// Worn items seen by the last <see cref="HudAlreadyWornAsync"/> call.
        /// Zero means the Current Outfit Folder could not be read, which is a
        /// different thing from the avatar wearing nothing — see the
        /// SendAppearance note where the client is configured.
        /// </summary>
        private int _lastWornCount;

        private async Task<bool> HudAlreadyWornAsync(CancellationToken ct)
        {
            var want = _cfg.HudItemName.Trim();
            _lastWornCount = 0;
            try
            {
                using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
                timeout.CancelAfter(TimeSpan.FromSeconds(45));

                var worn = await _client.Appearance.RequestAgentWornAsync(timeout.Token);
                _lastWornCount = worn?.Count ?? 0;
                foreach (var entry in worn ?? new List<InventoryBase>())
                {
                    var name = entry?.Name ?? "";
                    if (HudNameMatches(name, want))
                    {
                        Console.WriteLine($"[{Label}] HUD already worn: {name}");
                        return true;
                    }
                }
                Console.WriteLine($"[{Label}] HUD not among {(worn?.Count ?? 0)} worn items; checking inventory");
                return false;
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                Console.Error.WriteLine($"[{Label}] worn-item check failed: {ex.Message}");
                return false;
            }
        }

        private async Task<List<InventoryItem>> FetchInventoryAsync(CancellationToken ct)
        {
            var found = new List<InventoryItem>();
            var store = _client.Inventory.Store;
            if (store?.RootFolder == null)
            {
                Console.Error.WriteLine($"[{Label}] inventory root not available yet");
                return found;
            }

            var queue = new Queue<(UUID Folder, string Path, int Depth)>();
            queue.Enqueue((store.RootFolder.UUID, "", 0));
            var seen = new HashSet<UUID>();

            // Hard wall-clock budget for the whole walk. Second Life can
            // leave a folder request outstanding indefinitely, and an
            // unbounded walk is what left a logged-in baby stuck reporting
            // "connecting" — the walk never returned, so nothing after it ran.
            var deadline = DateTime.UtcNow.AddMinutes(2);

            while (queue.Count > 0 && found.Count < 3000)
            {
                if (DateTime.UtcNow > deadline)
                {
                    Console.Error.WriteLine($"[{Label}] inventory walk hit its 2 minute budget; using {found.Count} items so far");
                    break;
                }

                var (folder, path, depth) = queue.Dequeue();
                if (depth > 12 || !seen.Add(folder)) continue;

                List<InventoryBase> contents;
                try
                {
                    // Per-folder timeout as well as the overall budget: one
                    // stuck folder must not consume the whole allowance.
                    using var perFolder = CancellationTokenSource.CreateLinkedTokenSource(ct);
                    perFolder.CancelAfter(TimeSpan.FromSeconds(20));

                    contents = await _client.Inventory.FolderContentsAsync(
                        folder, _client.Self.AgentID, true, true, InventorySortOrder.ByName, perFolder.Token);
                }
                catch (OperationCanceledException) when (!ct.IsCancellationRequested)
                {
                    Console.Error.WriteLine($"[{Label}] folder fetch timed out; skipping");
                    continue;
                }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    Console.Error.WriteLine($"[{Label}] folder fetch failed: {ex.Message}");
                    continue;
                }
                if (contents == null) continue;

                foreach (var entry in contents)
                {
                    switch (entry)
                    {
                        case InventoryFolder sub:
                            queue.Enqueue((sub.UUID, string.IsNullOrEmpty(path) ? sub.Name : $"{path}/{sub.Name}", depth + 1));
                            break;
                        case InventoryItem item:
                            _folderOf[item.UUID] = path;
                            found.Add(item);
                            break;
                    }
                }
            }
            return found;
        }

        private readonly Dictionary<UUID, string> _folderOf = new();

        /// <summary>
        /// Push the cached wardrobe to the API so the portal can render it.
        ///
        /// An empty walk is never published. The sync is a full replace on the
        /// server, and Second Life fails inventory by returning nothing rather
        /// than by erroring — when a region declines to serve the inventory
        /// capability the walk completes "successfully" with zero items. Left
        /// unguarded that deletes a parent's entire wardrobe from the portal,
        /// which is what happened to a 1063-item inventory during testing.
        /// A baby genuinely owning nothing is not a case worth supporting.
        /// </summary>
        private async Task SyncInventoryAsync(List<InventoryItem> items, CancellationToken ct)
        {
            if (items.Count == 0)
            {
                Console.Error.WriteLine(
                    $"[{Label}] inventory walk returned 0 items - not publishing, " +
                    "keeping the last good wardrobe (region likely not serving the inventory capability)");
                return;
            }

            var snapshot = new List<InventorySnapshotItem>(items.Count);
            foreach (var item in items)
            {
                bool worn;
                try { worn = _client.Appearance.IsItemWorn(item.UUID) || _client.Appearance.isItemAttached(item.UUID); }
                catch { worn = false; }

                snapshot.Add(new InventorySnapshotItem
                {
                    item_key     = item.UUID.ToString(),
                    name         = item.Name ?? "",
                    asset_type   = item.AssetType.ToString(),
                    folder       = _folderOf.TryGetValue(item.UUID, out var f) ? f : "",
                    is_worn      = worn,
                    attach_point = worn && item is InventoryObject obj ? obj.AttachPoint.ToString() : "",
                });
            }
            await _api.InventoryAsync(BotKey, snapshot, ct);
            Console.WriteLine($"[{Label}] inventory synced ({snapshot.Count} items)");
        }

        /// <summary>
        /// Reduce a HUD name to letters, digits and single spaces, lowercased,
        /// so punctuation and bracket style stop mattering. The real product is
        /// named "[Lifeline RP] Main Hybrid HUD v1.3.19"; a configured name of
        /// "Lifeline RP Hybrid HUD" has to find it, and plain prefix matching
        /// never could — the brackets alone defeat it.
        /// </summary>
        private static string NormalizeHudName(string s)
        {
            if (string.IsNullOrEmpty(s)) return "";
            var sb = new StringBuilder(s.Length);
            var lastWasSpace = true;
            foreach (var ch in s)
            {
                if (char.IsLetterOrDigit(ch)) { sb.Append(char.ToLowerInvariant(ch)); lastWasSpace = false; }
                else if (!lastWasSpace) { sb.Append(' '); lastWasSpace = true; }
            }
            return sb.ToString().Trim();
        }

        /// <summary>
        /// Does <paramref name="name"/> name the configured HUD?
        ///
        /// Every word of the configured name must appear in the item name.
        /// That is deliberately looser than a prefix and deliberately tighter
        /// than a substring: it survives version suffixes, bracket styles and
        /// inserted words like "Main", while still refusing an item that is
        /// merely adjacent. Callers restrict the candidate set to attachable
        /// objects, so a notecard named after the HUD cannot win.
        /// </summary>
        private static bool HudNameMatches(string name, string want)
        {
            var n = NormalizeHudName(name);
            var w = NormalizeHudName(want);
            if (n.Length == 0 || w.Length == 0) return false;
            if (n == w || n.StartsWith(w, StringComparison.Ordinal)) return true;

            var haystack = n.Split(' ', StringSplitOptions.RemoveEmptyEntries).ToHashSet(StringComparer.Ordinal);
            return w.Split(' ', StringSplitOptions.RemoveEmptyEntries).All(haystack.Contains);
        }

        /// <summary>
        /// Find the HUD by name and wear it.
        ///
        /// Two rules beyond name matching, both learned from the real product:
        /// only attachable objects are considered, because the HUD ships
        /// alongside a notecard and a landmark with near-identical names; and
        /// when several versions match, the most recently received one wins,
        /// since that is the update the parent was just given.
        /// </summary>
        private async Task<bool> WearHudAsync(List<InventoryItem> items, CancellationToken ct)
        {
            var want = _cfg.HudItemName.Trim();

            var candidates = items
                .Where(i => i?.Name != null && i.AssetType == AssetType.Object)
                .ToList();

            // Exact name always wins outright — if a parent configured the
            // full name, honour it rather than second-guessing by date.
            var hud = candidates.FirstOrDefault(i =>
                        string.Equals(i.Name, want, StringComparison.OrdinalIgnoreCase))
                   ?? candidates.Where(i => HudNameMatches(i.Name, want))
                                .OrderByDescending(i => i.CreationDate)
                                .FirstOrDefault();

            if (hud == null)
            {
                Console.Error.WriteLine(
                    $"[{Label}] no attachable inventory object matching \"{want}\" " +
                    $"among {candidates.Count} objects ({items.Count} items total)");
                return false;
            }

            try
            {
                if (_client.Appearance.isItemAttached(hud.UUID))
                {
                    Console.WriteLine($"[{Label}] HUD already attached");
                    return true;
                }

                // Attaching to Default lets the HUD's own scripted attach
                // point win, which is what the HUD expects.
                _client.Appearance.Attach(hud, AttachmentPoint.Default, replace: false);
                await Delay(6, ct);

                var ok = _client.Appearance.isItemAttached(hud.UUID);
                Console.WriteLine($"[{Label}] HUD {(ok ? "attached" : "attach not confirmed")}: {hud.Name}");
                return ok;
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                Console.Error.WriteLine($"[{Label}] HUD attach failed: {ex.Message}");
                return false;
            }
        }

        /* ═══════════════════════════ Commands ═══════════════════════ */

        private async Task CommandLoopAsync(CancellationToken ct)
        {
            while (!ct.IsCancellationRequested && !_shutdownRequested)
            {
                await Delay((int)_cfg.CommandPollInterval.TotalSeconds, ct);
                if (ct.IsCancellationRequested) break;

                // Commands are only drained while online. Draining offline
                // would mark them done against an avatar that never acted.
                if (!Online) continue;

                List<BotCommand> commands;
                try { commands = await _api.CommandsAsync(BotKey, ct); }
                catch (OperationCanceledException) { break; }

                foreach (var cmd in commands)
                {
                    if (ct.IsCancellationRequested) break;
                    CommandResult result;
                    try
                    {
                        result = await ExecuteAsync(cmd, ct);
                    }
                    catch (OperationCanceledException) { break; }
                    catch (Exception ex)
                    {
                        result = CommandResult.Failure(ex.Message);
                    }
                    Console.WriteLine($"[{Label}] {cmd.Command} -> {(result.Ok ? "ok" : "FAILED")}: {result.Message}");
                    await _api.CommandResultAsync(cmd.Id, result.Ok, result.Message, ct);
                }

                if (DateTime.UtcNow - _lastInventorySync > _cfg.InventorySyncInterval)
                {
                    _lastInventorySync = DateTime.UtcNow;
                    try
                    {
                        var fresh = await FetchInventoryAsync(ct);
                        await SyncInventoryAsync(fresh, ct);

                        // A baby without its HUD reports no stats, so it is
                        // not usable even though it is logged in. Retry here
                        // rather than requiring a restart: the usual cause is
                        // a region that was not serving inventory at login.
                        if (!_hudAttached && fresh.Count > 0)
                        {
                            _hudAttached = await HudAlreadyWornAsync(ct) || await WearHudAsync(fresh, ct);
                            if (_hudAttached)
                                await _api.StatusAsync(BotKey, "online", "online with HUD",
                                                       Region, Position, true, "", ct);
                        }
                    }
                    catch (OperationCanceledException) { break; }
                    catch (Exception ex) { Console.Error.WriteLine($"[{Label}] inventory resync: {ex.Message}"); }
                }
            }
        }

        private async Task<CommandResult> ExecuteAsync(BotCommand cmd, CancellationToken ct)
        {
            switch (cmd.Command)
            {
                case "attach_hud":
                    return await WearHudAsync(await FetchInventoryAsync(ct), ct)
                        ? CommandResult.Success("HUD attached")
                        : CommandResult.Failure($"No inventory item named \"{_cfg.HudItemName}\"");

                case "wear_item":     return await WearItemAsync(cmd, ct);
                case "detach_item":   return DetachItem(cmd);
                case "wear_outfit":   return await WearOutfitAsync(cmd, ct);
                case "sit":           return await SitAsync(cmd, ct);
                case "stand":         return Stand();
                case "teleport":      return await TeleportAsync(cmd, ct);
                case "say":           return Say(cmd);
                case "im":            return SendIm(cmd);
                case "animate":       return Animate(cmd);
                case "sync_inventory":
                    await SyncInventoryAsync(await FetchInventoryAsync(ct), ct);
                    return CommandResult.Success("inventory synced");

                case "rez":           return await RezAsync(cmd, ct);
                case "give_item":     return GiveItem(cmd);
                case "delete_item":   return await DeleteItemAsync(cmd, ct);

                case "logout":
                    _shutdownRequested = true;
                    return CommandResult.Success("logging out");

                default:
                    return CommandResult.Failure($"unknown command '{cmd.Command}'");
            }
        }

        private async Task<InventoryItem> FindItemAsync(string idOrName, CancellationToken ct)
        {
            var items = await FetchInventoryAsync(ct);
            if (UUID.TryParse(idOrName, out var id))
            {
                var byId = items.FirstOrDefault(i => i.UUID == id);
                if (byId != null) return byId;
            }
            return items.FirstOrDefault(i => string.Equals(i.Name, idOrName, StringComparison.OrdinalIgnoreCase))
                ?? items.FirstOrDefault(i => i.Name != null && i.Name.StartsWith(idOrName, StringComparison.OrdinalIgnoreCase));
        }

        private async Task<CommandResult> WearItemAsync(BotCommand cmd, CancellationToken ct)
        {
            var target = cmd.ArgString("item", cmd.ArgString("item_key"));
            if (string.IsNullOrWhiteSpace(target)) return CommandResult.Failure("item required");

            var item = await FindItemAsync(target, ct);
            if (item == null) return CommandResult.Failure($"no inventory item '{target}'");

            var pointName = cmd.ArgString("attach_point");
            if (item.InventoryType == InventoryType.Object)
            {
                var point = Enum.TryParse<AttachmentPoint>(pointName, true, out var p) ? p : AttachmentPoint.Default;
                _client.Appearance.Attach(item, point, replace: cmd.ArgBool("replace", true));
                return CommandResult.Success($"attached {item.Name}");
            }

            _client.Appearance.AddToOutfit(item, replace: cmd.ArgBool("replace", true));
            return CommandResult.Success($"wearing {item.Name}");
        }

        private CommandResult DetachItem(BotCommand cmd)
        {
            var target = cmd.ArgString("item", cmd.ArgString("item_key"));
            if (!UUID.TryParse(target, out var id)) return CommandResult.Failure("item_key must be a UUID");
            _client.Appearance.Detach(id);
            return CommandResult.Success("detached");
        }

        /// <summary>
        /// Apply a saved outfit. Replaces rather than adds, because that is
        /// what "wear this outfit" means to a parent — adding would layer a
        /// dress over pyjamas.
        /// </summary>
        private async Task<CommandResult> WearOutfitAsync(BotCommand cmd, CancellationToken ct)
        {
            var wanted = cmd.ArgList("items");
            if (wanted.Count == 0) return CommandResult.Failure("outfit has no items");

            var inventory = await FetchInventoryAsync(ct);
            var byId = inventory.Where(i => i.UUID != UUID.Zero).ToDictionary(i => i.UUID.ToString(), i => i);

            var resolved = new List<InventoryItem>();
            var missing = new List<string>();
            foreach (var key in wanted)
            {
                if (byId.TryGetValue(key, out var item)) resolved.Add(item);
                else missing.Add(key);
            }

            if (resolved.Count == 0)
                return CommandResult.Failure("none of the outfit's items are still in inventory");

            await _client.Appearance.ReplaceOutfitAsync(resolved);

            // Re-wearing the outfit takes the HUD off with everything else,
            // so put it back — otherwise changing clothes silently stops the
            // baby's stats, which is the most confusing possible symptom.
            _hudAttached = await WearHudAsync(inventory, ct);

            return missing.Count == 0
                ? CommandResult.Success($"wearing {resolved.Count} items")
                : CommandResult.Success($"wearing {resolved.Count} items; {missing.Count} no longer in inventory");
        }

        /// <summary>
        /// Sit on a target prim. The furniture script publishes the marker
        /// prim's key, so the portal and the HUD both send a real object
        /// UUID here rather than a position guess.
        /// </summary>
        private async Task<CommandResult> SitAsync(BotCommand cmd, CancellationToken ct)
        {
            var target = cmd.ArgString("target", cmd.ArgString("object_key"));
            if (!UUID.TryParse(target, out var id)) return CommandResult.Failure("target must be an object UUID");

            var offset = new Vector3(cmd.ArgFloat("offset_x", 0f), cmd.ArgFloat("offset_y", 0f), cmd.ArgFloat("offset_z", 0f));
            _client.Self.RequestSit(id, offset);
            await Delay(2, ct);
            _client.Self.Sit();
            return CommandResult.Success("sat");
        }

        private CommandResult Stand()
        {
            _client.Self.Stand();
            return CommandResult.Success("standing");
        }

        private async Task<CommandResult> TeleportAsync(BotCommand cmd, CancellationToken ct)
        {
            var region = cmd.ArgString("region");
            if (string.IsNullOrWhiteSpace(region)) return CommandResult.Failure("region required");

            var pos = new Vector3(cmd.ArgFloat("x", 128f), cmd.ArgFloat("y", 128f), cmd.ArgFloat("z", 30f));
            var ok = await _client.Self.TeleportAsync(region, pos, ct);
            return ok ? CommandResult.Success($"teleported to {region}")
                      : CommandResult.Failure($"teleport to {region} failed: {_client.Self.TeleportMessage}");
        }

        private CommandResult Say(BotCommand cmd)
        {
            var text = cmd.ArgString("text");
            if (string.IsNullOrWhiteSpace(text)) return CommandResult.Failure("text required");
            var channel = (int)cmd.ArgFloat("channel", 0);
            _client.Self.Chat(text, channel, ChatType.Normal);
            return CommandResult.Success("said");
        }

        private CommandResult SendIm(BotCommand cmd)
        {
            var to = cmd.ArgString("to");
            var text = cmd.ArgString("text");
            if (!UUID.TryParse(to, out var target)) return CommandResult.Failure("to must be an avatar UUID");
            if (string.IsNullOrWhiteSpace(text)) return CommandResult.Failure("text required");
            _client.Self.InstantMessage(target, text);
            return CommandResult.Success("sent");
        }

        private CommandResult Animate(BotCommand cmd)
        {
            var anim = cmd.ArgString("animation");
            if (!UUID.TryParse(anim, out var id)) return CommandResult.Failure("animation must be a UUID");
            if (cmd.ArgBool("stop")) _client.Self.AnimationStop(id, true);
            else _client.Self.AnimationStart(id, true);
            return CommandResult.Success("ok");
        }

        /* ── Destructive verbs ──────────────────────────────────────
           These three can lose a parent real, paid-for content. The
           portal asks for confirmation before queueing them; the guard
           here is the second half of that — a command that arrives
           without confirm:true is refused, so a replayed or
           hand-crafted queue row cannot delete anything.            */

        private async Task<CommandResult> RezAsync(BotCommand cmd, CancellationToken ct)
        {
            if (!cmd.ArgBool("confirm")) return CommandResult.Failure("rez requires confirm:true");

            var target = cmd.ArgString("item", cmd.ArgString("item_key"));
            var item = await FindItemAsync(target, ct);
            if (item == null) return CommandResult.Failure($"no inventory item '{target}'");

            var sim = _client.Network.CurrentSim;
            if (sim == null) return CommandResult.Failure("not in a region");

            // Default to just in front of the avatar rather than 0,0,0,
            // which on most sims is underground.
            var here = _client.Self.SimPosition;
            var pos = new Vector3(cmd.ArgFloat("x", here.X + 1.5f),
                                  cmd.ArgFloat("y", here.Y),
                                  cmd.ArgFloat("z", here.Z));

            _client.Inventory.RequestRezFromInventory(sim, Quaternion.Identity, pos, item);
            return CommandResult.Success($"rezzed {item.Name} at {pos.X:0},{pos.Y:0},{pos.Z:0}");
        }

        private CommandResult GiveItem(BotCommand cmd)
        {
            if (!cmd.ArgBool("confirm")) return CommandResult.Failure("give_item requires confirm:true");

            var target = cmd.ArgString("item", cmd.ArgString("item_key"));
            var to = cmd.ArgString("to");
            if (!UUID.TryParse(target, out var itemId)) return CommandResult.Failure("item_key must be a UUID");
            if (!UUID.TryParse(to, out var recipient)) return CommandResult.Failure("to must be an avatar UUID");

            var name = cmd.ArgString("name", "item");
            var assetType = Enum.TryParse<AssetType>(cmd.ArgString("asset_type"), true, out var t) ? t : AssetType.Object;

            _client.Inventory.GiveItem(itemId, name, assetType, recipient, true);
            return CommandResult.Success($"offered {name}");
        }

        private async Task<CommandResult> DeleteItemAsync(BotCommand cmd, CancellationToken ct)
        {
            if (!cmd.ArgBool("confirm")) return CommandResult.Failure("delete_item requires confirm:true");

            var target = cmd.ArgString("item", cmd.ArgString("item_key"));
            if (!UUID.TryParse(target, out var itemId)) return CommandResult.Failure("item_key must be a UUID");

            // Moved to Trash, never EmptyTrash. The parent asked to delete
            // one item; emptying the trash would also destroy everything
            // they had deleted previously and might still want back.
            var trash = _client.Inventory.FindFolderForType(FolderType.Trash);
            if (trash != UUID.Zero)
            {
                await _client.Inventory.MoveItemAsync(itemId, trash, ct);
                return CommandResult.Success("moved to trash");
            }

            await _client.Inventory.RemoveItemAsync(itemId, ct);
            return CommandResult.Success("removed");
        }

        /* ══════════════════════════ Heartbeat ═══════════════════════ */

        private async Task HeartbeatLoopAsync(CancellationToken ct)
        {
            while (!ct.IsCancellationRequested && !_shutdownRequested)
            {
                await Delay((int)_cfg.HeartbeatInterval.TotalSeconds, ct);
                if (ct.IsCancellationRequested) break;

                var desired = await _api.HeartbeatAsync(BotKey, Region, Position, ct);

                // A null answer is a failed call, not a shutdown order. Only
                // an explicit non-'online' state parks the baby — otherwise
                // a brief API outage would log out every bot on the grid.
                if (desired != null && desired != "online")
                {
                    Console.WriteLine($"[{Label}] desired_state is '{desired}' — shutting down");
                    _shutdownRequested = true;
                    break;
                }
            }
        }

        /* ══════════════════════════ Helpers ═════════════════════════ */

        // Accepts last/home, a region, region/x/y/z, or a maps.secondlife.com URL.
        private static string ResolveStart(string loc)
        {
            var l = (loc ?? "").Trim();
            if (l.Length == 0) return "last";
            if (l.Equals("last", StringComparison.OrdinalIgnoreCase) || l.Equals("home", StringComparison.OrdinalIgnoreCase))
                return l.ToLowerInvariant();

            if (Uri.TryCreate(l, UriKind.Absolute, out var url)
                && url.Host.Equals("maps.secondlife.com", StringComparison.OrdinalIgnoreCase))
            {
                l = Uri.UnescapeDataString(url.AbsolutePath).Trim('/')
                       .Replace("secondlife/", "", StringComparison.OrdinalIgnoreCase);
            }

            var parts = l.Split('/', StringSplitOptions.RemoveEmptyEntries);
            var region = parts.Length > 0 ? parts[0] : l;
            var x = parts.Length > 1 && int.TryParse(parts[1], out var px) ? px : 128;
            var y = parts.Length > 2 && int.TryParse(parts[2], out var py) ? py : 128;
            var z = parts.Length > 3 && int.TryParse(parts[3], out var pz) ? pz : 30;
            return $"uri:{region}&{x}&{y}&{z}";
        }

        private static async Task Delay(int seconds, CancellationToken ct)
        {
            try { await Task.Delay(TimeSpan.FromSeconds(seconds), ct); }
            catch (OperationCanceledException) { }
        }

        public async ValueTask DisposeAsync()
        {
            _shutdownRequested = true;
            _cts.Cancel();
            try
            {
                await Task.WhenAll(
                    _connectionLoop ?? Task.CompletedTask,
                    _commandLoop ?? Task.CompletedTask,
                    _heartbeatLoop ?? Task.CompletedTask).WaitAsync(TimeSpan.FromSeconds(20));
            }
            catch { /* best effort on shutdown */ }
            _cts.Dispose();
        }
    }
}
