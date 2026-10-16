// Section registry: every folder in src/sections is one section type, shipped by its own EmDash plugin
// (plugin.ts) and rendered by its own component (index.ts). Nothing here needs editing to add a section.
import { defineBlockComponents } from "emdash/ui";
import type { SectionModule } from "./types";
export { normalizeBlocks } from "./options";
const mods = import.meta.glob<{ default: SectionModule }>("./*/index.ts", { eager: true });
export const SECTIONS: SectionModule[] = Object.values(mods).map((m) => m.default);
const BY = Object.fromEntries(SECTIONS.map((s) => [s.slug, s]));
export const blockComponents = defineBlockComponents<any>(Object.fromEntries(SECTIONS.map((s) => [s.slug, s.Component])));
export const BLOCK_TYPES = SECTIONS.map((s) => s.slug);
/** CSS/JS for the blocks on one page (normalised values). Assets load only on pages that use them. */
export function pageAssets(blocks: any[]) {
	const css = new Set<string>(), js = new Set<string>(), types = new Set<string>(); let all = false, headerSwitch = false;
	for (const b of blocks) {
		const s = BY[b?._type]; if (!s) continue;
		const a = s.assets(b); a.css.forEach((x) => css.add(x)); a.js.forEach((x) => js.add(x)); types.add(b._type);
		if (s.allFonts) all = true;
	}
	return { css: [...css], js: [...js], fonts: (all ? "all" : "theme") as "all" | "theme", headerSwitch, types: [...types] };
}
