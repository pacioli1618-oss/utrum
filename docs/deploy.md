# Deploy

Production runs on **Vercel** (Next.js, no Vercel-specific code) with the **Supabase project
shared with QuemLeva and AmigoSecreto** (sa-east-1), in its own `utrum` schema.

## 1. Database

Apply `supabase/migrations/20261116000100_utrum_schema.sql` once (Supabase → SQL editor,
or `supabase db push`). It only creates the `utrum` schema and the `public.ut_*` functions;
it does not touch `quemleva`, `amigosecreto` or `oqfalta`. Then run the security and performance advisors.

## 2. Vercel project

1. Import the GitHub repository in Vercel (framework preset: Next.js, default build and output).
2. Environment variables (Production and Preview):

   | Name | Value |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://uqkyhzvdwynpkqdiuvyn.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | the publishable key (`.env.example`) |
   | `NEXT_PUBLIC_SITE_URL` | optional: `https://utrum.gr1618.io` (base of the link-preview image URL) |
   | `NEXT_PUBLIC_CONTACT_EMAIL` | optional: contact on About, Privacy and Terms; without it, GitHub issues |

   Both Supabase values are public by design: the browser calls the `ut_*` RPCs directly and the
   tables are not exposed.
3. Function region: **São Paulo (gru1)**, next to the database (`vercel.json`).

## 3. Domain

Validation phase: `utrum.gr1618.io` (DNS for `gr1618.io` is managed at Hover).

1. Vercel → Project → Settings → Domains → add `utrum.gr1618.io`.
2. At Hover, add the `CNAME` record Vercel shows (name `utrum`).
3. Wait for Vercel to mark the domain valid; HTTPS is automatic.

## 4. Smoke test after each deploy

1. Phone A: create a list with 6 items, taking part yourself. Compare until done; the "Compare views" tab shows only you.
2. Phone B: open the list link, join with a new name. The "Compare views" tab is locked. Compare until done: now it shows both rankings, the agreement and where you differ.
3. Phone B: suggest an item. Both phones get only the new comparisons it brings.
4. Phone A, host panel: both people with their status, the results, the suggested item tagged with B's name. Remove an item: rankings keep their order.
5. Paste the list link in a WhatsApp chat: the card shows the title and the criterion, no names.
