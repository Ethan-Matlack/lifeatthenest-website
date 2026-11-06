// Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseIngredientLine, parseIngredientList } from "./paste.ts";

// Same options as the recipes.ingredients "unit" select.
const UNITS = [
	"tsp", "tbsp", "cup", "fl oz", "pint", "quart", "oz", "lb", "g", "kg", "ml", "l",
	"pinch", "dash", "clove", "can", "jar", "package", "stick", "slice", "sprig", "bunch",
];
const p = (line: string) => parseIngredientLine(line, UNITS);

test("amount, unit, item, and note", () => {
	assert.deepEqual(p("1 1/2 cups flour, sifted"), { amount: "1 1/2", unit: "cup", item: "flour", note: "sifted" });
	assert.deepEqual(p("2 tbsp butter"), { amount: "2", unit: "tbsp", item: "butter" });
	assert.deepEqual(p("½ tsp baking soda"), { amount: "½", unit: "tsp", item: "baking soda" });
	assert.deepEqual(p("1½ cups milk"), { amount: "1½", unit: "cup", item: "milk" });
	assert.deepEqual(p("2-3 cloves garlic, minced"), { amount: "2-3", unit: "clove", item: "garlic", note: "minced" });
	assert.deepEqual(p("2 to 3 cups broth"), { amount: "2 to 3", unit: "cup", item: "broth" });
});

test("unit spellings and abbreviations", () => {
	assert.equal(p("1 teaspoon salt")?.unit, "tsp");
	assert.equal(p("1 Tablespoon oil")?.unit, "tbsp");
	assert.equal(p("1 T oil")?.unit, "tbsp");
	assert.equal(p("1 t salt")?.unit, "tsp");
	assert.equal(p("3 lbs chicken thighs")?.unit, "lb");
	assert.equal(p("8 oz. cream cheese")?.unit, "oz");
	assert.deepEqual(p("4 fl oz cream"), { amount: "4", unit: "fl oz", item: "cream" });
	assert.equal(p("2 Cups sugar")?.unit, "cup");
});

test("no unit, filler words, bullets", () => {
	assert.deepEqual(p("1 egg"), { amount: "1", item: "egg" });
	assert.deepEqual(p("2 cups of flour"), { amount: "2", unit: "cup", item: "flour" });
	assert.deepEqual(p("- 1 cup sugar"), { amount: "1", unit: "cup", item: "sugar" });
	assert.deepEqual(p("• 1 cup sugar"), { amount: "1", unit: "cup", item: "sugar" });
	assert.deepEqual(p("3. 2 eggs"), { amount: "2", item: "eggs" }, "numbered list marker is removed");
});

test("lines without an amount stay whole", () => {
	assert.deepEqual(p("salt to taste"), { item: "salt to taste" });
	assert.deepEqual(p("Fresh parsley, chopped"), { item: "Fresh parsley", note: "chopped" });
	assert.deepEqual(p("a handful of walnuts"), { item: "a handful of walnuts" });
	assert.deepEqual(p("2 cups"), { item: "2 cups" }, "nothing lost when only an amount + unit");
	assert.equal(p("   "), null);
});

test("words that look like units but aren't allowed stay in the item", () => {
	assert.deepEqual(p("2 large eggs"), { amount: "2", item: "large eggs" });
	assert.deepEqual(parseIngredientLine("1 cup flour", ["tsp"]), { amount: "1", item: "cup flour" });
});

test("lists with group headings", () => {
	const text = "For the crust:\n1 1/2 cups flour\n\n1/2 cup butter, cold\nFor the filling:\n1 cup molasses\n";
	assert.deepEqual(parseIngredientList(text, UNITS), [
		{ kind: "heading", text: "For the crust" },
		{ kind: "row", row: { amount: "1 1/2", unit: "cup", item: "flour" } },
		{ kind: "row", row: { amount: "1/2", unit: "cup", item: "butter", note: "cold" } },
		{ kind: "heading", text: "For the filling" },
		{ kind: "row", row: { amount: "1", unit: "cup", item: "molasses" } },
	]);
});

test("decimal amounts aren't mistaken for list numbers", () => {
	assert.deepEqual(parseIngredientLine("1.5 cups water", UNITS), { amount: "1.5", unit: "cup", item: "water" });
	assert.deepEqual(parseIngredientLine("2) 1 cup sugar", UNITS), { amount: "1", unit: "cup", item: "sugar" });
});
