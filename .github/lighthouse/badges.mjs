#!/usr/bin/env node
/**
 * Writes the production Lighthouse scores to a GitHub Gist as Shields.io
 * "endpoint" JSON files, which the README badges read. Used by
 * .github/workflows/lighthouse-production.yml.
 *
 *   node .github/lighthouse/badges.mjs <resultsPath>
 *
 * Env: LIGHTHOUSE_GIST_TOKEN (a token with the `gist` scope) and
 * LIGHTHOUSE_GIST_ID. If either is missing it prints the scores and exits
 * cleanly, so the workflow works before the badges are set up.
 * The Gist must already exist (any content); files are created or replaced.
 * Pass --dry-run to print the files instead of uploading them.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
const resultsPath = args.find((a) => !a.startsWith("--"));
const dryRun = args.includes("--dry-run");
if (!resultsPath) {
	console.error("Usage: badges.mjs <resultsPath> [--dry-run]");
	process.exit(1);
}

const manifest = JSON.parse(readFileSync(join(resultsPath, "manifest.json"), "utf8"));
const run = manifest.find((r) => r.isRepresentativeRun);
if (!run) {
	console.error("No representative Lighthouse run found.");
	process.exit(1);
}

const LABEL = { performance: "Performance", accessibility: "Accessibility", "best-practices": "Best Practices", seo: "SEO" };
const color = (score) => (score >= 0.9 ? "brightgreen" : score >= 0.5 ? "orange" : "red");

const files = {};
for (const [category, score] of Object.entries(run.summary)) {
	if (!LABEL[category]) continue;
	files[`lighthouse-${category}.json`] = {
		content: JSON.stringify({ schemaVersion: 1, label: LABEL[category], message: String(Math.round(score * 100)), color: color(score) }),
	};
}
console.log(`Scores for ${run.url}:`, Object.fromEntries(Object.entries(run.summary).map(([k, v]) => [k, Math.round(v * 100)])));

const token = process.env.LIGHTHOUSE_GIST_TOKEN;
const gistId = process.env.LIGHTHOUSE_GIST_ID;
if (dryRun || !token || !gistId) {
	if (!dryRun) {
		const missing = [!token && "secret LIGHTHOUSE_GIST_TOKEN", !gistId && "variable LIGHTHOUSE_GIST_ID"].filter(Boolean).join(" and ");
		// A GitHub Actions warning annotation: shows on the run and its summary
		// instead of passing silently.
		console.log(`::warning title=Badges not updated::Missing ${missing} (Settings → Secrets and variables → Actions). See README > Staging and Lighthouse.`);
	}
	console.log(JSON.stringify(files, null, 2));
	process.exit(0);
}

const res = await fetch(`https://api.github.com/gists/${gistId}`, {
	method: "PATCH",
	headers: {
		Authorization: `Bearer ${token}`,
		Accept: "application/vnd.github+json",
		"X-GitHub-Api-Version": "2022-11-28",
		"User-Agent": "lighthouse-badges",
	},
	body: JSON.stringify({ files }),
});
if (!res.ok) {
	console.error(`Gist update failed: ${res.status} ${(await res.text()).slice(0, 300)}`);
	process.exit(1);
}
console.log(`Updated ${Object.keys(files).length} badge files in gist ${gistId}.`);
