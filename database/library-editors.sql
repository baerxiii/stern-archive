-- Apply in the Supabase SQL editor. Creates custom_library if it does not exist
-- and replaces all policies on the library tables.
begin;

create table if not exists public.custom_library (
  id text primary key,
  archive_id text not null,
  title text not null,
  year text,
  category text not null default 'Stern Show',
  created_at timestamptz not null default now()
);
alter table public.custom_library add column if not exists category text not null default 'Stern Show';
alter table public.custom_library add column if not exists created_at timestamptz not null default now();

create table if not exists public.library_editors (
  user_id uuid primary key references auth.users(id) on delete cascade
);
create table if not exists public.hidden_default_archives (
  archive_id text primary key
);
create table if not exists public.shared_podcasts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  rss text not null unique,
  created_at timestamptz not null default now()
);

alter table public.custom_library enable row level security;
alter table public.library_editors enable row level security;
alter table public.hidden_default_archives enable row level security;
alter table public.shared_podcasts enable row level security;

do $$
declare existing_policy record;
begin
  for existing_policy in
    select tablename, policyname from pg_policies
    where schemaname = 'public'
      and tablename in ('custom_library', 'library_editors', 'hidden_default_archives', 'shared_podcasts')
  loop
    execute format('drop policy %I on public.%I', existing_policy.policyname, existing_policy.tablename);
  end loop;
end $$;

revoke all on public.library_editors from anon, authenticated;
grant select on public.library_editors to authenticated;
revoke all on public.custom_library, public.hidden_default_archives, public.shared_podcasts from anon, authenticated;
grant select on public.custom_library, public.hidden_default_archives, public.shared_podcasts to anon, authenticated;
grant insert, update, delete on public.custom_library, public.hidden_default_archives to authenticated;
grant insert on public.shared_podcasts to authenticated;

create policy "Editors can see their own authorization" on public.library_editors
  for select to authenticated using (user_id = auth.uid());
create policy "Public can read archives" on public.custom_library
  for select to anon, authenticated using (true);
create policy "Editors can add archives" on public.custom_library
  for insert to authenticated with check (exists (select 1 from public.library_editors where user_id = auth.uid()));
create policy "Editors can update archives" on public.custom_library
  for update to authenticated using (exists (select 1 from public.library_editors where user_id = auth.uid()))
  with check (exists (select 1 from public.library_editors where user_id = auth.uid()));
create policy "Editors can delete archives" on public.custom_library
  for delete to authenticated using (exists (select 1 from public.library_editors where user_id = auth.uid()));
create policy "Public can read hidden defaults" on public.hidden_default_archives
  for select to anon, authenticated using (true);
create policy "Editors can hide defaults" on public.hidden_default_archives
  for insert to authenticated with check (exists (select 1 from public.library_editors where user_id = auth.uid()));
create policy "Editors can update hidden defaults" on public.hidden_default_archives
  for update to authenticated using (exists (select 1 from public.library_editors where user_id = auth.uid()))
  with check (exists (select 1 from public.library_editors where user_id = auth.uid()));
create policy "Editors can restore defaults" on public.hidden_default_archives
  for delete to authenticated using (exists (select 1 from public.library_editors where user_id = auth.uid()));
create policy "Public can read podcasts" on public.shared_podcasts
  for select to anon, authenticated using (true);
create policy "Editors can add podcasts" on public.shared_podcasts
  for insert to authenticated with check (exists (select 1 from public.library_editors where user_id = auth.uid()));

commit;
