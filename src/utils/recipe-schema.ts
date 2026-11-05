/**
 * schema.org Recipe JSON-LD for Google rich results and Pinterest.
 * https://developers.google.com/search/docs/appearance/structured-data/recipe
 */
import { isoDuration, scaleAmount, scaledMax, unitLabel } from "./amount";
import { toPlainText } from "./portable-text";

interface Row {
	group?: string | null;
	amount?: string | null;
	unit?: string | null;
	item?: string | null;
	note?: string | null;
	fixed?: boolean | null;
	instruction?: string | null;
}

export interface RecipeSchemaInput {
	url: string;
	name: string;
	description?: string | null;
	images: string[];
	author: string;
	datePublished?: Date | null;
	servings?: number | null;
	yieldUnit?: string | null;
	prepMinutes?: number | null;
	cookMinutes?: number | null;
	extraMinutes?: number | null;
	ingredients?: Row[] | null;
	steps?: Row[] | null;
	categories: string[];
	keywords: string[];
	calories?: number | null;
	intro?: unknown;
}

/** "2½ cups flour, sifted" */
export function ingredientLine(row: Row): string {
	const fixed = Boolean(row.fixed);
	const amount = scaleAmount(row.amount, 1, fixed);
	const unit = unitLabel(row.unit, scaledMax(row.amount, 1, fixed));
	return [amount, unit, row.item?.trim()].filter(Boolean).join(" ") + (row.note ? `, ${row.note.trim()}` : "");
}

function instructions(steps: Row[], url: string) {
	const toStep = (row: Row, i: number) => ({
		"@type": "HowToStep",
		text: row.instruction?.trim() ?? "",
		url: `${url}#step-${i + 1}`,
	});
	const hasGroups = steps.some((s) => s.group?.trim());
	if (!hasGroups) return steps.map(toStep);

	// Group headings become HowToSections (headings carry forward like on the page).
	const sections: { name: string; itemListElement: ReturnType<typeof toStep>[] }[] = [];
	let current = "";
	steps.forEach((row, i) => {
		const name = row.group?.trim() || current;
		if (!sections.length || name !== current) sections.push({ name, itemListElement: [] });
		current = name;
		sections[sections.length - 1]!.itemListElement.push(toStep(row, i));
	});
	return sections.map((s) =>
		s.name ? { "@type": "HowToSection", name: s.name, itemListElement: s.itemListElement } : s.itemListElement,
	).flat();
}

export function recipeJsonLd(r: RecipeSchemaInput): Record<string, unknown> {
	const total = (r.prepMinutes ?? 0) + (r.cookMinutes ?? 0) + (r.extraMinutes ?? 0);
	const servings = r.servings && r.servings > 0 ? r.servings : undefined;
	const description = r.description?.trim() || toPlainText(r.intro).slice(0, 300) || undefined;

	const data: Record<string, unknown> = {
		"@context": "https://schema.org",
		"@type": "Recipe",
		name: r.name,
		description,
		image: r.images.length ? r.images : undefined,
		author: { "@type": "Person", name: r.author },
		datePublished: r.datePublished?.toISOString().slice(0, 10),
		recipeYield: servings ? [String(servings), `${servings} ${r.yieldUnit?.trim() || "servings"}`] : undefined,
		prepTime: isoDuration(r.prepMinutes),
		cookTime: isoDuration(r.cookMinutes),
		totalTime: isoDuration(total),
		recipeCategory: r.categories.length ? r.categories.join(", ") : undefined,
		keywords: r.keywords.length ? r.keywords.join(", ") : undefined,
		recipeIngredient: (r.ingredients ?? []).filter((i) => i.item?.trim()).map(ingredientLine),
		recipeInstructions: instructions((r.steps ?? []).filter((s) => s.instruction?.trim()), r.url),
		nutrition: r.calories
			? { "@type": "NutritionInformation", calories: `${r.calories} calories` }
			: undefined,
		url: r.url,
	};
	// Drop empty keys so the output stays tidy.
	for (const k of Object.keys(data)) if (data[k] === undefined) delete data[k];
	return data;
}

/** Safe to inline in <script type="application/ld+json">. */
export function jsonLdString(data: unknown): string {
	return JSON.stringify(data).replace(/</g, "\\u003c");
}
