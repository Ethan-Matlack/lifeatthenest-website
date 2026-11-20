/**
 * Edge caching for converted images (the `/_image` endpoint). Pure helpers,
 * used by src/middleware.ts and unit-tested in image-cache.test.ts.
 *
 * EmDash's image endpoint converts on every request (R2 read + Images
 * binding) and sends `Cache-Control: max-age=0, must-revalidate`, so nothing
 * stores the result. We keep a converted copy in the Cloudflare Cache API for
 * a bounded time. Browsers keep EmDash's revalidate-every-time header, so a
 * replaced image only lingers at the edge, never in a visitor's browser.
 */

/** How long a converted image stays in the edge cache (seconds). */
export const IMAGE_EDGE_TTL = 60 * 60 * 24; // 1 day

const IMAGE_PATH = "/_image";

/** Should this request go through the edge cache? */
export function isCacheableImageRequest(method: string, url: URL): boolean {
	return method === "GET" && url.pathname === IMAGE_PATH && url.searchParams.has("href");
}

/** Should this endpoint response be stored? Only complete, successful images. */
export function isStorableImageResponse(status: number, headers: Headers): boolean {
	if (status !== 200) return false;
	const type = headers.get("Content-Type") ?? "";
	if (!type.startsWith("image/")) return false;
	// Never share a response that sets a cookie (the Cache API refuses them anyway).
	return !headers.has("Set-Cookie");
}

/**
 * Headers for the stored copy: an edge lifetime (`s-maxage`, which only
 * shared caches read) on top of EmDash's browser policy, minus cookies.
 */
export function edgeCacheHeaders(headers: Headers, ttl = IMAGE_EDGE_TTL): Headers {
	const out = new Headers(headers);
	out.delete("Set-Cookie");
	const browser = (headers.get("Cache-Control") ?? "public, max-age=0, must-revalidate")
		.split(",")
		.map((d) => d.trim())
		.filter((d) => d && !/^s-maxage=/i.test(d));
	out.set("Cache-Control", [...browser, `s-maxage=${ttl}`].join(", "));
	return out;
}

/**
 * Does the browser already have this version? (If-None-Match vs the cached
 * ETag, weak comparison as HTTP specifies for GET.) Lets a cache hit answer
 * a revalidation with 304 instead of resending the image.
 */
export function matchesIfNoneMatch(ifNoneMatch: string | null, etag: string | null): boolean {
	if (!ifNoneMatch || !etag) return false;
	const strip = (t: string) => t.trim().replace(/^W\//, "");
	const target = strip(etag);
	return ifNoneMatch.split(",").some((t) => t.trim() === "*" || strip(t) === target);
}
