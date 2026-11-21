/**
 * Order of the cards on /seasonal. Pure, so it's unit-tested
 * (seasonal-order.test.ts).
 *
 * Each seasonal page sits at the position of its Seasonal Collections tag
 * (the manual order set in the admin). The tag list is treated as a loop
 * through the year: after the last tag comes the first again.
 *
 *  - Featured pages ("Feature now") all go first, in loop order.
 *  - The other pages continue the loop from just after the featured ones,
 *    so the next upcoming collections come first and the ones that just
 *    passed come last.
 *  - If featured pages aren't next to each other in the list, the loop
 *    continues after the featured page followed by the longest run of
 *    non-featured tags (the natural "end" of the featured stretch).
 *  - With nothing featured, the plain tag order is used.
 *  - Pages without a tag go last (featured or not), keeping input order.
 *    Pages sharing a tag keep input order too (the caller passes newest first).
 */

export interface OrderInput {
	/** Position of the page's tag in the admin order, or null if untagged. */
	position: number | null;
	featured: boolean;
}

export function orderSeasonal<T extends OrderInput>(pages: T[], tagCount: number): { featured: T[]; others: T[] } {
	const tagged = pages.filter((p) => p.position !== null && p.position >= 0 && p.position < tagCount);
	const untagged = pages.filter((p) => !tagged.includes(p));

	const featuredPositions = [...new Set(tagged.filter((p) => p.featured).map((p) => p.position as number))].sort(
		(a, b) => a - b,
	);

	// Where the loop starts: just after the featured page with the longest gap after it.
	let start = 0;
	if (featuredPositions.length && tagCount > 0) {
		let best = -1;
		featuredPositions.forEach((pos, i) => {
			const next = featuredPositions[(i + 1) % featuredPositions.length]!;
			const gap = (next - pos - 1 + tagCount) % tagCount;
			const gapAfter = featuredPositions.length === 1 ? tagCount - 1 : gap;
			if (gapAfter > best) {
				best = gapAfter;
				start = (pos + 1) % tagCount;
			}
		});
	}

	// Distance along the loop from `start`; stable sort keeps input order for ties.
	const loop = (p: T) => ((p.position as number) - start + tagCount) % tagCount;
	const byLoop = (a: T, b: T) => loop(a) - loop(b);

	return {
		featured: [...tagged.filter((p) => p.featured).sort(byLoop), ...untagged.filter((p) => p.featured)],
		others: [...tagged.filter((p) => !p.featured).sort(byLoop), ...untagged.filter((p) => !p.featured)],
	};
}
