# signups4fastcash.com

Rewards and cashback comparison site built with React, Vite, Express, and PostgreSQL.

## Local development

Prerequisites: Node.js 20 or newer.

```bash
npm install
npm run dev
```

The development server runs at `http://localhost:3000`. Copy `.env.example` to
`.env.local` and configure the values needed for the features you want to test.

## Validation and production build

```bash
npm run lint
npm run build
npm start
```

The production server serves the built site and API from `dist/`.

## Environment variables

Required for production:

- `NODE_ENV=production`
- `APP_URL=https://signups4fastcash.com`
- `DATABASE_URL` — PostgreSQL connection string
- `ADMIN_PASSCODE` — private admin unlock passcode

Feature-specific:

- `GEMINI_API_KEY` — enables CashBot AI scans
- `CPX_APP_ID` — CPX Research app ID (currently `36089`)
- `CPX_SECURE_HASH` — private CPX signing secret
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` — Google OAuth web client credentials
- `REFERRAL_HASH_SECRET` — private HMAC key used to store referral fraud-check hashes
- `MILESTONE_CALLBACK_SECRET` — private HMAC key shared with the trusted game provider for milestone callbacks
- `POSTBACK_SECRET` — private HMAC-SHA256 key shared with the trusted affiliate network

Never commit `.env.local` or provider secrets.

## RPS games and offer milestones

Signed-in users can play via `POST /api/games/rps/play` with
`{"choice":"rock","entryBet":0.50}` (`entryBet` is optional and defaults to
$0.50). Bets are limited by the user's available balance and must be in whole
cents. The game uses the existing survey points wallet (100 points = $1), so a
win pays 2× the entry as the total pot, a loss keeps the entry, and a draw
refunds it. Every request must include an `Idempotency-Key` header; reuse the
same key when retrying to avoid playing or charging twice. Game balances require
PostgreSQL and are not enabled in in-memory mode.

`GET /api/offers/milestones` returns the signed-in user's configured stages and
claims. The EarnX example tiers are level 5 ($2), level 10 ($7.50), and level 20
($25). Only a trusted provider callback can advance a level or credit those
rewards; client-submitted levels are not accepted. Configure the provider to
POST `{"userId":"<platform-user-id>","offerId":"offer-earnx","level":5}` to
`/api/offers/milestones` with these headers:

- `X-Milestone-Timestamp`: Unix time in milliseconds (must be within five minutes)
- `X-Milestone-Event-Id`: provider-unique event ID
- `X-Milestone-Signature`: lowercase/uppercase hex HMAC-SHA256 of
  `<timestamp>.<eventId>.<userId>.<offerId>.<level>`, using
  `MILESTONE_CALLBACK_SECRET`

Progress updates are monotonic and event IDs are idempotent. Skipped tiers are
credited together when a signed level update crosses them. Both game winnings
and milestone rewards use the existing survey points wallet and therefore
require PostgreSQL.

Admin campaign routes use the `x-admin-token` header. `GET /api/admin/offers`
includes campaigns; `POST /api/admin/offers` creates a campaign with `title`,
`description`, `category`, `total_value`, and a `milestones` array. Each tier has
`step_number`, `description`, and `payout_amount`; optional `level` defaults to
`step_number`. The total must equal the sum of tier payouts, which are credited
in the existing survey-points wallet. `PUT /api/admin/offers/:id` supports copy
and tracking-parameter changes or one-tier updates such as
`{"milestone":{"step_number":2,"payout_amount":7.5}}`. `DELETE` deactivates the
campaign and its visible tiers without deleting prior claims. Active campaign
metadata and signed-in progress are included by `GET /api/offers/milestones`.

Affiliate reward networks can send signed GET or POST callbacks to
`/api/v1/callbacks/postback`. Configure `POSTBACK_SECRET`; sign
`<click_id>.<user_id>.<offer_id>.<milestone_step>.<payout_cents>` with
HMAC-SHA256 and provide the hex digest as `signature` (or
`X-Postback-Signature`). The active configured tier must match the payout.
Credits are transactional and idempotent by click, offer, and step, with an
audit row in `transactions`; success and exact retries return plain-text `1`.
These callback credits use the dollar-denominated `users.balance` and are
separate from the existing survey-points wallet used by RPS and milestone
progress.

The original responsive dashboard layout template is available at
`/dashboard-preview`. It uses clearly labeled sample balances, payout activity,
and milestone progress; it is not connected to live account or payout data.

## Development presentation seed

The optional presentation seeder creates 24 synthetic users with varied survey
point balances and referral counts, 24 completed RPS matches, four waiting
rooms, 50 simulated offer-feed entries from the last 48 hours, and three
resolved sample support tickets. It uses stable IDs and upserts only its own
`presentation-seed-*` records, so rerunning it does not duplicate rows. It does
not credit real cash balances or submit provider postbacks.

The script deliberately does not read `.env.local` or fall back to `DATABASE_URL`.
Use an isolated local development database and set its connection string and
confirmation explicitly in the current PowerShell session:

```powershell
$env:NODE_ENV = 'development'
$env:PRESENTATION_DATABASE_URL = 'postgresql://postgres:password@localhost:5432/s4fc'
$env:PRESENTATION_SEED_CONFIRMATION = 'seed-demo-data-in-development'
npm run db:seed:presentation
```

Remote databases are refused unless `PRESENTATION_SEED_ALLOW_REMOTE=yes` is
also set and the database name includes a `dev`, `test`, `staging`, or `local`
environment marker. The seeder still requires `NODE_ENV=development` and the
confirmation value above; never point it at production.

## Admin workflow

1. Open the site and enter the configured admin passcode in the offer search field.
2. Review or create offers in the Admin Panel.
3. Publish only offers with verified official and referral URLs.
4. For owner accounts, use the referral payout queue to review historical bonuses. Mark a bonus completed only after paying it; this status change does not issue a payment.
5. Re-lock the panel when finished.

The member-to-member referral program is temporarily paused. The site does not
promote personal referral links, attach new signups to a referrer, or accept
referral claims while paused. Existing referral records and the owner-only
payout queue are retained for historical review. This does not affect merchant
referral or affiliate links used to present individual offers.

Offer edits persist in PostgreSQL when `DATABASE_URL` is configured. Without it,
the app uses in-memory storage and changes are lost on restart.

Database migration 2 adds a decimal `users.balance`, indexed affiliate tracking
IDs, ban metadata, and a typed `transactions` ledger with unique callback
references. The nullable raw `ip_address` field is not populated; signup
anti-fraud continues to use the existing hashed IP value. This schema addition
does not convert the existing survey-points wallet or change its current API.

Database migration 3 adds nullable Google identity and bcrypt password hashes
for email/username sign-in, plus a case-insensitive unique email index. Password
registration and login require PostgreSQL; accounts use the existing persistent
HTTP-only session cookie. New passwords must be at least 12 characters and no
more than 72 UTF-8 bytes. If existing accounts share an email address, resolve
those duplicates before applying the migration.
Use `POST /api/auth/signup` with an email, username, and password, or
`POST /api/auth/login` with an email-or-username identifier and password.
Verified Google sign-in can link to an existing account with the same email.

On startup with PostgreSQL configured, the server also creates the PvP RPS
schema: `rps_lobbies` tracks points/cash wagers and room state, `rps_matches`
stores completed player choices and results, `rps_lobby_moves` keeps unpaired
moves private, and `rps_house_ledger` records the 3% winning-match rake.
Player and winner references point to `users`; cash wagers use `users.balance`
and point wagers use `survey_reward_balances`. Authenticated PvP APIs include
`POST /api/v1/rps/lobbies` and `GET /api/v1/rps/lobbies` to create/list rooms,
`POST /api/v1/rps/lobbies/:id/join` with the matching `wagerAmount` and
`currency`, `GET /api/v1/rps/lobbies/:id` to poll state, and
`POST /api/v1/rps/lobbies/:id/moves` with a `choice`. Moves remain private
until both are submitted and cannot be changed. Wagers must be at least $0.50
or 50 points; joining debits both stakes transactionally, ties refund both
stakes, and winning settlement credits the pool less the rounded 3% rake. An
active room with no move activity for five minutes refunds both wagers;
unmatched rooms expire after 24 hours.

## Deployment

Render deployment instructions, environment variables, health checks, and custom
domain setup are documented in [DEPLOYMENT.md](./DEPLOYMENT.md).

Before launch, verify:

- `https://signups4fastcash.com` resolves and has a valid TLS certificate.
- `/api/health` returns `status: "ok"`.
- PostgreSQL is connected.
- CPX and admin secrets are configured.
- Survey postbacks use the deployed HTTPS URL.
- CPX app approval, survey inventory, and a non-zero respondent reward share are enabled in the CPX publisher dashboard.
- Cash-out messaging matches the payout features actually enabled.
