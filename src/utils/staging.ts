/**
 * Staging (staging.lifeatthenest.com) runs the `dev` branch against the LIVE
 * database and media, so it must never write anything. src/worker.ts applies
 * these rules to every request when SITE_ENV is "staging", before EmDash,
 * the admin, or any API route runs.
 */

export const PRODUCTION_ORIGIN = "https://lifeatthenest.com";

const READ_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** Paths that sign people in or set the site up (even via GET). */
const BLOCKED_PREFIXES = ["/_emdash/api/auth", "/_emdash/api/setup"];

/**
 * The response to send instead of handling the request, or null to let it
 * through. The admin redirects to the live admin (that's where editing
 * happens); sign-in/setup and every write are refused.
 */
export function stagingGuard(request: Request): Response | null {
	const url = new URL(request.url);
	const path = url.pathname;

	if (path === "/_emdash/admin" || path.startsWith("/_emdash/admin/")) {
		return Response.redirect(`${PRODUCTION_ORIGIN}${path}${url.search}`, 302);
	}
	if (!READ_METHODS.has(request.method) || BLOCKED_PREFIXES.some((p) => path.startsWith(p))) {
		return new Response("Staging is read-only. Make changes on https://lifeatthenest.com.", {
			status: 403,
			headers: { "Content-Type": "text/plain; charset=utf-8", "X-Robots-Tag": "noindex, nofollow" },
		});
	}
	return null;
}

/** Keep staging out of search engines (it duplicates the live site). */
export function markStaging(response: Response): Response {
	if (response.status === 101) return response; // WebSocket upgrade: leave untouched
	const marked = new Response(response.body, response);
	marked.headers.set("X-Robots-Tag", "noindex, nofollow");
	return marked;
}
