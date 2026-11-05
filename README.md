# EmDash Starter Template (Cloudflare)

A general-purpose starting point for building sites with [EmDash](https://github.com/emdash-cms/emdash) on Cloudflare Workers. Includes posts, pages, categories, and tags with minimal styling -- designed as a base you can build on rather than a finished theme.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/emdash-cms/templates/tree/main/starter-cloudflare)

## What's Included

- Posts with category and tag archives
- Static pages via slug routing
- Seed data with demo content
- D1 database and R2 storage pre-configured

## Pages

| Page | Route |
|---|---|
| Homepage | `/` |
| All posts | `/posts` |
| Single post | `/posts/:slug` |
| Category archive | `/category/:slug` |
| Tag archive | `/tag/:slug` |
| Static pages | `/:slug` |
| 404 | fallback |

## Infrastructure

- **Runtime:** Cloudflare Workers
- **Database:** D1
- **Storage:** R2
- **Framework:** Astro with `@astrojs/cloudflare`

## Local Development

```bash
npm install
npm run dev
```

Open http://localhost:4321/_emdash/admin and complete the setup wizard. EmDash runs database migrations and applies the starter seed during setup. The site is available at http://localhost:4321.

## Deploying

```bash
npx wrangler login
npm run deploy
```

The first deployment provisions the named D1 database and R2 bucket from `wrangler.jsonc`. See [Deploy to Cloudflare](https://docs.emdashcms.com/deployment/cloudflare/) for production setup, or use the deploy button above.

## Upstream Requests (EmDash)

Things to file with [EmDash](https://github.com/emdash-cms/emdash/issues) rather than work around locally.

- [ ] **Tag icon for any flat taxonomy in the admin sidebar.** The admin picks a taxonomy's nav icon by name only: `getTaxonomyNavIcon(name)` returns the tag icon when `name === "tag"` and the generic taxonomy icon otherwise (`@emdash-cms/admin`). Our "Recipe Tags" (`recipe_tag`) is a tag list but shows the generic icon, while "Blog Tags" (`tag`) gets the tag icon. Request either an `icon` option on taxonomy definitions (seed + Content Types UI), or defaulting non-hierarchical taxonomies to the tag icon. Cosmetic only; ignore until fixed upstream.

## See Also

- [Node.js variant](../starter) -- same template using SQLite and local file storage
- [All templates](../)
- [EmDash documentation](https://docs.emdashcms.com/)
