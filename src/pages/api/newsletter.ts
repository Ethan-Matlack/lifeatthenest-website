/**
 * POST /api/newsletter: newsletter signup (Kit, double opt-in).
 *
 *   1. honeypot field filled -> pretend success, do nothing
 *   2. validate the email
 *   3. verify Cloudflare Turnstile
 *   4. add to Kit (see src/utils/newsletter.ts); Kit emails a confirmation
 *
 * Until KIT_API_KEY, KIT_FORM_ID, TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY
 * are all set on the Worker, it replies "signups open soon".
 *
 * Replies with JSON when the request asks for it (the form's JS does);
 * otherwise redirects back to the page with ?newsletter=<status>.
 */
import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import {
	SIGNUP_MESSAGES,
	newsletterConfig,
	parseSignup,
	subscribeToKit,
	verifyTurnstile,
	type SignupStatus,
} from "../../utils/newsletter";

export const prerender = false;

const HTTP_STATUS: Record<SignupStatus, number> = {
	ok: 200,
	already: 200,
	invalid: 400,
	verify: 400,
	error: 502,
	soon: 503,
};

/** Same-site page the form was on, for the no-JS redirect and Kit's referrer. */
function sourcePage(request: Request, url: URL): URL {
	try {
		const ref = new URL(request.headers.get("referer") ?? "");
		if (ref.origin === url.origin) return ref;
	} catch {}
	return new URL("/contact", url);
}

function reply(request: Request, url: URL, status: SignupStatus) {
	const ok = status === "ok" || status === "already";
	if (request.headers.get("accept")?.includes("application/json")) {
		return new Response(JSON.stringify({ ok, status, message: SIGNUP_MESSAGES[status] }), {
			status: HTTP_STATUS[status],
			headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
		});
	}
	const back = sourcePage(request, url);
	back.searchParams.set("newsletter", status);
	back.hash = "newsletter";
	return new Response(null, { status: 303, headers: { Location: back.pathname + back.search + back.hash } });
}

export const POST: APIRoute = async ({ request, url }) => {
	let form: FormData;
	try {
		form = await request.formData();
	} catch {
		return reply(request, url, "invalid");
	}

	const config = newsletterConfig(env as unknown as Record<string, unknown>);

	// Spam trap filled in: look successful, do nothing.
	if (String(form.get("website") ?? "").trim()) return reply(request, url, config ? "ok" : "soon");

	const { email, firstName } = parseSignup(form);
	if (!email) return reply(request, url, "invalid");
	if (!config) return reply(request, url, "soon");

	const token = String(form.get("cf-turnstile-response") ?? "");
	const human = await verifyTurnstile(token, config.turnstileSecretKey, request.headers.get("CF-Connecting-IP"));
	if (!human) return reply(request, url, "verify");

	const page = sourcePage(request, url);
	const status = await subscribeToKit({ email, firstName, referrer: page.origin + page.pathname }, config);
	return reply(request, url, status);
};
