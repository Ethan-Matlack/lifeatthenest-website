// Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseVideoLink, videoEntries } from "./video.ts";

const kind = (url: string) => {
	const v = parseVideoLink(url);
	return v ? `${v.platform}:${v.kind}` : null;
};

test("YouTube links keep working, with a clean watch URL and start time", () => {
	assert.deepEqual(parseVideoLink("https://youtu.be/jNQXAC9IVRw?t=90"), {
		platform: "youtube",
		kind: "video",
		youtubeId: "jNQXAC9IVRw",
		href: "https://www.youtube.com/watch?v=jNQXAC9IVRw&t=90s",
	});
	assert.equal(kind("https://www.youtube.com/shorts/jNQXAC9IVRw"), "youtube:video");
});

test("TikTok videos, photo posts, and short links", () => {
	assert.equal(kind("https://www.tiktok.com/@lifeatthenest/video/7301234567890123456"), "tiktok:video");
	assert.equal(kind("https://www.tiktok.com/@lifeatthenest/photo/7301234567890123456"), "tiktok:post");
	assert.equal(kind("https://vm.tiktok.com/ZMabc123/"), "tiktok:video");
	assert.equal(kind("https://www.tiktok.com/t/ZTabc123/"), "tiktok:video");
	assert.equal(kind("https://www.tiktok.com/@lifeatthenest"), null, "profile links are not cards");
});

test("Instagram reels and posts", () => {
	assert.equal(kind("https://www.instagram.com/reel/C1a2b3c4d5e/"), "instagram:video");
	assert.equal(kind("https://www.instagram.com/reels/C1a2b3c4d5e/"), "instagram:video");
	assert.equal(kind("https://www.instagram.com/p/C1a2b3c4d5e/?igsh=abc"), "instagram:post");
	assert.equal(kind("https://www.instagram.com/life_at_the_nest/reel/C1a2b3c4d5e/"), "instagram:video");
	assert.equal(kind("https://www.instagram.com/life_at_the_nest/"), null);
});

test("Facebook videos, reels, share links, and posts", () => {
	assert.equal(kind("https://www.facebook.com/watch/?v=1234567890"), "facebook:video");
	assert.equal(kind("https://www.facebook.com/reel/1234567890"), "facebook:video");
	assert.equal(kind("https://www.facebook.com/lifeatthenest/videos/1234567890/"), "facebook:video");
	assert.equal(kind("https://fb.watch/abcDEF123/"), "facebook:video");
	assert.equal(kind("https://www.facebook.com/share/v/1AbCdEf/"), "facebook:video");
	assert.equal(kind("https://www.facebook.com/share/r/1AbCdEf/"), "facebook:video");
	assert.equal(kind("https://www.facebook.com/share/p/1AbCdEf/"), "facebook:post");
	assert.equal(kind("https://www.facebook.com/lifeatthenest/posts/pfbid0abc"), "facebook:post");
	assert.equal(kind("https://www.facebook.com/lifeatthenest"), null);
});

test("creator handle comes from the URL when present", () => {
	assert.equal(parseVideoLink("https://www.tiktok.com/@lifeatthenest/video/7301234567890123456")?.handle, "@lifeatthenest");
	assert.equal(parseVideoLink("https://www.instagram.com/life_at_the_nest/reel/C1a2b3c4d5e/")?.handle, "@life_at_the_nest");
	assert.equal(parseVideoLink("https://www.instagram.com/reel/C1a2b3c4d5e/")?.handle, undefined);
	assert.equal(parseVideoLink("https://www.facebook.com/lifeatthenest/videos/1234567890/")?.handle, "lifeatthenest");
	assert.equal(parseVideoLink("https://vm.tiktok.com/ZMabc123/")?.handle, undefined);
});

test("anything else is not a card", () => {
	for (const url of ["", "not a url", "https://example.com/video/1", "javascript:alert(1)", "https://vimeo.com/123"]) {
		assert.equal(parseVideoLink(url), null, url);
	}
});

test("videoEntries reads the repeater, skipping blanks and duplicates", () => {
	assert.deepEqual(
		videoEntries({
			videos: [
				{ url: " https://youtu.be/jNQXAC9IVRw ", title: "  Zoo  " },
				{ url: "" },
				{ url: "https://youtu.be/jNQXAC9IVRw" },
				{ url: "https://www.instagram.com/reel/C1a2b3c4d5e/", title: "" },
				null,
			],
		}),
		[
			{ url: "https://youtu.be/jNQXAC9IVRw", title: "Zoo" },
			{ url: "https://www.instagram.com/reel/C1a2b3c4d5e/" },
		],
	);
});

test("videoEntries passes an uploaded thumbnail through, ignoring empty ones", () => {
	const image = { id: "01ABC", provider: "local", meta: { storageKey: "01ABC.jpg" } };
	assert.deepEqual(videoEntries({ videos: [{ url: "https://fb.watch/x/", image }] }), [
		{ url: "https://fb.watch/x/", image },
	]);
	assert.deepEqual(videoEntries({ videos: [{ url: "https://fb.watch/x/", image: null }] }), [{ url: "https://fb.watch/x/" }]);
	assert.deepEqual(videoEntries({ videos: [{ url: "https://fb.watch/x/", image: {} }] }), [{ url: "https://fb.watch/x/" }]);
});

test("videoEntries falls back to the old single video_url field", () => {
	assert.deepEqual(videoEntries({ video_url: "https://youtu.be/jNQXAC9IVRw" }), [{ url: "https://youtu.be/jNQXAC9IVRw" }]);
	assert.deepEqual(videoEntries({ videos: [], video_url: "https://youtu.be/jNQXAC9IVRw" }).length, 1);
	assert.deepEqual(
		videoEntries({ videos: [{ url: "https://fb.watch/x/" }], video_url: "https://youtu.be/jNQXAC9IVRw" }),
		[{ url: "https://fb.watch/x/" }],
		"the list wins once it has rows",
	);
	assert.deepEqual(videoEntries(null), []);
	assert.deepEqual(videoEntries({}), []);
});
