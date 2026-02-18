# Deployment checklist

- [ ] Create Supabase project
- [ ] Run `supabase/schema.sql`
- [ ] Push code to GitHub repo
- [ ] Enable GitHub Pages (Source = GitHub Actions)
- [ ] Add secrets: SUPABASE_URL, SUPABASE_ANON_KEY
- [ ] Confirm build/deploy succeeds
- [ ] Test: sign-in -> confirm sign-in with fob -> sign-out request -> confirm sign-out
- [ ] Check signed out table and CSV export
