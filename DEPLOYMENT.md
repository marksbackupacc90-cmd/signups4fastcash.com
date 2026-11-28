# Deployment Guide for signups4fastcash.com

This project is ready to deploy as a Node.js app with a custom domain.

## Recommended hosting
Use Render.

## Required environment variables
Set these in the hosting panel:

- `GEMINI_API_KEY` — your Gemini API key
- `APP_URL` — `https://signups4fastcash.com`
- `NODE_ENV=production`
- `DATABASE_URL` — PostgreSQL connection string for persistent Admin Panel edits
- `ADMIN_PASSCODE` — private passcode used to unlock the Admin Panel; set this only in Render and `.env.local`
- `PROVIDER_CREDENTIALS_ENCRYPTION_KEY` — optional stable secret for credentials saved in Admin > Integrations; if omitted, `ADMIN_PASSCODE` is used. Keep the selected secret unchanged while credentials are stored.
- `CPX_APP_ID` — CPX app ID, currently `36089`
- `CPX_SECURE_HASH` — private CPX postback secret; set this in Render and never commit it
- `GOOGLE_CLIENT_ID` — Google OAuth web application client ID
- `GOOGLE_CLIENT_SECRET` — Google OAuth web application secret
- `MILESTONE_CALLBACK_SECRET` — private HMAC-SHA256 secret shared with the trusted game provider for milestone callbacks
- `POSTBACK_SECRET` — private HMAC-SHA256 secret shared with the trusted affiliate network
- `RESEND_API_KEY` — Resend API key for confirmation and alert delivery
- `EMAIL_FROM` — verified sender, for example `Signups4FastCash.com <alerts@your-domain.com>`
- `NEWSLETTER_UNSUBSCRIBE_SECRET` — long random secret used to sign unsubscribe links
- `NEWSLETTER_WEBHOOK_SECRET` — separate secret configured on the email-provider webhook
- `ADMIN_SESSION_HOURS` — optional admin-token lifetime, default `2`
- `VISITOR_ANALYTICS_RETENTION_DAYS` — optional retention for legacy visitor events, default `365`

Once `CPX_SECURE_HASH` is configured, the Surveys & Rewards category generates a signed CPX iframe URL for each anonymous browser session. Without this secret, the site intentionally shows a configuration message instead of a broken survey wall.

Survey accounting records provider callbacks at 100 points per $1, displays the balance in the signed-in Surveys & Rewards panel, and allows a PayPal cash-out request at 500 points ($5). Requests are reserved transactionally and stored as `pending` in PostgreSQL so the same balance cannot be requested twice. They still require manual review and PayPal processing; the site does not claim that a request has been paid until an operator completes it.

Google sign-in requires a Google Cloud OAuth client configured as a **Web application**. Add this authorized redirect URI exactly:

`https://signups4fastcash.com/api/auth/google/callback`

For local testing, also add:

`http://localhost:3000/api/auth/google/callback`

Set the resulting client ID and secret in Render. The sign-in modal supports Google or email/username and password. Password registration requires PostgreSQL, uses bcrypt hashes, and applies migration 3; account sessions are stored in PostgreSQL and issued as HTTP-only cookies. A verified Google sign-in using an existing account's email links to that account.

## CPX publisher setup

The website code can load the CPX wall, but CPX controls approval, survey inventory, and respondent rewards. In the CPX publisher dashboard for app `36089`:

1. Confirm the app is approved and live for the countries you want to serve.
2. Configure a non-zero respondent/user reward share. A wall showing surveys with `+0.00` means CPX has not assigned a user payout, even though the integration is loading correctly.
3. Set the CPX postback URL to:

   `https://signups4fastcash.com/api/cpx/postback`

   If CPX requires query-string macros, use:

   `https://signups4fastcash.com/api/cpx/postback?status={status}&trans_id={trans_id}&user_id={user_id}&amount_local={amount_local}&amount_usd={amount_usd}&offer_id={offer_id}&hash={hash}`

4. Set the CPX secure hash in Render as `CPX_SECURE_HASH`. It must match the secret configured in CPX and must never be committed to the repository.
5. Complete one test survey and confirm the callback changes the balance shown in the Surveys & Rewards panel.

The callback accepts CPX statuses `1` (credit) and `2` (reversal), validates the transaction hash, and stores balances in PostgreSQL when `DATABASE_URL` is configured. The site does not enable cash-out requests automatically; payout processing still requires authenticated accounts and a configured payout provider.

## RPS games and verified milestones

The RPS endpoint and milestone claims use the existing survey points wallet at
100 points per dollar. They only operate with PostgreSQL and a signed-in user
account. Configure `MILESTONE_CALLBACK_SECRET` to a long random value shared
with the trusted game provider. The provider must send milestone progress to
`POST /api/offers/milestones` with `userId`, `offerId`, and `level` in JSON,
plus `X-Milestone-Timestamp` (Unix milliseconds), `X-Milestone-Event-Id`
(unique provider event ID), and `X-Milestone-Signature` (HMAC-SHA256 hex over
`<timestamp>.<eventId>.<userId>.<offerId>.<level>`). Callbacks older than five
minutes are rejected; IDs are idempotent and only verified server callbacks
can credit rewards. The seeded EarnX milestones are levels 5, 10, and 20.

`POST /api/games/rps/play` requires a signed-in user, a choice, and a unique
`Idempotency-Key`. The optional entry bet defaults to $0.50 and is limited by
the current wallet balance. Wins pay twice the entry (the total pot), losses
forfeit the entry, and draws refund it.

Dynamic offer campaigns are managed through `GET/POST /api/admin/offers` and
`PUT/DELETE /api/admin/offers/:id`, using an active `x-admin-token` and the
PostgreSQL database. Campaign milestones are stored with their tier details and
mirrored into the verified milestone ledger transactionally. Deleting a
campaign deactivates it for users while preserving its historical claims.

Affiliate reward callbacks use `GET/POST /api/v1/callbacks/postback` and require
`POSTBACK_SECRET`. Sign the canonical string
`<click_id>.<user_id>.<offer_id>.<milestone_step>.<payout_cents>` with
HMAC-SHA256; send its hex digest as `signature` or in `X-Postback-Signature`.
The payout must match the active configured tier. Transactions credit
`users.balance` exactly once per click, offer, and step and are recorded in the
`transactions` ledger. This dollar balance is separate from survey points.

`GET /api/live-offers` is a public, capped feed of the 15 newest successfully
credited affiliate and CPX offers. It returns masked usernames, offerwall and
offer labels, payout amounts, and credit timestamps; raw user IDs are never
returned. Feed rows are stored idempotently with the successful credit and
queried through a timestamp index. The `/ws/activity` socket also broadcasts
new public credits as `offers.credit` events. CPX reversals remove the related
entry from the live feed.

The UI-only `/dashboard-preview` page is a layout prototype. Its wallet,
cash-outs, and offer progress are illustrative sample data and are not linked to
accounts or payout processing.

## Render setup
1. Push this repo to GitHub.
2. In Render, choose New > Web Service.
3. Connect the GitHub repo.
4. Use these values:
   - Build Command: `npm install && npm run build`
   - Start Command: `npm run start`
   - Health Check Path: `/api/health` (returns HTTP 503 when PostgreSQL is configured but unavailable)
5. Add the environment variables above, or use the `render.yaml` blueprint to create the web service and database together.
6. Deploy. On the first start, the server creates the `offers` table and imports the catalog from `src/data/initialOffers.ts`.

## Redeploying offer catalog changes

Offer cards are bundled into the frontend during `npm run build`. After adding or
updating an offer in `src/data/initialOffers.ts`:

1. Push the change to the branch connected to Render.
2. In Render, open the `signups4fastcash` service and select **Manual Deploy > Deploy latest commit**.
3. Wait for the deploy to become live and confirm the health check is passing.
4. Open `https://signups4fastcash.com/api/offers` and verify the offer ID is present.
5. Open the homepage in a private window, hard-refresh, and click the offer card to confirm its referral URL.

For the Western Union card, verify `offer-western-union-referral` and
`https://ssqt.co/mQXPJgc`. Do not rely on an old browser tab or cached JavaScript
when checking a newly deployed catalog.

## Offer activity reporting and visitor privacy

Page loads are counted in a single aggregate counter. The counter does not store
visitor IDs, page paths, sources, or locations, and no consent popup is used.
Offer impressions remain disabled; the legacy impression endpoint returns HTTP
410. The public offer cards show tracked referral-link clicks, not unique people.
Aggregate page-view counting starts when this version is deployed; earlier
page-view totals may be incomplete because collection was previously disabled.
The optional `VISITOR_ANALYTICS_RETENTION_DAYS` setting remains only to expire
historical visitor events already stored before collection was disabled.

The Admin dashboard shows offer clicks and recorded-conversion events since the
last successful check in that browser. Its first check includes the previous 30
days; subsequent checks start at the saved browser-local cursor. Offer events are
stored in PostgreSQL and older events are pruned during startup. Click records
contain the offer ID and event time, not a visitor ID or location. Conversion
totals increase only when an integration records a conversion; a referral click
alone does not confirm a merchant signup or payout.

The public Tracking Check performs a read-only readiness request for the site's
click-tracking storage and tests temporary browser storage. It does not create an
offer click or verify a partner's attribution. Owner admins can review visitor
reports for expired offers, broken links, and incorrect terms in the Reports tab.

The owner-only Admin overview also shows aggregate click and page-view totals.
The click counter is resettable using the existing owner-only analytics reset;
page views are counted from this deployment forward and are also cleared by
that reset.

## Monitoring and recovery

- Configure the hosting platform health check to call `/api/health`. It returns HTTP 503 when
  PostgreSQL is configured but cannot answer a readiness probe.
- Send response status and the `x-request-id` header to your log/incident system so failures can
  be traced without logging tokens, passwords, or subscriber email contents.
- Configure the email provider webhook to POST bounce and complaint events to
  `/api/newsletter/provider-webhook` with the `x-newsletter-webhook-secret` header. The endpoint
  suppresses affected addresses from future broadcasts.
- Enable automated PostgreSQL backups in the hosting provider and perform a restore test before
  launch. Source code cannot create or verify provider-side backups.
- Keep database, email, OAuth, CPX, and admin secrets only in the hosting provider's secret
  manager. Never place them in the repository.
- Before a production release, run `npm run lint`, `npm test`, and a smoke test covering health,
  newsletter confirmation, unsubscribe, admin unlock, offer publishing, and analytics access.

## Custom domain
1. In Render, add the custom domain `signups4fastcash.com`.
2. At your DNS provider, create or update the required A/CNAME records for the domain to point to Render.
3. Wait for DNS propagation.
4. Redeploy if Render asks for it.

## Local production test
Run:

```bash
npm run build
npm run start
```

Then visit:

- http://localhost:3000

## Notes
- The app expects `PORT` from the hosting platform.
- The server reads `.env.local` during local development and will use host environment variables in production.
- The app is already configured for a server-side Gemini setup.
- Without `DATABASE_URL`, local development uses an in-memory fallback and changes reset when the server restarts.
- Offline friends in the chat list show relative last-seen text such as `last seen 5m ago`. A friend is considered online after chat activity within the last 90 seconds.
- Presence is currently kept in server memory and retained for up to 30 days. It resets when the server restarts and is not shared across multiple web-service instances; use a shared presence store such as PostgreSQL or Redis before scaling horizontally.
- Render's `render.yaml` provisions the PostgreSQL database and injects its connection string into the web service.
