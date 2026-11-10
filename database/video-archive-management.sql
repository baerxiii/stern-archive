-- Apply after database/video-archives.sql. Safe to run again.
begin;

create table if not exists public.video_archive_migrations (
  name text primary key
);
alter table public.video_archive_migrations enable row level security;
revoke all on public.video_archive_migrations from anon, authenticated;
grant select on public.video_archive_migrations to anon, authenticated;
drop policy if exists "Public can read video archive migrations" on public.video_archive_migrations;
create policy "Public can read video archive migrations" on public.video_archive_migrations
  for select to anon, authenticated using (true);

with first_run as (
  insert into public.video_archive_migrations (name)
  values ('managed-default-1998')
  on conflict do nothing
  returning name
)
insert into public.shared_video_archives (archive_id, title)
select '1998.03.11-blockbuster-awards-e', '1998 video archive'
from first_run
on conflict (archive_id) do nothing;

grant update on public.shared_video_archives to authenticated;
drop policy if exists "Editors can update video archives" on public.shared_video_archives;
create policy "Editors can update video archives" on public.shared_video_archives
  for update to authenticated
  using (exists (select 1 from public.library_editors where user_id = auth.uid()))
  with check (exists (select 1 from public.library_editors where user_id = auth.uid()));

commit;
