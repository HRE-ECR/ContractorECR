# ContractorECR (v0.5.1)

## Fix included
- Prevents any unapproved role (including `New_Teamleader` or missing profile role) from accessing Dashboard.
- The approval message is shown unless role is exactly `teamleader` or `admin`.
- Dashboard link is hidden until approved.

## Setup
1. Run `supabase/schema.sql` in Supabase SQL Editor.
2. In Supabase Auth -> URL Configuration, add redirect:
   `https://<your-pages-url>/#/reset-password`
3. GitHub -> Settings -> Secrets and variables -> Actions:
   - SUPABASE_URL
   - SUPABASE_ANON_KEY
4. GitHub Pages -> Source: GitHub Actions.

## Approving users
Update a user role:
```sql
update public.profiles set role = 'teamleader' where email = 'someone@hitachirail.com';
```
