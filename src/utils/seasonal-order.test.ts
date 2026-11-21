// Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { orderSeasonal } from "./seasonal-order.ts";

// Admin tag order on the live site.
const TAGS = ["Spring", "Summer", "Fall", "Thanksgiving", "Winter Holiday", "New Year"];
const page = (tag: string | null, featured = false, name = tag ?? "untagged") => ({
	name,
	position: tag === null ? null : TAGS.indexOf(tag),
	featured,
});
const names = (r: { featured: { name: string }[]; others: { name: string }[] }) => ({
	featured: r.featured.map((p) => p.name),
	others: r.others.map((p) => p.name),
});
const all = (featured: string[]) => TAGS.map((t) => page(t, featured.includes(t)));

test("one featured: the rest continue after it and wrap around", () => {
	assert.deepEqual(names(orderSeasonal(all(["Thanksgiving"]), TAGS.length)), {
		featured: ["Thanksgiving"],
		others: ["Winter Holiday", "New Year", "Spring", "Summer", "Fall"],
	});
	assert.deepEqual(names(orderSeasonal(all(["Winter Holiday"]), TAGS.length)).others, [
		"New Year",
		"Spring",
		"Summer",
		"Fall",
		"Thanksgiving",
	]);
	assert.deepEqual(names(orderSeasonal(all(["New Year"]), TAGS.length)).others, [
		"Spring",
		"Summer",
		"Fall",
		"Thanksgiving",
		"Winter Holiday",
	]);
});

test("several featured next to each other: all shown, rest continue after the last", () => {
	assert.deepEqual(names(orderSeasonal(all(["Thanksgiving", "Winter Holiday"]), TAGS.length)), {
		featured: ["Thanksgiving", "Winter Holiday"],
		others: ["New Year", "Spring", "Summer", "Fall"],
	});
	// Wrapping across the end of the list.
	assert.deepEqual(names(orderSeasonal(all(["New Year", "Spring"]), TAGS.length)), {
		featured: ["New Year", "Spring"],
		others: ["Summer", "Fall", "Thanksgiving", "Winter Holiday"],
	});
});

test("featured pages apart: continue after the one with the longest gap after it", () => {
	assert.deepEqual(names(orderSeasonal(all(["Spring", "Fall"]), TAGS.length)), {
		featured: ["Spring", "Fall"],
		others: ["Thanksgiving", "Winter Holiday", "New Year", "Summer"],
	});
});

test("nothing featured: plain tag order", () => {
	assert.deepEqual(names(orderSeasonal(all([]), TAGS.length)).others, TAGS);
});

test("untagged pages go last; pages sharing a tag keep input order", () => {
	const r = orderSeasonal(
		[page(null, false, "loose"), page("Fall", false, "Fall A"), page("Fall", false, "Fall B"), page("Thanksgiving", true), page(null, true, "loose featured")],
		TAGS.length,
	);
	assert.deepEqual(names(r), {
		featured: ["Thanksgiving", "loose featured"],
		others: ["Fall A", "Fall B", "loose"],
	});
});

test("only pages with tags count; missing tags don't break the loop", () => {
	// Summer has no page: the loop just skips it.
	const pages = all(["Thanksgiving"]).filter((p) => p.name !== "Summer");
	assert.deepEqual(names(orderSeasonal(pages, TAGS.length)).others, ["Winter Holiday", "New Year", "Spring", "Fall"]);
});
