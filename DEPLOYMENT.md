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
