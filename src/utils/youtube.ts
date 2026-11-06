const YOUTUBE_ID = /^[a-zA-Z0-9_-]{11}$/;

/**
 * Extract a YouTube video ID from any of the common URL shapes:
 * watch?v=, youtu.be/, /embed/, /shorts/, /live/, youtube-nocookie.com.
 * Returns null for anything that isn't a YouTube video link.
 */
export function getYouTubeId(input: string | null | undefined): string | null {
	if (!input) return null;
	let url: URL;
	try {
		url = new URL(input.trim());
	} catch {
		return null;
	}
	const host = url.hostname.replace(/^(www\.|m\.|music\.)/, "");
	let id: string | null = null;

	if (host === "youtu.be") {
		id = url.pathname.slice(1).split("/")[0] ?? null;
	} else if (host === "youtube.com" || host === "youtube-nocookie.com") {
		if (url.pathname === "/watch") {
			id = url.searchParams.get("v");
		} else {
			const match = url.pathname.match(/^\/(?:embed|shorts|live|v)\/([^/?#]+)/);
			id = match?.[1] ?? null;
		}
	}

	return id && YOUTUBE_ID.test(id) ? id : null;
}

/** Start time in seconds from ?t= / ?start= (accepts "90", "90s", "1m30s"). */
export function getYouTubeStart(input: string | null | undefined): number {
	if (!input) return 0;
	try {
		const url = new URL(input.trim());
		const raw = url.searchParams.get("t") ?? url.searchParams.get("start");
		if (!raw) return 0;
		if (/^\d+$/.test(raw)) return Number(raw);
		const m = raw.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
		if (!m) return 0;
		return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
	} catch {
		return 0;
	}
}
