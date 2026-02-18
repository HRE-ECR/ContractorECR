-- Enable required extensions
create extension if not exists pgcrypto;

-- Types for areas and status
do $$
begin
  if not exists (select 1 from pg_type where typname = 'area_type') then
    create type area_type as enum ('M1','M2','Insp','1CL','2CL','3CL','4CL');
  end if;
  if not exists (select 1 from pg_type where typname = 'status_type') then
    create type status_type as enum ('pending','confirmed','signed_out');
  end if;
end $$;

-- Profiles table for roles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  role text not null default 'teamleader' check (role in ('teamleader','admin')),
  created_at timestamptz not null default now()
);

-- Create profile on new user
create or replace function public.handle_new_user() returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict do nothing;
  return new;
end;
$$ language plpgsql security definer;

-- Make trigger idempotent

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Contractors/Visitors table
create table if not exists public.contractors (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  surname text not null,
  company text not null,
  phone text not null,
  areas area_type[] not null,
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

-- If you are upgrading an existing table, these keep the script idempotent
alter table public.contractors add column if not exists sign_in_confirmed_by uuid;
alter table public.contractors add column if not exists sign_in_confirmed_by_email text;
alter table public.contractors add column if not exists signed_out_by uuid;
alter table public.contractors add column if not exists signed_out_by_email text;

-- Ensure at least one area selected (idempotent)
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'contractors_at_least_one_area'
      and conrelid = 'public.contractors'::regclass
  ) then
    alter table public.contractors
      add constraint contractors_at_least_one_area
      check (array_length(areas, 1) >= 1);
  end if;
end $$;

-- Updated_at trigger
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

-- Helpful indexes
create index if not exists contractors_phone_open_idx on public.contractors (phone, signed_out_at);
create index if not exists contractors_status_idx on public.contractors (status);
create index if not exists contractors_signed_in_idx on public.contractors (signed_in_at desc);

-- Sign-out request function (publicly callable)
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

-- Role helper functions for RLS
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

-- Row Level Security
alter table public.contractors enable row level security;
alter table public.profiles enable row level security;

-- Policies

drop policy if exists "Profiles are viewable by owners" on public.profiles;
create policy "Profiles are viewable by owners"
on public.profiles
for select
to authenticated
using (id = auth.uid());

drop policy if exists "Admins can view all profiles" on public.profiles;
create policy "Admins can view all profiles"
on public.profiles
for select
to authenticated
using (public.is_admin());

-- Anyone (anon) can insert a contractor sign-in request

drop policy if exists "Public can insert contractor sign-in" on public.contractors;
create policy "Public can insert contractor sign-in"
on public.contractors
for insert
to anon
with check (true);

-- Team leaders can read all

drop policy if exists "Teamleaders can read contractors" on public.contractors;
create policy "Teamleaders can read contractors"
on public.contractors
for select
to authenticated
using (public.is_teamleader());

-- Team leaders can update (confirm sign-in/out, fob status)

drop policy if exists "Teamleaders can update contractors" on public.contractors;
create policy "Teamleaders can update contractors"
on public.contractors
for update
to authenticated
using (public.is_teamleader());

-- Only admins can delete rows

drop policy if exists "Admins can delete contractors" on public.contractors;
create policy "Admins can delete contractors"
on public.contractors
for delete
to authenticated
using (public.is_admin());

-- Cleanup function to delete old data
create or replace function public.cleanup_old_contractor_data(days_to_keep integer default 7)
returns void as $$
begin
  delete from public.contractors c
  where coalesce(c.signed_out_at, c.signed_in_at) < now() - make_interval(days => days_to_keep);
end;
$$ language plpgsql security definer;

grant execute on function public.cleanup_old_contractor_data(integer) to service_role, authenticated;

-- Optional: schedule daily cleanup at 03:00 using pg_cron if available
DO $do$
BEGIN
  BEGIN
    EXECUTE 'create extension if not exists pg_cron';
  EXCEPTION WHEN others THEN
    NULL;
  END;

  IF EXISTS (select 1 from pg_catalog.pg_extension where extname = 'pg_cron') THEN
    BEGIN
      EXECUTE 'select cron.unschedule(jobid) from cron.job where jobname = ''sp_cleanup_old_contractor_data''';
      EXECUTE 'select cron.schedule(''sp_cleanup_old_contractor_data'', ''0 3 * * *'', ''select public.cleanup_old_contractor_data(7);'')';
    EXCEPTION WHEN others THEN
      NULL;
    END;
  END IF;
END
$do$;
