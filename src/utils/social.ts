/**
 * Profile handle from a social URL, for display:
 *   https://www.instagram.com/life_at_the_nest/ -> @life_at_the_nest
 *   https://www.tiktok.com/@life_at_the_nest     -> @life_at_the_nest
 *   https://www.facebook.com/lifeatthenest       -> lifeatthenest
 * Returns "" when there's nothing sensible to show.
 */
export function socialHandle(href: string): string {
	let url: URL;
	try {
		url = new URL(href);
	} catch {
		return "";
	}
	const first = url.pathname.split("/").filter(Boolean)[0] ?? "";
	if (!first || ["channel", "c", "user", "pages", "profile.php"].includes(first)) return "";
	const host = url.hostname.replace(/^www\./, "");
	if (first.startsWith("@")) return first;
	return host.endsWith("facebook.com") ? first : `@${first}`;
}
