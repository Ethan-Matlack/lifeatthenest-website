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
 * Turn a paragraph that contains nothing but a YouTube link into an embed
 * block, so pasting a link on its own line shows the video card.
 *
 * Skipped in visual-edit mode: the value carries edit metadata that a copy
 * would lose, and the editor should show what was actually typed.
 */
export function autoEmbedVideos<T>(value: T): T {
	if (!Array.isArray(value) || getEditMeta(value)) return value;
	return (value as Block[]).map((block) => {
		if (block._type !== "block" || (block.style && block.style !== "normal") || block.listItem) {
			return block;
		}
		const text = blockText(block).trim();
		if (!text || /\s/.test(text) || !getYouTubeId(text)) return block;
		return { _type: "embed", _key: block._key ?? text, url: text };
	}) as T;
}
