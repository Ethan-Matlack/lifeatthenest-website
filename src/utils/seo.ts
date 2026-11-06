/**
 * SEO meta for a single entry (post, recipe, page), with consistent fallbacks:
 *
 *   description: SEO panel description → the entry's short description
 *   image:       SEO panel image       → the entry's main photo
 *
 * The SEO panel always wins when filled in, so Audra can still override per
 * page, but leaving it empty is the normal case and does the right thing.
 */
import { getSeoMeta } from "emdash";
import { clampText } from "./seo-text.ts";

export { clampText, SHORT_DESCRIPTION_MAX } from "./seo-text.ts";

type SeoEntry = Parameters<typeof getSeoMeta>[0];

interface ImageFieldValue {
	id?: string;
	src?: string | null;
	meta?: Record<string, unknown> | null;
}

/**
 * Absolute URL of an image field's original file, for og:image and JSON-LD.
 * Uploaded images are stored without `src` (only `meta.storageKey`), so this
 * mirrors how EmDash's <Image> resolves them.
 */
export function imageUrl(
	image: ImageFieldValue | null | undefined,
	url: URL,
	publicMediaUrl?: (key: string) => string,
): string | null {
	if (!image) return null;
	const key = typeof image.meta?.storageKey === "string" ? image.meta.storageKey : null;
	const src =
		image.src ||
		(key ? (publicMediaUrl?.(key) ?? `/_emdash/api/media/file/${encodeURIComponent(key)}`) : null) ||
		(image.id ? `/_emdash/api/media/file/${encodeURIComponent(image.id)}` : null);
	return src ? new URL(src, url).toString() : null;
}

export function entrySeo(
	entry: SeoEntry,
	options: {
		siteTitle: string;
		url: URL;
		/** The entry's short description (excerpt / summary). */
		description?: string | null;
		/** The entry's main photo (an image field value). */
		image?: ImageFieldValue | null;
		/** Pass `Astro.locals.emdash?.getPublicMediaUrl` so R2 public URLs are used when configured. */
		publicMediaUrl?: (key: string) => string;
	},
) {
	const { siteTitle, url } = options;
	const path = url.pathname.replace(/\/$/, "");
	const image = imageUrl(options.image, url, options.publicMediaUrl) ?? undefined;
	const seo = getSeoMeta(entry, {
		siteTitle,
		siteUrl: url.origin,
		path,
		defaultDescription: clampText(options.description) ?? undefined,
		defaultOgImage: image,
	});
	return { ...seo, canonical: seo.canonical ?? new URL(path, url).toString() };
}
