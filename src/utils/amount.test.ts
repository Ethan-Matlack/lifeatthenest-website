// Run with: npm test   (Node's built-in test runner; no dependencies)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
	formatNumber,
	formatQuantity,
	isoDuration,
	parseAmount,
	scaleAmount,
	scaledMax,
	unitLabel,
} from "./amount.ts";

test("parses whole numbers and decimals", () => {
	assert.deepEqual(parseAmount("2"), { min: 2 });
	assert.deepEqual(parseAmount("1.5"), { min: 1.5 });
	assert.deepEqual(parseAmount(".5"), { min: 0.5 });
	assert.deepEqual(parseAmount("  3  "), { min: 3 });
});

test("parses simple and mixed fractions", () => {
	assert.deepEqual(parseAmount("1/2"), { min: 0.5 });
	assert.deepEqual(parseAmount("3/4"), { min: 0.75 });
	assert.deepEqual(parseAmount("1 1/2"), { min: 1.5 });
	assert.deepEqual(parseAmount("2 3/4"), { min: 2.75 });
	assert.deepEqual(parseAmount("1-1/2"), { min: 1.5 }, "hyphenated mixed number is not a range");
	assert.deepEqual(parseAmount("1 / 3"), { min: 1 / 3 });
});

test("parses unicode fractions", () => {
	assert.deepEqual(parseAmount("½"), { min: 0.5 });
	assert.deepEqual(parseAmount("⅓"), { min: 1 / 3 });
	assert.deepEqual(parseAmount("1½"), { min: 1.5 });
	assert.deepEqual(parseAmount("1 ½"), { min: 1.5 });
	assert.deepEqual(parseAmount("2⅔"), { min: 2 + 2 / 3 });
	assert.deepEqual(parseAmount("⅛"), { min: 0.125 });
});

test("parses ranges", () => {
	assert.deepEqual(parseAmount("2-3"), { min: 2, max: 3 });
	assert.deepEqual(parseAmount("2–3"), { min: 2, max: 3 });
	assert.deepEqual(parseAmount("2 — 3"), { min: 2, max: 3 });
	assert.deepEqual(parseAmount("2 to 3"), { min: 2, max: 3 });
	assert.deepEqual(parseAmount("1/2-1"), { min: 0.5, max: 1 });
	assert.deepEqual(parseAmount("1 1/2 - 2"), { min: 1.5, max: 2 });
	assert.deepEqual(parseAmount("½–1"), { min: 0.5, max: 1 });
	assert.deepEqual(parseAmount("3-2"), { min: 2, max: 3 }, "reversed range is normalized");
	assert.deepEqual(parseAmount("2-2"), { min: 2 });
});

test("rejects things that aren't amounts", () => {
	for (const s of ["", "  ", "a handful", "to taste", "1/0", "0", "abc 2", "2 cups", "1/2/3", "-1", null, undefined]) {
		assert.equal(parseAmount(s as string), null, `should reject ${JSON.stringify(s)}`);
	}
});

test("formats friendly fractions, never long decimals", () => {
	assert.equal(formatNumber(0.5), "½");
	assert.equal(formatNumber(1 / 3), "⅓");
	assert.equal(formatNumber(2 / 3), "⅔");
	assert.equal(formatNumber(0.25), "¼");
	assert.equal(formatNumber(0.75), "¾");
	assert.equal(formatNumber(0.125), "⅛");
	assert.equal(formatNumber(1.5), "1½");
	assert.equal(formatNumber(2), "2");
	assert.equal(formatNumber(0.333333), "⅓");
	assert.equal(formatNumber(1.66), "1⅔");
	for (let i = 1; i <= 400; i++) {
		const out = formatNumber(i / 37);
		assert.doesNotMatch(out, /\./, `${i / 37} formatted as ${out}`);
	}
});

test("rounds to the nearest kitchen fraction", () => {
	assert.equal(formatNumber(0.3), "⅓"); // nearer ⅓ than ¼
	assert.equal(formatNumber(0.97), "1"); // rounds up to the next whole
	assert.equal(formatNumber(2.95), "3");
	assert.equal(formatNumber(1.04), "1");
	assert.equal(formatNumber(0.05), "⅛", "tiny amounts never show as 0");
	assert.equal(formatNumber(0.0001), "⅛");
});

test("larger amounts use halves, then whole numbers", () => {
	assert.equal(formatNumber(12.4), "12½");
	assert.equal(formatNumber(12.2), "12");
	assert.equal(formatNumber(10), "10");
	assert.equal(formatNumber(49.8), "50");
	assert.equal(formatNumber(73.4), "73");
});

test("formats ranges", () => {
	assert.equal(formatQuantity({ min: 2, max: 3 }), "2–3");
	assert.equal(formatQuantity({ min: 0.5, max: 1 }), "½–1");
	assert.equal(formatQuantity({ min: 1.01, max: 0.99 + 0.02 }), "1", "collapses when both ends round the same");
});

test("scales amounts", () => {
	assert.equal(scaleAmount("1 1/2", 2), "3");
	assert.equal(scaleAmount("1/3", 2), "⅔");
	assert.equal(scaleAmount("1/3", 3), "1");
	assert.equal(scaleAmount("3/4", 0.5), "⅜");
	assert.equal(scaleAmount("2-3", 2), "4–6");
	assert.equal(scaleAmount("2–3", 0.5), "1–1½");
	assert.equal(scaleAmount("1", 1), "1");
	assert.equal(scaleAmount("1 1/2", 1), "1½", "1× still normalizes formatting");
	assert.equal(scaleAmount("2.5", 3), "7½");
});

test("leaves unparseable and fixed amounts alone", () => {
	assert.equal(scaleAmount("a handful", 2), "a handful");
	assert.equal(scaleAmount("", 2), "");
	assert.equal(scaleAmount(undefined, 2), "");
	assert.equal(scaleAmount("1", 3, true), "1");
	assert.equal(scaleAmount("1 1/2", 3, true), "1 1/2", "fixed amounts keep the editor's text");
});

test("scaledMax supports plural units", () => {
	assert.equal(scaledMax("1/2", 2), 1);
	assert.equal(scaledMax("2-3", 1), 3);
	assert.equal(scaledMax("1", 4, true), 1);
	assert.equal(scaledMax("some", 2), null);
});

test("pluralizes units only when the amount is more than one", () => {
	assert.equal(unitLabel("cup", 1), "cup");
	assert.equal(unitLabel("cup", 0.5), "cup");
	assert.equal(unitLabel("cup", 2), "cups");
	assert.equal(unitLabel("bunch", 3), "bunches");
	assert.equal(unitLabel("tbsp", 3), "tbsp");
	assert.equal(unitLabel("oz", 8), "oz");
	assert.equal(unitLabel("clove", null), "clove");
	assert.equal(unitLabel(undefined, 2), "");
});

test("ISO 8601 durations", () => {
	assert.equal(isoDuration(15), "PT15M");
	assert.equal(isoDuration(60), "PT1H");
	assert.equal(isoDuration(75), "PT1H15M");
	assert.equal(isoDuration(0), undefined);
	assert.equal(isoDuration(null), undefined);
});
