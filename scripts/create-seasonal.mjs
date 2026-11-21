#!/usr/bin/env node
/**
 * Create the "Seasonal" content type (seasonal roundup pages at
 * /seasonal/<slug>) on an EmDash site. Mirrors the `seasonal` collection in
 * seed/seed.json, which only applies to brand-new sites.
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
	description: "Seasonal roundups (e.g. Thanksgiving at the Nest): an intro plus hand-picked recipes, posts, and products.",
	icon: "leaf",
	supports: ["drafts", "revisions", "preview", "scheduling", "search", "seo"],
	urlPattern: "/seasonal/{slug}",
	admin: { listColumns: ["season"] },
};

/** Picker fields: one relation each, Seasonal page -> picked entries. */
const PICKERS = [
	{ field: "recipes", target: "recipes", label: "Recipes on this page", singular: "Recipe" },
	{ field: "posts", target: "posts", label: "Blog posts on this page", singular: "Blog Post" },
	{ field: "products", target: "products", label: "Products on this page (also shown on the Shop page)", singular: "Product" },
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

if (!existing?.titleField) {
	step("set title field to `title`");
	if (APPLY) await api(`/schema/collections/${COLLECTION.slug}`, "PUT", { titleField: "title" });
}

console.log(APPLY ? "\nDone." : "\nNothing was changed (dry run).");
