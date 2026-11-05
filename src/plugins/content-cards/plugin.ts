/**
 * EmDash native plugin: "content cards" editor blocks.
 *
 * For each type in ./card-types.ts it adds:
 *   - a block in the rich-text editor's insert ("/") menu with a dropdown
 *   - a private route that fills that dropdown with published entries, A–Z
 *
 * The site renders the saved blocks itself (src/components/RichText.astro),
 * so this plugin has no Astro components of its own.
 *
 * Registered in astro.config.mjs via ./descriptor.mjs.
 */
import { definePlugin } from "emdash";
import { CARD_TYPES, encodeChoice, optionsRoute, type CardType } from "./card-types";

const MAX_CHOICES = 500;

interface ContentLister {
	content?: {
		list(
			collection: string,
			options?: { limit?: number; cursor?: string; where?: { status?: string } },
		): Promise<{ items: { id: string; data: Record<string, unknown> }[]; cursor?: string; hasMore: boolean }>;
	};
}

/** Published entries of a collection as dropdown choices, sorted by title. */
async function listChoices(ctx: ContentLister, t: CardType) {
	if (!ctx.content) return [];
	const items: { id: string; name: string }[] = [];
	let cursor: string | undefined;
	do {
		const page = await ctx.content.list(t.collection, { limit: 100, cursor, where: { status: "published" } });
		for (const entry of page.items) {
			const title = typeof entry.data.title === "string" ? entry.data.title : "";
			const choice = encodeChoice(title, entry.id);
			items.push({ id: choice, name: title || "Untitled" });
		}
		cursor = page.hasMore ? page.cursor : undefined;
	} while (cursor && items.length < MAX_CHOICES);
	return items.sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
}

export function createPlugin() {
	return definePlugin({
		id: "content-cards",
		version: "0.1.0",
		capabilities: ["content:read"],

		routes: Object.fromEntries(
			CARD_TYPES.map((t) => [
				optionsRoute(t),
				{
					// Anyone who can work with content (incl. the Editor role) can load the list.
					permission: "content:read",
					handler: async (ctx: ContentLister) => ({ items: await listChoices(ctx, t) }),
				},
			]),
		),

		admin: {
			portableTextBlocks: CARD_TYPES.map((t) => ({
				type: t.type,
				label: t.label,
				icon: "link",
				description: t.description,
				category: "Cards",
				fields: [
					{
						type: "select" as const,
						action_id: t.field,
						label: t.pickerLabel,
						options: [],
						optionsRoute: optionsRoute(t),
					},
				],
			})),
		},
	});
}
