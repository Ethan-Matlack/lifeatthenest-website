// Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { clampText, seoImageValue } from "./seo-text.ts";

test("short text is returned trimmed, empty becomes null", () => {
	assert.equal(clampText("  Crisp granola.  "), "Crisp granola.");
	assert.equal(clampText(""), null);
	assert.equal(clampText(null), null);
	assert.equal(clampText("   "), null);
});

test("long text is cut at a word boundary with an ellipsis, within the limit", () => {
	const long = "word ".repeat(60);
	const out = clampText(long, 160)!;
	assert.ok(out.length <= 160, `length ${out.length}`);
	assert.ok(out.endsWith("word…"));
});

test("trailing punctuation before the cut is dropped", () => {
	assert.equal(clampText("alpha beta, gamma delta", 13), "alpha beta…");
});

test("whitespace and newlines collapse", () => {
	assert.equal(clampText("a\n\n b\t c"), "a b c");
});

test("seoImageValue resolves media IDs, paths, and URLs", () => {
	assert.deepEqual(seoImageValue("01KABC"), { id: "01KABC", src: "/_emdash/api/media/file/01KABC" });
	assert.deepEqual(seoImageValue("/_emdash/api/media/file/x.jpg"), { id: "/_emdash/api/media/file/x.jpg", src: "/_emdash/api/media/file/x.jpg" });
	assert.deepEqual(seoImageValue("https://example.com/a.jpg"), { id: "https://example.com/a.jpg", src: "https://example.com/a.jpg" });
	assert.equal(seoImageValue(""), null);
	assert.equal(seoImageValue(null), null);
});
