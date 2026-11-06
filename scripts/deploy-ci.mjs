#!/usr/bin/env node
/**
 * Production deploy, run by Cloudflare Workers Builds after `npm run build`
 * (deploy command: `npm run deploy:ci`).
 *
 *   1. Apply pending EmDash database migrations to the production D1 database
 *      from the build machine, so the Worker never migrates at runtime.
 *   2. Deploy the Worker with Wrangler.
 *   3. Verify with `emdash migrate --check` that nothing is pending.
 * If step 1 fails, step 2 never runs and the current version keeps serving.
 *
 * Build variables (Workers Builds > Settings > Build > Variables and secrets):
 *   EMDASH_MIGRATE_TOKEN       (secret)   Cloudflare API token with D1 Edit.
 *                                         Kept separate from CLOUDFLARE_API_TOKEN,
 *                                         which Workers Builds uses to deploy.
 *   EMDASH_TARGET_FINGERPRINT  (variable) From `emdash migrate --status`; guards
 *                                         against migrating the wrong database.
 *
 * `node scripts/deploy-ci.mjs --check` applies and deploys nothing: it reports
 * pending migrations and packages the Worker with `wrangler deploy --dry-run`.
 */
import { spawnSync } from "node:child_process";

// Not secrets: identifiers for the production account and database.
const ACCOUNT_ID = "5dae3c6cfd1e52fbd1cc35ceaba70321";
const D1_DATABASE_ID = "6a4529a3-33d1-4ac8-9167-8b7d7d1df823"; // lifeatthenest-db

const checkOnly = process.argv.includes("--check");

function fail(message) {
	console.error(`\n[deploy-ci] ${message}`);
	process.exit(1);
}

function run(label, args, env = process.env) {
	console.log(`\n[deploy-ci] ${label}: npx ${args.join(" ")}`);
	const result = spawnSync("npx", args, { stdio: "inherit", env });
	return result.status ?? 1;
}

const token = process.env.EMDASH_MIGRATE_TOKEN?.trim();
const fingerprint = process.env.EMDASH_TARGET_FINGERPRINT?.trim();
if (!token) fail("EMDASH_MIGRATE_TOKEN is not set (D1 Edit API token).");
if (!fingerprint && !checkOnly) fail("EMDASH_TARGET_FINGERPRINT is not set.");

// The migration token is passed only to the migrate step, under the name the
// EmDash CLI expects. Wrangler keeps the deploy token Workers Builds provides.
const migrateEnv = { ...process.env, CLOUDFLARE_API_TOKEN: token };
const target = ["--account-id", ACCOUNT_ID, "--d1", D1_DATABASE_ID];

if (checkOnly) {
	// Exit code 2 = migrations pending (informational in check mode).
	const status = run("Check migrations", ["emdash", "migrate", "--check", ...target], migrateEnv);
	if (status !== 0 && status !== 2) fail(`Migration check failed (exit ${status}).`);
	console.log(status === 2 ? "[deploy-ci] Migrations are pending." : "[deploy-ci] No pending migrations.");
	if (run("Package Worker (dry run)", ["wrangler", "deploy", "--dry-run"]) !== 0) fail("Dry-run deploy failed.");
	console.log("\n[deploy-ci] Check complete. Nothing was applied or deployed.");
	process.exit(0);
}

if (run("Apply migrations", ["emdash", "migrate", ...target, "--expected-target-fingerprint", fingerprint], migrateEnv) !== 0) {
	fail("Migrations failed; not deploying. The current version keeps serving.");
}
if (run("Deploy Worker", ["wrangler", "deploy"]) !== 0) fail("Wrangler deploy failed.");

// Post-deploy guard (as in EmDash's CI example): confirm the database has no
// pending or unknown migrations for this release. The deploy has already
// happened, so a failure here marks the build red for attention rather than
// rolling anything back.
const after = run("Verify migrations", ["emdash", "migrate", "--check", ...target], migrateEnv);
if (after === 2) fail("Deployed, but migrations are still pending. Check the database before the next deploy.");
if (after !== 0) fail(`Deployed, but the migration check failed (exit ${after}). Check the build log.`);
console.log("\n[deploy-ci] Done. Migrations verified.");
