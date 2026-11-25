#!/usr/bin/env node
/**
 * Turns Lighthouse CI results into the Markdown used for the PR comment and
 * the workflow summary. Used by .github/workflows/lighthouse.yml.
 *
 *   node .github/lighthouse/report.mjs <resultsPath> [title]
 *
 * <resultsPath> is the folder with manifest.json that
 * treosh/lighthouse-ci-action reports as `resultsPath`. Report links come
 * from the LIGHTHOUSE_LINKS env var (the action's `links` output, JSON).
 * Prints Markdown to stdout.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const [resultsPath, title = "🔦 Lighthouse report"] = process.argv.slice(2);
if (!resultsPath) {
	console.error("Usage: report.mjs <resultsPath> [title]");
	process.exit(1);
}

const manifest = JSON.parse(readFileSync(join(resultsPath, "manifest.json"), "utf8"));
let links = {};
try {
	links = JSON.parse(process.env.LIGHTHOUSE_LINKS || "{}");
} catch {
	links = {};
}

const CATEGORY_LABEL = { performance: "Performance", accessibility: "Accessibility", "best-practices": "Best Practices", seo: "SEO" };
const METRICS = {
	FCP: "first-contentful-paint",
	LCP: "largest-contentful-paint",
	TBT: "total-blocking-time",
	SI: "speed-index",
	CLS: "cumulative-layout-shift",
};
const FORM_FACTOR = { mobile: "📱 Mobile", desktop: "🖥️ Desktop" };
const SEP = " &nbsp;·&nbsp; ";
const emoji = (score) => (score == null ? "⚪" : score >= 0.9 ? "🟢" : score >= 0.5 ? "🟠" : "🔴");

// One representative (median) run per URL, in the order the URLs were given.
const runs = manifest.filter((run) => run.isRepresentativeRun);
const runsPerUrl = Math.max(1, Math.round(manifest.length / Math.max(1, runs.length)));
const parsed = runs.map((run) => ({ run, lhr: JSON.parse(readFileSync(run.jsonPath, "utf8")) }));

const conditions = (() => {
	const settings = parsed[0]?.lhr.configSettings;
	if (!settings) return "";
	const { formFactor, throttlingMethod, throttling } = settings;
	const detail = throttling
		? ` (${throttling.rttMs} ms RTT, ${(throttling.throughputKbps / 1000).toFixed(1)} Mbps, ${throttling.cpuSlowdownMultiplier}x CPU slowdown)`
		: "";
	const median = runsPerUrl > 1 ? `, median of ${runsPerUrl} runs` : "";
	return `_Audited with: ${FORM_FACTOR[formFactor] ?? formFactor} emulation, ${throttlingMethod} throttling${detail}${median}_`;
})();

const sections = parsed.map(({ run, lhr }) => {
	const scores = Object.entries(run.summary)
		.filter(([category]) => CATEGORY_LABEL[category])
		.map(([category, score]) => `${emoji(score)} **${CATEGORY_LABEL[category]}** ${Math.round(score * 100)}`)
		.join(SEP);
	const metrics = Object.entries(METRICS)
		.map(([short, id]) => {
			const audit = lhr.audits[id];
			return audit ? `${emoji(audit.score)} **${short}** ${audit.displayValue}` : `⚪ **${short}** n/a`;
		})
		.join(SEP);
	// A page that errored (e.g. 503 while migrations are pending) still gets
	// a report; say so rather than showing misleading scores.
	const warning = lhr.runtimeError ? `\n\n> ⚠️ ${lhr.runtimeError.code}: ${lhr.runtimeError.message}` : "";
	const link = links[run.url] ? `[View full report →](${links[run.url]})` : "_No report link available_";
	return [`#### ${run.url}`, "", scores, "", metrics + warning, "", link].join("\n");
});

const body = sections.length ? sections.join("\n\n---\n\n") : "_No Lighthouse results were produced._";
process.stdout.write([`### ${title}`, "", conditions, "", body, ""].join("\n"));
