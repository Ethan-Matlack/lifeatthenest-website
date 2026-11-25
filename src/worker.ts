import handler, { createScheduledHandler, PluginBridge } from "@emdash-cms/cloudflare/worker";
import { markStaging, stagingGuard } from "./utils/staging";

export { PluginBridge };

export default {
	...handler,
	// On staging (SITE_ENV=staging, see wrangler.jsonc), refuse the admin,
	// sign-in, and writes before anything else runs: it uses the live database.
	async fetch(request, env, ctx) {
		if ((env as { SITE_ENV?: string }).SITE_ENV !== "staging") return handler.fetch!(request, env, ctx);
		return stagingGuard(request) ?? markStaging(await handler.fetch!(request, env, ctx));
	},
	scheduled: createScheduledHandler(),
} satisfies ExportedHandler;
