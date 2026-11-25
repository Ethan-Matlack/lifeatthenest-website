/**
 * Image "slots": the shape and largest on-screen width of each place a photo
 * appears, plus a `sizes` attribute that matches the CSS layout.
 *
 * Passing `width`/`height` to EmDash's <Image> does three things:
 *  - Cloudflare crops to the slot's shape (fit=cover), so a 4:3 tile no
 *    longer downloads a portrait original and hides half of it;
 *  - the srcset offers `width`, 2x `width`, and EmDash's standard widths in
 *    between (640, 750, 828, 960, ...), so small slots get small files;
 *  - fewer distinct sizes per photo means fewer Cloudflare transformations.
 * `sizes` tells the browser how wide the slot really is, so it picks the
 * right file from that srcset (e.g. half-width tiles on phones).
 *
 * When a layout changes, update its slot here.
 */

/** An image field value, or a plain URL string (which has no dimensions). */
type ImageLike = { width?: number | null; height?: number | null } | string | null | undefined;

export interface Slot {
	/** Largest CSS width the image is shown at, in px (1x). */
	width: number;
	/** Shape to crop to (width / height); omit to keep the photo's own shape. */
	aspect?: number;
	sizes: string;
}

export const SLOTS = {
	/** Recipe grids: 2 across on phones, auto-fill (~15-18rem) above. */
	recipeTile: {
		width: 320,
		aspect: 4 / 3,
		sizes: "(min-width: 80rem) 18rem, (min-width: 56rem) 31vw, (min-width: 40rem) 46vw, 48vw",
	},
	/** Post grids: 1 across on phones, 2 on tablets, 3 on desktop (~24rem). */
	postTile: {
		width: 400,
		aspect: 4 / 3,
		sizes: "(min-width: 75rem) 24rem, (min-width: 62rem) 32vw, (min-width: 40rem) 48vw, 100vw",
	},
	/** Seasonal mosaic recipe tile (can widen, photo beside text). */
	mosaicRecipe: { width: 480, aspect: 4 / 3, sizes: "(min-width: 40rem) 30rem, 100vw" },
	/** Seasonal mosaic story tile (about twice a recipe's width). */
	mosaicPost: { width: 560, aspect: 4 / 3, sizes: "(min-width: 64rem) 35rem, (min-width: 40rem) 60vw, 100vw" },

	/** Homepage welcome arch: 16rem phones, up to 30rem tablets, 23rem desktop. */
	homeHero: {
		width: 480,
		aspect: 4 / 5,
		sizes: "(min-width: 56rem) 23rem, (min-width: 44rem) min(45vw, 30rem), min(70vw, 16rem)",
	},
	/** Homepage "Meet Audra" arch. */
	homeAbout: {
		width: 420,
		aspect: 4 / 5,
		sizes: "(min-width: 56rem) 26rem, (min-width: 44rem) 40vw, min(70vw, 16rem)",
	},
	/** Recipe page hero photo (3:2, at most 30rem). */
	recipeHero: { width: 480, aspect: 3 / 2, sizes: "(min-width: 34rem) 30rem, 100vw" },
	/** Post page hero: keeps the photo's shape, at most 60rem. */
	postHero: { width: 960, sizes: "(min-width: 64rem) 60rem, 100vw" },

	/** /seasonal cards, 3 across on desktop. */
	seasonalCard: {
		width: 400,
		aspect: 3 / 2,
		sizes: "(min-width: 64rem) 24rem, (min-width: 40rem) 46vw, 100vw",
	},
	/** The large featured card (photo column ~42rem). */
	seasonalFeatured: { width: 720, aspect: 3 / 2, sizes: "(min-width: 75rem) 42rem, (min-width: 48rem) 55vw, 100vw" },

	/** Shop and "Shop this" product cards: 2 across on phones. */
	product: { width: 260, aspect: 1, sizes: "(min-width: 40rem) 15rem, 46vw" },
	/** Recipe card shown inside a post (photo column ~11rem). */
	recipeFeature: { width: 176, aspect: 1, sizes: "(min-width: 40rem) 11rem, 32vw" },
	/** Custom video thumbnails (column ~18rem). */
	videoThumb: { width: 288, aspect: 4 / 3, sizes: "(min-width: 40rem) 18rem, 40vw" },
	/** Photos inside recipe steps (16rem, 4:3). */
	stepImage: { width: 256, aspect: 4 / 3, sizes: "16rem" },
	/** Previous/next post thumbnails (4.5rem square). */
	postNavThumb: { width: 72, aspect: 1, sizes: "4.5rem" },
} satisfies Record<string, Slot>;

/**
 * `width`, `height`, and `sizes` props for <Image> in this slot. With no
 * aspect, the height follows the photo's own shape (needs its dimensions;
 * without them, only `sizes` is returned and the original shape is used).
 */
export function slotProps(image: ImageLike, slot: Slot): { width?: number; height?: number; sizes: string } {
	const { width, aspect, sizes } = slot;
	if (aspect) return { width, height: Math.round(width / aspect), sizes };
	const w = typeof image === "object" ? image?.width : undefined;
	const h = typeof image === "object" ? image?.height : undefined;
	if (w && h && w > 0 && h > 0) return { width, height: Math.round((width * h) / w), sizes };
	return { sizes };
}
