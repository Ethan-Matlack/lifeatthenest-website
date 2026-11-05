/**
 * Helpers for filterable listing pages (blog, recipes).
 * Filter state lives entirely in query params so every view is a link.
 */

export type ListingState = Record<string, string | number | null | undefined>;

/** Build `base?…` from the current state with some params overridden or removed (null). */
export function listingUrl(base: string, state: ListingState, overrides: ListingState = {}): string {
	const merged = { ...state, ...overrides };
	const sp = new URLSearchParams();
	for (const [k, v] of Object.entries(merged)) {
		if (v !== null && v !== undefined && v !== "") sp.set(k, String(v));
	}
	const qs = sp.toString();
	return qs ? `${base}?${qs}` : base;
}

/** Trimmed, length-capped query param ("" when missing). */
export function param(params: URLSearchParams, name: string, max = 80): string {
	return (params.get(name) ?? "").trim().slice(0, max);
}

/** Reorder entries to match the order of slugs returned by search. */
export function sortBySlugRank<T extends { id: string }>(entries: T[], slugs: string[]): T[] {
	const rank = new Map(slugs.map((s, i) => [s, i]));
	return entries.toSorted((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));
}
