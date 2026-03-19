-- ============================================
-- ContractorECR schema.sql (Option A - Hardened + Security Patch, corrected)
-- - Keeps anon insert (kiosk compatibility)
-- - Unique partial index: no duplicate open entries (company+phone)
-- - request_signout updates only ONE latest matching row
-- - Server-side attribution for *_by and *_by_email fields
-- - Phone format validation
-- - Insert/Update audit trail + delete audit
-- - Hardened cleanup: ONLY delete signed_out_at older than N days
-- - Cleanup audited, and EXECUTE restricted to service_role
-- - pg_cron daily schedule at 03:00 (safe re-create)
-- - FIX: Realtime block uses n.nspname (typo corrected)
-- - FIX: all_areas_valid uses plpgsql and self-guards if public.areas absent
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

-- Prevent multiple open records per company+phone
create unique index if not exists contractors_unique_open_company_phone_idx
on public.contractors (company, phone)
where signed_out_at is null;

-- =========================
-- Public sign-out request function (used by SignOut page)
-- Hardened: only flips ONE most recent open match
-- =========================
create or replace function public.request_signout(p_first text, p_phone text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
 v_id uuid;
begin
 select id into v_id
 from public.contractors
 where signed_out_at is null
   and lower(first_name) = lower(trim(p_first))
   and phone = trim(p_phone)
 order by signed_in_at desc
 limit 1;

 if v_id is null then
  return 0;
 end if;

 update public.contractors
 set signout_requested = true
 where id = v_id;

 return 1;
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

-- Contractors: public can insert sign-in requests (kiosk)
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

-- ✅ DELETE LOCKDOWN
drop policy if exists "Privileged can delete pending contractors" on public.contractors;
create policy "Privileged can delete pending contractors"
on public.contractors
for delete
to authenticated
using (
  public.is_teamleader()
  and status = 'pending'
  and sign_in_confirmed_at is null
  and signed_out_at is null
);

-- Ensure authenticated has delete privilege (RLS still applies)
grant delete on table public.contractors to authenticated;

-- =========================
-- INPUT VALIDATION
-- =========================

-- Phone: accept 7..20 digits when non-digits stripped
DO $$
BEGIN
 IF NOT EXISTS (
   SELECT 1 FROM pg_constraint
   WHERE conname = 'contractors_phone_format_chk'
     AND conrelid = 'public.contractors'::regclass
 ) THEN
   ALTER TABLE public.contractors
     ADD CONSTRAINT contractors_phone_format_chk
     CHECK (length(regexp_replace(phone, '\D', '', 'g')) between 7 and 20);
 END IF;
END $$;

-- Areas validation helper (safe even if public.areas does not exist)
create or replace function public.all_areas_valid(areas text[])
returns boolean
language plpgsql
stable
as $$
declare
  t_exists boolean;
  invalid_count integer;
begin
  -- Check if public.areas table exists; if not, treat as valid
  select exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'areas'
  ) into t_exists;

  if not t_exists then
    return true;
  end if;

  -- Validate each element against public.areas(code)
  select count(*) into invalid_count
  from unnest(areas) a
  left join public.areas ar on ar.code = a
  where ar.code is null;

  return (invalid_count = 0);
end;
$$;

-- Add constraint only if public.areas exists (and avoid duplicate add)
DO $$
BEGIN
 IF EXISTS (
   SELECT 1 FROM information_schema.tables
   WHERE table_schema = 'public' AND table_name = 'areas'
 ) AND NOT EXISTS (
   SELECT 1 FROM pg_constraint
   WHERE conname = 'contractors_areas_valid_chk'
     AND conrelid = 'public.contractors'::regclass
 ) THEN
   ALTER TABLE public.contractors
     ADD CONSTRAINT contractors_areas_valid_chk
     CHECK (public.all_areas_valid(areas));
 END IF;
END $$;

-- =========================
-- SERVER-SIDE ATTRIBUTION (prevent spoofing of *_by fields)
-- =========================

-- Helper to read jwt email safely
create or replace function public.current_jwt_email()
returns text
language plpgsql
stable
as $$
declare
  claims json;
  v_email text;
begin
  begin
    claims := current_setting('request.jwt.claims', true)::json;
    v_email := coalesce(claims->>'email', null);
  exception when others then
    v_email := null;
  end;
  return v_email;
end;
$$;

-- Trigger: enforce server-side attribution for sign-in confirm / sign-out
create or replace function public.enforce_actor_fields()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' then
    -- If sign-in got confirmed in this update
    if new.sign_in_confirmed_at is distinct from old.sign_in_confirmed_at
       and new.sign_in_confirmed_at is not null then
      new.sign_in_confirmed_by := auth.uid();
      new.sign_in_confirmed_by_email := public.current_jwt_email();
    end if;

    -- If sign-out was done in this update
    if new.signed_out_at is distinct from old.signed_out_at
       and new.signed_out_at is not null then
      new.signed_out_by := auth.uid();
      new.signed_out_by_email := public.current_jwt_email();
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_actor_fields on public.contractors;
create trigger trg_enforce_actor_fields
before update on public.contractors
for each row execute function public.enforce_actor_fields();

-- =========================
-- AUDIT: insert/update (delete audit below)
-- =========================
create table if not exists public.contractors_audit (
  id bigserial primary key,
  contractor_id uuid not null,
  action text not null,                       -- 'insert' | 'update'
  changed_at timestamptz not null default now(),
  changed_by uuid,
  changed_by_email text,
  old_row jsonb,
  new_row jsonb
);

create or replace function public.audit_contractors()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.contractors_audit (contractor_id, action, changed_by, changed_by_email, new_row)
    values (new.id, 'insert', auth.uid(), public.current_jwt_email(), to_jsonb(new));
    return new;
  elsif tg_op = 'UPDATE' then
    insert into public.contractors_audit (contractor_id, action, changed_by, changed_by_email, old_row, new_row)
    values (new.id, 'update', auth.uid(), public.current_jwt_email(), to_jsonb(old), to_jsonb(new));
    return new;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_audit_contractors on public.contractors;
create trigger trg_audit_contractors
after insert or update on public.contractors
for each row execute function public.audit_contractors();

-- =========================
-- HARDENED CLEANUP (Option A)
-- =========================

-- Delete audit table (idempotent)
create table if not exists public.contractors_delete_audit (
  id uuid primary key default gen_random_uuid(),
  deleted_at timestamptz not null default now(),
  deleted_count integer not null,
  days_to_keep integer not null,
  invoked_by text
);

-- Cleanup function: ONLY delete rows with a signed_out_at older than X days
create or replace function public.cleanup_old_contractor_data(days_to_keep integer default 30)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer;
begin
  delete from public.contractors c
  where c.signed_out_at is not null
    and c.signed_out_at < now() - make_interval(days => days_to_keep);

  get diagnostics v_deleted = row_count;

  insert into public.contractors_delete_audit (deleted_count, days_to_keep, invoked_by)
  values (v_deleted, days_to_keep, current_user);
end;
$$;

-- Tighten privileges: only service_role (backend) may invoke
revoke execute on function public.cleanup_old_contractor_data(integer) from public, anon, authenticated;
grant execute on function public.cleanup_old_contractor_data(integer) to service_role;

-- OPTIONAL: Force RLS if you want stricter guarantees (commented by default)
-- alter table public.contractors force row level security;

-- =========================
-- OPTIONAL: Schedule daily cleanup via pg_cron (if available)
-- Runs at 03:00 daily: keeps 30 days of data
-- Safely replaces any existing job with same name
-- =========================
DO $$
BEGIN
 IF EXISTS (select 1 from pg_extension where extname = 'pg_cron') THEN
  -- Unschedule any previous job with the same name
  IF EXISTS (select 1 from cron.job where jobname = 'cleanup_contractors_daily') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'cleanup_contractors_daily';
  END IF;

  -- Schedule fresh job
  PERFORM cron.schedule(
    'cleanup_contractors_daily',
    '0 3 * * *',
    $job$select public.cleanup_old_contractor_data(30);$job$
  );
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
