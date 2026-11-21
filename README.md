# Life at the Nest

Website for **Life at the Nest** (by Audra Chalfant Matlack): a blog, scalable and printable recipes, an affiliate shop, and a few static pages. Built on [EmDash](https://docs.emdashcms.com/) (an Astro-based CMS) and running on Cloudflare Workers.

- **Live :** lifeatthenest.com
- **Admin:** `/_emdash/admin`
- **Repo:** `main` deploys to production automatically; day-to-day work happens on `dev`.

Agent and contributor notes live in [`AGENTS.md`](AGENTS.md) and `.agents/skills/` (EmDash site, plugin, and CLI guides).

---

## Tech stack and infrastructure

| Layer | What we use |
|---|---|
| CMS / framework | EmDash `1.4.x` on Astro `7` (server-rendered, `output: "server"`) |
| Hosting | Cloudflare Workers (`lifeatthenest`), currently on the **Workers Free** plan |
| Database | Cloudflare D1: `lifeatthenest-db` |
| Media | Cloudflare R2: `lifeatthenest-media` |
| Sessions | Cloudflare KV: `lifeatthenest-session` (binding `SESSION`, pinned by ID in `wrangler.jsonc`) |
| Images | Cloudflare Images binding (`IMAGES`): on-the-fly resizing/WebP for uploaded photos. Free plan includes 5,000 unique transformations/month. |
| Scheduled jobs | Cron trigger every minute (scheduled publishing, maintenance, backups) |
| Admin UI | React (bundled by EmDash) |
| Fonts | Fraunces (headings) and Source Sans 3 (body), self-hosted via Astro's font API |
| CI/CD | Cloudflare **Workers Builds** connected to GitHub |
| Node | 24 (pinned in `.node-version`, used by Workers Builds) |
| Package manager | npm (`package-lock.json`) |

**Secrets** (never in git):
- `EMDASH_ENCRYPTION_KEY`: Worker secret. Encrypts plugin secrets at rest. Back it up; a database restore without it can't read encrypted plugin settings.
- `EMDASH_MIGRATE_TOKEN`: Workers Builds secret. Cloudflare API token with D1 Edit, used only by the deploy's migration step.

---

## Page structure

All pages are server-rendered on request, so published content appears without a rebuild.

| Route | File | What it shows | Where its text comes from |
|---|---|---|---|
| `/` | `src/pages/index.astro` | Welcome, latest posts, featured recipes, newsletter band, Meet Audra, quote slideshow | **Homepage** entry (one entry) + content |
| `/posts` | `src/pages/posts/index.astro` | Blog list: category chips, year filter, search, infinite scroll | **Pages** entry with slug `posts` |
| `/posts/[slug]` | `src/pages/posts/[slug].astro` | Blog post: rich text, video and recipe cards, "Shop this post", prev/next, comments | Blog Posts |
| `/recipes` | `src/pages/recipes/index.astro` | Recipe grid: category chips, tag dropdown, search, infinite scroll (A–Z) | **Pages** entry with slug `recipes` |
| `/recipes/[slug]` | `src/pages/recipes/[slug].astro` | Recipe page and printable **RecipeCard** (scaling, checkboxes, print/PDF), Recipe JSON-LD | Recipes |
| `/seasonal` | `src/pages/seasonal/index.astro` | Seasonal landing: every page with **Feature now** on, as large cards, then one grid of the rest **in the order of their Seasonal Collections tags** (Admin → Seasonal Collections → a tag's … menu → Move up/down), continuing from just after the featured page(s) and wrapping around, so upcoming collections come first (`src/utils/seasonal-order.ts`, tested). Untagged pages last, newest first | **Pages** entry with slug `seasonal` (optional; fallback heading/intro otherwise) |
| `/seasonal/[slug]` | `src/pages/seasonal/[slug].astro` | Seasonal roundup (e.g. "Thanksgiving at the Nest"): main photo, intro, then a **mosaic** of the recipes and blog posts tagged with the page's Seasonal Collection: "Recipe" and "Story" tiles in wrapping rows (stories ~2× a recipe's width; a tile that ends up wide switches to photo-beside-text). Pinned recipes, then pinned posts, first; the rest newest first. Tagged products show in the "Shop the season" strip below | Seasonal |
| `/shop` | `src/pages/shop.astro` | Affiliate products, newest first: category chips, search, infinite scroll | **Pages** entry with slug `shop` |
| `/contact` | `src/pages/contact.astro` | Social profile cards and newsletter signup | **Pages** entry with slug `contact`; cards from the **Social** menu |
| `/[slug]` | `src/pages/[slug].astro` | Static pages (e.g. `/about`): optional arched photo + rich text | Pages |
| `/category/[slug]`, `/tag/[slug]` | | 301 redirects to `/posts?category=` / `/posts?tag=` | |
| `/api/newsletter` | `src/pages/api/newsletter.ts` | Newsletter signup: Turnstile spam check, then adds the subscriber to Kit (double opt-in). Replies "signups open soon" until configured (see [Newsletter](#newsletter-kit)) | |
| `/_emdash/*` | (EmDash) | Admin, REST API, media, sitemap, robots.txt | |

Listing pages read their heading/intro from a **Pages** entry whose slug matches the route (`src/utils/listing-page.ts`). Real route files take precedence over `/[slug]`, so those entries never render on their own. **Don't change the slugs of the `posts`, `recipes`, `shop`, or `contact` pages.**

### Content model (lives in the database; mirrored in `seed/seed.json`)

| Collection | Notes |
|---|---|
| Blog Posts (`posts`) | Title, short description (max 160), main photo, rich-text body, videos list (stacked "Watch" cards at the end), "Products in this post" picker. Comments on. |
| Recipes (`recipes`) | Title, short description (max 160), main photo, then structured fields: yield, times, difficulty, ingredient/step repeaters (with group headings), notes, videos list, credit, "Products used" picker. Comments on. |
| Shop Products (`products`) | Name, photo, link, store, "Why you love it" blurb (max 100). Not routable (no product pages). |
| Pages (`pages`) | Title, optional page photo, rich text. |
| Seasonal (`seasonal`) | Seasonal roundup pages at `/seasonal/<slug>`: title, short description (max 160), main photo, **Feature now** toggle, intro, and pins for recipes and blog posts. **The page's collection comes from the Seasonal Collections taxonomy:** tag the page and any recipes, posts, or products with the same term (e.g. Thanksgiving) and they appear automatically. Created on an existing site with `scripts/create-seasonal.mjs` (dry run by default; `--apply`; `--url` + `EMDASH_TOKEN` with schema read/write for live). Listed on `/seasonal` ("Feature now" toggle puts one at the top) and linked from the **Seasonal** item in Main Navigation. |
| Homepage (`homepage`) | One entry: welcome text and photo, Meet Audra, quotes. Not routable. |

| Taxonomy | Used by |
|---|---|
| Blog Categories (`category`) | Posts: Kitchen, Garden, Pasture, Design, Family |
| Blog Tags (`tag`) | Posts (`/posts?tag=`) |
| Recipe Categories (`course`) | Recipes (`/recipes?category=`) |
| Recipe Tags (`recipe_tag`) | Recipes (`/recipes?tag=`) |
| Shop Categories (`shop_category`) | Products (`/shop?category=`) |
| Seasonal Collections (`seasonal`) | Posts, recipes, products, and Seasonal pages (flat; e.g. Thanksgiving). Drives what each Seasonal page lists |

**Video links** (the "Videos" list on posts and recipes, where each row has a link, an optional card title, and an optional uploaded thumbnail; an Embed block; or a paragraph that's just a link) render as a `VideoCard` that opens the video on its platform. YouTube cards show the thumbnail, title, and channel (YouTube oEmbed, no key). TikTok, Instagram, and Facebook cards show a branded panel, generic wording, and the creator handle from the URL: Instagram/Facebook oEmbed needs a Meta app token, and TikTok's oEmbed currently returns no title or thumbnail (used automatically if it does). An uploaded thumbnail replaces the automatic one (YouTube) or the branded panel (others). Unrecognised links fall back to a plain "Watch the video" link. `scripts/migrate-videos.mjs` moved the old single `video_url` field into the list (dry run by default; `--apply`; `--url` + `EMDASH_TOKEN` for live).

**SEO:** posts, recipes, and pages use `entrySeo()` (`src/utils/seo.ts`). The SEO panel's description and image win when filled in; otherwise the meta description is the short description (trimmed to 160 at a word boundary) and `og:image` is the main photo. Usually leave the SEO panel empty.

Menus: **Main Navigation** (`primary`) and **Social Links** (`social`, which drives the footer icons and Contact cards; icons are picked from each URL's domain).

### Key code

```
src/
  layouts/Base.astro          Shell: head/SEO, header, footer, theme
  styles/theme.css            Design tokens (palette, type, spacing) + shared styles
  components/
    RichText.astro            Renders all rich text (posts, pages, recipe stories)
    pt/                       Rich-text block renderers (video links, iframe, content cards)
    VideoCard.astro           Link-out card for YouTube/TikTok/Instagram/Facebook videos & posts
    RecipeCard.astro          Printable recipe card (scaling, checkboxes, print)
    ContentTile.astro         The site's photo tile (whole tile is one link), shared by RecipeTile and PostTile;
                              `adaptive` switches to photo-beside-text when wide (seasonal mosaic)
    ListingFilters.astro      Shared filter bar (search + chips + dropdown)
    LoadMore.astro            Shared infinite scroll / "Load more"
    ...                       Cards, header/footer, carousel, back-to-top, etc.
  plugins/                    Our EmDash plugins: content-cards, recipe-editor, local-notice (see Plugins)
  utils/
    amount.ts                 Ingredient amount parsing/scaling/formatting (tested)
    recipe-schema.ts          schema.org Recipe JSON-LD
    portable-text.ts          Reading time, video-link auto-embed
    video.ts                  Recognises YouTube/TikTok/Instagram/Facebook links (tested)
    seo.ts                    Meta description / og:image fallbacks, image field → URL
scripts/deploy-ci.mjs         Production deploy (migrate, deploy, verify)
scripts/pull-live.mjs         Copy live content into the local dev site (npm run pull:live)
seed/seed.json                Content model + sample content for fresh installs
```

---

## Plugins

### `content-cards` (ours, `src/plugins/content-cards/`)

Adds a **Recipe card** block to the rich-text editor: type `/`, choose **Recipe card** (under "Cards"), and pick a published recipe from the dropdown. The site renders a compact card linking to it.

- **Native plugin**, registered in `astro.config.mjs` via `descriptor.mjs`. It runs in-process, so it works on Workers Free (no sandbox needed).
- **Saved value:** `"<Title> · <entry ID>"`. The editor shows the title; the site loads by the trailing ID, so renaming a recipe or changing its slug doesn't break cards. Seeded content may use a slug instead of an ID, and both are accepted.
- **Options route:** the dropdown is filled by a private route (`/_emdash/api/plugins/content-cards/options/recipes`, permission `content:read`) listing published entries A–Z.
- **Missing entries:** if the entry is unpublished or deleted, the card simply doesn't render.

**Adding a card type** (e.g. "Blog post card"):
1. Add an entry to `CARD_TYPES` in `card-types.ts` (a commented `postCard` example is there).
2. Add its card component to `CARD_COMPONENTS` in `src/components/pt/ContentCard.astro`.
3. Restart the dev server (plugin definitions load at startup) and deploy.

Tests: `src/plugins/content-cards/card-types.test.ts`.

### `recipe-editor` (ours, `src/plugins/recipe-editor/`)

Compact admin editors for a recipe's **Ingredients** and **Instructions**, replacing the default one-block-per-row repeater editor:

- **Ingredients:** a table (Amount / Unit / Ingredient / Note / Fixed) with group-heading rows ("For the frosting"), ↑ ↓ ✕ per row, Enter in Note to add a row, and **Paste ingredients**. Paste turns a list like `1 1/2 cups flour, sifted` into rows using the site's amount parser (`paste.ts`); a line ending in `:` becomes a heading.
- **Instructions:** numbered rows with auto-growing text, group-heading rows, and an optional step photo through the admin's media picker.
- **How it's attached:** these are **field widgets**, set on the schema as `widget: "recipe-editor:ingredients"` / `"recipe-editor:steps"`. Only the editor changes; the fields stay `repeater`s and store the same data, so the recipe page, scaling, print, and JSON-LD are unaffected. Removing the plugin (or the `widget` setting) falls back to the default editor with no data loss.
- **Group headings:** stored on each row's `group` field (`rows.ts` converts between stored rows and heading lines).
- **Native plugin with a React admin module** (`admin.tsx`, built from the admin's own Kumo components so it matches light/dark themes). Registered in `astro.config.mjs` via `descriptor.mjs`.

Tests: `paste.test.ts`, `rows.test.ts`.

### `local-notice` (ours, `src/plugins/local-notice/`)

Dev-only reminder that you're editing the **local test copy**: a yellow "Local test copy · changes here never reach the live site" pill at the bottom of the admin (`admin.ts`), matching the strip above the header on the site (`src/components/LocalNotice.astro`). Both check `import.meta.env.DEV`, so neither appears in a production build. The pill ignores clicks. Removing the plugin only removes the notice.

No third-party plugins are installed. Sandboxed plugins would require Workers Paid (the `worker_loaders` binding is commented out in `wrangler.jsonc`).

---

## Editing process: how changes reach the live site

There are two separate lanes. **Content never flows through git, and code never flows through the CMS.**

```
CODE (git)                                      CONTENT (CMS)
edit locally → npm run dev (local test data)    write/upload/publish in the live admin
commit to dev → PR → merge to main              saved directly to production D1/R2
Workers Builds: build → migrate → deploy        live on the next page view (no build)
```

| Kind of change | Where it's made | When it's live |
|---|---|---|
| Posts, recipes, products, pages, photos, menus, comments | Live admin | Immediately (scheduled posts via the cron job) |
| Site settings (title, social, SEO, robots.txt, backups) | Live admin → Settings | Immediately |
| Templates, styles, components, plugin code, config | Git → `main` | After the Workers Build finishes (~minutes) |
| **Content model** (collections, fields, taxonomies) | Live admin → Content Types (or EmDash CLI/API) | Immediately. **Then mirror it in `seed/seed.json`** and regenerate types (`npx emdash types`). |
| EmDash internal migrations (from upgrading `emdash`) | Git (package bump) | Applied by the deploy's migrate step before the new code goes live |

Rules of thumb:
- **Production is the source of truth for content.** Local data is test data and will drift. To refresh local from live, run `npm run pull:live` (see [Copy live content to local](#copy-live-content-to-local)).
- **`seed/seed.json` only applies when a brand-new site is set up.** Editing it does not change an existing site. Keep it in sync so a future staging site or rebuild matches production.
- **Code that needs a new field ships after the field exists on production** (or handles its absence).
- **Audra uses the Editor role;** she never needs git or code.

---

## Newsletter (Kit)

Signup forms post to `/api/newsletter` (`src/pages/api/newsletter.ts`, logic in `src/utils/newsletter.ts`, tested):

1. Honeypot field filled in → pretend success, do nothing.
2. Validate the email; verify **Cloudflare Turnstile** (the widget on the form).
3. Create the subscriber in Kit as `inactive`, then add them to the **Kit form**. With double opt-in on that form, Kit sends its confirmation ("incentive") email and activates them when they click. Already on the form → "you're already signed up" (Kit doesn't resend).

Kit holds the list and handles unsubscribes; nothing is stored on our side. The form's page is sent to Kit as the referrer.

**Settings** (Workers & Pages → `lifeatthenest` → Settings → Variables and Secrets). Until all four are set, the widget is hidden and the endpoint replies "signups open soon":

| Name | Type | Where it comes from |
|---|---|---|
| `KIT_API_KEY` | Secret | Kit → Settings → Developer → API keys (v4) |
| `KIT_FORM_ID` | Variable | Kit → Grow → Landing Pages & Forms → the form; the number in its URL |
| `TURNSTILE_SITE_KEY` | Variable | Cloudflare → Turnstile → the site widget (public) |
| `TURNSTILE_SECRET_KEY` | Secret | Same Turnstile widget |

Plain variables set in the dashboard are overwritten by `wrangler deploy` unless they're in `wrangler.jsonc`, so put `KIT_FORM_ID` and `TURNSTILE_SITE_KEY` under `"vars"` there; keep the two secrets in the dashboard only.

**The Kit form must have double opt-in on** (form settings → Incentive email, "auto-confirm new members" unchecked), or people are subscribed without confirming.

**Local testing:** create `.dev.vars` (gitignored) with Cloudflare's [Turnstile test keys](https://developers.cloudflare.com/turnstile/troubleshooting/testing/) (`1x00000000000000000000AA` / `1x0000000000000000000000000000000AA` always pass) and a real Kit key + test form only if you want real Kit calls. Restart the dev server after changing it.

### Comments

Built into EmDash: honeypot, rate limit (5 per 10 minutes per visitor), and per-collection moderation (Content Types → the collection: "first time" holds a new commenter's first comment for review).

- **"Close comments after (days)" is 0 (never) on every collection with comments, on live and local.** EmDash's default is 90, which closes comments on older posts ("Comments are closed for this content"). The setting lives in the database (Content Types → the collection), not `seed/seed.json`, which can't set it, so set it to 0 again on any new site or new collection with comments.
- **Turnstile:** EmDash enforces Turnstile on comments whenever `TURNSTILE_SECRET_KEY` is set (the same secret the newsletter uses). The post and recipe pages pass `TURNSTILE_SITE_KEY` to `<CommentForm>` via `turnstileSiteKey()` (`src/utils/turnstile.ts`); without the widget, every comment would be rejected.

## Deploy process

### Automatic (normal path)

Merging to **`main`** triggers Cloudflare Workers Builds:

| Setting | Value |
|---|---|
| Build command | `npm run build` |
| Deploy command | `npm run deploy:ci`: `scripts/deploy-ci.mjs` |
| Non-production branch builds | **Off** (preview command is a guard that exits with an error until a staging database exists) |
| Build variables | `EMDASH_MIGRATE_TOKEN` (secret, D1 Edit token), `EMDASH_TARGET_FINGERPRINT` (from `emdash migrate --status`) |

`deploy-ci.mjs` does:
1. **`emdash migrate`** against the production D1 database, guarded by the target fingerprint. On failure, it stops; the current version keeps serving.
2. **`wrangler deploy`**.
3. **`emdash migrate --check`.** Fails the build (red) if anything is still pending, for attention. It does not roll back.

Migrations deliberately run on the build machine, never inside the Worker. A Worker that migrates at runtime can be stopped mid-migration and leave the migration lock held. That happened on the first deploy; recovery is documented under [Release a stuck migration lock](https://docs.emdashcms.com/deployment/core-migrations/#release-a-stuck-migration-lock).

Logs: Cloudflare dashboard → Workers & Pages → `lifeatthenest` → Deployments. Live request logs: `npx wrangler tail lifeatthenest`.

### Checking without deploying

```bash
npm run build
EMDASH_MIGRATE_TOKEN=... npm run deploy:check   # reports pending migrations + wrangler --dry-run
```

### Rollback and recovery

- **Bad code deploy:** roll back to a previous Worker version in the dashboard (Deployments), or `npx wrangler rollback`.
- **Bad data:** EmDash automatic backups (Settings) and D1 Time Travel (`npx wrangler d1 time-travel restore lifeatthenest-db --timestamp=...`).
- **Manual deploy from a laptop** (`npm run deploy`) still exists but does **not** run migrations. Avoid it; every deploy should go through GitHub.

### Things to know

- **D1 is matched by name in `wrangler.jsonc`.** Don't add `database_id` there: local dev keys its database file on it and would switch to an empty local database. The production database ID lives in `scripts/deploy-ci.mjs`.
- **Images are resized by Cloudflare's CDN**, not the Worker: `imageService: "cloudflare"` in `astro.config.mjs` makes pages use `/cdn-cgi/image/<options>/<media URL>` URLs. Cloudflare fetches the original from EmDash's media route on a cache miss, resizes it, and caches the result (about 4 hours, its default), so image requests don't run the Worker: no cold-start delays, and they don't count toward Workers requests. Originals stay in R2 untouched.
  - **Requires Images → Transformations enabled on the lifeatthenest.com zone.** Turning it off breaks resizing (images fall back to originals via `onerror=redirect`).
  - Astro only resizes hosts listed in `SITE_HOSTS`. **Add any new domain there** (it must be a Cloudflare zone with Transformations on). `/cdn-cgi/image` doesn't exist on `*.workers.dev`, so images don't load there; `astro dev` serves originals.
  - **Photos inside post/page/recipe text** render through `src/components/pt/PtImage.astro`, which tells EmDash's image block the column width (672 px, half for left/right, 960 px for wide/full; `column="wide"` on `RichText` for the recipe story and notes). Without it, EmDash sized them by the original upload, and browsers downloaded multi-MB versions.
  - WebP is sent to browsers that accept it; opening an image URL directly in the address bar returns JPEG, which is expected.
  - **After "Replace original" (crop)**, the old version can show for up to ~4 hours. To clear it right away: dashboard → Caching → Configuration → Purge Everything.
  - The free plan covers 5,000 unique transformations a month (each photo × each width counts once); past that, new sizes fall back to originals. Check Images → Transformations now and then.

---

## Local development

```bash
npm install
npm run dev          # http://localhost:4321  (admin: /_emdash/admin)
npm test             # unit tests (Node's built-in runner, no extra deps)
npm run typecheck    # astro check
npm run build        # production build
```

- Local D1/R2/KV live under `.wrangler/` (gitignored). A fresh local database applies `seed/seed.json` on first run.
- **Dev-only sign-in shortcut:** `/_emdash/api/auth/dev-bypass?redirect=/_emdash/admin` signs in as a local "Dev Admin" (development builds only; returns 403 in production).
- **Share the dev server with someone:** `npx astro dev --host` (LAN) or a Cloudflare quick tunnel (`cloudflared tunnel --url http://localhost:4321` with `--allowed-hosts .trycloudflare.com`).
- **After changing the content model,** run `npx emdash types` or restart the dev server so `emdash-env.d.ts` is regenerated.

> **⚠ Local is a separate copy. Nothing you do locally reaches the live site.**
> Posts, photos, menus, and settings edited in the local admin stay on your machine, and live edits never come down on their own. Make real content changes in the **live** admin. A yellow "Local test copy" notice shows on the local site and admin as a reminder.

### Copy live content to local

`npm run pull:live` replaces the local site's content with a fresh copy of the live site (one-way: live → local; it never writes to live).

1. **Create a short-lived live API token:** live admin → Settings → API Tokens → new token with only the **`transfer:export`** scope and the shortest expiry.
2. **Stop the dev server**, then run `npm run pull:live`. Paste the token when asked (input is hidden; or set `LIVE_EMDASH_TOKEN` for that one command). It's never printed or saved.
3. The script:
   - exports live into `.local-sync/live-<time>.emdash` (gitignored);
   - **asks**, then moves `.wrangler/state` to `.wrangler/state-backup-<time>` (moved, not deleted);
   - starts a temporary dev server on an empty site (seed schema only, no sample content);
   - shows the import plan, **asks**, imports, and stops the temporary server.
4. `npm run dev`, then sign in with the dev bypass link above. **Revoke the token** in the live admin.

Notes:
- **Comes across:** all content including drafts and trash, media, menus, taxonomies, widgets, settings, and comments. **Doesn't:** users and passkeys. Live authors are credited to the local Dev Admin.
- **Undo:** stop the dev server, delete `.wrangler/state`, and rename the backup back to `.wrangler/state`.
- **Housekeeping:** the `.emdash` file holds all content plus author and commenter emails, so keep it private. Delete old exports and `state-backup-*` folders once you're done with them.
- **Re-import without exporting again:** `npm run pull:live -- --package .local-sync/live-<time>.emdash`.
- **Why the script deletes relations on the temporary site:** the seed's "featured products" reference fields create relations, and EmDash 1.4 doesn't count those as setup scaffold, so the import would refuse with `TRANSFER_TARGET_NOT_EMPTY`. The import recreates them from the live package.
- **Local schema changes are replaced:** content types or fields added only locally are overwritten by live's. Code is unaffected.

---

## References

- [EmDash documentation](https://docs.emdashcms.com/) (also available as an MCP server: `https://docs.emdashcms.com/mcp`)
- [Deploy to Cloudflare](https://docs.emdashcms.com/deployment/cloudflare/) · [Core migrations](https://docs.emdashcms.com/deployment/core-migrations/) · [Site transfer](https://docs.emdashcms.com/guides/site-transfer/) · [Move to a new domain](https://docs.emdashcms.com/guides/change-domain/)
