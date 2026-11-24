#!/usr/bin/env node
/**
 * Render share / cover images (GitHub social preview, link previews, slides)
 * in the site's colours, fonts, and logo.
 *
 *   node scripts/render-share-images.mjs
 *   node scripts/render-share-images.mjs --out docs/images/share --photo ~/Pictures/hero.jpg
 *
 * Options:
 *   --out <dir>       Where to write the PNGs (default: docs/images/share)
 *   --photo <file|url> Photo for the "arch" design (default: the live
 *                     homepage's welcome photo)
 *   --site <url>      Site to fetch the default photo from (default: https://lifeatthenest.com)
 *
 * Writes two designs at 2:1 (1280x640) and 3:2 (1200x800):
 *   share-arch-*      linen, logo + tagline, arched photo
 *   share-wordmark-*  olive (like the footer), cream logo, no photo
 *
 * Colours come from src/styles/theme.css and the logo from
 * public/images/logo.svg, so re-running picks up palette changes.
 * Needs Chromium or Chrome installed (set CHROME_PATH if it isn't found) and
 * a network connection for the Google Fonts and the default photo.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
const option = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const OUT = resolve(ROOT, option("--out", "docs/images/share"));
const SITE = option("--site", "https://lifeatthenest.com").replace(/\/$/, "");
const PHOTO = option("--photo");

// ── browser ────────────────────────────────────────────────────────────────
const candidates = [process.env.CHROME_PATH, "chromium", "chromium-browser", "google-chrome", "google-chrome-stable"];
const browser = candidates.find((c) => c && spawnSync(c, ["--version"], { encoding: "utf8" }).status === 0);
if (!browser) {
	console.error("Chromium/Chrome not found. Install it or set CHROME_PATH.");
	process.exit(1);
}

// ── inputs ─────────────────────────────────────────────────────────────────
const css = readFileSync(resolve(ROOT, "src/styles/theme.css"), "utf8");
const tok = (name) => {
	const m = css.match(new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})`));
	if (!m) throw new Error(`--color-${name} not found in theme.css`);
	return m[1];
};
const C = { sage: tok("sage"), moss: tok("moss"), olive: tok("olive"), cream: tok("cream"), linen: tok("linen") };

const logo = readFileSync(resolve(ROOT, "public/images/logo.svg"));
const logoUrl = `data:image/svg+xml;base64,${logo.toString("base64")}`;

async function fetchBytes(url) {
	const res = await fetch(url);
	if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
	return { bytes: Buffer.from(await res.arrayBuffer()), type: res.headers.get("content-type") ?? "image/jpeg" };
}

async function loadPhoto() {
	if (PHOTO && !/^https?:/.test(PHOTO)) {
		const type = /\.png$/i.test(PHOTO) ? "image/png" : /\.webp$/i.test(PHOTO) ? "image/webp" : "image/jpeg";
		return { bytes: readFileSync(resolve(PHOTO)), type };
	}
	if (PHOTO) return fetchBytes(PHOTO);
	// The homepage welcome photo: first image inside .hero-media.
	const html = await (await fetch(`${SITE}/`)).text();
	const block = html.slice(html.indexOf('class="hero-media'));
	const src = block.match(/<img[^>]*\ssrc="([^"]+)"/)?.[1];
	if (!src) throw new Error("Couldn't find the homepage photo; pass --photo.");
	// Resized src is /cdn-cgi/image/<opts>/<original>; ask for a large JPEG of the original.
	const original = src.includes("/cdn-cgi/image/") ? src.replace(/^.*\/cdn-cgi\/image\/[^/]+\//, "") : new URL(src, SITE).href;
	return fetchBytes(`${SITE}/cdn-cgi/image/width=1100,height=1375,fit=cover,format=jpeg,quality=88/${original}`);
}

const photo = await loadPhoto();
const photoUrl = `data:${photo.type};base64,${photo.bytes.toString("base64")}`;

// ── designs ────────────────────────────────────────────────────────────────
const fonts = `<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..700;1,9..144,300..700&family=Source+Sans+3:wght@400..700&display=block" rel="stylesheet">`;
const tagline = `<span style="white-space:nowrap">Make-it-from-scratch</span> living from our kitchen, garden, pasture, and studio.`;

const base = (w, h) => `
*{box-sizing:border-box;margin:0}
html,body{width:${w}px;height:${h}px;overflow:hidden}
body{font-family:"Source Sans 3",system-ui,sans-serif;-webkit-font-smoothing:antialiased}
.eyebrow{font-weight:600;letter-spacing:.16em;text-transform:uppercase}
.arch{overflow:hidden;border-radius:50% 50% 14px 14px / 40% 40% 14px 14px}
.arch img{width:100%;height:100%;object-fit:cover;display:block}`;

function arch(w, h) {
	const tall = h / w > 0.6; // 3:2
	const pad = Math.round(h * 0.1);
	const archH = h - pad * 2;
	return `<!doctype html><html><head><meta charset="utf-8">${fonts}<style>${base(w, h)}
body{background:${C.linen};color:${C.olive}}
.frame{position:absolute;inset:${Math.round(pad * 0.45)}px;border:1.5px solid ${C.sage};border-radius:22px;opacity:.55}
.wrap{position:absolute;inset:${pad}px;display:flex;align-items:center;gap:${Math.round(w * 0.06)}px}
.copy{flex:1;display:flex;flex-direction:column;gap:${tall ? 26 : 20}px;padding-left:${Math.round(w * 0.02)}px}
.logo{width:${tall ? 560 : 540}px;max-width:100%}
.by{font-size:${tall ? 22 : 19}px;color:${C.moss};margin-top:-6px}
.rule{width:64px;height:2px;background:${C.sage};border-radius:2px}
.line{font-family:Fraunces,Georgia,serif;font-weight:400;font-size:${tall ? 36 : 34}px;line-height:1.25;color:${C.olive};max-width:${tall ? 560 : 600}px}
.url{font-size:${tall ? 22 : 20}px;font-weight:600;letter-spacing:.04em;color:${C.moss}}
.arch{flex:none;width:${Math.round(archH * 0.8)}px;height:${archH}px}
</style></head><body>
<div class="frame"></div>
<div class="wrap">
  <div class="copy">
    <img class="logo" src="${logoUrl}" alt="">
    <span class="eyebrow by">With Audra Chalfant Matlack</span>
    <span class="rule"></span>
    <p class="line">${tagline}</p>
    <span class="url">lifeatthenest.com</span>
  </div>
  <div class="arch"><img src="${photoUrl}" alt=""></div>
</div></body></html>`;
}

function wordmark(w, h) {
	const tall = h / w > 0.6;
	return `<!doctype html><html><head><meta charset="utf-8">${fonts}<style>${base(w, h)}
body{background:${C.olive};color:${C.cream};display:grid;place-items:center;text-align:center}
body::before{content:"";position:absolute;inset:0;background-image:radial-gradient(${C.sage}55 1.2px,transparent 1.8px);background-size:22px 22px;
  -webkit-mask:radial-gradient(ellipse at center,transparent 38%,#000 85%);mask:radial-gradient(ellipse at center,transparent 38%,#000 85%)}
.inner{position:relative;display:flex;flex-direction:column;align-items:center;gap:${tall ? 30 : 24}px}
.logo{width:${tall ? 760 : 720}px;aspect-ratio:341/89.6;background:${C.cream};
  -webkit-mask:url("${logoUrl}") center/contain no-repeat;mask:url("${logoUrl}") center/contain no-repeat}
.by{font-size:${tall ? 24 : 21}px;color:${C.linen}}
.line{text-wrap:balance;font-family:Fraunces,Georgia,serif;font-style:italic;font-weight:400;font-size:${tall ? 34 : 30}px;color:${C.cream};opacity:.92;max-width:${tall ? 900 : 1000}px;line-height:1.3}
.url{font-size:${tall ? 21 : 19}px;font-weight:600;letter-spacing:.06em;color:${C.linen};padding:10px 26px;border:1.5px solid ${C.cream}59;border-radius:999px}
</style></head><body>
<div class="inner">
  <div class="logo"></div>
  <span class="eyebrow by">With Audra Chalfant Matlack</span>
  <p class="line">${tagline}</p>
  <span class="url">lifeatthenest.com</span>
</div></body></html>`;
}

// ── render ─────────────────────────────────────────────────────────────────
mkdirSync(OUT, { recursive: true });
const work = mkdtempSync(join(tmpdir(), "share-images-"));
try {
	for (const [name, design] of [["arch", arch], ["wordmark", wordmark]]) {
		for (const [ratio, w, h] of [["2x1", 1280, 640], ["3x2", 1200, 800]]) {
			const page = join(work, `${name}-${ratio}.html`);
			writeFileSync(page, design(w, h));
			const file = join(OUT, `share-${name}-${ratio}-${w}x${h}.png`);
			const run = spawnSync(
				browser,
				[
					"--headless",
					"--disable-gpu",
					"--hide-scrollbars",
					"--force-device-scale-factor=1",
					`--window-size=${w},${h}`,
					"--virtual-time-budget=10000", // let the web fonts load
					`--user-data-dir=${join(work, "profile")}`,
					`--screenshot=${file}`,
					pathToFileURL(page).href,
				],
				{ encoding: "utf8" },
			);
			if (run.status !== 0 || !existsSync(file)) {
				throw new Error(`Rendering ${name} ${ratio} failed:\n${run.stderr.slice(-1500)}`);
			}
			console.log(`wrote ${file.replace(`${ROOT}/`, "")}`);
		}
	}
} finally {
	rmSync(work, { recursive: true, force: true });
}
