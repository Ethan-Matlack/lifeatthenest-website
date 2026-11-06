/**
 * EmDash native plugin: compact admin editors for recipe ingredients and steps.
 *
 * It only ships React field widgets (./admin.tsx); the schema opts fields in
 * with `widget: "recipe-editor:ingredients"` / `"recipe-editor:steps"`.
 * Stored data is unchanged, so removing the plugin falls back to the default
 * repeater editors with no data loss.
 *
 * Registered in astro.config.mjs via ./descriptor.mjs, which passes the
 * admin module path in `options` (it must match the descriptor's adminEntry).
 */
import { definePlugin } from "emdash";

export function createPlugin(options: { adminEntry?: string } = {}) {
	return definePlugin({
		id: "recipe-editor",
		version: "0.1.0",
		admin: {
			entry: options.adminEntry,
		},
	});
}
