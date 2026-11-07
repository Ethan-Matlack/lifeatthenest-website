#!/usr/bin/env node
/**
 * Content-type migration for the "Videos" repeater on posts and recipes:
 * moves the old single "Video link" field (`video_url`) into `videos`
 * (rows of { url, title, image }), and keeps the repeater's sub-fields in
 * sync with VIDEOS_FIELD below when new ones are added (e.g. the thumbnail).
 *
 *   node scripts/migrate-videos.mjs                       # local dev site, dry run
 *   node scripts/migrate-videos.mjs --apply               # local, do it
 *   EMDASH_TOKEN=... node scripts/migrate-videos.mjs --url https://lifeatthenest.ethan-5da.workers.dev --apply
 *
 * Steps, per collection (each is skipped if already done, so re-running is safe):
 *   1. Add the `videos` repeater right where `video_url` sits, or, if it
 *      exists, add any sub-fields it's missing (existing rows are untouched).
 *   2. Copy each entry's `video_url` into `videos` and re-publish it.
 *      Entries with unpublished draft edits are SKIPPED (publishing would
 *      push those edits live); they're listed so they can be done by hand.
 *   3. Delete `video_url`, only if every entry was copied and --apply is set.
 *
 * Live needs a token with schema write + content write/publish scopes.
 * The site code reads `videos` first and falls back to `video_url`, so the
 * site looks the same before, during, and after.
 */
const args = process.argv.slice(2);
const BASE = (args.includes("--url") ? args[args.indexOf("--url") + 1] : "http://localhost:4321").replace(/\/$/, "");
const APPLY = args.includes("--apply");
const API = `${BASE}/_emdash/api`;
const COLLECTIONS = ["posts", "recipes"];

const VIDEOS_FIELD = {
	slug: "videos",
	label: "Videos (optional)",
	type: "repeater",
	validation: {
		maxItems: 10,
		subFields: [
			{ slug: "url", label: "Video link (YouTube, TikTok, Instagram, Facebook)", type: "url", required: true },
			{ slug: "title", label: "Title (optional, shown on the card)", type: "string" },
			{ slug: "image", label: "Thumbnail (optional, replaces the automatic one)", type: "image" },
		],
	},
};

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
	if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${JSON.stringify(json).slice(0, 400)}`);
	return json.data;
}

async function allEntries(collection) {
	const items = [];
	let cursor;
	do {
		const q = new URLSearchParams({ limit: "100", ...(cursor ? { cursor } : {}) });
		const data = await api(`/content/${collection}?${q}`);
		items.push(...data.items);
		cursor = data.nextCursor;
	} while (cursor);
	return items;
}

// ── run ────────────────────────────────────────────────────────────────────
console.log(`${APPLY ? "APPLYING" : "DRY RUN (add --apply to make changes)"} on ${BASE}\n`);
let problems = 0;

for (const collection of COLLECTIONS) {
	console.log(`── ${collection}`);
	const schema = await api(`/schema/collections/${collection}?includeFields=true`);
	const fields = (schema.item ?? schema).fields;
	const slugs = fields.map((f) => f.slug);
	const hasOld = slugs.includes("video_url");
	const hasNew = slugs.includes("videos");

	// 1. Add the repeater next to the old field.
	if (!hasNew) {
		console.log("   add field `videos`");
		if (APPLY) {
			await api(`/schema/collections/${collection}/fields`, "POST", VIDEOS_FIELD);
			if (hasOld) {
				const order = slugs.flatMap((s) => (s === "video_url" ? ["video_url", "videos"] : [s]));
				await api(`/schema/collections/${collection}/fields/reorder`, "POST", { fieldSlugs: order });
			}
		}
	} else {
		const current = fields.find((f) => f.slug === "videos");
		const have = new Set((current.validation?.subFields ?? []).map((f) => f.slug));
		const missing = VIDEOS_FIELD.validation.subFields.filter((f) => !have.has(f.slug));
		if (missing.length) {
			console.log(`   field \`videos\`: add sub-field(s) ${missing.map((f) => `\`${f.slug}\``).join(", ")}`);
			if (APPLY) {
				const subFields = [...(current.validation?.subFields ?? []), ...missing];
				await api(`/schema/collections/${collection}/fields/videos`, "PUT", {
					validation: { ...current.validation, subFields },
				});
			}
		} else {
			console.log("   field `videos` is up to date");
		}
	}

	if (!hasOld) {
		console.log("   no `video_url` field: nothing to copy\n");
		continue;
	}

	// 2. Copy values.
	const skipped = [];
	for (const item of await allEntries(collection)) {
		const url = typeof item.data?.video_url === "string" ? item.data.video_url.trim() : "";
		const existing = Array.isArray(item.data?.videos) ? item.data.videos : [];
		if (!url || existing.some((v) => v?.url === url)) continue;
		const name = item.slug ?? item.id;
		if (item.draftRevisionId) {
			skipped.push(name);
			console.log(`   SKIP ${name}: has unpublished draft edits (copy its video by hand)`);
			continue;
		}
		console.log(`   copy ${name}: ${url}`);
		if (APPLY) {
			await api(`/content/${collection}/${item.id}`, "PUT", { data: { videos: [...existing, { url }] } });
			if (item.status === "published") await api(`/content/${collection}/${item.id}/publish`, "POST");
		}
	}

	// 3. Remove the old field once everything is across.
	if (skipped.length) {
		problems += skipped.length;
		console.log("   keep `video_url` until the skipped entries are done\n");
	} else {
		console.log("   delete field `video_url`\n");
		if (APPLY) await api(`/schema/collections/${collection}/fields/video_url`, "DELETE");
	}
}

console.log(problems ? `Done with ${problems} skipped entr${problems === 1 ? "y" : "ies"}.` : "Done.");
if (!APPLY) console.log("Nothing was changed (dry run).");
