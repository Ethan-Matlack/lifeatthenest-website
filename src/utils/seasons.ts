/**
 * Seasons for the Seasonal pages. The `season` select on a Seasonal page
 * uses these labels; the /seasonal listing groups pages by them, starting
 * with the current season and continuing through the calendar.
 *
 * Each season starts on the given month/day and runs until the next one
 * starts (Holidays runs from mid-November into the new year's Winter).
 */
export const SEASONS = ["Winter", "Spring", "Summer", "Fall", "Holidays"] as const;
export type Season = (typeof SEASONS)[number];

/** Start dates in calendar order: [month (1-12), day]. */
const STARTS: Record<Season, [number, number]> = {
	Winter: [1, 1],
	Spring: [3, 20],
	Summer: [6, 21],
	Fall: [9, 22],
	Holidays: [11, 15],
};

/** The season a date falls in (by the site's calendar, not the visitor's). */
export function currentSeason(date: Date): Season {
	const md = (date.getMonth() + 1) * 100 + date.getDate();
	let current: Season = "Winter";
	for (const season of SEASONS) {
		const [m, d] = STARTS[season];
		if (md >= m * 100 + d) current = season;
	}
	return current;
}

/** All seasons, starting with the current one, in calendar order. */
export function seasonsFrom(date: Date): Season[] {
	const start = SEASONS.indexOf(currentSeason(date));
	return SEASONS.map((_, i) => SEASONS[(start + i) % SEASONS.length]!);
}

export function isSeason(value: unknown): value is Season {
	return typeof value === "string" && (SEASONS as readonly string[]).includes(value);
}
