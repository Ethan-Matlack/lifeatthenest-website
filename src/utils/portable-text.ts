import { getEditMeta } from "emdash";
import { getYouTubeId } from "./youtube";

type Block = { _type: string; _key?: string; [key: string]: unknown };
type Span = { _type: string; text?: string; marks?: string[] };

function blockText(block: Block): string {
	if (block._type !== "block" || !Array.isArray(block.children)) return "";
	return (block.children as Span[]).map((c) => (typeof c.text === "string" ? c.text : "")).join("");
}

/** Plain text of every text block, for reading time and excerpts. */
export function toPlainText(value: unknown): string {
	if (!Array.isArray(value)) return "";
	return (value as Block[]).map(blockText).filter(Boolean).join("\n\n");
}

/** Rounded-up minutes at ~225 words per minute; at least 1. */
export function readingMinutes(value: unknown): number {
	const words = toPlainText(value).split(/\s+/).filter(Boolean).length;
	return Math.max(1, Math.ceil(words / 225));
}

/**
 * If a plain paragraph is nothing but one link, return its URL: either the
 * text itself is a URL, or every character is covered by the same link.
 */
function soleLink(block: Block): string | null {
	if (block._type !== "block" || (block.style && block.style !== "normal") || block.listItem) return null;
	const text = blockText(block).trim();
	if (!text) return null;
	if (!/\s/.test(text) && /^(https?:\/\/|\/)/.test(text)) return text;

	const markDefs = (block.markDefs as { _key: string; _type: string; href?: string }[] | undefined) ?? [];
	const links = new Map(markDefs.filter((m) => m._type === "link" && m.href).map((m) => [m._key, m.href!]));
	const spans = (block.children as Span[]).filter((c) => (c.text ?? "").trim());
	const keys = spans.map((c) => (c.marks ?? []).find((m) => links.has(m)));
	if (!keys.length || keys.some((k) => !k || k !== keys[0])) return null;
	return links.get(keys[0]!) ?? null;
}

// Hosts that count as "this site" for recipe links (plus relative links).
const SITE_HOST = /(^|\.)lifeatthenest\.com$|^localhost$|^127\.0\.0\.1$|\.workers\.dev$/;

/** Recipe slug from a link to /recipes/<slug> on this site, else null. */
export function recipeSlugFromUrl(href: string): string | null {
	let url: URL;
	try {
		url = new URL(href, "https://lifeatthenest.com");
	} catch {
		return null;
	}
	if (!SITE_HOST.test(url.hostname)) return null;
	const m = url.pathname.match(/^\/recipes\/([a-z0-9][a-z0-9-]*)\/?$/i);
	return m ? m[1]!.toLowerCase() : null;
}

/**
 * Turn a paragraph that is nothing but one link into a card:
 * - a YouTube link becomes the video card (`embed` block)
 * - a link to one of our recipes becomes the recipe card (`recipeEmbed`)
 * A link inside a sentence is left alone.
 *
 * Skipped in visual-edit mode: the value carries edit metadata that a copy
 * would lose, and the editor should show what was actually typed.
 */
export function autoEmbeds<T>(value: T): T {
	if (!Array.isArray(value) || getEditMeta(value)) return value;
	return (value as Block[]).map((block) => {
		const href = soleLink(block);
		if (!href) return block;
		const key = block._key ?? href;
		if (getYouTubeId(href)) return { _type: "embed", _key: key, url: href };
		const slug = recipeSlugFromUrl(href);
		if (slug) return { _type: "recipeEmbed", _key: key, slug, href, text: blockText(block).trim() };
		return block;
	}) as T;
}
