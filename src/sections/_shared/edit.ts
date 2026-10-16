// Editing markers for fields inside a page block.
//  - EmDash edit mode: data-emdash-ref (content.<key>.<field>) so a click opens the classic editor at that field.
//  - Visual editor frame (?vx_frame=1 on a signed draft-preview URL): data-vx-f="<key>.<field>" so the
//    Visual editor can highlight, select and live-patch fields. Public pages get neither.
const defs = import.meta.glob<any>("../*/section.json", { eager: true, import: "default" });
const FIRST: Record<string, string> = {};
export const LABEL: Record<string, string> = {};
for (const d of Object.values(defs)) {
	const bt = d?.blockType; const v = bt?.versions?.find((x: any) => x.version === bt.currentVersion) ?? bt?.versions?.at(-1);
	if (bt?.slug && v?.fields?.[0]) FIRST[bt.slug] = v.fields[0].slug;
	if (bt?.slug) LABEL[bt.slug] = bt.label;
}
export function ed(locals: any, v: any, field?: string, type?: string): Record<string, string> {
	if (!v?._key) return {};
	const f = field ?? FIRST[type ?? v._type]; if (!f) return {};
	const out: Record<string, string> = {};
	const e = locals?.vxEdit;
	if (e) Object.assign(out, (e[`content.${v._key}.${f}`] as Record<string, string>) ?? {});
	if (locals?.vxFrame && field) out["data-vx-f"] = `${v._key}.${f}`;
	return out;
}
/** Section-root attributes for the Visual editor frame. */
export function veSection(locals: any, v: any, type: string): Record<string, string> {
	if (!locals?.vxFrame || !v?._key) return {};
	return { "data-vx-key": v._key, "data-vx-label": LABEL[type] || type };
}
