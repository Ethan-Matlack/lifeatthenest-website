// Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { turnstileSiteKey } from "./turnstile.ts";

test("site key only when both keys are set", () => {
	assert.equal(turnstileSiteKey({ TURNSTILE_SITE_KEY: "0xAA", TURNSTILE_SECRET_KEY: "s" }), "0xAA");
	assert.equal(turnstileSiteKey({ TURNSTILE_SITE_KEY: "0xAA" }), "");
	assert.equal(turnstileSiteKey({ TURNSTILE_SECRET_KEY: "s" }), "");
	assert.equal(turnstileSiteKey({ TURNSTILE_SITE_KEY: " ", TURNSTILE_SECRET_KEY: "s" }), "");
	assert.equal(turnstileSiteKey({}), "");
});
