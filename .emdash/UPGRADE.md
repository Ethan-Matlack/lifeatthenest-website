# EmDash upgrade work order

This file is the handoff for upgrading the project at `/home/ethanmatlack/Documents/github-repos/lifeatthenest-website` to the npm `latest` release. The updater resolved the direct packages, changed and installed them where needed, refreshed the project EmDash skills, and compared the installed core migration manifests. It did not edit application code, apply a database migration, or deploy the site.

## Package changes

- `@emdash-cms/cloudflare`: `1.5.0` → `1.6.0` (`^1.5.0` → `^1.6.0`)
- `emdash`: `1.5.0` → `1.6.0` (`^1.3.0` → `^1.6.0`)

## Release entries to assess

These are the complete authored major, minor, and patch entries crossed by the direct EmDash packages in this project. Changesets dependency-bump entries and attribution wrappers have been removed. Check whether each entry affects code or configuration in this project. Do not adopt an unrelated feature merely because it appears here.

### Change 1

Applies to: `@emdash-cms/cloudflare@1.6.0` (minor), `emdash@1.6.0` (minor)  
Source: [#4911](https://github.com/emdash-cms/emdash/pull/4911)

Caches EmDash image files for one year on sites with a compatible route-cache provider, such as `cacheCloudflare()`. Original files from `/_emdash/api/media/file/` and eligible resized variants from `/_image` share the tag `emdash:media:<storageKey>`. Replacing an image, or deleting one whose stored file is removed, purges that tag. Deletes from the admin media library and media picker, the MCP `media_delete` tool and `ctx.media.delete()` in plugin routes are covered, subject to the [purge limitations](https://docs.emdashcms.com/deployment/route-caching/#media-files).
  
  Astro's `memoryCache()` does not receive automatic media cache entries at any response size; page caching is unaffected. Other providers must preserve distinct source URLs and transform options in their cache keys and support conditional requests. Audio, video, partial responses and original-file URLs with query strings are not stored. Variants are eligible only when their `href` is a plain EmDash media path or that path prefixed with the request's origin, without a nested query or fragment.
  
  Automatic variant caching and query normalization apply only to Astro's stock sharp service on Node and `@astrojs/cloudflare/image-service-workerd` on Cloudflare. With these services, `/_image` URLs for EmDash media redirect with a `301` when their outer query contains unknown or repeated parameters, uses a different parameter order or encodes values differently. This also applies without a cache provider. Stock-service URLs built by `<Image>` and `getImage()` are unaffected. Custom image services retain their existing handling and parameters without these redirects or automatic variant caching.

### Change 2

Applies to: `@emdash-cms/cloudflare@1.6.0` (patch)  
Source: [#4940](https://github.com/emdash-cms/emdash/pull/4940)

Updates `@cloudflare/kumo` to 2.19.0. These packages now require exactly `@cloudflare/kumo@2.19.0`, so sites and plugins that install Kumo themselves should upgrade to that version to match the admin's prebuilt styles. Update `emdash` and the Forms, Field Kit, AI Moderation and AI Search plugins together, since their earlier releases require Kumo 2.15.0.
  
  In the admin, date pickers use Kumo's refreshed day and month buttons, and button labels are vertically centred.
  
  Plugin admin pages built with Kumo may need changes for `Radio.Group` tests, `DatePicker` style overrides and `Dialog` maximum heights. [Upgrade to Kumo 2.19](https://docs.emdashcms.com/plugins/creating-native-plugins/distributing/#upgrade-to-kumo-219) describes each change, and [Match the admin's Kumo version](https://docs.emdashcms.com/plugins/creating-native-plugins/distributing/#match-the-admins-kumo-version) explains how a plugin pins Kumo.

### Change 3

Applies to: `@emdash-cms/cloudflare@1.6.0` (patch), `emdash@1.6.0` (patch)  
Source: [#4968](https://github.com/emdash-cms/emdash/pull/4968)

Fixes media usage tracking missing files linked by their `/_emdash/api/media/file/` URL. **Used in** now includes Portable Text paragraph link marks, HTML block `href` and `src` attributes, and whole string or URL field values, including fields inside blocks and repeaters.
  
  Counts both root-relative URLs and full same-site URLs copied from the Media Library. Full URLs must match the site origin resolved from configuration or environment, the Site URL setting, or the setup URL when neither is set. The Site URL setting is used only for HTTPS or loopback HTTP addresses; for other HTTP sites, configure `siteUrl` instead (or `EMDASH_SITE_URL` on Node.js). External URLs and URLs embedded in plain text are not counted. Deleting media still requires reviewing its references first; usage tracking does not prevent deletion.
  
  Playground sessions now record their setup origin automatically, so full URLs from **Copy URL** are counted without setting Site URL manually.
  
  #### Upgrade action
  
  Existing entries are not re-indexed automatically. After upgrading, run `npx emdash media repair-usage --all` against the upgraded instance (use `--url` to select the site), or save the affected entries again. Alternatives are the `media_usage_repair` MCP tool or `POST /_emdash/api/admin/media-usage/repair`, both with `{ "scope": "all" }`. Until repair completes or the entries are saved again, coverage can still show as complete and a linked file can show **No tracked references found**. See the [upgrade instructions](https://docs.emdashcms.com/deployment/updating/#fixed-media-url-link-usage) for connection options and verification.

### Change 4

Applies to: `@emdash-cms/cloudflare@1.6.0` (patch), `emdash@1.6.0` (minor)  
Source: [#4787](https://github.com/emdash-cms/emdash/pull/4787)

Fixes scheduled entries going live up to a minute after their scheduled time.
  
  On Cloudflare, each Cron Trigger run waits up to 70 seconds for upcoming entries and publishes each one at its scheduled time, so an entry scheduled about a minute or more ahead no longer depends on when the next trigger starts. Waiting uses no CPU time, but while entries are scheduled within that window a scheduled invocation stays open for up to about a minute, so consecutive invocations can overlap in Workers logs and metrics. Sites that use `createScheduledHandler()` from `@emdash-cms/cloudflare/worker` get this automatically.
  
  On Node.js, the scheduler runs the publishing sweep at the start of every minute, so an entry scheduled for a whole minute, as the admin sets it, goes live at that minute. A schedule with seconds, which only the API and MCP can set, can still go live up to a minute late.
  
  A scheduled publish that another scheduler run or an editor has already completed no longer runs `content:beforePublish` hooks, so a hook cannot record a rejection for an entry that is already live.
  
  A custom Worker entry point that calls `runScheduledTasks()` from `emdash/middleware` publishes only entries that are already due. To wait for upcoming entries, pass the new `publishUpcomingWithinMs` option:
  
  ```ts title="src/worker.ts"
  await runScheduledTasks({ publishUpcomingWithinMs: 70 * 1000 });
  ```

### Change 5

Applies to: `@emdash-cms/cloudflare@1.6.0` (patch), `emdash@1.6.0` (patch)  
Source: [#4866](https://github.com/emdash-cms/emdash/pull/4866)

Fixes registry and marketplace plugin routes intermittently returning `404 Plugin route not found` on warm Cloudflare isolates after an install, update, or uninstall. Requests to `/_emdash/api/plugins/*` check for plugin-state changes before checking route permissions, without requiring a redeploy. Only newer generation-tagged snapshots are applied, so replica lag can delay a change but cannot restore older plugin code or permissions.
  
  Plugin route requests return `503 PLUGIN_SYNC_ERROR` if state cannot be read or the requested plugin fails to load. Bundle and sandbox-load failures retry after a five-second backoff, or immediately when the plugin's stored state changes.
  
  On Durable Object SQL deployments, upgrade core and the Cloudflare adapter together so plugin state and its generation are committed atomically.
  
  Durable Object SQL also executes existing atomic batches for content saves, menus, seeding and block-type updates as single primary transactions instead of separate statements.

### Change 6

Applies to: `emdash@1.6.0` (minor)  
Source: [#4626](https://github.com/emdash-cms/emdash/pull/4626)

Adds draft access for trusted content editor panels. A native plugin's panel receives `editorDraft` beside `entry`. `editorDraft.get()` reads the values open in the editor, including unsaved changes: the field values, the slug, and the SEO title and meta description, with their definitions and a revision. `editorDraft.patch(operations, { expectedRevision })` sets or clears them in the form without saving the entry. The editor refuses the patch when any of those values changed after the revision was read. A translation or excerpt panel can therefore read the current draft and put its results back for the user to review, without overwriting edits made while it worked. The SEO panel saves patched SEO values the way it saves typed ones, so they take effect at once. `editorDraft` is `undefined` on older versions. The React admin extensions guide covers the rules and has an example.
  
  Draft patches from sandboxed editor panels and actions (`admin.editor-draft:patch`) change too:
  
  - A patched rich text field shows the patched document. Before, it kept showing the old document, and the next keystroke there wrote the old document back over the patch.
  - In collections with revisions, the first save that includes a patch keeps the draft revision it replaces, autosaves included, so the values from before the patch can be restored. With collaborative editing on, the room's saves don't keep it.
  - A sandboxed patch with rich text that the editor can't load is refused with the "Plugin changes were not applied" message, and the form is left unchanged.
  - The "Plugin changes were not applied" message shows as a toast. Before, it was a banner that stayed above the fields after the user moved on.
  
  Field descriptors in the admin manifest include the field's schema `type`, which tells apart types that share an editor `kind`, such as `slug` and `string`.

### Change 7

Applies to: `emdash@1.6.0` (patch)  
Source: [#4970](https://github.com/emdash-cms/emdash/pull/4970)

Fixes object-cache page-render failures on Cloudflare Workers after a request is cancelled. Deferred work now uses Workers' lifetime extender even with injected or vendored Astro adapters, such as Alchemy, and shared cache operations that reject after their owning request ends use their existing non-fatal fallbacks instead of failing the render. Node deployments keep the existing fire-and-forget behavior.

### Change 8

Applies to: `emdash@1.6.0` (patch)  
Source: [#4760](https://github.com/emdash-cms/emdash/pull/4760)

Reduces D1 rows read by search and autocomplete on cold Workers isolates by skipping full row-count verification of existing search indexes. Missing indexes and indexes left empty by an interrupted rebuild are still repaired automatically. Partially populated indexes are no longer detected automatically; to repair one, send a `POST /_emdash/api/search/rebuild` request as an Admin (`search:manage` permission), with `X-EmDash-Request: 1` and a JSON body such as `{"collection":"articles"}`. Bearer tokens also require the `admin` scope. See [search index recovery](https://docs.emdashcms.com/reference/rest-api/#search-index-recovery) for the complete request and verification steps.

### Change 9

Applies to: `emdash@1.6.0` (patch)  
Source: [#4999](https://github.com/emdash-cms/emdash/pull/4999)

Stops the first request to a fresh isolate or process from writing to the database to release stale plugin cron locks. Scheduled maintenance (the Cloudflare Cron Trigger or the Node scheduler) still releases them on every run, so cold anonymous page views on D1 no longer go to the primary for this write.

### Change 10

Applies to: `emdash@1.6.0` (patch)  
Source: [#4994](https://github.com/emdash-cms/emdash/pull/4994)

Fixes cached detail-page 404s staying stale after the missing entry is published. `getEmDashEntry` now returns the collection tag in `cacheHint` when no entry is found, so publishing the entry purges the cached 404. An entry found in the requested locale keeps only its own id and reference tags. An entry served from a fallback locale, or stored under a legacy locale code such as `en-US`, also carries the collection tag. On a site whose page passes no other cache hint, this can make a 404 cacheable for up to 60 seconds even without a route rule. To keep misses uncached, see [Error responses](https://docs.emdashcms.com/deployment/route-caching/#error-responses).
  
  #### Upgrading
  
  Pass the `getEmDashEntry` hint to `Astro.cache.set()` before rewriting to `/404`, as the templates now do, so the cached 404 is purged when the entry is published.

### Change 11

Applies to: `emdash@1.6.0` (patch)  
Source: [#4935](https://github.com/emdash-cms/emdash/pull/4935)

Fixes external authentication, such as Cloudflare Access, saving a role level that EmDash doesn't define (anything other than 10, 20, 30, 40 or 50) to the user record. Such a record made every later sign-in by that user fail. EmDash now refuses a sign-in with an undefined role level and leaves the user record unchanged.
  
  A user record that already holds an undefined role level is not repaired automatically: that user still can't sign in after upgrading. Correct the provider's role mapping, then set the user's `role` column in the `users` table to one of the defined levels.

### Change 12

Applies to: `emdash@1.6.0` (patch)  
Source: [#4864](https://github.com/emdash-cms/emdash/pull/4864)

Fixes allowed-domain self-signup failing with "Setup already complete" when creating a passkey on a site that has finished setup.

### Change 13

Applies to: `emdash@1.6.0` (patch)  
Source: [#4967](https://github.com/emdash-cms/emdash/pull/4967)

Fixes published Portable Text code blocks so keyboard users can focus and scroll them horizontally, with a visible focus indicator and an accessible name based on the filename or language.

### Change 14

Applies to: `emdash@1.6.0` (patch)  
Source: [#4935](https://github.com/emdash-cms/emdash/pull/4935)

Fixes the Node image endpoint returning a 500 for EmDash media that Astro's image service can't optimize. The endpoint now passes Astro's logger to the image service, so the service logs its warning and serves the original image.

### Change 15

Applies to: `emdash@1.6.0` (patch)  
Source: [#4947](https://github.com/emdash-cms/emdash/pull/4947)

Fixes searches in the admin Media Library and media picker failing on Cloudflare D1 for long search terms, including multibyte text, and fixes the same limit in folder search. Media search also matches storage keys and media IDs, and accepts pasted media file URLs. Short terms may return more results because they can match keys and IDs as well as filenames.

### Change 16

Applies to: `emdash@1.6.0` (patch)  
Source: [#4935](https://github.com/emdash-cms/emdash/pull/4935)

Corrects the types of the `Astro.locals.emdash` handlers to match what they return and accept.
  
  - A handler result now narrows on `success`, so `result.data` is typed after an `if (result.success)` check. `result.data?.…` and `result.error?.…` still work without narrowing.
  - `handleContentGet` and `handleRevisionGet` type the standard properties of `item`, such as `status`, `data`, and `createdAt`. Other properties still read as `unknown`. Code that deletes a required property, such as `delete item.draftRevisionId`, or assigns an `unknown` value to `item.data` no longer type-checks. Use destructuring to drop a property (`const { draftRevisionId, ...rest } = item`), or cast `item` to `Record<string, unknown>` first.
  - `handleMediaList`, `handleMediaGet`, `handleMediaCreate`, `handleMediaUpdate`, and `handleCommentModerate` describe their result data.
  - `handleMediaUpload` requires `base64` and `contentType` and no longer lists a `url` option, which it never supported.

### Change 17

Applies to: `emdash@1.6.0` (patch)  
Source: [#4194](https://github.com/emdash-cms/emdash/pull/4194)

Fixes `search()` ranking so full-title phrase matches and titles matching every query term appear before body-only matches, even in small collections or on short result pages. Within title-term matches, shorter titles rank before higher scores.
  
  `search()` scores are now normalized to 0–1 within each collection instead of returning raw BM25 magnitudes, including searches restricted to one collection. Title-match tiers take precedence over scores. Preserve the returned result order and review any custom score thresholds when upgrading. `searchCollection()` keeps its raw scores and score-based ordering.

### Change 18

Applies to: `emdash@1.6.0` (patch)  
Source: [#4238](https://github.com/emdash-cms/emdash/pull/4238)

Fixes literal heading and list markers, such as `# Title` and `1. item`, turning into Markdown blocks when rich text is read and written back through the CLI, MCP content tools, `EmDashClient` or `portableTextToMarkdown` from `emdash/client`. Markdown output now escapes these markers at the start of paragraph lines, including lines after a hard break, and escapes setext underlines such as `---` and `===` and table delimiter rows such as `| --- | --- |`.

### Change 19

Applies to: `emdash@1.6.0` (patch)  
Source: [#5010](https://github.com/emdash-cms/emdash/pull/5010)

Improves search and autocomplete latency across multiple collections on D1 when query coalescing is enabled. Reduces first-search index health checks to a small number of database round trips while preserving automatic repair of missing or empty indexes.

### Change 20

Applies to: `emdash@1.6.0` (patch)  
Source: [#4840](https://github.com/emdash-cms/emdash/pull/4840)

Fixes duplicate layout queries when anonymous public pages call `Astro.rewrite()`, such as rewriting an unknown slug to `/404`. The rewritten page reuses the original request's cached reads and prefetched layout data. Previews, edit mode, and requests carrying session cookies or authorization headers continue to use fresh request contexts.

### Change 21

Applies to: `emdash@1.6.0` (patch)  
Source: [#4910](https://github.com/emdash-cms/emdash/pull/4910)

Fixes `<Comments>` dates to use the site's Timezone setting instead of the server's timezone, including dates on threaded replies. Missing or invalid timezone settings use UTC, including on Node.js servers configured with a different local timezone. Set the site's Timezone to keep dates in your preferred timezone.

### Change 22

Applies to: `emdash@1.6.0` (patch)  
Source: [#4871](https://github.com/emdash-cms/emdash/pull/4871)

Fixes visual editing creating an unwanted draft when clicking into an unchanged Portable Text field that ends in a list, image, heading, blockquote, HTML block, or plugin block, then leaving the field or page.

### Change 23

Applies to: `emdash@1.6.0` (patch)  
Source: [#4960](https://github.com/emdash-cms/emdash/pull/4960)

Fixes concurrent content saves failing with hung-request errors on Cloudflare Workers when updating media usage. Later saves can also recover if an earlier request was cancelled while holding a media-usage lock, rather than leaving writes to the collection stuck until the isolate restarts. A save may wait up to a minute before reclaiming an abandoned lock.

### Change 24

Applies to: `emdash@1.6.0` (patch)  
Source: [#4857](https://github.com/emdash-cms/emdash/pull/4857)

Fixes layout prefetching on anonymous multilingual Astro pages to load menus and taxonomy terms in the page's locale, avoiding duplicate reads when layouts request that locale explicitly. Sites with a single configured locale, or no i18n configuration, keep their existing prefetch behavior.
  
  On non-default-locale pages, implicit `getMenu()` and `getTaxonomyTerms()` calls still return default-locale data, but now load it separately from the page-locale prefetch. This increases reads for implicit-locale layouts and EmDash's built-in menu widgets on translated pages, including pages whose other navigation already passes an explicit locale. Menu widgets retain their default-locale output; this patch does not change which content they render. Layouts intended to render translated navigation should pass `{ locale: Astro.currentLocale }` to these helpers to reuse the prefetched data.

### Change 25

Applies to: `emdash@1.6.0` (patch)  
Source: [#4890](https://github.com/emdash-cms/emdash/pull/4890)

Fixes built-in search endpoints on PostgreSQL, including Hyperdrive, so they report `503 SEARCH_UNAVAILABLE` instead of returning generic errors or misleading empty results. PostgreSQL search is still unavailable; use a SQLite-family database with FTS5 for built-in full-text search. The editor's link picker explains that content search is unavailable and suggests pasting a URL, without retrying the unsupported search or blaming the network connection.

### Change 26

Applies to: `emdash@1.6.0` (patch)  
Source: [#4837](https://github.com/emdash-cms/emdash/pull/4837)

Fixes two Astro warnings on static sites: the `Astro.request.headers` warning on prerendered pages and the `cache.set()` warning on 404s when no route cache provider is configured.

### Change 27

Applies to: `emdash@1.6.0` (patch)  
Source: [#4805](https://github.com/emdash-cms/emdash/pull/4805)

Fixes the Users page showing “Last Login: Never” after magic-link, OAuth (including AT Protocol), or external-provider sign-in. Successful sign-ins now record a login time independently of passkeys, while existing passkey login history remains visible. Previously unrecorded logins appear after the next sign-in; refreshing an existing session does not record a new login.
  
  EmDash migrates the database automatically. Existing standalone Kysely auth-adapter databases continue to report passkey history without requiring a schema change.

### Change 28

Applies to: `emdash@1.6.0` (patch)  
Source: [#4812](https://github.com/emdash-cms/emdash/pull/4812)

Prevents SQLite from creating a blank database when the main file is missing but its `-wal` or `-shm` file remains, protecting committed content still in the write-ahead log. EmDash refuses the open and logs an error without changing these files. Stop the server and restore the original main file before restarting. This cannot recover data already overwritten by an earlier startup.
  
  To intentionally discard all local SQLite data and start fresh, stop all processes using the database and delete `data.db`, `data.db-wal`, and `data.db-shm` (substitute your configured database path). Reset scripts that delete only `data.db` must also remove its sidecars.

### Change 29

Applies to: `emdash@1.6.0` (patch)  
Source: [#4992](https://github.com/emdash-cms/emdash/pull/4992)

Allows content-miss 404s on public page routes with active cache options to be served from the cache for up to 60 seconds, instead of rendering on every request. With a route-cache provider configured, a tags-only hint from the 404 page or its layout can activate this behavior even without a route rule. Shorter lifetimes and explicit cache opt-outs are preserved, and stale-while-revalidate is disabled for these responses.
  
  Keep the collection or taxonomy tag on the route rule so publishing the missing entry or saving the missing term purges its cached 404. Previously these responses were never cached. Sites whose rules lack the matching tag can now serve a stale 404 until its short lifetime expires; a failed purge has the same effect. Shipped template layouts supply settings and menu hints, not the missing content's collection or taxonomy tag, so their misses can remain cached after publication until this lifetime expires. To restore uncached misses, call `Astro.cache.set(false)` in the 404 page's frontmatter (or the miss branch for a directly returned 404), and skip any later layout calls that re-enable caching.
  
  Cached 404 hits no longer reach the origin, so the admin's 404 hit counts exclude those requests. URLs that match no Astro route, internal paths, and paths ending in a file extension are unchanged.

### Change 30

Applies to: `emdash@1.6.0` (patch)  
Source: [#4926](https://github.com/emdash-cms/emdash/pull/4926)

Fixes repeated `getEmDashEntry()` calls with the same arguments issuing duplicate database reads within a request, so layouts and blocks can share a singleton entry read. As with `getEmDashCollection()`, identical calls in one request now share the same result object, so copy entry data before modifying it.

### Change 31

Applies to: `emdash@1.6.0` (patch)  
Source: [#4868](https://github.com/emdash-cms/emdash/pull/4868)

Fixes media replacements in the admin not triggering `media:afterUpload`, so upload plugins can process replaced files and send audit-log and webhook notifications.

### Change 32

Applies to: `emdash@1.6.0` (patch)  
Source: [#4965](https://github.com/emdash-cms/emdash/pull/4965)

Fixes `EmDashClient` errors losing plain-text response bodies from runtimes and proxies. Non-JSON error messages now include the first 500 characters of the trimmed body, falling back to the HTTP status text or status code when the body is empty or unreadable.

### Change 33

Applies to: `emdash@1.6.0` (patch)  
Source: [#4964](https://github.com/emdash-cms/emdash/pull/4964)

Fixes exact redirect rules for paths with file extensions, such as `/old/report.pdf`, being saved but never applied. A file request also matches an exact rule saved with a trailing slash. Only exact rules apply to file requests; named and catch-all patterns do not redirect them. File requests are not recorded in the 404 log.

### Change 34

Applies to: `emdash@1.6.0` (patch)  
Source: [#4972](https://github.com/emdash-cms/emdash/pull/4972)

Fixes PostgreSQL detection during `astro dev` with Cloudflare Hyperdrive, so plugin storage queries and index creation no longer fail with `function json_extract(text, unknown) does not exist` when Vite loads separate copies of Kysely.

### Change 35

Applies to: `emdash@1.6.0` (patch)  
Source: [#4929](https://github.com/emdash-cms/emdash/pull/4929)

Fixes image sub-fields in repeaters ignoring `validation.allowedMimeTypes` in the media picker and during upload, including repeaters inside block types. Configure the image sub-field through a seed, the schema API, or code to opt into formats such as SVG without changing the global upload allowlist. Editing a repeater in Content Types preserves its configured sub-field allowlists.

### Change 36

Applies to: `emdash@1.6.0` (patch)  
Source: [#4976](https://github.com/emdash-cms/emdash/pull/4976)

Fixes sitemap `lastmod` dates staying unchanged after live SEO metadata edits, including SEO title changes. Sitemap entries and the sitemap index now use the later content or SEO modification date. Saving unchanged SEO settings does not advance the date.

## Agent skills

The updater ran:

```sh
npx --yes skills@1.7.0 add emdash-cms/skills -y
```

Use the refreshed `upgrading-emdash` skill for this work order. If the skills command reported a conflict or failure, resolve that before continuing.

## Core database migrations

Installed EmDash changed from `1.5.0` to `1.6.0`.

The target package adds these core migrations:

- `098_user_last_login`

Do not apply migrations until the application changes compile and the target build has generated `.emdash/migrations.json`. Before starting or deploying the upgraded build, follow [Backups and recovery](https://docs.emdashcms.com/guides/backups/) to create a restorable database backup, back up media storage separately, and retain the `EMDASH_ENCRYPTION_KEY` rotation list. A JSON backup is not a recovery point. Apply migrations from the same build artifact that will be deployed.

Build the upgraded project and inspect the exact database target:

```sh
npm run build
npm exec -- emdash migrate --status
```

After a human has reviewed the target and backup, apply pending migrations:

```sh
npm exec -- emdash migrate
```

The command shows the target and asks for confirmation. In a non-interactive shell, add `--expected-target-fingerprint` with the target fingerprint that the status command printed for the reviewed database.

Deploy the same build artifact with the project's deployment workflow, without rebuilding it. On Cloudflare Workers, run `wrangler deploy`.

Verify the deployed database against that artifact:

```sh
npm exec -- emdash migrate --check
```

Do not run migration `down()` functions or delete migration records to roll back. Restore the matching pre-migration database, media, keys, and application artifact together if recovery is required.

## Verification

1. Assess every release entry above and make the project changes it requires.
2. Run the project's format, tests, typecheck, and build commands.
3. Inspect the migration target and pending names before applying them.
4. Verify the public site, admin sign-in, content editing, media reads, and encrypted plugin settings after deployment.
