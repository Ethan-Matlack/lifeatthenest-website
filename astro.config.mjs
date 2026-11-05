import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import { d1, r2 } from "@emdash-cms/cloudflare";
import { defineConfig, fontProviders } from "astro/config";
import emdash from "emdash/astro";
import { contentCardsPlugin } from "./src/plugins/content-cards/descriptor.mjs";

export default defineConfig({
	output: "server",
	adapter: cloudflare(),
	image: {
		layout: "constrained",
		responsiveStyles: true,
	},
	integrations: [
		react(),
		emdash({
			database: d1({ binding: "DB", session: "auto", coalesce: true }),
			storage: r2({ binding: "MEDIA" }),
			// Our own editor blocks: "Recipe card" (see src/plugins/content-cards)
			plugins: [contentCardsPlugin()],
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
