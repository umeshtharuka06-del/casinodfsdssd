# engine-royal — Royal 1 result/settlement engine

A standalone service that **creates and settles game rounds** for Royal 1. It runs
continuously on a VPS, shares the **same PostgreSQL database** as the website, and is
the *only* component that generates results or processes settlement payouts.

> **Database note:** Royal 1 runs on **PostgreSQL** (Prisma). The engine shares the
> website's database; the website owns the schema and its SQL migrations — the
> engine only generates its own Prisma client from an identical schema copy.

```
        ┌─────────────────────┐
        │  Website (Vercel)   │   reads rounds/history/balances, places bets,
        │  Next.js + APIs     │   handles real-time manual crash cash-out
        └──────────┬──────────┘
                   │  (read + bet only)
                   ▼
        ┌─────────────────────┐
        │  Shared PostgreSQL  │
        └──────────┬──────────┘
                   ▲  (create + settle + payouts)
                   │
        ┌──────────┴──────────┐
        │  engine-royal (VPS) │   creates rounds, settles rounds, processes
        │  PM2 worker         │   payouts, runs on a schedule, logs, /health
        └─────────────────────┘
```

## Responsibilities

| Engine (this service, VPS) | Website (Vercel) |
| --- | --- |
| Create rounds (color, number, crash) | Display rounds & history |
| Promote crash BETTING→RUNNING | Display user balances / game info |
| Settle rounds & generate results | Place bets (writes to the round the engine opened) |
| Process settlement payouts (incl. auto-cashout) | Manual crash cash-out (real-time user action) |
| Logging + `/health` | — |

The website **never** creates or settles rounds during a request. If the engine is
stopped, no new rounds open and bets are politely rejected with
`The next round is being prepared…` until it is running again.

> **Why bets & manual cash-out stay on the website:** they are triggered by a live
> user request and cannot be moved to a scheduled worker. They only *read* the
> engine-created round and write the user's own bet/cash-out — they never create or
> settle rounds. All result generation and settlement payouts live here in the engine.

## Folder structure

```
engine-royal/
├── ecosystem.config.js        # PM2 process definition
├── package.json
├── tsconfig.json
├── .env.example               # copy to .env
├── prisma/
│   └── schema.prisma          # exact copy of the website schema (shared DB)
├── scripts/
│   ├── settle-worker.ts       # ← the long-running VPS process (PM2 runs this)
│   ├── create-rounds.ts       # one-shot: ensure current rounds exist
│   └── process-rounds.ts      # one-shot: settle all due rounds
├── src/
│   ├── db.ts  fair.ts  wallet.ts  settings.ts   # shared helpers (copies)
│   ├── logger.ts             # structured logs → logs/
│   ├── health.ts             # GET /health server
│   ├── runner.ts             # createAllRounds() / processAllRounds() / tick()
│   ├── engine/
│   │   ├── prediction-engine.ts   # color + number result logic (unchanged)
│   │   └── crash-engine.ts        # crash math (unchanged)
│   └── games/
│       ├── color-game.ts   number-game.ts   crash-game.ts  # create + settle
└── logs/
    ├── engine.log  settlement.log  error.log
```

## Environment variables (`.env`)

Separate from the website's `.env`. Copy `.env.example` → `.env`:

| Var | Purpose |
| --- | --- |
| `DATABASE_URL` | **Same** PostgreSQL connection string the website uses |
| `JWT_SECRET` / `FAIR_SECRET` | Match the website (kept for parity) |
| `ENGINE_INTERVAL` | Tick interval in ms (default `1000`; keep ≤ 2000 so crash stays responsive) |
| `HEALTH_PORT` | Port for `GET /health` (default `4000`) |
| `NODE_ENV` | `production` |

## Local run

```bash
cd engine-royal
cp .env.example .env          # then edit DATABASE_URL etc.
npm install                   # also runs `prisma generate`
npm run worker                # start the continuous worker
# one-shot helpers:
npm run create-rounds         # ensure current rounds exist, then exit
npm run process-rounds        # settle all due rounds, then exit
```

## VPS deployment (PM2)

```bash
# 1. System prerequisites (Ubuntu example)
sudo apt update && sudo apt install -y git
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm i -g pm2

# 2. Get the code + install
git clone <your-repo> royal && cd royal/engine-royal
cp .env.example .env          # edit DATABASE_URL to the SHARED PostgreSQL
npm install                   # installs deps + generates Prisma client

# 3. Start under PM2 (auto-restart on crash)
pm2 start ecosystem.config.js
pm2 save                      # remember the process list

# 4. Start on server reboot
pm2 startup                   # prints a command — copy/paste & run it
pm2 save

# Operate
pm2 status
pm2 logs royal-engine         # live logs
pm2 restart royal-engine
pm2 stop royal-engine
```

`autorestart: true` + `pm2 startup`/`pm2 save` ensure the engine comes back after a
crash **and** after a server reboot.

## Health monitoring

```bash
curl http://localhost:4000/health
```
```json
{ "status": "ok", "engine": "running", "database": "connected" }
```
Returns HTTP **200** when healthy, **503** when degraded (DB unreachable or engine
stopped). Point an uptime monitor at this endpoint. Open the port in your firewall
only if you monitor it externally.

## Logging

Structured JSON lines, one per event, in `engine-royal/logs/`:

- `engine.log` — startup, ticks, round creation, promotions
- `settlement.log` — one line per settled round (game, period, result, #bets)
- `error.log` — anything that threw (the worker keeps running)

PM2 also captures stdout/stderr to `logs/pm2-out.log` / `logs/pm2-error.log`.
Rotate them with `pm2 install pm2-logrotate` if desired.

---

## Migration guide (from the previous single-app architecture)

Previously the website created and settled rounds **lazily**, inside API requests
(e.g. `GET /api/games/*/current` and the bet routes). That logic now lives here.

### What changed on the website (already applied in this repo)
- `src/lib/color-game.ts`, `number-game.ts`, `crash-game.ts` were reduced to
  **read + bet** helpers (`getCurrent*Round`, `sanitize*`, `recent*`, `place*Bet`,
  `cashoutCrash`). The `ensureCurrent*Round` / `settleDue*` functions were **removed**
  from the website.
- `src/app/api/games/*/current` routes now **only read** — no create/settle.
- `src/engine/prediction-engine.ts` was **removed** from the website (result
  generation is engine-only). `src/engine/crash-engine.ts` stays (the website needs
  `multiplierAt` for live manual cash-out).
- New error `ROUND_NOT_READY` returns a friendly 409 if a bet arrives before the
  engine has opened the round.
- No database models, APIs shapes, UI, payouts, or game rules were changed.

### Deployment steps
1. **Database:** the website owns the PostgreSQL schema — run migrations from the
   website project (`npm run db:migrate` / `prisma migrate deploy`). The engine
   never pushes schema changes; it only generates its client.
2. **Engine (VPS):** deploy `engine-royal/` and start it with PM2 (above). Set its
   `.env` `DATABASE_URL` to the **same** PostgreSQL database the website uses.
3. **Website (Vercel):** redeploy as usual. It now only reads + accepts bets.
4. **Verify:** `curl http://<vps>:4000/health` → `"database":"connected"`; watch
   `logs/settlement.log` fill as rounds settle; confirm the website shows new rounds
   and history updating.

### Rollback
The website and engine share the DB and are independent. To roll back, stop the
engine (`pm2 stop royal-engine`) and redeploy the previous website build — but note
that without the engine, **no rounds will be created or settled** (that was the whole
point of the split), so a rollback also means restoring the website's old lazy
settlement code.
