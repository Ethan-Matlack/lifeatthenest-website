/**
 * Editable heading + intro for route pages (Blog, Recipes, Shop, Contact).
 *
 * Each listing has a matching entry in Pages whose slug equals the route
 * ("posts", "recipes", "shop", "contact"). Astro's real route files take precedence
 * over the catch-all [slug] page, so these entries never render on their
 * own; the listing page reads their title, content, and SEO fields instead.
 * If the entry is missing or unpublished, the built-in fallback is used.
 */
import { getEmDashEntry } from "emdash";
import { toPlainText } from "./portable-text";

export interface ListingFallback {
	title: string;
	intro: string;
}

export async function getListingPage(slug: string, fallback: ListingFallback) {
	const { entry, cacheHint } = await getEmDashEntry("pages", slug);
	const content = Array.isArray(entry?.data.content) && entry.data.content.length > 0 ? entry.data.content : null;
	const introText = toPlainText(content).trim();
	return {
		entry,
		cacheHint,
		title: entry?.data.title?.trim() || fallback.title,
		/** Rich intro from the page, or null to show the fallback text */
		content,
		/** Plain-text intro for meta descriptions */
		introText: introText || fallback.intro,
		fallbackIntro: fallback.intro,
	};
}
