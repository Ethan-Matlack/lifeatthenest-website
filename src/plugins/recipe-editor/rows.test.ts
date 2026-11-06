// Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { linesToRows, moveLine, rowsToLines, sameRows } from "./rows.ts";

const stored = [
	{ group: "For the soup", amount: "3", unit: "lb", item: "chicken thighs" },
	{ group: "For the soup", amount: "3", unit: "quart", item: "water" },
	{ group: "For the rivels", amount: "1", unit: "cup", item: "flour" },
	{ group: "For the rivels", amount: "1", item: "egg" },
];

test("stored rows become heading + item lines", () => {
	const lines = rowsToLines(stored);
	assert.deepEqual(
		lines.map((l) => (l.kind === "heading" ? `# ${l.text}` : String(l.data.item))),
		["# For the soup", "chicken thighs", "water", "# For the rivels", "flour", "egg"],
	);
	assert.ok(lines.every((l) => l.kind === "heading" || !("group" in l.data)), "group is moved onto heading lines");
});

test("round trip preserves the data", () => {
	assert.deepEqual(linesToRows(rowsToLines(stored)), stored);
});

test("headings carry forward like the recipe card (group only on first row)", () => {
	const sparse = [
		{ group: "Dough", item: "flour" },
		{ item: "water" },
		{ group: "Topping", item: "sugar" },
	];
	assert.deepEqual(linesToRows(rowsToLines(sparse)), [
		{ group: "Dough", item: "flour" },
		{ group: "Dough", item: "water" },
		{ group: "Topping", item: "sugar" },
	]);
	assert.ok(sameRows(sparse, linesToRows(rowsToLines(sparse))), "sparse and explicit forms are equivalent");
});

test("rows before any heading have no group", () => {
	assert.deepEqual(linesToRows(rowsToLines([{ item: "salt" }])), [{ item: "salt" }]);
});

test("empty optional values are dropped, strings trimmed, fixed kept only when true", () => {
	const lines = rowsToLines([{ item: "salt" }]);
	if (lines[0]!.kind !== "row") throw new Error("expected row");
	lines[0]!.data = { amount: "", unit: "", item: "  salt ", note: "", fixed: false };
	assert.deepEqual(linesToRows(lines), [{ item: "salt" }]);
	lines[0]!.data = { amount: "1", item: "salt", fixed: true };
	assert.deepEqual(linesToRows(lines), [{ amount: "1", item: "salt", fixed: true }]);
});

test("a heading with nothing under it isn't stored", () => {
	const lines = [...rowsToLines([{ item: "salt" }]), { key: "x", kind: "heading" as const, text: "Later" }];
	assert.deepEqual(linesToRows(lines), [{ item: "salt" }]);
});

test("non-text values like images pass through untouched", () => {
	const image = { id: "01ABC", provider: "local", meta: { storageKey: "01ABC.jpg" } };
	const steps = [{ group: "Make the dough", instruction: "Mix.", image }];
	assert.deepEqual(linesToRows(rowsToLines(steps)), steps);
});

test("invalid stored values are treated as empty", () => {
	assert.deepEqual(rowsToLines(null), []);
	assert.deepEqual(rowsToLines("nope"), []);
	assert.deepEqual(rowsToLines([null, 3, { item: "ok" }]).length, 1);
});

test("moveLine moves within bounds only", () => {
	assert.deepEqual(moveLine(["a", "b", "c"], 0, 1), ["b", "a", "c"]);
	assert.deepEqual(moveLine(["a", "b", "c"], 2, -1), ["a", "c", "b"]);
	assert.deepEqual(moveLine(["a", "b", "c"], 0, -1), ["a", "b", "c"]);
	assert.deepEqual(moveLine(["a", "b", "c"], 2, 1), ["a", "b", "c"]);
});
