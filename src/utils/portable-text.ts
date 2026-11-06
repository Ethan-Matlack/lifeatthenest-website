import { getEditMeta } from "emdash";
import { parseVideoLink } from "./video";

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

/**
 * Turn a paragraph that is nothing but one video link (YouTube, TikTok,
 * Instagram, Facebook; see utils/video.ts) into an embed block,
 * so pasting a link on its own line shows the video card. A link inside a
 * sentence is left alone. (Recipe and other content cards are inserted with
 * the editor's "Recipe card" block instead; see src/plugins/content-cards.)
 *
 * Skipped in visual-edit mode: the value carries edit metadata that a copy
 * would lose, and the editor should show what was actually typed.
 */
export function autoEmbeds<T>(value: T): T {
	if (!Array.isArray(value) || getEditMeta(value)) return value;
	return (value as Block[]).map((block) => {
		const href = soleLink(block);
		if (!href || !parseVideoLink(href)) return block;
		return { _type: "embed", _key: block._key ?? href, url: href };
	}) as T;
}
