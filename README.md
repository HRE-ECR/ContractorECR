
# Site Pass — Contractor & Visitor Manager

A responsive web app (React + Vite + Tailwind + Supabase) to manage contractor/visitor sign-ins and sign-outs with Team Leader authentication.

## Features
- **Landing page** with clear actions: Contractor/Visitor sign-in, sign-out, and Team Leader login.
- **Contractor/Visitor sign-in** (no account required): collects First name, Surname, Company, Phone, and one or more Areas (M1, M2, Insp, 1CL, 2CL, 3CL, 4CL). Records timestamp on submission.
- **Team Leader portal** (email+password via Supabase Auth):
  - View all current/last 7 days records.
  - Confirm sign-in by assigning a **visitor fob number** (mandatory at confirmation).
  - See **sign-out requests** coming from the sign-out page.
  - Confirm sign-out (requires **fob returned** checkbox) and optionally **delete** entries (admins only).
- **Dashboard summary**: total on site and counts per Area.
- **Data retention**: automatic cleanup after **7 days** (via `pg_cron` if available, otherwise manual/Edge schedule).
- **Deployed to GitHub Pages** with a single workflow. Uses HashRouter to avoid 404s.

## Quick start

### 1) Create Supabase project
1. Create a new Supabase project.
2. In the SQL Editor, run the contents of [`supabase/schema.sql`](./supabase/schema.sql).
   - This sets up tables, RLS policies, auth profile sync, helper functions, and optional daily cleanup.

> **Note:** If your project does not allow `pg_cron`, schedule cleanup by either:
> - Creating a Supabase **Scheduled Function (Edge)** that calls `select public.cleanup_old_contractor_data(7);`, or
> - Running the SQL manually as needed.

### 2) Configure GitHub repository
1. Create a repo and push this project.
2. In **Repository → Settings → Secrets and variables → Actions → New repository secret**:
   - `SUPABASE_URL` = your project URL (e.g., `https://xyzcompany.supabase.co`)
   - `SUPABASE_ANON_KEY` = your anon public API key
3. Ensure **Pages** is enabled (it will be configured by the workflow). The workflow sets `BASE_PATH` to `/<repo>/` automatically.

### 3) Local development (optional)
```bash
npm i
cp .env.example .env.local
# set values inside .env.local
npm run dev
```

### 4) Roles
- Team leader accounts are created through the **Sign up** tab. They receive role `teamleader` by default.
- To grant admin permissions, update the profile role:
```sql
update public.profiles set role = 'admin' where email = 'someone@company.com';
```

### 5) How it works
- **Sign-in page** inserts a row to `public.contractors` with status `pending`.
- **Dashboard (Team leader):**
  - **Awaiting confirmation**: enter **fob number** and press **Confirm sign-in** → sets status to `confirmed` and timestamp.
  - **Sign-out requested**: appears once the visitor submits their sign-out request (first name + phone). Team leader must tick **fob returned** and press **Confirm sign-out** → sets `signed_out_at` and status `signed_out`.
  - **Delete** button is visible to admins only.
- **Sign-out page** calls the secured function `public.request_signout(first, phone)` to set `signout_requested = true` for any open session(s) that match.

### 6) Retention & cleanup
- `public.cleanup_old_contractor_data(days)` deletes rows where `coalesce(signed_out_at, signed_in_at) < now() - interval 'days'`.
- The SQL attempts to schedule a daily job at 03:00 via `pg_cron` when available.

### 7) Routing on GitHub Pages
This app uses **HashRouter** so deep links won’t 404 on Pages. The workflow injects `BASE_PATH` so assets resolve under `/<repo>/`.

## Environment variables
- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — Supabase anon public key

## Security notes
- RLS allows **anon inserts** only for new sign-in rows and **RPC sign-out requests**. All reads/updates/deletes require authenticated team leaders.
- Admins can delete; team leaders can update but not delete.

## License
MIT
