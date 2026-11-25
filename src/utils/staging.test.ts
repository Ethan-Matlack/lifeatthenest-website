// Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { markStaging, stagingGuard } from "./staging.ts";

const req = (path: string, method = "GET") => new Request(`https://staging.lifeatthenest.com${path}`, { method });

test("public pages, assets, media, and search pass through", () => {
	for (const path of ["/", "/recipes/homemade-granola", "/_astro/app.js", "/_emdash/api/media/file/x.jpg", "/_emdash/api/search?q=soup"]) {
		assert.equal(stagingGuard(req(path)), null, path);
		assert.equal(stagingGuard(req(path, "HEAD")), null, path);
	}
});

test("the admin redirects to the live admin", () => {
	const res = stagingGuard(req("/_emdash/admin/content/posts?x=1"))!;
	assert.equal(res.status, 302);
	assert.equal(res.headers.get("Location"), "https://lifeatthenest.com/_emdash/admin/content/posts?x=1");
	assert.equal(stagingGuard(req("/_emdash/admin"))!.status, 302);
});

test("writes are refused anywhere", () => {
	for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
		assert.equal(stagingGuard(req("/_emdash/api/comments/posts/abc", method))!.status, 403, method);
		assert.equal(stagingGuard(req("/api/newsletter", method))!.status, 403, method);
	}
});

test("sign-in and setup are refused even via GET", () => {
	assert.equal(stagingGuard(req("/_emdash/api/auth/dev-bypass"))!.status, 403);
	assert.equal(stagingGuard(req("/_emdash/api/auth/oauth/github"))!.status, 403);
	assert.equal(stagingGuard(req("/_emdash/api/setup/dev-bypass"))!.status, 403);
});

test("a path that merely starts like the admin isn't caught", () => {
	assert.equal(stagingGuard(req("/_emdash/administration")), null);
});

test("responses are marked noindex", () => {
	const res = markStaging(new Response("ok", { headers: { "Content-Type": "text/html" } }));
	assert.equal(res.headers.get("X-Robots-Tag"), "noindex, nofollow");
	assert.equal(res.headers.get("Content-Type"), "text/html");
});
