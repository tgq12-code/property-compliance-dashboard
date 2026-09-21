# Vo Family reminder scheduler

This Cloudflare Worker calls the existing protected reminder endpoint every five minutes. The application, Supabase database, and Resend email delivery remain unchanged.

## Required secret

Set `CRON_SECRET` as a Cloudflare Worker secret. Its value must exactly match the `CRON_SECRET` configured for the Vo Family Operations production project in Vercel. Never commit the value to GitHub.

## Deployment

From this directory, authenticate Wrangler with Cloudflare, add the secret, and deploy:

```sh
npx wrangler secret put CRON_SECRET
npm run deploy
```

The trigger in `wrangler.jsonc` runs every five minutes. After the Worker is deployed and a successful scheduled event is verified, remove `/api/cron/reminders` from the Vercel `crons` array to prevent duplicate scheduler calls. Keep the separate `/api/cron/database-health` Vercel job active.
