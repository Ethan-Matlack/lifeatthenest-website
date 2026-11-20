/**
 * Cloudflare Turnstile site key for forms, or "" when Turnstile isn't fully
 * configured. Returns the key only when the secret is set too: the public
 * key alone (it's in wrangler.jsonc, so local dev has it) would show a
 * widget nothing verifies, and on localhost a real key doesn't load anyway.
 *
 * Comment forms need this: EmDash enforces Turnstile on comments whenever
 * TURNSTILE_SECRET_KEY is set, so a form without the widget gets every
 * comment rejected ("CAPTCHA verification failed").
 */
export function turnstileSiteKey(env: Record<string, unknown>): string {
	const site = typeof env.TURNSTILE_SITE_KEY === "string" ? env.TURNSTILE_SITE_KEY.trim() : "";
	const secret = typeof env.TURNSTILE_SECRET_KEY === "string" ? env.TURNSTILE_SECRET_KEY.trim() : "";
	return site && secret ? site : "";
}
