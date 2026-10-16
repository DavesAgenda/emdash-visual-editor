import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import { defineConfig } from "astro/config";
import emdash from "emdash/astro";
import { d1, r2 } from "@emdash-cms/cloudflare";
import { readdirSync, existsSync } from "node:fs";

// One EmDash plugin per section type: every folder in src/sections with a plugin.ts.
const sectionsDir = new URL("./src/sections/", import.meta.url);
const sectionPlugins = readdirSync(sectionsDir, { withFileTypes: true })
	.filter((d) => d.isDirectory() && existsSync(new URL(`${d.name}/plugin.ts`, sectionsDir)))
	.map((d) => ({ id: `section-${d.name.replace(/_/g, "-")}`, version: "1.0.0", format: "native", entrypoint: new URL(`${d.name}/plugin.ts`, sectionsDir).pathname }));

export default defineConfig({
	output: "server",
	adapter: cloudflare(),
	integrations: [
		react(),
		emdash({
			plugins: [
				// The Visual editor: a trusted admin page at /_emdash/admin/plugins/visual-editor/
				{
					id: "visual-editor", version: "1.0.0", format: "native",
					entrypoint: new URL("./src/plugins/visual-editor/index.ts", import.meta.url).pathname,
					adminEntry: new URL("./src/plugins/visual-editor/admin.tsx", import.meta.url).pathname,
					adminPages: [{ path: "/", label: "Visual editor", icon: "paint-brush" }],
				},
				...sectionPlugins,
			],
			database: d1({ binding: "DB", session: "auto" }),
			// Image uploads need an R2 bucket. Add the MEDIA binding in wrangler.jsonc and build with R2=1.
			...(process.env.R2 === "1" ? { storage: r2({ binding: "MEDIA" }) } : {}),
		}),
	],
	devToolbar: { enabled: false },
	// Section CSS/JS is linked by URL (only on pages that use it), so never inline it.
	vite: { build: { assetsInlineLimit: 0 } },
});
