# ContractorECR (v0.5.0)

## Key features
- Contractor/Visitor sign-in and sign-out request pages
- Team leader dashboard with:
  - Awaiting confirmation table
  - On site table (includes signed-in time, signed-in by)
  - Signed out table (last 10 / show more to 30)
  - Export all tables (CSV)
  - Refresh button
  - Sign-out confirmation rules:
    - Team leader: requires sign-out requested = Yes AND fob returned
    - Admin: requires fob returned only

## New team leader approval flow
- New signups are created with role `New_Teamleader`.
- They can log in but will be blocked from dashboard with:
  "Please contact Admin for team leader account approval."
- Admin approves by updating role in Supabase:

```sql
update public.profiles set role = 'teamleader' where email = 'someone@example.com';
```

## Forgotten password
- Login page includes "Forgot password".
- Password reset link redirects to `#/reset-password`.

## Deploy
1. Create a Supabase project.
2. Run `supabase/schema.sql` in Supabase SQL editor.
3. In Supabase Auth settings, add redirect URL for password reset:
   - `https://<your-pages-url>/#/reset-password`
4. In GitHub repo settings -> Secrets and variables -> Actions, add:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
5. Enable GitHub Pages -> Source: GitHub Actions.
6. Push to main.
