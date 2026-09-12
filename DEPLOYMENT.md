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
- `CPX_APP_ID` — CPX app ID, currently `36089`
- `CPX_SECURE_HASH` — private CPX postback secret; set this in Render and never commit it
- `GOOGLE_CLIENT_ID` — Google OAuth web application client ID
- `GOOGLE_CLIENT_SECRET` — Google OAuth web application secret

Once `CPX_SECURE_HASH` is configured, the Surveys & Rewards category generates a signed CPX iframe URL for each anonymous browser session. Without this secret, the site intentionally shows a configuration message instead of a broken survey wall.

Survey accounting currently records provider callbacks at 100 points per $1 and displays a $5 PayPal minimum. Automatic PayPal transfers and user cash-out requests remain disabled until authenticated user accounts, fraud/reversal review, and PayPal payout credentials are configured.

Google sign-in requires a Google Cloud OAuth client configured as a **Web application**. Add this authorized redirect URI exactly:

`https://signups4fastcash.com/api/auth/google/callback`

For local testing, also add:

`http://localhost:3000/api/auth/google/callback`

Set the resulting client ID and secret in Render. The first visit opens the sign-in modal; after Google authenticates, the user must choose a unique username. Account sessions and usernames are stored in PostgreSQL.

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

## Render setup
1. Push this repo to GitHub.
2. In Render, choose New > Web Service.
3. Connect the GitHub repo.
4. Use these values:
   - Build Command: `npm install && npm run build`
   - Start Command: `npm run start`
   - Health Check Path: `/api/health`
5. Add the environment variables above, or use the `render.yaml` blueprint to create the web service and database together.
6. Deploy. On the first start, the server creates the `offers` table and imports the catalog from `src/data/initialOffers.ts`.

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
- Render's `render.yaml` provisions the PostgreSQL database and injects its connection string into the web service.
