// Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { SLOTS, slotProps } from "./image-slots.ts";

test("fixed-shape slots crop to their aspect regardless of the photo", () => {
	assert.deepEqual(slotProps({ width: 3000, height: 4000 }, SLOTS.recipeTile), {
		width: 320,
		height: 240,
		sizes: SLOTS.recipeTile.sizes,
	});
	assert.deepEqual(slotProps(null, SLOTS.homeHero), { width: 480, height: 600, sizes: SLOTS.homeHero.sizes });
	assert.equal(slotProps({}, SLOTS.recipeHero).height, 320);
	assert.equal(slotProps({}, SLOTS.postNavThumb).height, 72);
});

test("free-shape slots keep the photo's proportions", () => {
	assert.deepEqual(slotProps({ width: 4000, height: 3000 }, SLOTS.postHero), {
		width: 960,
		height: 720,
		sizes: SLOTS.postHero.sizes,
	});
	assert.equal(slotProps({ width: 1000, height: 1500 }, SLOTS.postHero).height, 1440);
});

test("free-shape slots without dimensions leave the size alone", () => {
	assert.deepEqual(slotProps({ width: null, height: null }, SLOTS.postHero), { sizes: SLOTS.postHero.sizes });
	assert.deepEqual(slotProps(undefined, SLOTS.postHero), { sizes: SLOTS.postHero.sizes });
});

test("every slot has a positive width and a sizes value", () => {
	for (const [name, slot] of Object.entries(SLOTS)) {
		assert.ok(slot.width > 0, name);
		assert.ok(slot.sizes.length > 0, name);
	}
});

test("a plain URL string has no dimensions", () => {
	assert.deepEqual(slotProps("https://example.com/a.jpg", SLOTS.postHero), { sizes: SLOTS.postHero.sizes });
	assert.equal(slotProps("https://example.com/a.jpg", SLOTS.product).height, 260);
});
