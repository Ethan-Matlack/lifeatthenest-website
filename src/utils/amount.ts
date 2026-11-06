/**
 * Recipe ingredient amounts: parse what the editor types, scale it, and
 * format the result as friendly kitchen fractions.
 *
 * Accepts: "2", "1.5", ".5", "1/2", "1 1/2", "1-1/2", "½", "1½", "1 ½",
 * ranges "2-3", "2–3", "2 to 3", "1/2-1", "1 1/2 - 2".
 * Anything else ("a handful", "to taste") is left as written.
 *
 * Shared by the server render, the browser scaling script, and the tests,
 * so this file must not import anything.
 */

export interface Quantity {
	min: number;
	/** Upper end of a range ("2-3"); undefined for a single amount */
	max?: number;
}

const UNICODE_FRACTIONS: Record<string, number> = {
	"½": 1 / 2,
	"⅓": 1 / 3,
	"⅔": 2 / 3,
	"¼": 1 / 4,
	"¾": 3 / 4,
	"⅕": 1 / 5,
	"⅖": 2 / 5,
	"⅗": 3 / 5,
	"⅘": 4 / 5,
	"⅙": 1 / 6,
	"⅚": 5 / 6,
	"⅛": 1 / 8,
	"⅜": 3 / 8,
	"⅝": 5 / 8,
	"⅞": 7 / 8,
};
const UNICODE_CLASS = Object.keys(UNICODE_FRACTIONS).join("");

// One number: "1 1/2", "1-1/2", "1/2", "1½", "1 ½", "½", "1.5", ".5", "2"
const NUMBER = String.raw`(?:\d+(?:[\s-]+|(?=[${UNICODE_CLASS}])))?(?:\d+\s*\/\s*\d+|[${UNICODE_CLASS}])|\d*\.\d+|\d+`;
const SINGLE = new RegExp(`^(${NUMBER})$`);
const RANGE = new RegExp(`^(${NUMBER})\\s*(?:-|–|—|to)\\s*(${NUMBER})$`, "i");

function parseNumber(raw: string): number | null {
	const s = raw.trim();
	// Mixed number with ASCII fraction: "1 1/2" or "1-1/2"
	let m = s.match(/^(\d+)[\s-]+(\d+)\s*\/\s*(\d+)$/);
	if (m) {
		const den = Number(m[3]);
		return den ? Number(m[1]) + Number(m[2]) / den : null;
	}
	// Mixed number with Unicode fraction: "1½" or "1 ½"
	m = s.match(new RegExp(`^(\\d+)\\s*([${UNICODE_CLASS}])$`));
	if (m) return Number(m[1]) + UNICODE_FRACTIONS[m[2]!]!;
	// Simple fraction
	m = s.match(/^(\d+)\s*\/\s*(\d+)$/);
	if (m) {
		const den = Number(m[2]);
		return den ? Number(m[1]) / den : null;
	}
	if (s in UNICODE_FRACTIONS) return UNICODE_FRACTIONS[s]!;
	// Whole number or decimal
	if (/^(\d+|\d*\.\d+)$/.test(s)) return Number(s);
	return null;
}

/** Parse an amount string. Returns null when it isn't a number we understand. */
export function parseAmount(input: string | null | undefined): Quantity | null {
	if (!input) return null;
	const s = input.trim().replace(/\s+/g, " ");
	if (!s) return null;

	// A lone "1-1/2" reads as a mixed number, not the range 1 to ½.
	const single = s.match(SINGLE);
	if (single) {
		const n = parseNumber(single[1]!);
		return n === null || n <= 0 ? null : { min: n };
	}

	const range = s.match(RANGE);
	if (range) {
		const a = parseNumber(range[1]!);
		const b = parseNumber(range[2]!);
		if (a === null || b === null || a <= 0 || b <= 0) return null;
		return a === b ? { min: a } : { min: Math.min(a, b), max: Math.max(a, b) };
	}
	return null;
}

// Fractions a home cook can measure. Thirds and eighths cover nearly
// everything; sixths, fifths, etc. are deliberately excluded.
const FRACTIONS: Array<[number, string]> = [
	[1 / 8, "⅛"],
	[1 / 4, "¼"],
	[1 / 3, "⅓"],
	[3 / 8, "⅜"],
	[1 / 2, "½"],
	[5 / 8, "⅝"],
	[2 / 3, "⅔"],
	[3 / 4, "¾"],
	[7 / 8, "⅞"],
];

/**
 * Format a positive number as a friendly amount:
 * - under 10: whole + nearest kitchen fraction ("1⅓", "¾"), never below ⅛
 * - 10 to under 50: nearest half ("12½")
 * - 50 and up: whole number
 */
export function formatNumber(value: number): string {
	if (!Number.isFinite(value) || value <= 0) return "0";
	if (value >= 50) return String(Math.round(value));
	if (value >= 10) {
		const halves = Math.round(value * 2);
		return halves % 2 ? `${(halves - 1) / 2}½` : String(halves / 2);
	}

	let whole = Math.floor(value);
	const frac = value - whole;
	// Nearest of: 0, each kitchen fraction, or 1 (round up).
	let best = { diff: frac, text: "" };
	for (const [n, text] of FRACTIONS) {
		const diff = Math.abs(frac - n);
		if (diff < best.diff - 1e-9) best = { diff, text };
	}
	if (1 - frac < best.diff - 1e-9) {
		whole += 1;
		best = { diff: 1 - frac, text: "" };
	}
	if (whole === 0 && !best.text) return "⅛"; // never show 0 for a real amount
	if (whole === 0) return best.text;
	return `${whole}${best.text}`;
}

export function formatQuantity(q: Quantity): string {
	const min = formatNumber(q.min);
	if (q.max === undefined) return min;
	const max = formatNumber(q.max);
	return min === max ? min : `${min}–${max}`;
}

/**
 * Scale an amount string by a factor. Unparseable or "fixed" amounts come
 * back exactly as written; everything else is reformatted.
 */
export function scaleAmount(input: string | null | undefined, factor: number, fixed = false): string {
	const raw = (input ?? "").trim();
	if (fixed) return raw;
	const q = parseAmount(raw);
	if (!q) return raw;
	return formatQuantity({ min: q.min * factor, max: q.max === undefined ? undefined : q.max * factor });
}

/** Largest number in a scaled amount (for singular/plural units). Null if unparseable. */
export function scaledMax(input: string | null | undefined, factor: number, fixed = false): number | null {
	const q = parseAmount(input);
	if (!q) return null;
	const f = fixed ? 1 : factor;
	return (q.max ?? q.min) * f;
}

const PLURAL_UNITS: Record<string, string> = {
	cup: "cups",
	pint: "pints",
	quart: "quarts",
	pinch: "pinches",
	dash: "dashes",
	clove: "cloves",
	can: "cans",
	jar: "jars",
	package: "packages",
	stick: "sticks",
	slice: "slices",
	sprig: "sprigs",
	bunch: "bunches",
};

/**
 * Unit label for a quantity: "cups" above 1, "cup" at or below 1.
 * Abbreviations (tsp, tbsp, oz, lb, g, ml, …) never change.
 */
export function unitLabel(unit: string | null | undefined, quantity: number | null): string {
	if (!unit) return "";
	if (quantity === null || quantity <= 1) return unit;
	return PLURAL_UNITS[unit] ?? unit;
}

/** Minutes to an ISO 8601 duration for structured data: 75 -> "PT1H15M". */
export function isoDuration(minutes: number | null | undefined): string | undefined {
	if (!minutes || minutes <= 0) return undefined;
	const h = Math.floor(minutes / 60);
	const m = Math.round(minutes % 60);
	return `PT${h ? `${h}H` : ""}${m || !h ? `${m}M` : ""}`;
}
