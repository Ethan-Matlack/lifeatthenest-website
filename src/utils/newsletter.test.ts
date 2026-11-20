// Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { newsletterConfig, parseSignup, subscribeToKit, verifyTurnstile } from "./newsletter.ts";

/** Fake fetch that replies from a queue and records each request. */
function fakeFetch(...replies: Array<{ status: number; body?: unknown } | Error>) {
	const calls: Array<{ url: string; init: RequestInit }> = [];
	const impl = (async (url: string | URL | Request, init: RequestInit = {}) => {
		calls.push({ url: String(url), init });
		const next = replies.shift();
		if (!next) throw new Error("unexpected request");
		if (next instanceof Error) throw next;
		return new Response(JSON.stringify(next.body ?? {}), { status: next.status });
	}) as typeof fetch;
	return { impl, calls };
}

const quiet = () => {
	const original = console.error;
	console.error = () => {};
	return () => (console.error = original);
};

test("config is null until all four settings are present", () => {
	const full = { KIT_API_KEY: "k", KIT_FORM_ID: "123", TURNSTILE_SITE_KEY: "s", TURNSTILE_SECRET_KEY: "x" };
	assert.deepEqual(newsletterConfig(full), {
		kitApiKey: "k",
		kitFormId: "123",
		turnstileSiteKey: "s",
		turnstileSecretKey: "x",
	});
	assert.equal(newsletterConfig({ ...full, KIT_FORM_ID: "" }), null);
	assert.equal(newsletterConfig({ ...full, KIT_API_KEY: "  " }), null);
	assert.equal(newsletterConfig({}), null);
});

test("parseSignup trims, validates the email, and tidies the first name", () => {
	const f = new FormData();
	f.set("email", "  audra@example.com ");
	f.set("first_name", "  Audra   Jane ");
	assert.deepEqual(parseSignup(f), { email: "audra@example.com", firstName: "Audra Jane" });
	const bad = new FormData();
	bad.set("email", "not-an-email");
	assert.deepEqual(parseSignup(bad), { email: null, firstName: "" });
	const long = new FormData();
	long.set("email", `${"a".repeat(250)}@example.com`);
	assert.equal(parseSignup(long).email, null);
});

test("Turnstile: success only when Cloudflare says so", async () => {
	const pass = fakeFetch({ status: 200, body: { success: true } });
	assert.equal(await verifyTurnstile("tok", "secret", "1.2.3.4", pass.impl), true);
	const body = pass.calls[0]!.init.body as FormData;
	assert.equal(body.get("response"), "tok");
	assert.equal(body.get("remoteip"), "1.2.3.4");

	assert.equal(await verifyTurnstile("tok", "s", null, fakeFetch({ status: 200, body: { success: false } }).impl), false);
	assert.equal(await verifyTurnstile("", "s", null, fakeFetch().impl), false, "no token: no request");
	const restore = quiet();
	assert.equal(await verifyTurnstile("tok", "s", null, fakeFetch(new Error("offline")).impl), false);
	restore();
});

const kit = { kitApiKey: "key", kitFormId: "42" };
const signup = { email: "a@example.com", firstName: "Audra", referrer: "https://lifeatthenest.com/contact" };

test("Kit: creates an inactive subscriber, then adds them to the form", async () => {
	const f = fakeFetch({ status: 201 }, { status: 201 });
	assert.equal(await subscribeToKit(signup, kit, f.impl), "ok");
	assert.equal(f.calls[0]!.url, "https://api.kit.com/v4/subscribers");
	assert.deepEqual(JSON.parse(String(f.calls[0]!.init.body)), {
		email_address: "a@example.com",
		first_name: "Audra",
		state: "inactive",
	});
	assert.equal((f.calls[0]!.init.headers as Record<string, string>)["X-Kit-Api-Key"], "key");
	assert.equal(f.calls[1]!.url, "https://api.kit.com/v4/forms/42/subscribers");
	assert.deepEqual(JSON.parse(String(f.calls[1]!.init.body)), {
		email_address: "a@example.com",
		referrer: "https://lifeatthenest.com/contact",
	});
});

test("Kit: existing subscriber already on the form is 'already'", async () => {
	assert.equal(await subscribeToKit(signup, kit, fakeFetch({ status: 200 }, { status: 200 }).impl), "already");
});

test("Kit: no first name is left out of the request", async () => {
	const f = fakeFetch({ status: 201 }, { status: 201 });
	await subscribeToKit({ email: "a@example.com", firstName: "" }, kit, f.impl);
	assert.equal("first_name" in JSON.parse(String(f.calls[0]!.init.body)), false);
	assert.equal("referrer" in JSON.parse(String(f.calls[1]!.init.body)), false);
});

test("Kit: invalid email, auth failures, bad form, and network errors", async () => {
	const restore = quiet();
	assert.equal(await subscribeToKit(signup, kit, fakeFetch({ status: 422 }).impl), "invalid");
	assert.equal(await subscribeToKit(signup, kit, fakeFetch({ status: 401 }).impl), "error");
	assert.equal(await subscribeToKit(signup, kit, fakeFetch({ status: 201 }, { status: 404 }).impl), "error");
	assert.equal(await subscribeToKit(signup, kit, fakeFetch({ status: 201 }, { status: 422 }).impl), "error");
	assert.equal(await subscribeToKit(signup, kit, fakeFetch(new Error("timeout")).impl), "error");
	restore();
});
