/**
 * Recognise links to videos/posts on YouTube, TikTok, Instagram, and
 * Facebook, for VideoCard. Pure module (unit-tested in video.test.ts).
 *
 * Only links to a specific video or post are recognised; profile/page links
 * return null so they render as ordinary links.
 */
import { getYouTubeId, getYouTubeStart } from "./youtube.ts";

export type VideoPlatform = "youtube" | "tiktok" | "instagram" | "facebook";

export interface VideoLink {
	platform: VideoPlatform;
	/** "video" for videos/reels/shorts, "post" for photo posts. Drives the wording. */
	kind: "video" | "post";
	/** The URL the card opens (cleaned up for YouTube; otherwise as given). */
	href: string;
	/** YouTube video ID (thumbnail + oEmbed). */
	youtubeId?: string;
	/** Creator handle when the URL contains one ("@lifeatthenest"). */
	handle?: string;
}

export const PLATFORM_NAMES: Record<VideoPlatform, string> = {
	youtube: "YouTube",
	tiktok: "TikTok",
	instagram: "Instagram",
	facebook: "Facebook",
};

function parseUrl(input: string | null | undefined): URL | null {
	if (!input) return null;
	try {
		const url = new URL(input.trim());
		return url.protocol === "https:" || url.protocol === "http:" ? url : null;
	} catch {
		return null;
	}
}

const segmentsOf = (url: URL) => url.pathname.split("/").filter(Boolean);

function tiktok(url: URL, host: string): VideoLink | null {
	const href = url.toString();
	// Short share links: vm.tiktok.com/XXXX, vt.tiktok.com/XXXX, tiktok.com/t/XXXX
	if ((host === "vm.tiktok.com" || host === "vt.tiktok.com") && segmentsOf(url).length) {
		return { platform: "tiktok", kind: "video", href };
	}
	if (host !== "tiktok.com" && host !== "m.tiktok.com") return null;
	const seg = segmentsOf(url);
	if (seg[0] === "t" && seg[1]) return { platform: "tiktok", kind: "video", href };
	// /@user/video/123 or /@user/photo/123
	if (seg[0]?.startsWith("@") && /^\d+$/.test(seg[2] ?? "")) {
		const handle = seg[0].length > 1 ? seg[0] : undefined;
		if (seg[1] === "video") return { platform: "tiktok", kind: "video", href, handle };
		if (seg[1] === "photo") return { platform: "tiktok", kind: "post", href, handle };
	}
	return null;
}

function instagram(url: URL, host: string): VideoLink | null {
	if (host !== "instagram.com" && host !== "m.instagram.com") return null;
	const seg = segmentsOf(url);
	// /p/CODE, /reel/CODE, /reels/CODE, /tv/CODE — optionally after /username/
	const i = seg.findIndex((s) => ["p", "reel", "reels", "tv"].includes(s));
	if (i < 0 || i > 1 || !seg[i + 1]) return null;
	const handle = i === 1 ? `@${seg[0]}` : undefined;
	return { platform: "instagram", kind: seg[i] === "p" ? "post" : "video", href: url.toString(), handle };
}

function facebook(url: URL, host: string): VideoLink | null {
	const href = url.toString();
	if (host === "fb.watch") return segmentsOf(url).length ? { platform: "facebook", kind: "video", href } : null;
	if (!["facebook.com", "m.facebook.com", "web.facebook.com", "fb.com"].includes(host)) return null;
	const seg = segmentsOf(url);
	if (seg[0] === "watch" && url.searchParams.get("v")) return { platform: "facebook", kind: "video", href };
	if (seg[0] === "reel" && seg[1]) return { platform: "facebook", kind: "video", href };
	if (seg[0] === "share" && seg[2]) {
		if (seg[1] === "v" || seg[1] === "r") return { platform: "facebook", kind: "video", href };
		if (seg[1] === "p") return { platform: "facebook", kind: "post", href };
		return null;
	}
	// /videos/123, /{page}/videos/123, /{page}/videos/title/123
	if (seg.includes("videos") && /^\d+$/.test(seg[seg.length - 1] ?? "")) {
		const handle = seg[1] === "videos" ? seg[0] : undefined;
		return { platform: "facebook", kind: "video", href, handle };
	}
	// /{page}/posts/...
	if (seg[1] === "posts" && seg[2]) return { platform: "facebook", kind: "post", href, handle: seg[0] };
	return null;
}

/** Recognise a video/post link, or null if it isn't one we can make a card for. */
export function parseVideoLink(input: string | null | undefined): VideoLink | null {
	const youtubeId = getYouTubeId(input);
	if (youtubeId) {
		const start = getYouTubeStart(input);
		return {
			platform: "youtube",
			kind: "video",
			youtubeId,
			href: `https://www.youtube.com/watch?v=${youtubeId}${start ? `&t=${start}s` : ""}`,
		};
	}
	const url = parseUrl(input);
	if (!url) return null;
	const host = url.hostname.toLowerCase().replace(/^www\./, "");
	return tiktok(url, host) ?? instagram(url, host) ?? facebook(url, host);
}

/** An uploaded image field value (EmDash media); rendered with <Image>. */
export type VideoThumbnail = { id: string } & Record<string, unknown>;

export interface VideoEntry {
	url: string;
	title?: string;
	/** Uploaded thumbnail; overrides YouTube's or fills the branded panel. */
	image?: VideoThumbnail;
}

/**
 * The videos to show for an entry: the `videos` repeater (link + optional
 * title + optional thumbnail per row), falling back to the older single `video_url` field so
 * entries keep working while the content type is migrated. Blank rows and
 * repeated links are skipped.
 */
export function videoEntries(data: unknown): VideoEntry[] {
	const d = (data && typeof data === "object" ? data : {}) as { videos?: unknown; video_url?: unknown };
	const rows = Array.isArray(d.videos) ? d.videos : [];
	const out: VideoEntry[] = [];
	const seen = new Set<string>();
	const add = (url: unknown, title?: unknown, image?: unknown) => {
		if (typeof url !== "string" || !url.trim() || seen.has(url.trim())) return;
		seen.add(url.trim());
		const entry: VideoEntry = { url: url.trim() };
		const t = typeof title === "string" ? title.trim() : "";
		if (t) entry.title = t;
		if (image && typeof image === "object" && typeof (image as { id?: unknown }).id === "string") {
			entry.image = image as VideoThumbnail;
		}
		out.push(entry);
	};
	for (const row of rows) {
		if (row && typeof row === "object") {
			const r = row as Record<string, unknown>;
			add(r.url, r.title, r.image);
		}
	}
	if (!out.length) add(d.video_url);
	return out;
}
