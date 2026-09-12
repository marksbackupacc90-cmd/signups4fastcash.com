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

Never commit `.env.local` or provider secrets.

## Admin workflow

1. Open the site and enter the configured admin passcode in the offer search field.
2. Review or create offers in the Admin Panel.
3. Publish only offers with verified official and referral URLs.
4. Re-lock the panel when finished.

Offer edits persist in PostgreSQL when `DATABASE_URL` is configured. Without it,
the app uses in-memory storage and changes are lost on restart.

## Deployment

Render deployment instructions, environment variables, health checks, and custom
domain setup are documented in [DEPLOYMENT.md](./DEPLOYMENT.md).

Before launch, verify:

- `https://signups4fastcash.com` resolves and has a valid TLS certificate.
- `/api/health` returns `status: "ok"`.
- PostgreSQL is connected.
- CPX and admin secrets are configured.
- Survey postbacks use the deployed HTTPS URL.
- Cash-out messaging matches the payout features actually enabled.
