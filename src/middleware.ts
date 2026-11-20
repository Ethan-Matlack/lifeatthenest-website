/**
 * Site middleware. Runs after EmDash's own middleware (which is all `pre`).
 *
 * Edge cache for converted images: see src/utils/image-cache.ts. A hit is
 * served from the Cloudflare Cache API without reading R2 or running the
 * Images binding. The Cache API only works on a custom domain (it's a no-op
 * on *.workers.dev), and `astro dev` skips it entirely.
 */
import { defineMiddleware } from "astro:middleware";
import {
	edgeCacheHeaders,
	isCacheableImageRequest,
	isStorableImageResponse,
	matchesIfNoneMatch,
} from "./utils/image-cache";

interface WaitUntil {
	waitUntil(promise: Promise<unknown>): void;
}

function edgeCache(): Cache | null {
	if (import.meta.env.DEV) return null;
	const store = (globalThis as { caches?: CacheStorage & { default?: Cache } }).caches;
	return store?.default ?? null;
}

export const onRequest = defineMiddleware(async (context, next) => {
	const url = new URL(context.request.url);
	const cache = isCacheableImageRequest(context.request.method, url) ? edgeCache() : null;
	if (!cache) return next();

	// Key on the URL only (no cookies/validators), so every visitor shares an entry.
	const key = new Request(url.toString(), { method: "GET" });
	try {
		const hit = await cache.match(key);
		if (hit) {
			if (matchesIfNoneMatch(context.request.headers.get("If-None-Match"), hit.headers.get("ETag"))) {
				await hit.body?.cancel();
				const headers = new Headers(hit.headers);
				headers.delete("Content-Length");
				return new Response(null, { status: 304, headers });
			}
			return hit;
		}
	} catch (error) {
		console.error("[image-cache] lookup failed:", error);
	}

	const response = await next();
	if (!isStorableImageResponse(response.status, response.headers)) return response;

	const stored = new Response(response.body, { status: response.status, headers: edgeCacheHeaders(response.headers) });
	const put = cache.put(key, stored.clone()).catch((error) => console.error("[image-cache] store failed:", error));
	const cf = (context.locals as { cfContext?: WaitUntil }).cfContext;
	if (cf) cf.waitUntil(put);
	else await put;
	return stored;
});
