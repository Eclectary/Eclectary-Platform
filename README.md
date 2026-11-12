# Eclectary Platform

Eclectary is the main marketplace application. Feedlog is included as an independent companion service under `FeedLog/`; its Nuxt API, database, authentication, and dependencies remain isolated from Eclectary's Rails and React applications.

## Repository setup

```bash
git clone https://github.com/Eclectary/eclectary-platform.git
cd eclectary-platform
git submodule update --init --recursive
```

## Run Eclectary

The local full-stack endpoints are:

- Rails: `http://localhost:3000`
- Vite: `http://localhost:5173`
- API: `http://localhost:3000/api/v1`

Install frontend and backend dependencies before the first run. Use PostgreSQL
and `psql`, Ruby 4.0.6, Bundler, Node.js, and npm. The version file uses `4.0.6`
without a `ruby-` prefix so rbenv can select the installed 4.0.6 version.
The live-suite process verification requires Linux Unix peer credentials
(`SO_PEERCRED`).

### Isolated integration database

Use your locally installed PostgreSQL to provision a **separate disposable
instance**, listening only on `127.0.0.1` at a nonstandard port such as `55432`.
Create an `eclectary_integration` database and a dedicated local role on that
instance; the role must be able to read and write that database. Provisioning
varies by operating system and PostgreSQL installation. Do not use the normal
development cluster, a port-forward to it, or production data or credentials.
The safeguards verify the confirmed address and running server identity; they
cannot determine whether an operator has mistakenly put valuable data there.

In each backend terminal, from `BackEnd/`, set these values to match the
instance you personally confirmed. Export both URL overrides empty to prevent
dotenv from supplying values from `.env`. In confirmed integration mode only,
application boot validates the integration settings after dotenv loads, then
removes these empty overrides before Active Record parses its configuration.
Rails 8.1 rejects empty URLs if they are left in the environment. Nonempty
`DATABASE_URL` or `PRIMARY_DATABASE_URL` values are rejected, not silently ignored.
Normal development and production URL handling is unchanged.
The integration scripts reject port 5432, remote hosts, and mismatched confirmation.

```bash
cd BackEnd
export RBENV_VERSION=4.0.6
export PATH="$HOME/.rbenv/shims:$HOME/.rbenv/bin:$PATH"
export BUNDLE_FROZEN=true
export RAILS_ENV=development
export DATABASE_HOST=127.0.0.1 DATABASE_PORT=55432
export DATABASE_NAME=eclectary_integration DATABASE_USERNAME=eclectary_integration
read -r -s -p 'Local integration PostgreSQL password: ' DATABASE_PASSWORD; echo
export DATABASE_PASSWORD DATABASE_URL="" PRIMARY_DATABASE_URL=""
export INTEGRATION_CONFIRM="127.0.0.1:55432/eclectary_integration"
```

Before preparing anything, confirm this is the intended disposable instance:

```bash
PGPASSWORD="$DATABASE_PASSWORD" psql -X -w -h "$DATABASE_HOST" -p "$DATABASE_PORT" \
  -U "$DATABASE_USERNAME" -d "$DATABASE_NAME" \
  -c "SELECT current_database(), inet_server_addr(), inet_server_port(), current_user, pg_postmaster_start_time();"
```

Verify the database, address, port, role, and server startup time against your
independently administered instance. For a database that is already prepared,
do not rerun migrations or data setup. Avoid `db:prepare`: on an uninitialized
database it can load the schema and normal seeds.

Prepare the fictional dataset using the same exported settings:

```bash
bundle exec ruby bin/rails runner script/setup_integration_data.rb
```

See [integration data](BackEnd/INTEGRATION_DATA.md) for managed records,
credentials, repeatability, and side effects.

### Start Rails

In the configured backend terminal, enable the local-only verification mode and
prepare a single-process Rails server. Create the secret once and reuse it for the
verification terminal; keep the file private and never commit or share it.
The exclusive create below refuses to overwrite an existing secret. If one already
exists, skip creation and retain it; never rotate it while a server is using it.

```bash
umask 077
bundle exec ruby -rsecurerandom -e 'File.open("tmp/integration-proof-secret", File::WRONLY | File::CREAT | File::EXCL, 0600) { |f| f.puts SecureRandom.hex(32) }'
```

Configure proof mode and verify Rails' resolved database configuration and connected
identity using only reads. This does not start a server or run functional tests:

```bash
export INTEGRATION_PROOF_SECRET="$(cat tmp/integration-proof-secret)"
export INTEGRATION_PROOF=1 WEB_CONCURRENCY=0
export INTEGRATION_API_SOCKET="$PWD/tmp/integration-api.sock"
export FRONTEND_URL=http://localhost:5173
export PIDFILE="$PWD/tmp/pids/integration-server.pid"
unset HOST BINDING PORT
unset SOLID_QUEUE_IN_PUMA
bundle exec ruby bin/rails runner 'IntegrationDatabase.validate_secret!(ENV["INTEGRATION_PROOF_SECRET"]); c = ActiveRecord::Base.connection; IntegrationDatabase.validate_connection!(c, ENV); abort "Pending migrations" if c.pool.migration_context.needs_migration?; puts "Verified integration connection; schema current; no database writes."'
```

Check `ss -ltnp 'sport = :3000'` before launching. The integration server uses
`127.0.0.1:3000`, so an existing Rails server on that port must first be stopped
manually in its owning terminal (Ctrl+C), **only when ready to switch**. Do not
stop Vite; its existing API URL and port 5173 remain valid. Do not remove a Unix
socket or PID file belonging to a running process.

After confirming port 3000 is free and the configured socket does not already
exist, start Rails in the same configured terminal:

```bash
test ! -e "$INTEGRATION_API_SOCKET" && test ! -L "$INTEGRATION_API_SOCKET" &&
bundle exec ruby bin/rails server
```

Only development mode installs the proof middleware. Startup refuses a mismatched
database configuration or identity before serving requests. It adds a keyed proof to
the existing health response for a local challenge; it exposes neither database
details nor credentials and adds no database-information endpoint. The Unix
socket is local and restricted to its owner. Do not expose the Rails server
or the socket to untrusted users. Do not pass Rails `-b` or `-p` options: they
override Puma's configured bindings and can remove the verification socket.
Stop this server after integration testing.

After launch, in another backend terminal, repeat the database exports above and
load the same proof secret and absolute socket path. Verify only the signed health
proof, without executing the functional suite or writing database records:

```bash
export INTEGRATION_PROOF_SECRET="$(cat tmp/integration-proof-secret)"
export INTEGRATION_API_SOCKET="$PWD/tmp/integration-api.sock"
bundle exec ruby script/test_live_integration.rb --verify-only
```

Expected: `PASS: API process and independently queried PostgreSQL instance match`.
This compares an independent PostgreSQL identity query with the HMAC of a fresh
health challenge and the Unix socket's OS-authenticated peer PID. An ordinary
`curl /api/v1/health` success is not a substitute. Keep secrets out of command
output, shell tracing, tracked files, and shared terminal transcripts.

### Start Vite

From the repository root, in a second terminal:

```bash
npm install
VITE_API_URL=http://localhost:3000/api/v1 \
npm run dev -- --host localhost --port 5173 --strictPort
```

`VITE_API_URL` may be omitted for local development because the frontend has the
same URL as its development fallback. `--strictPort` prevents Vite from silently
moving to another port and breaking CORS.

### Run the live API suite

In another backend terminal, repeat the database environment exports above,
including the password and confirmation. Reuse the same secret and socket path
while the Rails server and Vite are running:

```bash
export INTEGRATION_PROOF_SECRET="$(cat tmp/integration-proof-secret)"
export INTEGRATION_API_SOCKET="$PWD/tmp/integration-api.sock"
ruby script/test_live_integration.rb
```

The suite checks the PostgreSQL identity independently with `psql`, then checks
a fresh proof against the Unix socket's operating-system peer PID before each
API request. It uses that same connection for the request and refuses to
reconnect if it closes. The development middleware also verifies the database
and rechecks the same proof against its current database before dispatching each
marked suite request. Missing, mismatched, or unavailable verification stops
the suite before the next API request. This mechanism assumes a trusted local
user and directly connected single-process Puma; it is not an authentication
mechanism for normal application traffic.
The expired-JWT check also requires Rails' default development signing secret in
`BackEnd/tmp/local_secret.txt`; an overridden Rails signing secret causes the
check to fail.

Verified live-suite result: 26 checks passed, with zero failures and zero skipped
checks.

Each run creates a fictional customer, cart, two orders, merge record, and seller
product; it edits/deactivates that product and advances an order item. These
records are not cleaned up automatically. Rerunning the data setup restores its
managed records but leaves live-suite records alone.

The suite checks HTTP responses and PostgreSQL persistence, not React rendering
or real browser interactions. Registration/login navigation, guest-cart UI
merging, checkout screens, seller dashboard/fulfillment UI, and other browser
workflows still need manual or browser-automation verification.

Payment processing is currently a placeholder: checkout creates a pending order
and does not charge a card. Stripe variables, real card details, production
credentials, mail credentials, and `RAILS_MASTER_KEY` are not required for this
local integration workflow.

## Cart integration

Guest carts stay in the browser's `eclectary-cart` localStorage entry. Once a
session is authenticated, the frontend loads that account's saved cart from the
Rails API without merging or overwriting the separate guest cart. Signing out
restores the guest cart.

`AuthProvider` must wrap `CartProvider`. The cart context exposes `loading`,
`error`, and `canModifyCart` alongside its existing item and action helpers.

Saved account carts are currently read-only: signed-in add, quantity, remove, and
clear operations are blocked until server mutations are connected. Checkout is
unchanged, so creating an order does not yet clear the saved account cart.

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

Feedlog runs at `http://localhost:3000` by default, which conflicts with the
standard Eclectary Rails port. Feedlog is not required for Eclectary integration
testing; stop it or configure Feedlog on another port before starting Rails.
The services do not share database tables or authentication state.

For PostgreSQL requirements, see `FeedLog/docs/configuration.md` and Feedlog's own README.

## Updating Feedlog

The companion is pinned as a git submodule. To pull a newer upstream revision deliberately:

```bash
git -C FeedLog fetch origin
git -C FeedLog checkout main
git -C FeedLog pull --ff-only
git add FeedLog
```
