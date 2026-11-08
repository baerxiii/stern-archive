# stern-archive

Listening history saves each archive episode, podcast episode, and audiobook chapter
in the browser's local storage. Open History to resume an item or play a finished
item again. History is local to the browser and device; clearing site data removes
it. Previously saved archive and audiobook positions are used when those items
are opened. Playback requires access to the original archive or podcast feed.

## Shared archive library

Archives are grouped by category and sorted by year, oldest first; entries without
a year appear last. Entering a new category when adding an archive creates it.
Shared changes require an authorized Supabase email/password account.
Existing browser-only custom archives remain on that browser and can be removed
there by an authorized editor. Deleting a default archive hides it from the shared library, and deleting
any entry does not delete the original audio.

Before enabling shared editing, a Supabase project administrator must:

1. Apply `database/library-editors.sql` in the Supabase SQL editor. It replaces
   the existing `custom_library` row-level security policies, so review any
   existing integrations before applying it.
2. Create the editor's account in Supabase Auth, then authorize its user ID in
   the SQL editor with `insert into public.library_editors (user_id) values
   ('USER_UUID');`. Repeat for each authorized editor. Only a database admin can
   change this allowlist; signing up alone does not grant editing access.
3. Sign in on the archive library page using that account.

Until the migration is applied, the old database policies remain in force and
shared editing is not enabled by this interface. The migration is required to
enforce editor authorization at the database, not just in the browser. Reapply
`database/library-editors.sql` after pulling updates that add shared podcasts;
it creates the shared podcast table and its editor-only insert policy.

## Shared podcasts

Podcast feeds added from the Podcasts page are shared with everyone. Sign in
there with an authorized editor account, choose **Add podcast**, and enter the
podcast name and its HTTP(S) RSS feed URL. The built-in feeds remain in
`podcasts.json`; feeds added through the page are stored in Supabase.

Browsers can only read remote feeds whose hosts allow cross-origin access. The
Corbett Report feed has an optional, feed-specific Supabase Edge Function fallback
for when direct browser access fails. To enable it, deploy
`supabase/functions/corbett-feed/index.ts` as an Edge Function named
`corbett-feed` in the same Supabase project. For a dashboard deployment, create
the function via the editor, paste in that file's contents, and disable JWT
verification for the function so visitors can read the public feed. The CLI
configuration in `supabase/config.toml` also disables JWT verification for this
function. This public function can fetch only that hard-coded feed; it is not a
general-purpose proxy. Supabase usage limits and costs apply. Other feeds still
need to allow browser access.