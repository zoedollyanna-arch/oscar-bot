# Tammy Brightwood — Second Life Agent

Tammy is Lifeline's **in-world Second Life staff avatar**, run as a C# [LibreMetaverse](https://github.com/cinderblocks/libremetaverse) worker. She logs into Second Life, greets residents, answers questions, and handles IMs/local chat — and she is driven from Discord by the **main Lifeline Assistant bot**, not by her own Discord app.

> Discord-side staff features (tickets, FAQ, redelivery, announcements, applications) live in the **main bot** (`lifeline-discord-bot`). Tammy must **not** duplicate them. She shares the main bot's **Neon** database and reads the **Lifeline backend** for guest context.

## Architecture

```
Resident (Second Life)
    │  IM / local chat
    ▼
TammyAgent (this repo, C# LibreMetaverse worker on Render)
    ├── logs conversations ─────────────► Neon Postgres (SHARED with the main Discord bot)
    ├── reads guest context ────────────► Lifeline backend HTTP (/api/tammy/guest-context)
    ├── AI brain (optional) ────────────► OpenAI Responses API (tiered actions)
    └── polls tammy_commands ◄─────────── main Discord bot  /tammy im | say | mode | takeover …
```

Everything coordinates through the shared Neon tables: `tammy_settings`, `tammy_commands`,
`tammy_conversations`, `tammy_messages`, `tammy_action_requests`, `tammy_waypoints`,
`tammy_guest_cooldowns`. The worker ensures these on startup; the main bot's `db.js` ensures them too.

## Modes
`automated` (AI answers) · `assisted` (staff answer via `/tammy im`) · `manual` (logged out for your Firestorm control) · `away` · `event` · `emergency`.

## Action safety tiers (AI never gets unrestricted authority)
- **Auto**: FAQ, directions, lookups, basic ticket — Tammy does it.
- **Approval**: add cabin guest, replace product, change booking, welcome package — queued for staff.
- **Human only**: refunds, bans, account deletion, payment changes — refused and flagged.

## Build & run locally
```bash
# Fix already applied: source generators pinned to the installed Roslyn (Directory.Packages.props).
dotnet build TammyAgent/TammyAgent.csproj -c Release -f net8.0

# Credentials via environment variables (never commit these):
SL_FIRST_NAME=Tammy SL_LAST_NAME=Brightwood SL_PASSWORD=... \
DATABASE_URL=postgres://...neon.tech/... \
dotnet run --project TammyAgent/TammyAgent.csproj -c Release -f net8.0
```

## Deploy (one Render Web Service, Docker)
Use the root `Dockerfile` for the existing **Discord bot Web Service**. The container starts both the
Node Discord bot and the C# Second Life agent. Node owns Render's `PORT` and `/health`; both processes
share `DATABASE_URL`, and the container is restarted if either process exits. Leave the Render root
directory at the repository root, choose the **Docker** runtime, and do not set an `npm install` build
command because the Dockerfile builds both applications.

Set both the Discord variables from `.env.example` and the TammyAgent variables below in the same
service. Keep all tokens and passwords in protected Render environment variables.

## Environment variables
| Var | Required | Purpose |
|-----|----------|---------|
| `SL_FIRST_NAME` / `SL_LAST_NAME` / `SL_PASSWORD` | yes | Tammy's SL login (last name `Resident` for single-name usernames) |
| `SL_START_LOCATION` | no | `last`, `home`, or a region name (default `last`) |
| `DATABASE_URL` | yes | **Same Neon URL as the main Discord bot** — this is what shares the data |
| `LIFELINE_API_URL` / `LIFELINE_API_SECRET` | no | Lifeline backend for guest context |
| `OPENAI_API_KEY` / `OPENAI_MODEL` | no | Enables the AI brain (default model `gpt-4o-mini`) |
| `TAMMY_MODE` | no | Initial mode (e.g. `assisted`) |
| `PORT` | Render sets it | HTTP health-listener port (defaults to `3000` locally) |
| `TAMMY_HEALTH_SERVER` | no | Set internally to `false` in the combined container; Node owns the port |
