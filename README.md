# Smart Queue

Smart Queue is a full-stack queueing and appointment management app built on React, Vite, Express, TypeScript, and SQLite. This repository is organized for two goals:

- day-to-day development with `pnpm`
- smooth USB handoff with clean source and runnable package outputs
- deployable public hosting as a single-origin Node web app

## Requirements

- Node.js 22 or newer
- Corepack-enabled pnpm (`corepack pnpm --version`)

## Quick Start

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm dev
```

Desktop development:

```bash
corepack pnpm desktop:dev
```

Production build and checks:

```bash
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
corepack pnpm handoff
```

Desktop production-style run:

```bash
corepack pnpm desktop
```

## Environment Setup

This repo no longer keeps machine-specific secrets in version control.

1. Copy `.env.example` to `.env` when you need local overrides.
2. Leave optional integrations blank if you only need the local demo-capable app.

### Environment variables

- `PORT`: optional production port for `pnpm start`
- `HOST`: optional host bind override for `pnpm start`
- `TRUST_PROXY`: Express proxy trust setting for hosted HTTPS deployments, default `1`
- `APP_URL`: optional public HTTPS URL used for absolute links and secure cookie behavior
- `PING_MESSAGE`: optional `/api/ping` response override
- `QTECH_DATA_DIR`: optional local SQLite directory override
- `QTECH_ENABLE_DEMO_SEEDING`: set to `false` in production so demo/sample data is not auto-created
- `SESSION_COOKIE_SECURE`: `auto`, `true`, or `false`
- `SESSION_COOKIE_SAME_SITE`: `lax`, `strict`, or `none`
- `SESSION_COOKIE_DOMAIN`: optional cookie domain for hosted deployments
- `CORS_ALLOWED_ORIGINS`: optional comma-separated allowlist when frontend and backend are not same-origin
- `DATABASE_URL`: planned Postgres connection string for the shared-cloud migration; the current checked-in runtime still uses SQLite until that adapter work is completed
- `DATABASE_AUTH_TOKEN`: optional managed database auth token; required for libsql/Turso-style URLs when that adapter is enabled
- `ADMIN_SIGNUP_SECRET`: optional admin self-registration secret
- `GROQ_API_KEY`: optional live assistant integration
- `GROQ_MODEL`: optional Groq model override
- `GROQ_BASE_URL`: optional Groq base URL override
- `GOOGLE_PLACES_API_KEY`: optional Google Places lookup integration

If `GROQ_API_KEY` or `GOOGLE_PLACES_API_KEY` are missing, the app falls back gracefully instead of failing startup.

## Project Layout

- `client/`: SPA routes, components, hooks, and front-end utilities
- `server/`: Express server, SQLite setup, API logic, and server runtime entry
- `shared/`: shared Zod schemas and shared API types
- `public/`: static assets copied directly into the production build
- `.data/`: local SQLite runtime data; do not commit machine-specific state
- `scripts/`: maintenance and handoff automation
- `handoff/`: generated USB deliverables; safe to delete and regenerate

### Files and folders that should stay out of version control

- `node_modules/`
- `dist/`
- `handoff/`
- `.env`
- `.data/*.sqlite-shm`
- `.data/*.sqlite-wal`
- temporary logs and caches

## Local Database Behavior

Smart Queue uses a local SQLite database at `.data/qless.sqlite` by default.

- The app creates the database automatically when it does not exist.
- Startup also seeds demo-friendly sample businesses, accounts, queue data, and receipts.
- In production, set `QTECH_ENABLE_DEMO_SEEDING=false` so the app creates schema only and does not auto-populate demo data.
- You can relocate the database by setting `QTECH_DATA_DIR`.

For a fully fresh state, delete `.data/qless.sqlite` and restart the app.

## Demo Accounts

The seeded demo data includes these default accounts:

- `admin@qless.app` / `password123`
- `owner.bank@qless.app` / `password123`
- `owner.restaurant@qless.app` / `password123`
- `sara@qless.app` / `password123`
- `james@qless.app` / `password123`

These are demo-only credentials for local development and handoff testing.

## USB Handoff

Run:

```bash
corepack pnpm handoff
```

This generates:

- `handoff/source/`: clean source handoff with docs, lockfile, and no generated/runtime clutter
- `handoff/runnable/`: production build plus a sanitized demo database and minimal runtime package manifest

### Recommended USB contents

For USB transfer, copy these prepared folders instead of the raw working repo or temporary local folders:

- `handoff/source/` for developers who will maintain the app
- `handoff/runnable/` for colleagues who mainly need to install and run it

If someone opens the project in VS Code, they should open one of those prepared folders directly:

- open `handoff/source/` for development, editing, testing, and regeneration of handoff packages
- open `handoff/runnable/` for the fastest install-and-run path on another machine

Both packages assume:

- Node.js 22 or newer
- Corepack-enabled pnpm
- commands are run as `corepack pnpm ...`

## Desktop App

Smart Queue can run as a desktop app through Electron without replacing the existing web app flow.

- `corepack pnpm desktop:dev` starts the existing Vite + Express development stack on `http://127.0.0.1:8080` and opens it in Electron.
- `corepack pnpm desktop` builds the SPA and server bundle first, then launches Electron against the built local app.
- `corepack pnpm desktop:dist` creates an installable desktop package with `electron-builder`.

In packaged desktop builds, the embedded Express server binds to a random localhost port and stores app data under the Electron user data directory.

## Public Internet Deployment

The fastest live setup for multi-device access is to host the existing Express + SPA app as one Node service over HTTPS.

- Recommended host: Render or Railway
- Recommended runtime shape: one public URL serving both the SPA and `/api/*`
- Recommended storage for the current codebase: persistent disk-backed SQLite using `QTECH_DATA_DIR`
- Free-tier warning: if you point `QTECH_DATA_DIR` to `/tmp` or another ephemeral path, newly created accounts and app data can disappear after restart/redeploy
- Important: set `QTECH_ENABLE_DEMO_SEEDING=false` in production
- Keep the existing PWA manifest and service worker so the hosted site remains installable on supported browsers

### Render quick start

1. Push this repo to GitHub.
2. Create a new Render Blueprint or Web Service.
3. Use the included `render.yaml`.
4. If you created the service manually before, make sure the Render dashboard build command is `npm install --include=dev && npm run build`.
5. Keep the start command as `node dist/server/node-build.mjs`.
6. Do not use `corepack enable` in the Render build command. That step can fail on Render's read-only filesystem before your app build even starts.
7. If `NODE_ENV=production` is set on the service, keep `--include=dev` in the build command so build tools like `vite` are still installed during deploys.
8. Set secrets such as `APP_URL` and `ADMIN_SIGNUP_SECRET`. Leave `GROQ_API_KEY`, `GOOGLE_PLACES_API_KEY`, `DATABASE_URL`, and `DATABASE_AUTH_TOKEN` unset unless you are deploying a build that explicitly supports a managed cloud database adapter.
9. Keep the persistent disk mounted so app data survives restarts.

The included Render config uses:

- `HOST=0.0.0.0`
- `PORT=10000`
- `TRUST_PROXY=1`
- `QTECH_DATA_DIR=/var/data/qtech`
- `QTECH_ENABLE_DEMO_SEEDING=false`
- `/api/health` as the health check endpoint
- a single-origin Node deployment shape so auth cookies and SSE stay straightforward
- Node 22.x as the intended runtime target for deployment

If an older manual Render service keeps reusing stale dashboard settings, recreate it as a Render Blueprint from this repo so `render.yaml` becomes the source of truth.

### Docker deployment

This repo also includes a `Dockerfile` for generic Node hosts and container platforms.

Example:

```bash
docker build -t smart-queue .
docker run -p 3000:3000 -e APP_URL=http://localhost:3000 -e QTECH_ENABLE_DEMO_SEEDING=false smart-queue
```

Mount a persistent volume to `/data` or override `QTECH_DATA_DIR` to avoid losing runtime data.

### About shared cloud databases

The current production-fast path keeps SQLite on a persistent server disk so multiple internet-connected devices can use the same hosted app immediately.

A true move to a managed cloud database is still the recommended next step for higher concurrency, managed backups, and free-tier durability without relying on host disks. This repo now exposes `DATABASE_URL` and `DATABASE_AUTH_TOKEN` in deployment config and health metadata, but the runtime adapter migration itself is not completed in the checked-in server yet, so production still runs on SQLite today. If `DATABASE_URL` is set in production on this build, startup now fails loudly instead of silently pretending durable storage is active.

### Runnable handoff startup

Inside `handoff/runnable/`:

```bash
corepack pnpm install --prod
corepack pnpm start
```

This package already includes the built app, public assets, and a sanitized demo SQLite database that is safe to share.

### Source handoff startup

Inside `handoff/source/`:

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm dev
```

This package is the developer-maintainable copy and intentionally excludes local `node_modules`, `dist`, and runtime database clutter.

## Notes for Future Developers

- Use `pnpm` as the only package manager for this repo.
- Put browser-served assets in `public/` or import them from client code; do not leave runtime assets at the repo root.
- Keep server-only secrets in local env files, never in tracked source.
- Prefer small internal refactors and shared schema updates over copy-paste endpoint logic.

## Troubleshooting

### `pnpm` is not installed

Use Corepack for local development only. Do not add `corepack enable` to the Render build command.

```bash
corepack enable
corepack pnpm --version
```

### The app starts but external lookups or the assistant are limited

That is expected when optional API keys are blank. The local app should still run with seeded demo data.

### The database seems stale

Delete `.data/qless.sqlite` and restart the app to regenerate the seeded local database.

### Notification sound does not play

Browser notification/audio permissions may be blocked. The sound file is now served from `public/` so build output and development should use the same asset path.
