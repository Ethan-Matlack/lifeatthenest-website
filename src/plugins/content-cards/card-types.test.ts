// Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { CARD_TYPES, cardTypeFor, decodeChoice, encodeChoice, optionsRoute } from "./card-types.ts";

const ID = "01M6MX98HWTF8WGD9PQZHW55CN";

test("encodes a readable title with the entry id", () => {
	assert.equal(encodeChoice("Homemade Granola", ID), `Homemade Granola · ${ID}`);
	assert.equal(encodeChoice("  ", ID), `Untitled · ${ID}`);
});

test("decodes the entry id, ignoring the title", () => {
	assert.equal(decodeChoice(encodeChoice("Homemade Granola", ID)), ID);
	assert.equal(decodeChoice(`Renamed Since · ${ID}`), ID);
	assert.equal(decodeChoice(`Title · With · Dots · ${ID}`), ID);
	assert.equal(decodeChoice(ID.toLowerCase()), ID, "bare id, any case");
});

test("falls back to a trailing slug (seeded content)", () => {
	assert.equal(decodeChoice("Homemade Granola · homemade-granola"), "homemade-granola");
	assert.equal(decodeChoice("homemade-granola"), "homemade-granola");
});

test("rejects values without an id or slug", () => {
	for (const v of ["", "   ", "Just A Title", "Title · Not A Slug!", null, undefined, 42]) {
		assert.equal(decodeChoice(v), null, `should reject ${JSON.stringify(v)}`);
	}
});

test("every card type is well-formed and unique", () => {
	const types = new Set<string>();
	for (const t of CARD_TYPES) {
		assert.ok(/^[a-z][A-Za-z]+$/.test(t.type), `type ${t.type}`);
		assert.ok(!types.has(t.type), `duplicate ${t.type}`);
		types.add(t.type);
		assert.equal(cardTypeFor(t.type), t);
		assert.equal(optionsRoute(t), `options/${t.collection}`);
	}
	assert.equal(cardTypeFor("nope"), undefined);
});
