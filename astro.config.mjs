import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import { d1, r2 } from "@emdash-cms/cloudflare";
import { defineConfig, fontProviders } from "astro/config";
import emdash from "emdash/astro";
import { github } from "emdash/auth/providers/github";
import { google } from "emdash/auth/providers/google";
import { contentCardsPlugin } from "./src/plugins/content-cards/descriptor.mjs";
import { localNoticePlugin } from "./src/plugins/local-notice/descriptor.mjs";
import { recipeEditorPlugin } from "./src/plugins/recipe-editor/descriptor.mjs";

// Hostnames this site is served from. Astro only optimizes (resizes + WebP)
// absolute image URLs from allowed hosts; EmDash allows its own media route
// only when it knows the site URL at build time, which we don't set. Without
// this, production serves full-size originals. Add any new domain here
// (it must be a Cloudflare zone with Image Transformations enabled).
const SITE_HOSTS = ["lifeatthenest.ethan-5da.workers.dev", "lifeatthenest.com", "www.lifeatthenest.com"];

export default defineConfig({
	output: "server",
	// Images are resized by Cloudflare's CDN (/cdn-cgi/image/... URLs), which
	// caches the result, so image requests never run the Worker (no cold
	// starts). Needs Images -> Transformations enabled on the zone. `astro dev`
	// serves originals instead. Doesn't work on *.workers.dev.
	adapter: cloudflare({ imageService: "cloudflare" }),
	image: {
		layout: "constrained",
		responsiveStyles: true,
		// Only EmDash's own media route on our hosts. Cloudflare fetches the
		// original from this route on a cache miss, then serves its cached copy.
		remotePatterns: SITE_HOSTS.map((hostname) => ({
			protocol: "https",
			hostname,
			pathname: "/_emdash/api/media/file/**",
		})),
	},
	integrations: [
		react(),
		emdash({
			database: d1({ binding: "DB", session: "auto", coalesce: true }),
			storage: r2({ binding: "MEDIA" }),
			authProviders: [github(), google()],
			// Our own plugins: "Recipe card" editor block (src/plugins/content-cards) and
			// compact ingredient/step editors for recipes (src/plugins/recipe-editor),
			// and a dev-only "Local test copy" notice in the admin (src/plugins/local-notice).
			plugins: [contentCardsPlugin(), recipeEditorPlugin(), localNoticePlugin()],
		}),
	],
	fonts: [
		{
			provider: fontProviders.google(),
			name: "Fraunces",
			cssVariable: "--font-display",
			weights: ["300 700"],
			styles: ["normal", "italic"],
			subsets: ["latin", "latin-ext"],
			fallbacks: ["Georgia", "serif"],
		},
		{
			provider: fontProviders.google(),
			name: "Source Sans 3",
			cssVariable: "--font-body",
			weights: ["400 700"],
			styles: ["normal", "italic"],
			subsets: ["latin", "latin-ext"],
			fallbacks: ["system-ui", "sans-serif"],
		},
	],
	devToolbar: { enabled: false },
});
