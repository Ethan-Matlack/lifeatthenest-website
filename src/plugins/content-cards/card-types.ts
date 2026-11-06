/**
 * Content cards: editor blocks that embed a card for another entry (a recipe
 * today; blog posts, products, … later) inside rich text.
 *
 * This registry is the single source of truth, shared by:
 *   - the EmDash plugin (./plugin.ts): one editor block + one options route per type
 *   - the site renderer (src/components/pt/ContentCard.astro): looks up the entry
 *
 * To add a card type:
 *   1. Add an entry here.
 *   2. Add its card component to CARD_COMPONENTS in src/components/pt/ContentCard.astro.
 *   3. Restart the dev server (plugin definitions load at startup).
 *
 * Keep this file free of imports: it's loaded by astro.config.mjs tooling,
 * the plugin runtime, and site components alike.
 */

export interface CardType {
	/** Portable Text `_type` saved in content. Never rename once used. */
	type: string;
	/** Collection the picker lists and the card loads from */
	collection: string;
	/** Name in the editor's insert ("/") menu */
	label: string;
	/** Help text in the insert menu */
	description: string;
	/** Label above the dropdown in the block dialog */
	pickerLabel: string;
	/** Key the selection is saved under on the block */
	field: string;
}

export const CARD_TYPES: readonly CardType[] = [
	{
		type: "recipeCard",
		collection: "recipes",
		label: "Recipe card",
		description: "Show a card that links to one of your recipes",
		pickerLabel: "Recipe",
		field: "recipe",
	},
	// Example for later:
	// {
	// 	type: "postCard",
	// 	collection: "posts",
	// 	label: "Blog post card",
	// 	description: "Show a card that links to another blog post",
	// 	pickerLabel: "Blog post",
	// 	field: "post",
	// },
];

export function cardTypeFor(type: string): CardType | undefined {
	return CARD_TYPES.find((t) => t.type === type);
}

/** Route name (under /_emdash/api/plugins/content-cards/) that lists a type's choices. */
export function optionsRoute(t: CardType): string {
	return `options/${t.collection}`;
}

/*
 * Saved value format: "<title> · <entry id>".
 * The editor shows the saved value on the block, so leading with the title
 * makes it readable; the site only uses the trailing id, so renaming an
 * entry or changing its slug never breaks the card.
 */
const SEPARATOR = " · ";
const ENTRY_ID = /([0-9A-HJKMNP-TV-Z]{26})$/i; // EmDash entry ids are ULIDs

export function encodeChoice(title: string, id: string): string {
	return `${title.trim() || "Untitled"}${SEPARATOR}${id}`;
}

/**
 * Entry to load from a saved value: the trailing id, or (for seeded content,
 * where ids aren't known ahead of time) a trailing slug. Null if neither.
 */
export function decodeChoice(value: unknown): string | null {
	if (typeof value !== "string") return null;
	const v = value.trim();
	const i = v.lastIndexOf(SEPARATOR);
	const tail = (i >= 0 ? v.slice(i + SEPARATOR.length) : v).trim();
	if (ENTRY_ID.test(tail) && tail.length === 26) return tail.toUpperCase();
	return /^[a-z0-9][a-z0-9-]*$/.test(tail) ? tail : null;
}
