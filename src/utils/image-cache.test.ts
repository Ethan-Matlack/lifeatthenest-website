// Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { edgeCacheHeaders, isCacheableImageRequest, isStorableImageResponse, matchesIfNoneMatch } from "./image-cache.ts";

const u = (s: string) => new URL(s, "https://lifeatthenest.com");

test("only GET /_image with an href is cached", () => {
	assert.equal(isCacheableImageRequest("GET", u("/_image?href=%2Fx.jpg&w=640&f=webp")), true);
	assert.equal(isCacheableImageRequest("HEAD", u("/_image?href=%2Fx.jpg")), false);
	assert.equal(isCacheableImageRequest("GET", u("/_image")), false);
	assert.equal(isCacheableImageRequest("GET", u("/_emdash/api/media/file/x.jpg")), false);
	assert.equal(isCacheableImageRequest("GET", u("/_image/other?href=x")), false);
});

test("only 200 image responses without cookies are stored", () => {
	const img = new Headers({ "Content-Type": "image/webp" });
	assert.equal(isStorableImageResponse(200, img), true);
	assert.equal(isStorableImageResponse(304, img), false);
	assert.equal(isStorableImageResponse(404, img), false);
	assert.equal(isStorableImageResponse(500, new Headers({ "Content-Type": "text/plain" })), false);
	assert.equal(isStorableImageResponse(200, new Headers({ "Content-Type": "text/html" })), false);
	assert.equal(
		isStorableImageResponse(200, new Headers({ "Content-Type": "image/webp", "Set-Cookie": "a=b" })),
		false,
	);
});

test("stored copy gets an edge lifetime but keeps the browser policy", () => {
	const h = edgeCacheHeaders(
		new Headers({
			"Content-Type": "image/webp",
			"Cache-Control": "public, max-age=0, must-revalidate",
			ETag: '"abc"',
			"Set-Cookie": "a=b",
		}),
		86400,
	);
	assert.equal(h.get("Cache-Control"), "public, max-age=0, must-revalidate, s-maxage=86400");
	assert.equal(h.get("ETag"), '"abc"');
	assert.equal(h.has("Set-Cookie"), false);
	assert.equal(h.get("Content-Type"), "image/webp");
});

test("an existing s-maxage is replaced, and a missing Cache-Control gets EmDash's default", () => {
	assert.equal(
		edgeCacheHeaders(new Headers({ "Cache-Control": "public, s-maxage=5" }), 60).get("Cache-Control"),
		"public, s-maxage=60",
	);
	assert.equal(edgeCacheHeaders(new Headers(), 60).get("Cache-Control"), "public, max-age=0, must-revalidate, s-maxage=60");
});

test("If-None-Match matches the cached ETag (weak comparison, lists, *)", () => {
	const etag = 'W/"105152-1794011273173-w=644"';
	assert.equal(matchesIfNoneMatch(etag, etag), true);
	assert.equal(matchesIfNoneMatch('"105152-1794011273173-w=644"', etag), true);
	assert.equal(matchesIfNoneMatch('"other", W/"105152-1794011273173-w=644"', etag), true);
	assert.equal(matchesIfNoneMatch("*", etag), true);
	assert.equal(matchesIfNoneMatch('"other"', etag), false);
	assert.equal(matchesIfNoneMatch(null, etag), false);
	assert.equal(matchesIfNoneMatch(etag, null), false);
});
