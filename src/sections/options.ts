// Editors see human option labels ("Soft tint", "Heading above the questions"); components work with
// short internal values ("muted", "stacked"). This maps one to the other using each section.json.
// Pure TS (JSON only), so other plugins can use it too.
const defs = import.meta.glob<{ default: { blockType: { slug: string }; optionValues: Record<string, Record<string, string>> } }>("./*/section.json", { eager: true });
const MAPS: Record<string, Record<string, Record<string, string>>> = {};
for (const m of Object.values(defs)) MAPS[m.default.blockType.slug] = m.default.optionValues || {};
const one = (map: Record<string, string>, v: unknown) => (typeof v === "string" && v in map ? map[v] : v);
export function normalizeBlock<T extends Record<string, any>>(b: T): T {
	const maps = b && MAPS[b._type]; if (!maps) return b;
	const out: Record<string, any> = { ...b };
	for (const [field, map] of Object.entries(maps)) {
		const v = out[field];
		out[field] = Array.isArray(v) ? v.map((x) => one(map, x)) : one(map, v);
	}
	return out as T;
}
export const normalizeBlocks = (blocks: unknown): any[] => (Array.isArray(blocks) ? blocks.map((b) => normalizeBlock(b)) : []);
