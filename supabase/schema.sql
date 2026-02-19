create extension if not exists pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'area_type') THEN
    CREATE TYPE area_type AS ENUM ('M1','M2','Insp','1CL','2CL','3CL','4CL');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'status_type') THEN
    CREATE TYPE status_type AS ENUM ('pending','confirmed','signed_out');
  END IF;
END $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  role text not null default 'New_Teamleader',
  created_at timestamptz not null default now()
);

alter table public.profiles alter column role set default 'New_Teamleader';

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('New_Teamleader','teamleader','admin'));

create or replace function public.handle_new_user() returns trigger as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'New_Teamleader')
  on conflict do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

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

alter table public.contractors add column if not exists sign_in_confirmed_by uuid;
alter table public.contractors add column if not exists sign_in_confirmed_by_email text;
alter table public.contractors add column if not exists signed_out_by uuid;
alter table public.contractors add column if not exists signed_out_by_email text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'contractors_at_least_one_area'
      AND conrelid = 'public.contractors'::regclass
  ) THEN
    ALTER TABLE public.contractors ADD CONSTRAINT contractors_at_least_one_area CHECK (array_length(areas, 1) >= 1);
  END IF;
END $$;

create or replace function public.set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_timestamp on public.contractors;
create trigger set_timestamp before update on public.contractors for each row execute function public.set_updated_at();

create index if not exists contractors_phone_open_idx on public.contractors (phone, signed_out_at);
create index if not exists contractors_status_idx on public.contractors (status);
create index if not exists contractors_signed_in_idx on public.contractors (signed_in_at desc);

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

create or replace function public.is_admin() returns boolean as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$ language sql stable;

create or replace function public.is_teamleader() returns boolean as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('teamleader','admin'));
$$ language sql stable;

alter table public.contractors enable row level security;
alter table public.profiles enable row level security;

drop policy if exists "Profiles are viewable by owners" on public.profiles;
create policy "Profiles are viewable by owners" on public.profiles for select to authenticated using (id = auth.uid());

drop policy if exists "Admins can view all profiles" on public.profiles;
create policy "Admins can view all profiles" on public.profiles for select to authenticated using (public.is_admin());

drop policy if exists "Public can insert contractor sign-in" on public.contractors;
create policy "Public can insert contractor sign-in" on public.contractors for insert to anon with check (true);

drop policy if exists "Teamleaders can read contractors" on public.contractors;
create policy "Teamleaders can read contractors" on public.contractors for select to authenticated using (public.is_teamleader());

drop policy if exists "Teamleaders can update contractors" on public.contractors;
create policy "Teamleaders can update contractors" on public.contractors for update to authenticated using (public.is_teamleader());

drop policy if exists "Admins can delete contractors" on public.contractors;
create policy "Admins can delete contractors" on public.contractors for delete to authenticated using (public.is_admin());

create or replace function public.cleanup_old_contractor_data(days_to_keep integer default 7)
returns void as $$
begin
  delete from public.contractors c
  where coalesce(c.signed_out_at, c.signed_in_at) < now() - make_interval(days => days_to_keep);
end;
$$ language plpgsql security definer;

grant execute on function public.cleanup_old_contractor_data(integer) to service_role, authenticated;
