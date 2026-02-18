# ContractorECR - Contractor and Visitor Manager

## Dashboard
- Awaiting confirmation table
- On site table
- Signed out table (last 10, Show more to 30)
- Export all tables button (CSV)

Signed-out records are kept for up to 7 days and are removed by the cleanup job.

## Setup
1. Run `supabase/schema.sql` in Supabase SQL editor.
2. In GitHub, add Actions secrets: SUPABASE_URL and SUPABASE_ANON_KEY.
3. Enable Pages: Settings -> Pages -> Source: GitHub Actions.
