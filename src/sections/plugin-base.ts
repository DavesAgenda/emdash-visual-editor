// Shared factory for section plugins. A section plugin owns one page-block type: its fields
// (section.json), its component and assets (index.ts). EmDash 1.1 plugins cannot register block
// types at runtime (block types come from the seed or the schema API), so scripts/mkseed.py
// collects every section.json into the seed. The plugin exposes its definition for tools.
import { definePlugin } from "emdash";
export const pluginIdFor = (slug: string) => `section-${slug.replace(/_/g, "-")}`;
export function defineSectionPlugin(slug: string, def: any, extra: Record<string, any> = {}) {
	return definePlugin({
		id: pluginIdFor(slug), version: "1.0.0", capabilities: [],
		...extra,
		routes: {
			definition: { permission: "content:read", handler: async () => ({ blockType: def.blockType, optionLabels: Object.fromEntries(Object.entries(def.optionValues || {}).map(([k, m]: any) => [k, Object.keys(m)])) }) },
			...(extra.routes || {}),
		},
	} as any);
}
