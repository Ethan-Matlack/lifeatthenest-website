/**
 * "Paste ingredients": turn a pasted list (one ingredient per line) into
 * structured rows for the recipe editor.
 *
 *   "For the dough:"              -> group heading
 *   "1 1/2 cups flour, sifted"    -> amount "1 1/2", unit "cup", item "flour", note "sifted"
 *   "2-3 cloves garlic, minced"   -> amount "2-3", unit "clove", item "garlic", note "minced"
 *   "salt to taste"               -> item "salt to taste"
 *
 * Only units in the field's option list are recognized; anything the parser
 * can't split stays in the item text so nothing is lost. Pure module (no
 * React), shared by the admin widget and the unit tests.
 */
import { parseAmount } from "../../utils/amount.ts";

export interface PastedIngredient {
	amount?: string;
	unit?: string;
	item: string;
	note?: string;
}

export type PastedLine = { kind: "heading"; text: string } | { kind: "row"; row: PastedIngredient };

/** Spellings people type, mapped to the canonical unit option. */
const UNIT_ALIASES: Record<string, string> = {
	t: "tsp",
	tsp: "tsp",
	tsps: "tsp",
	teaspoon: "tsp",
	teaspoons: "tsp",
	T: "tbsp",
	tbs: "tbsp",
	tbsp: "tbsp",
	tbsps: "tbsp",
	tablespoon: "tbsp",
	tablespoons: "tbsp",
	c: "cup",
	cup: "cup",
	cups: "cup",
	"fl oz": "fl oz",
	"fluid ounce": "fl oz",
	"fluid ounces": "fl oz",
	pt: "pint",
	pint: "pint",
	pints: "pint",
	qt: "quart",
	quart: "quart",
	quarts: "quart",
	oz: "oz",
	ounce: "oz",
	ounces: "oz",
	lb: "lb",
	lbs: "lb",
	pound: "lb",
	pounds: "lb",
	g: "g",
	gram: "g",
	grams: "g",
	kg: "kg",
	kilogram: "kg",
	kilograms: "kg",
	ml: "ml",
	milliliter: "ml",
	milliliters: "ml",
	l: "l",
	liter: "l",
	liters: "l",
	pinch: "pinch",
	pinches: "pinch",
	dash: "dash",
	dashes: "dash",
	clove: "clove",
	cloves: "clove",
	can: "can",
	cans: "can",
	jar: "jar",
	jars: "jar",
	package: "package",
	packages: "package",
	pkg: "package",
	pkgs: "package",
	stick: "stick",
	sticks: "stick",
	slice: "slice",
	slices: "slice",
	sprig: "sprig",
	sprigs: "sprig",
	bunch: "bunch",
	bunches: "bunch",
};

/** Canonical unit for a word, if it's one of the allowed units. Case matters only for t vs T. */
function matchUnit(word: string, allowed: ReadonlySet<string>): string | null {
	const cleaned = word.replace(/\.$/, "");
	const unit = UNIT_ALIASES[cleaned] ?? UNIT_ALIASES[cleaned.toLowerCase()];
	return unit && allowed.has(unit) ? unit : null;
}

// List markers: "-", "*", "•", or "3." / "3)" followed by a space (so "1.5 cups" is untouched).
const BULLET = /^\s*(?:[-*•·‣◦]|\d+[.)](?=\s))\s*/;

/** Split one ingredient line into amount / unit / item / note. */
export function parseIngredientLine(line: string, allowedUnits: readonly string[]): PastedIngredient | null {
	const text = line.replace(BULLET, "").replace(/\s+/g, " ").trim();
	if (!text) return null;
	const allowed = new Set(allowedUnits);
	const words = text.split(" ");

	// Longest leading run of up to 4 words that parses as an amount ("1 1/2", "2 to 3").
	let amount: string | undefined;
	let used = 0;
	for (let n = Math.min(4, words.length); n >= 1; n--) {
		const candidate = words.slice(0, n).join(" ");
		if (parseAmount(candidate)) {
			amount = candidate;
			used = n;
			break;
		}
	}

	// Unit right after the amount (also "fl oz" / "fluid ounces" as two words).
	let unit: string | undefined;
	if (amount && used < words.length) {
		const two = words.slice(used, used + 2).join(" ");
		const twoMatch = used + 1 < words.length ? matchUnit(two, allowed) : null;
		const oneMatch = matchUnit(words[used]!, allowed);
		if (twoMatch) {
			unit = twoMatch;
			used += 2;
		} else if (oneMatch) {
			unit = oneMatch;
			used += 1;
		}
	}

	// Skip a filler "of" ("2 cups of flour").
	if (amount && words[used]?.toLowerCase() === "of" && used + 1 < words.length) used += 1;

	let rest = words.slice(used).join(" ").trim();
	if (!rest) {
		// Nothing left (e.g. a bare "2 cups"): keep the whole line as the item.
		return { item: text };
	}

	// Note after the first comma: "flour, sifted".
	let note: string | undefined;
	const comma = rest.indexOf(",");
	if (comma > 0) {
		note = rest.slice(comma + 1).trim() || undefined;
		rest = rest.slice(0, comma).trim();
	}

	return {
		...(amount ? { amount } : {}),
		...(unit ? { unit } : {}),
		item: rest,
		...(note ? { note } : {}),
	};
}

/** Parse a pasted block. Lines ending in ":" become group headings; blanks are skipped. */
export function parseIngredientList(text: string, allowedUnits: readonly string[]): PastedLine[] {
	const out: PastedLine[] = [];
	for (const raw of text.split(/\r?\n/)) {
		const line = raw.trim();
		if (!line) continue;
		const heading = line.replace(BULLET, "").match(/^(.+?):\s*$/);
		if (heading) {
			out.push({ kind: "heading", text: heading[1]!.trim() });
			continue;
		}
		const row = parseIngredientLine(line, allowedUnits);
		if (row) out.push({ kind: "row", row });
	}
	return out;
}
