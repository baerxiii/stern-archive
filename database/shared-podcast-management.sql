-- Apply after database/library-editors.sql. Safe to run again.
begin;

alter table public.shared_podcasts enable row level security;
revoke all on public.shared_podcasts from anon, authenticated;
grant select on public.shared_podcasts to anon, authenticated;
grant insert, update, delete on public.shared_podcasts to authenticated;

drop policy if exists "Public can read podcasts" on public.shared_podcasts;
drop policy if exists "Editors can add podcasts" on public.shared_podcasts;
drop policy if exists "Editors can update podcasts" on public.shared_podcasts;
drop policy if exists "Editors can delete podcasts" on public.shared_podcasts;

create policy "Public can read podcasts" on public.shared_podcasts
  for select to anon, authenticated using (true);
create policy "Editors can add podcasts" on public.shared_podcasts
  for insert to authenticated with check (exists (select 1 from public.library_editors where user_id = auth.uid()));
create policy "Editors can update podcasts" on public.shared_podcasts
  for update to authenticated using (exists (select 1 from public.library_editors where user_id = auth.uid()))
  with check (exists (select 1 from public.library_editors where user_id = auth.uid()));
create policy "Editors can delete podcasts" on public.shared_podcasts
  for delete to authenticated using (exists (select 1 from public.library_editors where user_id = auth.uid()));

commit;
