-- Extensions
create extension if not exists pgcrypto;

-- Enum types (area_type removed because areas now uses text[])
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'status_type') THEN
    CREATE TYPE status_type AS ENUM ('pending','confirmed','signed_out');
  END IF;
END $$;

-- Profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  role text not null default 'New_Teamleader',
  created_at timestamptz not null default now()
);

alter table public.profiles
  alter column role set default 'New_Teamleader';

alter table public.profiles
  drop constraint if exists profiles_role_check;

-- Added Display role here
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('New_Teamleader','teamleader','admin','Display'));

-- Create profile on new user (default role = New_Teamleader)
create or replace function public.handle_new_user() returns trigger as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'New_Teamleader')
  on conflict do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Contractors table (areas now text[])
create table if not exists public.contractors (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  surname text not null,
  company text not null,
  phone text not null,
  areas text[] not null,
  status status_type not null default 'pending',
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

-- If you already had areas as area_type[] (enum array), convert it to text[] safely
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

-- idempotent alter for audit columns
alter table public.contractors add column if not exists sign_in_confirmed_by uuid;
alter table public.contractors add column if not exists sign_in_confirmed_by_email text;
alter table public.contractors add column if not exists signed_out_by uuid;
alter table public.contractors add column if not exists signed_out_by_email text;

-- ensure at least one area
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
create or replace function public.set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_timestamp on public.contractors;
create trigger set_timestamp
before update on public.contractors
for each row execute function public.set_updated_at();

-- Indexes
create index if not exists contractors_phone_open_idx on public.contractors (phone, signed_out_at);
create index if not exists contractors_status_idx on public.contractors (status);
create index if not exists contractors_signed_in_idx on public.contractors (signed_in_at desc);

-- Public sign-out request function
create or replace function public.request_signout(p_first text, p_phone text)
returns integer as $$
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
$$ language plpgsql security definer set search_path = public;

revoke all on function public.request_signout(text, text) from public;
grant execute on function public.request_signout(text, text) to anon, authenticated;

-- Role helper functions
create or replace function public.is_admin() returns boolean as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$ language sql stable;

create or replace function public.is_teamleader() returns boolean as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role in ('teamleader','admin')
  );
$$ language sql stable;

create or replace function public.is_display() returns boolean as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'Display'
  );
$$ language sql stable;

--------------------------------------------------------------------------------
-- JWT Custom Access Token Hook (NO client query to public.profiles needed)
-- Adds the user's role into the JWT as: app_metadata.app_role
-- After running this SQL, enable it in Supabase:
-- Auth -> Hooks -> Custom Access Token Hook -> public.custom_access_token_hook
--------------------------------------------------------------------------------
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
as $$
declare
  claims jsonb := event->'claims';
  uid uuid := (event->>'user_id')::uuid;
  r text;
begin
  select role into r
  from public.profiles
  where id = uid;

  if r is null then
    r := 'New_Teamleader';
  end if;

  claims := jsonb_set(
    claims,
    '{app_metadata,app_role}',
    to_jsonb(r),
    true
  );

  return jsonb_build_object('claims', claims);
end;
$$;

-- RLS
alter table public.contractors enable row level security;
alter table public.profiles enable row level security;

-- Profiles policies (view own)
drop policy if exists "Profiles are viewable by owners" on public.profiles;
create policy "Profiles are viewable by owners"
on public.profiles
for select
to authenticated
using (id = auth.uid());

-- Admin can view all profiles
drop policy if exists "Admins can view all profiles" on public.profiles;
create policy "Admins can view all profiles"
on public.profiles
for select
to authenticated
using (public.is_admin());

-- Contractors policies
-- Anyone can insert sign-in requests
drop policy if exists "Public can insert contractor sign-in" on public.contractors;
create policy "Public can insert contractor sign-in"
on public.contractors
for insert
to anon
with check (true);

-- Teamleaders OR Display can read contractors
drop policy if exists "Teamleaders can read contractors" on public.contractors;
create policy "Teamleaders can read contractors"
on public.contractors
for select
to authenticated
using (public.is_teamleader() OR public.is_display());

-- Team leaders can update (Display cannot update)
drop policy if exists "Teamleaders can update contractors" on public.contractors;
create policy "Teamleaders can update contractors"
on public.contractors
for update
to authenticated
using (public.is_teamleader());

-- Only admins can delete
drop policy if exists "Admins can delete contractors" on public.contractors;
create policy "Admins can delete contractors"
on public.contractors
for delete
to authenticated
using (public.is_admin());

-- Cleanup function
create or replace function public.cleanup_old_contractor_data(days_to_keep integer default 7)
returns void as $$
begin
  delete from public.contractors c
  where coalesce(c.signed_out_at, c.signed_in_at) < now() - make_interval(days => days_to_keep);
end;
$$ language plpgsql security definer;

grant execute on function public.cleanup_old_contractor_data(integer) to service_role, authenticated;

--------------------------------------------------------------------------------
-- Realtime (Postgres Changes) for Dashboard / Screen display auto-refresh
-- Required: add contractors table to supabase_realtime publication
--------------------------------------------------------------------------------
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

-- Recommended: improves UPDATE payloads for realtime listeners
alter table public.contractors replica identity full;
