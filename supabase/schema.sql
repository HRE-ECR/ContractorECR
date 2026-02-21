-- ============================================
-- ContractorECR schema.sql (clean)
-- Includes:
-- - profiles + roles (New_Teamleader/teamleader/admin/Display)
-- - contractors table (areas text[])
-- - RLS policies
-- - realtime publication enablement
-- - Custom Access Token Hook (JWT role claim)
-- - Cleanup retention: 30 days (optional pg_cron schedule)
-- ============================================

-- Extensions
create extension if not exists pgcrypto;

-- Enum types
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'status_type') THEN
    CREATE TYPE public.status_type AS ENUM ('pending','confirmed','signed_out');
  END IF;
END $$;

-- =========================
-- Profiles
-- =========================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  role text not null default 'New_Teamleader',
  created_at timestamptz not null default now()
);

-- Ensure default + allowed roles
alter table public.profiles
  alter column role set default 'New_Teamleader';

alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('New_Teamleader','teamleader','admin','Display'));

-- Create profile on new user (default role = New_Teamleader)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'New_Teamleader')
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =========================
-- Contractors
-- =========================
create table if not exists public.contractors (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  surname text not null,
  company text not null,
  phone text not null,
  areas text[] not null,
  status public.status_type not null default 'pending',
  fob_number text,
  fob_returned boolean not null default false,
  signout_requested boolean not null default false,
  signed_in_at timestamptz not null default now(),
  sign_in_confirmed_at timestamptz,
  sign_in_confirmed_by uuid,
  sign_in_confirmed_by_email text,
  signed_out_at timestamptz,
  signed_out_by uuid,
  signed_out_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- If you previously had areas as enum array (_area_type), safely convert to text[]
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'contractors'
      AND column_name = 'areas'
      AND udt_name = '_area_type'
  ) THEN
    ALTER TABLE public.contractors
      ALTER COLUMN areas TYPE text[]
      USING (areas::text[]);
  END IF;
END $$;

-- Ensure at least one area selected
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'contractors_at_least_one_area'
      AND conrelid = 'public.contractors'::regclass
  ) THEN
    ALTER TABLE public.contractors
      ADD CONSTRAINT contractors_at_least_one_area
      CHECK (array_length(areas, 1) >= 1);
  END IF;
END $$;

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_timestamp on public.contractors;
create trigger set_timestamp
  before update on public.contractors
  for each row execute function public.set_updated_at();

-- Indexes
create index if not exists contractors_phone_open_idx on public.contractors (phone, signed_out_at);
create index if not exists contractors_status_idx on public.contractors (status);
create index if not exists contractors_signed_in_idx on public.contractors (signed_in_at desc);
create index if not exists contractors_signed_out_idx on public.contractors (signed_out_at desc);

-- =========================
-- Public sign-out request function (used by SignOut page)
-- =========================
create or replace function public.request_signout(p_first text, p_phone text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.contractors
  set signout_requested = true
  where signed_out_at is null
    and lower(first_name) = lower(trim(p_first))
    and phone = trim(p_phone);

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.request_signout(text, text) from public;
grant execute on function public.request_signout(text, text) to anon, authenticated;

-- =========================
-- Role helper functions (used by RLS)
-- =========================
create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.is_teamleader()
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('teamleader','admin')
  );
$$;

create or replace function public.is_display()
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'Display'
  );
$$;

-- ============================================================
-- Custom Access Token Hook (JWT role claim)
-- Injects role into JWT: claims.app_metadata.app_role
-- ============================================================
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  claims jsonb := coalesce(event->'claims', '{}'::jsonb);
  uid uuid;
  r text;
begin
  -- Safely parse user_id
  begin
    uid := (event->>'user_id')::uuid;
  exception when others then
    return jsonb_build_object('claims', claims);
  end;

  -- Fetch role
  select role into r
  from public.profiles
  where id = uid;

  if r is null then
    r := 'New_Teamleader';
  end if;

  -- Set claim: app_metadata.app_role
  claims := jsonb_set(
    claims,
    '{app_metadata,app_role}',
    to_jsonb(r),
    true
  );

  return jsonb_build_object('claims', claims);

exception when others then
  -- Fail-safe: never block auth if unexpected errors occur
  return jsonb_build_object('claims', claims);
end;
$$;

grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook(jsonb) from anon, authenticated, public;

-- =========================
-- RLS
-- =========================
alter table public.contractors enable row level security;
alter table public.profiles enable row level security;

-- Profiles: view own
drop policy if exists "Profiles are viewable by owners" on public.profiles;
create policy "Profiles are viewable by owners"
on public.profiles
for select
to authenticated
using (id = auth.uid());

-- Profiles: admin can view all
drop policy if exists "Admins can view all profiles" on public.profiles;
create policy "Admins can view all profiles"
on public.profiles
for select
to authenticated
using (public.is_admin());

-- Contractors: public can insert sign-in requests
drop policy if exists "Public can insert contractor sign-in" on public.contractors;
create policy "Public can insert contractor sign-in"
on public.contractors
for insert
to anon
with check (true);

-- Contractors: Teamleaders OR Display can read
drop policy if exists "Teamleaders can read contractors" on public.contractors;
create policy "Teamleaders can read contractors"
on public.contractors
for select
to authenticated
using (public.is_teamleader() OR public.is_display());

-- Contractors: Teamleaders can update (Display cannot update)
drop policy if exists "Teamleaders can update contractors" on public.contractors;
create policy "Teamleaders can update contractors"
on public.contractors
for update
to authenticated
using (public.is_teamleader());

-- Contractors: only admins can delete
drop policy if exists "Admins can delete contractors" on public.contractors;
create policy "Admins can delete contractors"
on public.contractors
for delete
to authenticated
using (public.is_admin());

-- =========================
-- Cleanup function (RETENTION: 30 DAYS)
-- =========================
create or replace function public.cleanup_old_contractor_data(days_to_keep integer default 30)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.contractors c
  where coalesce(c.signed_out_at, c.signed_in_at) < now() - make_interval(days => days_to_keep);
end;
$$;

grant execute on function public.cleanup_old_contractor_data(integer) to service_role, authenticated;

-- =========================
-- OPTIONAL: Schedule daily cleanup via pg_cron (if available)
-- Runs at 03:00 daily: keeps 30 days of data
-- =========================
DO $$
BEGIN
  IF EXISTS (select 1 from pg_extension where extname = 'pg_cron') THEN
    BEGIN
      IF NOT EXISTS (select 1 from cron.job where jobname = 'cleanup_contractors_daily') THEN
        PERFORM cron.schedule(
          'cleanup_contractors_daily',
          '0 3 * * *',
          $job$select public.cleanup_old_contractor_data(30);$job$
        );
      END IF;
    EXCEPTION WHEN undefined_table THEN
      -- cron schema/table not present (pg_cron not available / not exposed), ignore safely
      NULL;
    END;
  END IF;
END $$;

-- =========================
-- Realtime (Postgres Changes) enablement
-- =========================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication p
    JOIN pg_publication_rel pr ON pr.prpubid = p.oid
    JOIN pg_class c ON c.oid = pr.prrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE p.pubname = 'supabase_realtime'
      AND n.nspname = 'public'
      AND c.relname = 'contractors'
  ) THEN
    EXECUTE 'alter publication supabase_realtime add table public.contractors';
  END IF;
END $$;

-- Recommended for better UPDATE payloads for realtime listeners
alter table public.contractors replica identity full;
