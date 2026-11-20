/**
 * Newsletter signup: spam check (Cloudflare Turnstile) + Kit subscription.
 * Used by src/pages/api/newsletter.ts; pure apart from the injected `fetch`,
 * so it's unit-tested in newsletter.test.ts without network calls.
 *
 * Kit double opt-in: the subscriber is created as "inactive", then added to
 * a Kit form that has double opt-in on. Kit sends that form's confirmation
 * ("incentive") email and activates them when they click it. Kit holds the
 * list (and handles unsubscribes); nothing is stored on our side.
 */

export type SignupStatus = "ok" | "already" | "invalid" | "verify" | "error" | "soon";

/** Messages shown under the form (JSON replies and the no-JS redirect). */
export const SIGNUP_MESSAGES: Record<SignupStatus, string> = {
	ok: "Thanks! Check your inbox to confirm your subscription.",
	already:
		"You're already signed up, thank you! If you haven't confirmed yet, look for the confirmation email (and check your spam folder).",
	invalid: "Please enter a valid email address.",
	verify: "Please complete the spam check and try again.",
	error: "Something went wrong. Please try again in a moment.",
	soon: "Thanks for your interest! Newsletter signups open soon. Please check back.",
};

export interface NewsletterConfig {
	kitApiKey: string;
	kitFormId: string;
	turnstileSiteKey: string;
	turnstileSecretKey: string;
}

/** Read settings from the Worker environment; null until all four are set. */
export function newsletterConfig(env: Record<string, unknown>): NewsletterConfig | null {
	const get = (k: string) => (typeof env[k] === "string" ? (env[k] as string).trim() : "");
	const config = {
		kitApiKey: get("KIT_API_KEY"),
		kitFormId: get("KIT_FORM_ID"),
		turnstileSiteKey: get("TURNSTILE_SITE_KEY"),
		turnstileSecretKey: get("TURNSTILE_SECRET_KEY"),
	};
	return Object.values(config).every(Boolean) ? config : null;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Clean up the submitted email and first name; null email means invalid. */
export function parseSignup(form: FormData): { email: string | null; firstName: string } {
	const email = String(form.get("email") ?? "").trim();
	const firstName = String(form.get("first_name") ?? "")
		.replace(/\s+/g, " ")
		.trim()
		.slice(0, 80);
	return { email: EMAIL.test(email) && email.length <= 254 ? email : null, firstName };
}

type Fetch = typeof fetch;
const TIMEOUT_MS = 8000;

/** Ask Cloudflare whether the Turnstile token is valid. */
export async function verifyTurnstile(
	token: string,
	secret: string,
	ip: string | null,
	fetchImpl: Fetch = fetch,
): Promise<boolean> {
	if (!token) return false;
	const body = new FormData();
	body.set("secret", secret);
	body.set("response", token);
	if (ip) body.set("remoteip", ip);
	try {
		const res = await fetchImpl("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
			method: "POST",
			body,
			signal: AbortSignal.timeout(TIMEOUT_MS),
		});
		const data = (await res.json()) as { success?: boolean };
		return data.success === true;
	} catch (error) {
		console.error("[newsletter] Turnstile check failed:", error);
		return false;
	}
}

const KIT_API = "https://api.kit.com/v4";

/**
 * Add a signup to Kit: create (or find) the subscriber as inactive, then add
 * them to the double opt-in form, which sends the confirmation email.
 *   ok       newly added to the form (confirmation email sent)
 *   already  already on the form (Kit doesn't resend the email)
 *   invalid  Kit rejected the email address
 *   error    anything else (bad key/form ID, Kit down, timeout)
 */
export async function subscribeToKit(
	signup: { email: string; firstName: string; referrer?: string },
	config: Pick<NewsletterConfig, "kitApiKey" | "kitFormId">,
	fetchImpl: Fetch = fetch,
): Promise<Exclude<SignupStatus, "verify" | "soon">> {
	const headers = { "Content-Type": "application/json", Accept: "application/json", "X-Kit-Api-Key": config.kitApiKey };
	try {
		const created = await fetchImpl(`${KIT_API}/subscribers`, {
			method: "POST",
			headers,
			body: JSON.stringify({
				email_address: signup.email,
				...(signup.firstName ? { first_name: signup.firstName } : {}),
				state: "inactive",
			}),
			signal: AbortSignal.timeout(TIMEOUT_MS),
		});
		if (created.status === 422) return "invalid";
		if (!created.ok) {
			console.error(`[newsletter] Kit create subscriber failed: ${created.status}`);
			return "error";
		}

		const added = await fetchImpl(`${KIT_API}/forms/${encodeURIComponent(config.kitFormId)}/subscribers`, {
			method: "POST",
			headers,
			body: JSON.stringify({
				email_address: signup.email,
				...(signup.referrer ? { referrer: signup.referrer } : {}),
			}),
			signal: AbortSignal.timeout(TIMEOUT_MS),
		});
		if (added.status === 201) return "ok";
		if (added.status === 200) return "already";
		console.error(`[newsletter] Kit add to form failed: ${added.status}`);
		return "error";
	} catch (error) {
		console.error("[newsletter] Kit request failed:", error);
		return "error";
	}
}
