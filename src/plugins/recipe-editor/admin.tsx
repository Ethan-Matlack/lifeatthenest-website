/**
 * Admin field widgets for recipes (loaded into the EmDash admin by the
 * recipe-editor plugin). They replace the default repeater editors for
 * `ingredients` and `steps` with compact tables. The stored data is exactly
 * what the default repeater saves, so the site doesn't change.
 *
 *   recipe-editor:ingredients  table + group heading rows + "Paste ingredients"
 *   recipe-editor:steps        numbered list + group heading rows + step photos
 */
import * as React from "react";
import { Button, Input, InputArea, Select } from "@cloudflare/kumo";
import { MediaPickerModal, type MediaItem } from "@emdash-cms/admin";
import { parseIngredientList } from "./paste.ts";
import { linesToRows, moveLine, newKey, rowsToLines, sameRows, type Line, type Row } from "./rows.ts";

interface FieldWidgetProps {
	value: unknown;
	onChange: (value: unknown) => void;
	label: string;
	id: string;
	required?: boolean;
	options?: unknown;
	validation?: Record<string, unknown>;
	minimal?: boolean;
}

interface IngredientRow extends Row {
	amount?: string;
	unit?: string;
	item?: string;
	note?: string;
	fixed?: boolean;
}

interface ImageValue {
	id: string;
	src?: string;
	previewUrl?: string;
	alt?: string;
	meta?: Record<string, unknown>;
	[key: string]: unknown;
}

interface StepRow extends Row {
	instruction?: string;
	image?: ImageValue;
}

/* ---------------------------------------------------------------------------
 * Shared state: editor lines kept locally (so an empty new row or a heading
 * with nothing under it yet survives), saved as rows on every change, and
 * reset only when the stored value changes from outside (e.g. revision restore).
 * ------------------------------------------------------------------------- */
function useLines<T extends Row>(value: unknown, onChange: (value: unknown) => void) {
	const [lines, setLines] = React.useState<Line<T>[]>(() => rowsToLines<T>(value));
	const lastSaved = React.useRef<unknown>(value);

	React.useEffect(() => {
		if (!sameRows(value, lastSaved.current)) {
			lastSaved.current = value;
			setLines(rowsToLines<T>(value));
		}
	}, [value]);

	const update = React.useCallback(
		(next: Line<T>[]) => {
			setLines(next);
			const rows = linesToRows(next);
			lastSaved.current = rows;
			onChange(rows);
		},
		[onChange],
	);

	return [lines, update] as const;
}

/** Choices for the "unit" select sub-field, read from the schema so the list stays in one place. */
function unitOptions(validation: Record<string, unknown> | undefined): string[] {
	const subFields = Array.isArray(validation?.subFields) ? (validation.subFields as Record<string, unknown>[]) : [];
	const unit = subFields.find((f) => f.slug === "unit");
	const raw = (unit?.options ?? (unit?.validation as Record<string, unknown> | undefined)?.options) as unknown;
	if (!Array.isArray(raw)) return [];
	return raw
		.map((o) => (typeof o === "string" ? o : typeof o === "object" && o && "value" in o ? String((o as { value: unknown }).value) : ""))
		.filter(Boolean);
}

/** Focus a field by data attribute after the next render (for "add row" and Enter). */
function useFocusAfterRender() {
	const pending = React.useRef<string | null>(null);
	React.useEffect(() => {
		if (!pending.current) return;
		const el = document.querySelector<HTMLElement>(`[data-rfe-focus="${pending.current}"]`);
		pending.current = null;
		el?.focus();
	});
	return (key: string) => {
		pending.current = key;
	};
}

/* ------------------------------- small parts ------------------------------ */

function RowControls({
	index,
	count,
	label,
	onMove,
	onRemove,
}: {
	index: number;
	count: number;
	label: string;
	onMove: (delta: number) => void;
	onRemove: () => void;
}) {
	return (
		<div className="rfe-controls">
			<button type="button" className="rfe-icon" onClick={() => onMove(-1)} disabled={index === 0} aria-label={`Move ${label} up`} title="Move up">
				↑
			</button>
			<button type="button" className="rfe-icon" onClick={() => onMove(1)} disabled={index === count - 1} aria-label={`Move ${label} down`} title="Move down">
				↓
			</button>
			<button type="button" className="rfe-icon rfe-remove" onClick={onRemove} aria-label={`Remove ${label}`} title="Remove">
				✕
			</button>
		</div>
	);
}

function HeadingLine({
	text,
	index,
	count,
	focusKey,
	onText,
	onMove,
	onRemove,
}: {
	text: string;
	index: number;
	count: number;
	focusKey: string;
	onText: (text: string) => void;
	onMove: (delta: number) => void;
	onRemove: () => void;
}) {
	return (
		<div className="rfe-heading" role="group" aria-label="Group heading">
			<span className="rfe-heading-mark" aria-hidden="true">
				▸
			</span>
			<Input
				size="sm"
				value={text}
				aria-label="Group heading"
				data-rfe-focus={focusKey}
				onChange={(e: React.ChangeEvent<HTMLInputElement>) => onText(e.target.value)}
			/>
			<RowControls index={index} count={count} label="heading" onMove={onMove} onRemove={onRemove} />
		</div>
	);
}

/* --------------------------------- styles --------------------------------- */

const STYLES = `
.rfe { display: grid; gap: .5rem; }
.rfe-top { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: .5rem; }
.rfe-label { font-size: .875rem; font-weight: 500; }
.rfe-hint { font-size: .75rem; opacity: .7; }
.rfe-scroll { overflow-x: auto; border: 1px solid color-mix(in srgb, currentColor 14%, transparent); border-radius: .5rem; }
.rfe-table { min-width: 36rem; }
.rfe-ing .rfe-cols, .rfe-ing .rfe-row { display: grid; grid-template-columns: 4.25rem 6rem minmax(8rem, 2fr) minmax(6rem, 1.3fr) 2.75rem 5.25rem; gap: .375rem; align-items: center; }
.rfe-cols { padding: .4rem .5rem; font-size: .7rem; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; opacity: .65; border-bottom: 1px solid color-mix(in srgb, currentColor 14%, transparent); }
.rfe-row, .rfe-heading { padding: .3rem .5rem; }
.rfe-row + .rfe-row, .rfe-heading + .rfe-row, .rfe-row + .rfe-heading, .rfe-heading + .rfe-heading { border-top: 1px solid color-mix(in srgb, currentColor 8%, transparent); }
.rfe-heading { display: grid; grid-template-columns: 1rem 1fr 5.25rem; gap: .375rem; align-items: center; background: color-mix(in srgb, currentColor 5%, transparent); }
.rfe-heading input { font-weight: 600; }
.rfe-heading-mark { opacity: .6; font-size: .8rem; }
.rfe-fixed { display: flex; justify-content: center; }
.rfe-fixed input { width: 1rem; height: 1rem; cursor: pointer; }
.rfe-controls { display: flex; justify-content: flex-end; gap: .125rem; }
.rfe-icon { width: 1.6rem; height: 1.6rem; border: 0; border-radius: .375rem; background: transparent; color: inherit; cursor: pointer; font-size: .8rem; line-height: 1; opacity: .7; }
.rfe-icon:hover:not(:disabled) { opacity: 1; background: color-mix(in srgb, currentColor 10%, transparent); }
.rfe-icon:disabled { opacity: .25; cursor: default; }
.rfe-remove:hover:not(:disabled) { color: #c0392b; }
.rfe-empty { padding: 1rem .75rem; font-size: .85rem; opacity: .7; }
.rfe-actions { display: flex; flex-wrap: wrap; gap: .5rem; }
.rfe-paste { display: grid; gap: .5rem; padding: .75rem; border: 1px dashed color-mix(in srgb, currentColor 25%, transparent); border-radius: .5rem; }
.rfe-paste textarea { min-height: 9rem; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: .8rem; }
.rfe-steps .rfe-row { display: grid; grid-template-columns: 1.75rem 1fr 7rem 5.25rem; gap: .5rem; align-items: start; }
.rfe-steps .rfe-table { min-width: 30rem; }
.rfe-num { padding-top: .45rem; font-weight: 600; text-align: right; opacity: .7; }
.rfe-steps textarea { resize: vertical; min-height: 2.5rem; }
.rfe-photo { display: grid; gap: .25rem; justify-items: start; padding-top: .1rem; }
.rfe-photo img { width: 6.5rem; height: 4.25rem; object-fit: cover; border-radius: .375rem; }
.rfe-photo-actions { display: flex; gap: .25rem; }
.rfe-link { padding: 0; border: 0; background: none; color: inherit; font-size: .75rem; text-decoration: underline; cursor: pointer; opacity: .8; }
.rfe-link:hover { opacity: 1; }
.rfe-steps .rfe-controls { padding-top: .2rem; }
`;

function Styles() {
	return <style>{STYLES}</style>;
}

/* ------------------------------ ingredients ------------------------------- */

function IngredientsField({ value, onChange, label, id, validation }: FieldWidgetProps) {
	const [lines, setLines] = useLines<IngredientRow>(value, onChange);
	const focusAfterRender = useFocusAfterRender();
	const units = React.useMemo(() => unitOptions(validation), [validation]);
	const [pasteOpen, setPasteOpen] = React.useState(false);
	const [pasteText, setPasteText] = React.useState("");
	const pasted = React.useMemo(() => parseIngredientList(pasteText, units), [pasteText, units]);
	const pastedRows = pasted.filter((l) => l.kind === "row").length;

	const unitItems = React.useMemo(
		() => ({ "": "—", ...Object.fromEntries(units.map((u) => [u, u])) }),
		[units],
	);

	const setRow = (index: number, patch: Partial<IngredientRow>) => {
		const next = [...lines];
		const line = next[index];
		if (line?.kind !== "row") return;
		next[index] = { ...line, data: { ...line.data, ...patch } };
		setLines(next);
	};
	const insertRow = (at: number) => {
		const key = newKey();
		const next = [...lines];
		next.splice(at, 0, { key, kind: "row", data: {} });
		setLines(next);
		focusAfterRender(`${key}:amount`);
	};
	const addHeading = () => {
		const key = newKey();
		setLines([...lines, { key, kind: "heading", text: "" }]);
		focusAfterRender(`${key}:heading`);
	};
	const remove = (index: number) => setLines(lines.filter((_, i) => i !== index));
	const move = (index: number, delta: number) => setLines(moveLine(lines, index, delta));
	const addPasted = () => {
		const added: Line<IngredientRow>[] = pasted.map((l) =>
			l.kind === "heading"
				? { key: newKey(), kind: "heading", text: l.text }
				: { key: newKey(), kind: "row", data: { ...l.row } },
		);
		setLines([...lines, ...added]);
		setPasteText("");
		setPasteOpen(false);
	};
	// Enter in the last text cell adds a row below and moves to it.
	const enterAddsRow = (index: number) => (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter") {
			e.preventDefault();
			insertRow(index + 1);
		}
	};

	return (
		<div className="rfe rfe-ing" id={id} role="group" aria-labelledby={`${id}-label`}>
			<Styles />
			<div className="rfe-top">
				<span id={`${id}-label`} className="rfe-label">
					{label}
				</span>
				<span className="rfe-hint">Amounts like 1 1/2, ½, or 2-3. Press Enter in Note to add a row.</span>
			</div>

			<div className="rfe-scroll">
				<div className="rfe-table">
					<div className="rfe-cols" aria-hidden="true">
						<span>Amount</span>
						<span>Unit</span>
						<span>Ingredient</span>
						<span>Note</span>
						<span title="Don't scale this one (e.g. salt to taste)">Fixed</span>
						<span />
					</div>
					{lines.length === 0 && <div className="rfe-empty">No ingredients yet. Add one below, or paste a list.</div>}
					{lines.map((line, index) =>
						line.kind === "heading" ? (
							<HeadingLine
								key={line.key}
								text={line.text}
								index={index}
								count={lines.length}
								focusKey={`${line.key}:heading`}
								onText={(text) => {
									const next = [...lines];
									next[index] = { ...line, text };
									setLines(next);
								}}
								onMove={(d) => move(index, d)}
								onRemove={() => remove(index)}
							/>
						) : (
							<div className="rfe-row" key={line.key} role="group" aria-label={`Ingredient ${line.data.item || index + 1}`}>
								<Input
									size="sm"
									value={line.data.amount ?? ""}
									aria-label="Amount"
									data-rfe-focus={`${line.key}:amount`}
									onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRow(index, { amount: e.target.value })}
								/>
								<Select
									size="sm"
									aria-label="Unit"
									value={line.data.unit ?? ""}
									items={unitItems}
									onValueChange={(v: unknown) => setRow(index, { unit: typeof v === "string" ? v : "" })}
								/>
								<Input
									size="sm"
									value={line.data.item ?? ""}
									aria-label="Ingredient"
									onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRow(index, { item: e.target.value })}
								/>
								<Input
									size="sm"
									value={line.data.note ?? ""}
									aria-label="Note"
									onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRow(index, { note: e.target.value })}
									onKeyDown={enterAddsRow(index)}
								/>
								<label className="rfe-fixed" title="Don't scale this one (e.g. salt to taste)">
									<input
										type="checkbox"
										checked={Boolean(line.data.fixed)}
										aria-label="Don't scale this one"
										onChange={(e) => setRow(index, { fixed: e.target.checked })}
									/>
								</label>
								<RowControls
									index={index}
									count={lines.length}
									label={`ingredient ${line.data.item || index + 1}`}
									onMove={(d) => move(index, d)}
									onRemove={() => remove(index)}
								/>
							</div>
						),
					)}
				</div>
			</div>

			<div className="rfe-actions">
				<Button size="sm" variant="secondary" onClick={() => insertRow(lines.length)}>
					+ Add ingredient
				</Button>
				<Button size="sm" variant="ghost" onClick={addHeading}>
					+ Add group heading
				</Button>
				<Button size="sm" variant="ghost" onClick={() => setPasteOpen((o) => !o)} aria-expanded={pasteOpen}>
					Paste ingredients
				</Button>
			</div>

			{pasteOpen && (
				<div className="rfe-paste">
					<span className="rfe-hint">
						One ingredient per line, like “1 1/2 cups flour, sifted”. A line ending in “:” becomes a group heading.
						Rows are added to the end of the table so you can check them.
					</span>
					<InputArea
						value={pasteText}
						aria-label="Ingredients to paste"
						onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setPasteText(e.target.value)}
					/>
					<div className="rfe-actions">
						<Button size="sm" variant="primary" onClick={addPasted} disabled={pasted.length === 0}>
							{pastedRows ? `Add ${pastedRows} ingredient${pastedRows === 1 ? "" : "s"}` : "Add"}
						</Button>
						<Button
							size="sm"
							variant="ghost"
							onClick={() => {
								setPasteText("");
								setPasteOpen(false);
							}}
						>
							Cancel
						</Button>
					</div>
				</div>
			)}
		</div>
	);
}

/* --------------------------------- steps ---------------------------------- */

/** Media library item -> the same value the built-in image field stores. */
function mediaToImageValue(item: MediaItem): ImageValue {
	const m = item as unknown as Record<string, unknown> & { meta?: Record<string, unknown> };
	const provider = typeof m.provider === "string" && m.provider ? m.provider : "local";
	const isLocal = provider === "local";
	const isDirectUrl = provider === "external";
	const value: ImageValue = {
		id: String(m.id),
		provider,
		src: isDirectUrl ? (m.url as string | undefined) : undefined,
		previewUrl: !isLocal && !isDirectUrl ? (m.url as string | undefined) : undefined,
		alt: (m.alt as string | undefined) || "",
		caption: (m.caption as string | undefined) ?? undefined,
		width: m.width,
		height: m.height,
		focalX: m.focalX ?? undefined,
		focalY: m.focalY ?? undefined,
		filename: m.filename,
		mimeType: m.mimeType,
		blurhash: m.blurhash ?? undefined,
		dominantColor: m.dominantColor ?? undefined,
		meta: isLocal ? { ...(m.meta ?? {}), storageKey: m.storageKey } : m.meta,
	};
	for (const k of Object.keys(value)) if (value[k] === undefined) delete value[k];
	return value;
}

function thumbnailUrl(image: ImageValue | undefined): string | null {
	if (!image) return null;
	if (image.src) return image.src;
	const key = image.meta?.storageKey;
	if (typeof key === "string" && key) return `/_emdash/api/media/file/${encodeURIComponent(key)}`;
	return image.previewUrl ?? null;
}

function StepsField({ value, onChange, label, id }: FieldWidgetProps) {
	const [lines, setLines] = useLines<StepRow>(value, onChange);
	const focusAfterRender = useFocusAfterRender();
	const [pickerFor, setPickerFor] = React.useState<number | null>(null);

	const setRow = (index: number, patch: Partial<StepRow>) => {
		const next = [...lines];
		const line = next[index];
		if (line?.kind !== "row") return;
		const data = { ...line.data, ...patch };
		if (patch.image === undefined && "image" in patch) delete data.image;
		next[index] = { ...line, data };
		setLines(next);
	};
	const insertRow = (at: number) => {
		const key = newKey();
		const next = [...lines];
		next.splice(at, 0, { key, kind: "row", data: {} });
		setLines(next);
		focusAfterRender(`${key}:instruction`);
	};
	const addHeading = () => {
		const key = newKey();
		setLines([...lines, { key, kind: "heading", text: "" }]);
		focusAfterRender(`${key}:heading`);
	};
	const remove = (index: number) => setLines(lines.filter((_, i) => i !== index));
	const move = (index: number, delta: number) => setLines(moveLine(lines, index, delta));

	let stepNumber = 0;

	return (
		<div className="rfe rfe-steps" id={id} role="group" aria-labelledby={`${id}-label`}>
			<Styles />
			<div className="rfe-top">
				<span id={`${id}-label`} className="rfe-label">
					{label}
				</span>
				<span className="rfe-hint">Steps are numbered automatically. Photos are optional.</span>
			</div>

			<div className="rfe-scroll">
				<div className="rfe-table">
					{lines.length === 0 && <div className="rfe-empty">No steps yet. Add the first one below.</div>}
					{lines.map((line, index) => {
						if (line.kind === "heading") {
							return (
								<HeadingLine
									key={line.key}
									text={line.text}
									index={index}
									count={lines.length}
									focusKey={`${line.key}:heading`}
									onText={(text) => {
										const next = [...lines];
										next[index] = { ...line, text };
										setLines(next);
									}}
									onMove={(d) => move(index, d)}
									onRemove={() => remove(index)}
								/>
							);
						}
						stepNumber += 1;
						const n = stepNumber;
						const thumb = thumbnailUrl(line.data.image);
						return (
							<div className="rfe-row" key={line.key} role="group" aria-label={`Step ${n}`}>
								<span className="rfe-num" aria-hidden="true">
									{n}.
								</span>
								<InputArea
									size="sm"
									rows={2}
									value={line.data.instruction ?? ""}
									aria-label={`Step ${n}`}
									data-rfe-focus={`${line.key}:instruction`}
									onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setRow(index, { instruction: e.target.value })}
								/>
								<div className="rfe-photo">
									{thumb ? (
										<>
											<img src={thumb} alt={line.data.image?.alt || `Photo for step ${n}`} />
											<div className="rfe-photo-actions">
												<button type="button" className="rfe-link" onClick={() => setPickerFor(index)}>
													Change
												</button>
												<button type="button" className="rfe-link" onClick={() => setRow(index, { image: undefined })}>
													Remove
												</button>
											</div>
										</>
									) : (
										<button type="button" className="rfe-link" onClick={() => setPickerFor(index)}>
											+ Photo
										</button>
									)}
								</div>
								<RowControls
									index={index}
									count={lines.length}
									label={`step ${n}`}
									onMove={(d) => move(index, d)}
									onRemove={() => remove(index)}
								/>
							</div>
						);
					})}
				</div>
			</div>

			<div className="rfe-actions">
				<Button size="sm" variant="secondary" onClick={() => insertRow(lines.length)}>
					+ Add step
				</Button>
				<Button size="sm" variant="ghost" onClick={addHeading}>
					+ Add group heading
				</Button>
			</div>

			<MediaPickerModal
				open={pickerFor !== null}
				onOpenChange={(open: boolean) => {
					if (!open) setPickerFor(null);
				}}
				onSelect={(item: MediaItem) => {
					if (pickerFor !== null) setRow(pickerFor, { image: mediaToImageValue(item) });
					setPickerFor(null);
				}}
				mediaKind="image"
				title="Choose a step photo"
			/>
		</div>
	);
}

/** Field widgets, referenced from the schema as "recipe-editor:<name>". */
export const fields = {
	ingredients: IngredientsField,
	steps: StepsField,
};
