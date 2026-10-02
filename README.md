# Eclectary Platform

Eclectary is the main marketplace application. Feedlog is included as an independent companion service under `FeedLog/`; its Nuxt API, database, authentication, and dependencies remain isolated from Eclectary's Rails and React applications.

## Repository setup

```bash
git clone https://github.com/Eclectary/eclectary-platform.git
cd eclectary-platform
git submodule update --init --recursive
```

## Run Eclectary

Frontend:

```bash
npm install
npm run dev
```

Rails backend, from `BackEnd/`:

```bash
bin/rails db:prepare
bin/rails server -p 3001
```

## Run Feedlog

Feedlog has its own setup and environment. Run these commands from `FeedLog/`:

```powershell
corepack pnpm install
Copy-Item .env.example .env
```

Set `DATABASE_URL`, `BETTER_AUTH_SECRET`, and `SYSTEM_ADMIN_EMAILS` in `FeedLog/.env`, then initialize and start it:

```powershell
corepack pnpm migrate
corepack pnpm dev
```

Feedlog runs at `http://localhost:3000` by default. The Eclectary frontend and Rails backend can run alongside it without sharing database tables or authentication state.

For PostgreSQL requirements, see `FeedLog/docs/configuration.md` and Feedlog's own README.

## Updating Feedlog

The companion is pinned as a git submodule. To pull a newer upstream revision deliberately:

```bash
git -C FeedLog fetch origin
git -C FeedLog checkout main
git -C FeedLog pull --ff-only
git add FeedLog
```
