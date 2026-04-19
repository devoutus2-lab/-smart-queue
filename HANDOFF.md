# USB Handoff

Use the generated `handoff/` folder for USB transfer.

Both handoff packages expect Node.js 22 or newer and `corepack pnpm`.

## Recommended folders to copy

- `handoff/source/` for developer maintenance
- `handoff/runnable/` for quick install and run

Open `handoff/source/` in VS Code when someone will maintain the app.
Open `handoff/runnable/` in VS Code when someone mainly needs to install and run the prepared build.

## Do not prioritize these for sharing

- `node_modules/`
- `dist/`
- the raw working repo unless the full workspace is intentionally needed
- local `.data/*.sqlite-wal`
- local `.data/*.sqlite-shm`
- temporary logs or cache files

## Commands

For `handoff/source/`:

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm dev
```

Use this package for development, testing, builds, and future handoff regeneration.

For `handoff/runnable/`:

```bash
corepack pnpm install --prod
corepack pnpm start
```

Use this package for the quickest shareable run path with the built app and sanitized demo database.
