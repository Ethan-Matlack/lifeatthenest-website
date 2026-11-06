/**
 * POST /api/newsletter — newsletter signup.
 *
 * STUB: validates input but does not store or send anything yet. The real
 * version will (1) verify Turnstile, (2) save the email in D1, and
 * (3) forward it to the newsletter provider (provider TBD, behind an adapter).
 *
 * Responds with JSON when the request asks for it (the form's JS does);
 * otherwise redirects back to the contact page with ?newsletter=<status>.
 */
import type { APIRoute } from "astro";

export const prerender = false;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function reply(request: Request, status: "soon" | "invalid", message: string, httpStatus: number) {
	const wantsJson = request.headers.get("accept")?.includes("application/json");
	if (wantsJson) {
		return new Response(JSON.stringify({ ok: false, status, message }), {
			status: httpStatus,
			headers: { "Content-Type": "application/json" },
		});
	}
	return new Response(null, {
		status: 303,
		headers: { Location: `/contact?newsletter=${status}#newsletter` },
	});
}

export const POST: APIRoute = async ({ request }) => {
	let form: FormData;
	try {
		form = await request.formData();
	} catch {
		return reply(request, "invalid", "Please enter a valid email address.", 400);
	}

	// Spam trap filled in: pretend all is well, do nothing.
	if (String(form.get("website") ?? "").trim()) {
		return reply(request, "soon", "Thanks for your interest! Newsletter signups open soon.", 202);
	}

	const email = String(form.get("email") ?? "").trim();
	if (!EMAIL.test(email) || email.length > 254) {
		return reply(request, "invalid", "Please enter a valid email address.", 400);
	}

	// TODO(newsletter backend): verify Turnstile, store in D1, forward to provider.
	return reply(
		request,
		"soon",
		"Thanks for your interest! Newsletter signups open soon. Please check back.",
		503,
	);
};
