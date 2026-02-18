# ContractorECR - Contractor and Visitor Manager

React + Vite + Tailwind front end, Supabase back end.

## Dashboard
- Awaiting confirmation table
- On site table
- Signed out table (last 10, with Show more to 30)
- Export all tables button (CSV)

Signed-out records are kept for up to 7 days and are removed by the cleanup job.

## Setup
### Supabase
1. Create a Supabase project.
2. Run `supabase/schema.sql` in the Supabase SQL editor.
3. Authentication -> URL Configuration:
   - Set Site URL to your GitHub Pages URL.
   - Add your local URL (for example `http://localhost:5173/`) as an additional redirect URL if needed.

### GitHub
1. Enable Pages: Settings -> Pages -> Source: GitHub Actions.
2. Add secrets in repo settings -> Secrets and variables -> Actions:
   - SUPABASE_URL
   - SUPABASE_ANON_KEY
3. Push to main.

## Admin role
Team leaders default to role `teamleader`. Promote to admin:

```sql
update public.profiles set role = 'admin' where email = 'someone@example.com';
```
