#!/usr/bin/env node
/**
 * Create the "Seasonal" content type (seasonal roundup pages at
 * /seasonal/<slug>) and the shared flat "Seasonal Collections" taxonomy
 * (`seasonal`) on an EmDash site. Mirrors seed/seed.json, which only applies
 * to brand-new sites.
 *
 * How it fits together: tag recipes, blog posts, and products with a
 * Seasonal Collections term (e.g. "Thanksgiving"); tag a Seasonal page with
 * the same term and it lists everything tagged with it. Its two pickers pin
 * recipes/posts to the top.
 *
 *   node scripts/create-seasonal.mjs                      # local dev site, dry run
 *   node scripts/create-seasonal.mjs --apply              # local, do it
 *   EMDASH_TOKEN=... node scripts/create-seasonal.mjs --url https://lifeatthenest.com --apply
 *
 * Each step is skipped if it already exists, so re-running is safe. Nothing
 * is deleted or changed if it exists. Live needs a token with schema:read
 * and schema:write.
 */
const args = process.argv.slice(2);
const BASE = (args.includes("--url") ? args[args.indexOf("--url") + 1] : "http://localhost:4321").replace(/\/$/, "");
const APPLY = args.includes("--apply");
const API = `${BASE}/_emdash/api`;

const COLLECTION = {
	slug: "seasonal",
	label: "Seasonal",
	labelSingular: "Seasonal Page",
	description: "Seasonal roundups (e.g. Thanksgiving at the Nest). Tag it with a Seasonal Collection; everything with that tag appears automatically.",
	icon: "leaf",
	supports: ["drafts", "revisions", "preview", "scheduling", "search", "seo"],
	urlPattern: "/seasonal/{slug}",
	admin: { listColumns: ["season", "featured"] },
};

const TAXONOMY = {
	name: "seasonal",
	label: "Seasonal Collections",
	labelSingular: "Seasonal Collection",
	hierarchical: false,
	collections: ["posts", "recipes", "products", "seasonal"],
};

/** Pin pickers: one relation each, Seasonal page -> pinned entries. */
const PICKERS = [
	{ field: "pinned_recipes", target: "recipes", label: "Pinned recipes (shown first; everything tagged appears automatically)", singular: "Recipe" },
	{ field: "pinned_posts", target: "posts", label: "Pinned blog posts (shown first; everything tagged appears automatically)", singular: "Blog Post" },
];

const FIELDS = [
	{ slug: "title", label: "Title", type: "string", required: true, searchable: true, validation: { minLength: 1, maxLength: 120 } },
	{
		slug: "summary",
		label: "Short description (shows on cards and in Google)",
		type: "text",
		searchable: true,
		options: { rows: 3 },
		validation: { maxLength: 160 },
	},
	{
		slug: "hero_image",
		label: "Main photo",
		type: "image",
		validation: { allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"] },
	},
	{
		slug: "season",
		label: "Season",
		type: "select",
		validation: { options: ["Spring", "Summer", "Fall", "Winter", "Holidays"] },
	},
	{
		slug: "featured",
		label: "Feature now (shown at the top of the Seasonal page)",
		type: "boolean",
		defaultValue: false,
	},
	{ slug: "intro", label: "Intro", type: "portableText", searchable: true },
	...PICKERS.map((p) => ({
		slug: p.field,
		label: p.label,
		type: "reference",
		validation: { relation: `seasonal_${p.field}`, relationSide: "parent", targetCollection: p.target, multiple: true },
	})),
];

// ── auth ───────────────────────────────────────────────────────────────────
const headers = { "Content-Type": "application/json", "X-EmDash-Request": "1" };
if (process.env.EMDASH_TOKEN) {
	headers.Authorization = `Bearer ${process.env.EMDASH_TOKEN}`;
} else if (/^http:\/\/(localhost|127\.0\.0\.1)/.test(BASE)) {
	const res = await fetch(`${API}/auth/dev-bypass`, { redirect: "manual" });
	headers.cookie = res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
} else {
	console.error("Set EMDASH_TOKEN for a non-local site.");
	process.exit(1);
}

async function api(path, method = "GET", body) {
	const res = await fetch(`${API}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
	const json = await res.json().catch(() => ({}));
	if (!res.ok) throw Object.assign(new Error(`${method} ${path} -> ${res.status}: ${JSON.stringify(json).slice(0, 400)}`), { status: res.status });
	return json.data;
}

// ── run ────────────────────────────────────────────────────────────────────
console.log(`${APPLY ? "APPLYING" : "DRY RUN (add --apply to make changes)"} on ${BASE}\n`);
const step = (text) => console.log(`   ${text}`);

let existing = null;
try {
	const data = await api(`/schema/collections/${COLLECTION.slug}?includeFields=true`);
	existing = data.item ?? data;
} catch (error) {
	if (error.status !== 404) throw error;
}

if (existing) step("collection `seasonal` already exists");
else {
	step("create collection `seasonal`");
	if (APPLY) await api("/schema/collections", "POST", COLLECTION);
}

const taxonomies = await api("/taxonomies");
const taxList = taxonomies.taxonomies ?? taxonomies.items ?? taxonomies ?? [];
const taxonomy = (Array.isArray(taxList) ? taxList : []).find((t) => t.name === TAXONOMY.name);
if (!taxonomy) {
	step(`create taxonomy \`${TAXONOMY.name}\` (${TAXONOMY.collections.join(", ")})`);
	if (APPLY) await api("/taxonomies", "POST", TAXONOMY);
} else {
	const missing = TAXONOMY.collections.filter((c) => !(taxonomy.collections ?? []).includes(c));
	if (missing.length) {
		step(`add taxonomy \`${TAXONOMY.name}\` to ${missing.join(", ")}`);
		if (APPLY) await api(`/taxonomies/${TAXONOMY.name}`, "PUT", { collections: [...(taxonomy.collections ?? []), ...missing] });
	} else {
		step(`taxonomy \`${TAXONOMY.name}\` already exists`);
	}
}

const relations = (await api("/relations")).relations ?? [];
for (const p of PICKERS) {
	const slug = `seasonal_${p.field}`;
	if (relations.some((r) => r.slug === slug)) {
		step(`relation \`${slug}\` already exists`);
		continue;
	}
	step(`create relation \`${slug}\` (seasonal -> ${p.target})`);
	if (APPLY) {
		await api("/relations", "POST", {
			slug,
			parentCollection: "seasonal",
			childCollection: p.target,
			parentLabel: "Seasonal Pages",
			parentLabelSingular: "Seasonal Page",
			childLabel: p.label,
			childLabelSingular: p.singular,
		});
	}
}

const have = new Set((existing?.fields ?? []).map((f) => f.slug));
for (const field of FIELDS) {
	if (have.has(field.slug)) {
		step(`field \`${field.slug}\` already exists`);
		continue;
	}
	step(`add field \`${field.slug}\` (${field.type})`);
	if (APPLY) await api(`/schema/collections/${COLLECTION.slug}/fields`, "POST", field);
}

// Keep fields in the order above (new fields are added at the end).
if (APPLY || existing) {
	const now = await api(`/schema/collections/${COLLECTION.slug}?includeFields=true`).catch(() => null);
	const current = ((now?.item ?? now)?.fields ?? []).map((f) => f.slug);
	const wanted = [...FIELDS.map((f) => f.slug).filter((s) => current.includes(s)), ...current.filter((s) => !FIELDS.some((f) => f.slug === s))];
	if (current.length && JSON.stringify(current) !== JSON.stringify(wanted)) {
		step("reorder fields");
		if (APPLY) await api(`/schema/collections/${COLLECTION.slug}/fields/reorder`, "POST", { fieldSlugs: wanted });
	}
}

const wantColumns = COLLECTION.admin.listColumns;
if (existing && JSON.stringify(existing.admin?.listColumns ?? []) !== JSON.stringify(wantColumns)) {
	step(`set admin list columns to ${wantColumns.join(", ")}`);
	if (APPLY) await api(`/schema/collections/${COLLECTION.slug}`, "PUT", { admin: { ...existing.admin, listColumns: wantColumns } });
}

if (!existing?.titleField) {
	step("set title field to `title`");
	if (APPLY) await api(`/schema/collections/${COLLECTION.slug}`, "PUT", { titleField: "title" });
}

console.log(APPLY ? "\nDone." : "\nNothing was changed (dry run).");
