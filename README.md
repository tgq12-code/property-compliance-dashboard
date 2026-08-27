# Property Compliance Dashboard

Private dashboard for tracking property taxes, business filings, annual fees, and recurring compliance obligations.

## Stack

- Next.js + TypeScript
- Tailwind CSS
- Supabase for authentication and database
- Vercel for hosting
- Resend planned for email reminders

## Current MVP

The first version includes a dashboard UI with upcoming obligations, summary cards, and quick-add entry points for properties and businesses. A Supabase schema is included for profiles, properties, businesses, obligations, payments, and reminder preferences.

## Local setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local`.
3. Add your Supabase project URL and anon key.
4. Run the SQL in `supabase/schema.sql` inside the Supabase SQL editor.
5. Start the app with `npm run dev`.

## Environment variables

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `RESEND_API_KEY` (for reminder email work in the next phase)
- `REMINDER_FROM_EMAIL` (for reminder email work in the next phase)

## Next phase

- Connect the dashboard to Supabase data
- Add login/authentication
- Add create/edit forms for properties, businesses, and obligations
- Add mark-paid workflow and payment receipts
- Add scheduled email reminders
- Deploy to Vercel
