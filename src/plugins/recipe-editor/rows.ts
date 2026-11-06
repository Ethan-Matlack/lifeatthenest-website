/**
 * Convert between the stored repeater value (flat rows, each with an optional
 * `group` heading) and the editor's view (heading lines + item lines).
 *
 * Stored:  [{group:"For the soup", item:"water"}, {item:"corn"}, {group:"For the rivels", item:"flour"}]
 * Editor:  [heading "For the soup", row water, row corn, heading "For the rivels", row flour]
 *
 * Like the recipe card, a heading carries forward until it changes, so rows
 * with an empty group belong to the heading above them. On save every row
 * gets its heading written explicitly; the page renders the same either way.
 * Pure module, shared by the admin widget and the tests.
 */

export type Row = Record<string, unknown> & { group?: unknown };

export type Line<T extends Row> =
	| { key: string; kind: "heading"; text: string }
	| { key: string; kind: "row"; data: T };

let counter = 0;
export function newKey(): string {
	counter += 1;
	return `l${Date.now().toString(36)}${counter.toString(36)}`;
}

/** Stored rows -> editor lines. */
export function rowsToLines<T extends Row>(rows: unknown): Line<T>[] {
	const list = Array.isArray(rows) ? (rows as T[]) : [];
	const lines: Line<T>[] = [];
	let current = "";
	for (const row of list) {
		if (!row || typeof row !== "object") continue;
		const group = typeof row.group === "string" ? row.group.trim() : "";
		if (group && group !== current) {
			lines.push({ key: newKey(), kind: "heading", text: group });
			current = group;
		}
		const { group: _group, ...data } = row;
		lines.push({ key: newKey(), kind: "row", data: data as T });
	}
	return lines;
}

/**
 * Editor lines -> stored rows. Each row gets the nearest heading above it as
 * `group`; empty values are dropped so optional fields stay unset. Headings
 * with no rows under them aren't stored (there's nothing to attach them to).
 */
export function linesToRows<T extends Row>(lines: readonly Line<T>[]): T[] {
	const rows: T[] = [];
	let current = "";
	for (const line of lines) {
		if (line.kind === "heading") {
			current = line.text.trim();
			continue;
		}
		const row: Record<string, unknown> = {};
		if (current) row.group = current;
		for (const [k, v] of Object.entries(line.data)) {
			if (k === "group") continue;
			if (v === "" || v === undefined || v === null || v === false) continue;
			row[k] = typeof v === "string" ? v.trim() : v;
		}
		rows.push(row as T);
	}
	return rows;
}

/** Stable comparison of two stored values (used to detect outside changes). */
export function sameRows(a: unknown, b: unknown): boolean {
	return JSON.stringify(normalize(a)) === JSON.stringify(normalize(b));
}

function normalize(value: unknown): unknown {
	if (!Array.isArray(value)) return [];
	// Compare by meaning: carry headings forward like the page does.
	return linesToRows(rowsToLines(value));
}

/** Move the line at `index` by `delta` (-1 up, +1 down). Returns a new array. */
export function moveLine<T>(lines: readonly T[], index: number, delta: number): T[] {
	const target = index + delta;
	if (index < 0 || index >= lines.length || target < 0 || target >= lines.length) return [...lines];
	const next = [...lines];
	const [item] = next.splice(index, 1);
	next.splice(target, 0, item!);
	return next;
}
