/** Pure text helpers for SEO (no emdash imports, so they can be unit-tested). */

/** Max length of the "Short description" fields (cards + search snippets). */
export const SHORT_DESCRIPTION_MAX = 160;

/**
 * Trim text to `max` characters at a word boundary, adding "…" when cut.
 * Older entries can hold descriptions longer than the current field limit.
 */
export function clampText(text: string | null | undefined, max = SHORT_DESCRIPTION_MAX): string | null {
	const clean = (text ?? "").replace(/\s+/g, " ").trim();
	if (!clean) return null;
	if (clean.length <= max) return clean;
	const cut = clean.slice(0, max - 1);
	const space = cut.lastIndexOf(" ");
	return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,;:.–—-]+$/, "")}…`;
}

/**
 * The SEO panel stores its image as a bare media ID, a site path, or a full
 * URL. Turn that into an image value the <Image> component can render (the
 * same resolution EmDash uses for og:image). Null when there's no image.
 */
export function seoImageValue(ref: string | null | undefined): { id: string; src: string } | null {
	const value = (ref ?? "").trim();
	if (!value) return null;
	if (/^https?:\/\//i.test(value) || value.startsWith("/")) return { id: value, src: value };
	return { id: value, src: `/_emdash/api/media/file/${encodeURIComponent(value)}` };
}
