#!/usr/bin/env node
/**
 * Replace the LOCAL dev site's content with a copy of the LIVE site.
 *
 *   npm run pull:live                      # export live, then import locally
 *   npm run pull:live -- --package <file>  # skip the export, import a package you already have
 *   npm run pull:live -- --port 4322       # use another port for the temporary server
 *
 * One-way only: live -> local. Nothing is ever written to the live site.
 *
 * Steps (each destructive one asks first):
 *   1. Export live with `emdash site export` into .local-sync/ (gitignored).
 *      Needs a live API token with the `transfer:export` scope. It is read from
 *      LIVE_EMDASH_TOKEN or typed at a hidden prompt, never printed or saved.
 *   2. Move .wrangler/state (local D1 + R2 + KV) to .wrangler/state-backup-<time>.
 *      Nothing is deleted; delete old backups yourself when you're happy.
 *   3. Start a temporary dev server on the fresh state, set it up with the
 *      seed schema only (no sample content) via the dev bypass.
 *   4. `emdash site import --analyze`, show the plan, confirm, then import.
 *   5. Stop the temporary server. Run `npm run dev` as usual afterwards.
 *
 * What comes across: content (incl. drafts + trash), media, menus, taxonomies,
 * settings, comments. What doesn't: users and passkeys. Sign in locally with
 * http://localhost:4321/_emdash/api/auth/dev-bypass?redirect=/_emdash/admin
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, renameSync } from "node:fs";
import { resolve } from "node:path";
import { createInterface } from "node:readline";

const LIVE_URL = "https://lifeatthenest.ethan-5da.workers.dev";
const ROOT = resolve(import.meta.dirname, "..");
const SYNC_DIR = resolve(ROOT, ".local-sync");
const STATE_DIR = resolve(ROOT, ".wrangler/state");

const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const args = process.argv.slice(2);
const option = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const packageArg = option("--package");
const PORT = option("--port") ?? "4321";
const LOCAL_URL = `http://localhost:${PORT}`;

// ── helpers ────────────────────────────────────────────────────────────────

const step = (n, text) => console.log(`\n\x1b[1m${n}. ${text}\x1b[0m`);
const info = (text) => console.log(`   ${text}`);
let cleanup = () => {};
const fail = (text) => {
	cleanup();
	console.error(`\n\x1b[31m✖ ${text}\x1b[0m`);
	process.exit(1);
};

function ask(question, { hidden = false } = {}) {
	return new Promise((done) => {
		const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
		if (hidden) {
			// Echo nothing while the token is typed/pasted.
			rl._writeToOutput = (s) => {
				if (s.startsWith(question)) rl.output.write(question);
			};
		}
		rl.question(question, (answer) => {
			rl.close();
			if (hidden) process.stdout.write("\n");
			done(answer.trim());
		});
	});
}

async function confirm(question) {
	const answer = await ask(`   ${question} [y/N] `);
	if (!/^y(es)?$/i.test(answer)) fail("Stopped. Nothing further was changed.");
}

async function isUp(url) {
	try {
		await fetch(url, { signal: AbortSignal.timeout(2000) });
		return true;
	} catch {
		return false;
	}
}

/** Run the emdash CLI; returns parsed JSON stdout. Progress streams to stderr. */
function emdash(cliArgs, env = {}) {
	const result = spawnSync("npx", ["emdash", ...cliArgs, "--json"], {
		cwd: ROOT,
		env: { ...process.env, ...env },
		stdio: ["inherit", "pipe", "inherit"],
		encoding: "utf8",
	});
	let json;
	try {
		json = JSON.parse(result.stdout);
	} catch {
		json = undefined;
	}
	return { status: result.status, json, raw: result.stdout };
}

// ── 0. preflight ───────────────────────────────────────────────────────────

console.log("\x1b[1mCopy LIVE → LOCAL\x1b[0m");
console.log(`   from ${LIVE_URL}`);
console.log(`   into ${LOCAL_URL} (your local test copy; replaces everything in it)`);

if (!process.stdin.isTTY) fail("Run this in an interactive terminal; it asks for confirmation.");
const status = spawnSync("npx", ["astro", "dev", "status"], { cwd: ROOT, encoding: "utf8" });
if (!/No dev server is running/.test(`${status.stdout}${status.stderr}`)) {
	fail("A dev server for this project is running. Stop it first (Ctrl+C, or: npx astro dev stop).");
}
if (await isUp(LOCAL_URL)) fail(`Something else is using ${LOCAL_URL}. Free the port or pass --port.`);
if (packageArg && !existsSync(packageArg)) fail(`Package not found: ${packageArg}`);

// ── 1. export live ─────────────────────────────────────────────────────────

let packageFile = packageArg ? resolve(packageArg) : resolve(SYNC_DIR, `live-${stamp}.emdash`);

if (packageArg) {
	step(1, "Export live site — skipped, using the package you gave");
	info(packageFile);
} else {
	step(1, "Export live site");
	info("Needs a live API token with the transfer:export scope:");
	info(`${LIVE_URL}/_emdash/admin → Settings → API Tokens → create, scope "transfer:export",`);
	info("shortest expiry. Revoke it when you're done.");
	let token = process.env.LIVE_EMDASH_TOKEN;
	if (token) info("Using LIVE_EMDASH_TOKEN from the environment.");
	else token = await ask("   Paste the token (hidden): ", { hidden: true });
	if (!token) fail("No token given.");

	mkdirSync(SYNC_DIR, { recursive: true });
	const exp = emdash(["site", "export", "--url", LIVE_URL, "--output", packageFile], { EMDASH_TOKEN: token });
	token = undefined;
	if (exp.status !== 0) fail(`Export failed: ${exp.json?.error?.message ?? exp.raw}`);
	info(`Saved ${packageFile} (${exp.json?.files ?? "?"} files, ${Math.round((exp.json?.bytes ?? 0) / 1024)} KiB)`);
	info("This file holds all content and author/commenter emails. Keep it private.");
}

// ── 2. move local state aside ──────────────────────────────────────────────

step(2, "Set aside the current local database + media");
const backupDir = resolve(ROOT, `.wrangler/state-backup-${stamp}`);
if (existsSync(STATE_DIR)) {
	info(`.wrangler/state → .wrangler/state-backup-${stamp}`);
	info("(moved, not deleted — move it back to undo)");
	await confirm("Move it?");
	renameSync(STATE_DIR, backupDir);
} else {
	info("No local state yet — nothing to move.");
}

// ── 3. temporary dev server + empty setup ──────────────────────────────────

step(3, "Start a temporary dev server on a fresh, empty local site");
const astro = (...a) =>
	spawnSync("npx", ["astro", "dev", ...a], { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const started = astro("--background", "--port", PORT);
if (started.status !== 0) fail(`Dev server didn't start:\n${started.stdout}${started.stderr}`);
const stopServer = () => astro("stop");
cleanup = stopServer;
process.on("SIGINT", () => {
	stopServer();
	process.exit(130);
});

let up = false;
for (let i = 0; i < 90 && !up; i++) {
	await new Promise((r) => setTimeout(r, 1000));
	up = await isUp(LOCAL_URL);
}
if (!up) fail("Dev server didn't come up. See: npx astro dev logs");
info("Running.");

// Seed schema only (content=0) and create the local dev admin.
const setup = await fetch(`${LOCAL_URL}/_emdash/api/setup/dev-bypass?content=0`, {
	signal: AbortSignal.timeout(120_000),
});
if (!setup.ok) fail(`Local setup failed (${setup.status}): ${(await setup.text()).slice(0, 500)}`);

// Sign in as the dev admin for the API calls below.
const signIn = await fetch(`${LOCAL_URL}/_emdash/api/auth/dev-bypass`, { redirect: "manual" });
const cookie = signIn.headers
	.getSetCookie()
	.map((c) => c.split(";")[0])
	.join("; ");
const api = async (path, method = "GET") => {
	const res = await fetch(`${LOCAL_URL}/_emdash/api${path}`, {
		method,
		headers: { cookie, "X-EmDash-Request": "1" },
	});
	const body = await res.json().catch(() => ({}));
	if (!res.ok) fail(`${method} ${path} → ${res.status}: ${JSON.stringify(body).slice(0, 500)}`);
	return body.data;
};

// The seed's reference fields create relations, which EmDash (1.4) doesn't
// count as setup scaffold, so the site wouldn't count as empty. Remove them on
// this throwaway site; the import recreates the full schema from the package.
for (const rel of (await api("/relations")).relations ?? []) await api(`/relations/${rel.id}`, "DELETE");

const { portableDomain } = await api("/admin/transfer/capabilities");
if (!portableDomain?.empty) fail(`Local site isn't empty enough to import into: ${JSON.stringify(portableDomain?.blockers)}`);
info("Empty site ready (seed schema only, no content).");

// ── 4. analyze + import ────────────────────────────────────────────────────

step(4, "Import into the local site");
const analyze = (extra = []) => {
	const out = emdash(["site", "import", packageFile, "--analyze", "--url", LOCAL_URL, ...extra]);
	if (!out.json?.planDigest) fail(`Analysis failed:\n${JSON.stringify(out.json ?? out.raw, null, 2).slice(0, 3000)}`);
	return out.json;
};
let analysis = analyze();

// Users don't transfer. Credit every live author to the local Dev Admin so
// entries keep an owner (re-analyzing reuses the same upload).
const unmapped = Object.entries(analysis.plan.decisions?.principalMappings ?? {})
	.filter(([, target]) => !target)
	.map(([id]) => id);
if (unmapped.length) {
	analysis = analyze(unmapped.flatMap((id) => ["--map-principal", `${id}=dev@emdash.local`]));
}

const { plan, planDigest } = analysis;
const blockers = plan.blockers?.items ?? plan.blockers ?? [];
if (!analysis.executable || blockers.length) {
	fail(`The import plan has blockers:\n${JSON.stringify(blockers, null, 2).slice(0, 3000)}`);
}
info(`From: ${plan.origin?.createdByEmDashVersion ? `EmDash ${plan.origin.createdByEmDashVersion}, ` : ""}exported ${plan.origin?.createdAt ?? "?"}`);
const c = plan.counts ?? {};
info(`Entries ${c.entry ?? 0}, media ${c.media ?? 0}, terms ${c.term ?? 0}, menus ${c.menu ?? 0}, comments ${c.comment ?? 0}`);
for (const w of plan.warnings?.items ?? plan.warnings ?? []) info(`warning: ${w.code ?? JSON.stringify(w)}`);
info(`Plan ${planDigest}`);
await confirm("Import this into the local site?");

const run = emdash(["site", "import", packageFile, "--plan", planDigest, "--confirm", "--url", LOCAL_URL]);
if (run.status !== 0) fail(`Import failed:\n${JSON.stringify(run.json ?? run.raw, null, 2).slice(0, 3000)}`);
info(`Imported. Receipt: ${run.json?.receipt?.verification ?? run.json?.verification ?? "done"}`);

// ── 5. done ────────────────────────────────────────────────────────────────

stopServer();
step(5, "Done");
info("Start the dev server as usual:  npm run dev");
info(`Sign in:  ${LOCAL_URL}/_emdash/api/auth/dev-bypass?redirect=/_emdash/admin`);
if (existsSync(backupDir)) info(`Old local copy kept at .wrangler/state-backup-${stamp} (delete when happy).`);
info("Reminder: this is a test copy. Edits here NEVER reach the live site.");
process.exit(0);
