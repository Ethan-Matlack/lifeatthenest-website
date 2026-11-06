/**
 * Shows a "Local test copy" pill in the EmDash admin while running `astro dev`,
 * so local edits aren't mistaken for live ones. In a production build
 * `import.meta.env.DEV` is false and this module does nothing.
 *
 * There is no admin slot for a global banner, so this adds one fixed element
 * to the page when the admin loads this module. It ignores clicks (they pass
 * through to whatever is underneath).
 */
const ID = "local-notice-pill";

if (import.meta.env.DEV && typeof document !== "undefined" && !document.getElementById(ID)) {
	const pill = document.createElement("div");
	pill.id = ID;
	pill.setAttribute("role", "note");
	pill.textContent = "Local test copy · changes here never reach the live site";
	Object.assign(pill.style, {
		position: "fixed",
		left: "50%",
		bottom: "12px",
		transform: "translateX(-50%)",
		zIndex: "2147483000",
		padding: "6px 14px",
		borderRadius: "999px",
		background: "#f6d77a",
		color: "#3d3000",
		font: "600 13px/1.3 system-ui, sans-serif",
		boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
		pointerEvents: "none",
		whiteSpace: "nowrap",
	});
	const attach = () => document.body.appendChild(pill);
	if (document.body) attach();
	else document.addEventListener("DOMContentLoaded", attach, { once: true });
}

export {};
