-- Apply after database/library-editors.sql in the Supabase SQL editor.
begin;

create table if not exists public.shared_video_archives (
  archive_id text primary key,
  title text not null,
  created_at timestamptz not null default now()
);

alter table public.shared_video_archives enable row level security;
revoke all on public.shared_video_archives from anon, authenticated;
grant select on public.shared_video_archives to anon, authenticated;
grant insert, delete on public.shared_video_archives to authenticated;

drop policy if exists "Public can read video archives" on public.shared_video_archives;
drop policy if exists "Editors can add video archives" on public.shared_video_archives;
drop policy if exists "Editors can delete video archives" on public.shared_video_archives;
create policy "Public can read video archives" on public.shared_video_archives
  for select to anon, authenticated using (true);
create policy "Editors can add video archives" on public.shared_video_archives
  for insert to authenticated with check (exists (select 1 from public.library_editors where user_id = auth.uid()));
create policy "Editors can delete video archives" on public.shared_video_archives
  for delete to authenticated using (exists (select 1 from public.library_editors where user_id = auth.uid()));

commit;
