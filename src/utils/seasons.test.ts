// Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { currentSeason, isSeason, seasonsFrom } from "./seasons.ts";

const d = (m: number, day: number) => new Date(2026, m - 1, day, 12);

test("current season by start dates", () => {
	assert.equal(currentSeason(d(1, 1)), "Winter");
	assert.equal(currentSeason(d(3, 19)), "Winter");
	assert.equal(currentSeason(d(3, 20)), "Spring");
	assert.equal(currentSeason(d(6, 21)), "Summer");
	assert.equal(currentSeason(d(9, 21)), "Summer");
	assert.equal(currentSeason(d(9, 22)), "Fall");
	assert.equal(currentSeason(d(11, 14)), "Fall");
	assert.equal(currentSeason(d(11, 15)), "Holidays");
	assert.equal(currentSeason(d(12, 31)), "Holidays");
});

test("seasons ordered from the current one, wrapping around the year", () => {
	assert.deepEqual(seasonsFrom(d(11, 21)), ["Holidays", "Winter", "Spring", "Summer", "Fall"]);
	assert.deepEqual(seasonsFrom(d(4, 1)), ["Spring", "Summer", "Fall", "Holidays", "Winter"]);
	assert.deepEqual(seasonsFrom(d(1, 10)), ["Winter", "Spring", "Summer", "Fall", "Holidays"]);
});

test("isSeason", () => {
	assert.equal(isSeason("Fall"), true);
	assert.equal(isSeason("fall"), false);
	assert.equal(isSeason(undefined), false);
});
