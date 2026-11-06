/**
 * EmDash native plugin: a "Local test copy" notice in the admin during
 * `astro dev` (see ./admin.ts). It stores nothing and does nothing in
 * production; removing it only removes the notice.
 *
 * Registered in astro.config.mjs via ./descriptor.mjs, which passes the
 * admin module path in `options` (it must match the descriptor's adminEntry).
 */
import { definePlugin } from "emdash";

export function createPlugin(options: { adminEntry?: string } = {}) {
	return definePlugin({
		id: "local-notice",
		version: "0.1.0",
		admin: {
			entry: options.adminEntry,
		},
	});
}
