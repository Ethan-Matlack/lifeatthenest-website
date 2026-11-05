// Build-time descriptor for the content-cards plugin, imported by astro.config.mjs.
// EmDash imports `createPlugin` from `entrypoint` when the site starts.
import { fileURLToPath } from "node:url";

export function contentCardsPlugin() {
	return {
		id: "content-cards",
		version: "0.1.0",
		format: "native",
		entrypoint: fileURLToPath(new URL("./plugin.ts", import.meta.url)),
		options: {},
	};
}
