-- Apply after database/video-archives.sql and database/video-archive-management.sql.
begin;

alter table public.shared_video_archives
  add column if not exists category text not null default 'Uncategorized';

commit;
