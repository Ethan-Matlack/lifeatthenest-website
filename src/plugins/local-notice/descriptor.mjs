// Build-time descriptor for the local-notice plugin, imported by astro.config.mjs.
// `adminEntry` is bundled into the EmDash admin; `admin.entry` in plugin.ts must
// match it, so it's passed through `options`.
import { fileURLToPath } from "node:url";

export function localNoticePlugin() {
	const adminEntry = fileURLToPath(new URL("./admin.ts", import.meta.url));
	return {
		id: "local-notice",
		version: "0.1.0",
		format: "native",
		entrypoint: fileURLToPath(new URL("./plugin.ts", import.meta.url)),
		adminEntry,
		options: { adminEntry },
	};
}
