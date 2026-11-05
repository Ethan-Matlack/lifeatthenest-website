/** Sum recipe time fields, ignoring blanks. Returns 0 when nothing is set. */
export function totalMinutes(...parts: Array<number | null | undefined>): number {
	return parts.reduce<number>((sum, n) => sum + (typeof n === "number" && n > 0 ? n : 0), 0);
}

/** 75 -> "1 hr 15 min", 45 -> "45 min", 120 -> "2 hr". Empty string for 0. */
export function formatMinutes(minutes: number): string {
	if (!minutes || minutes <= 0) return "";
	const h = Math.floor(minutes / 60);
	const m = Math.round(minutes % 60);
	if (h === 0) return `${m} min`;
	if (m === 0) return `${h} hr`;
	return `${h} hr ${m} min`;
}

export function formatDate(date: Date | null | undefined): string {
	if (!date) return "";
	return date.toLocaleDateString("en-US", {
		year: "numeric",
		month: "long",
		day: "numeric",
		timeZone: "America/New_York",
	});
}
