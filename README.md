# DraftMind

Single-owner, self-hosted Telegram AI content automation platform built
with NestJS, Next.js, TypeScript, shadcn/ui, Tailwind CSS, and SQLite.

## Local commands

First machine setup:

```bash
npm run first-start
```

Normal start after setup:

```bash
npm run start
```

Frontend:

- [http://localhost:3000](http://localhost:3000)

Backend health:

- [http://localhost:4000/api/v1/health](http://localhost:4000/api/v1/health)

## What `npm run first-start` does

- creates `.env` from `.env.example` if needed
- generates `APP_ENCRYPTION_KEY` if the placeholder is still present
- ensures the writable `data/` directories exist
- installs dependencies with `pnpm`
- builds the backend
- initializes SQLite by running the backend once so its startup
  migration and seed path can create the schema and default records

## What `npm run start` does

- loads the repo-root `.env`
- starts backend and frontend together
- keeps the current single-instance scheduler model intact

## Setup wizard

Open the app in the browser and complete the step-by-step setup wizard:

1. Application settings
2. Telegram credentials
3. Primary AI provider

After setup, sign in and continue with workflow configuration.

## Documentation

Project documentation remains in `docs/`. The most relevant files for
running and understanding the app are:

- `docs/README.md`
- `docs/ARCHITECTURE.md`
- `docs/DEPLOYMENT.md`
- `docs/API_SPEC.md`
- `docs/SECURITY.md`
