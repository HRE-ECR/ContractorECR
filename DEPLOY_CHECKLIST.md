
# Deployment checklist

- [ ] Create Supabase project
- [ ] Run `supabase/schema.sql` in SQL Editor
- [ ] Create GitHub repository and push project
- [ ] Add Actions secrets: `SUPABASE_URL`, `SUPABASE_ANON_KEY`
- [ ] Enable GitHub Pages (workflow will publish automatically on `main`)
- [ ] Test flows: sign-in, dashboard confirm sign-in, sign-out request, confirm sign-out, summary counts
- [ ] (Optional) Grant admin role to selected accounts via SQL
- [ ] Verify 7-day cleanup (pg_cron or scheduled function)
