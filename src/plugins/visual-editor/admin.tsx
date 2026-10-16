// Visual editor admin page (trusted plugin React export). Left: the draft page in a frame; right: the
// selected section's fields. Saves drafts with EmDash's content API (PUT), publishes with /publish.
import * as React from "react";
import PH from "../../sections/placeholders.json";
const { useEffect, useMemo, useRef, useState, useCallback } = React;

type Field = { slug: string; label: string; type: string; required?: boolean; defaultValue?: any; validation?: any };
type BlockType = { slug: string; label: string; description?: string; category?: string; version: number; fields: Field[] };
type Block = { _type: string; _key: string; _version?: number; [k: string]: any };

const API = "/_emdash/api";
// Every call times out (default 15 s) so nothing can hang on "Saving draft…".
async function api(path: string, init: RequestInit & { timeout?: number } = {}) {
	const ac = new AbortController(); const timer = setTimeout(() => ac.abort(), init.timeout ?? 15000);
	let res: Response;
	try { res = await fetch(API + path, { credentials: "same-origin", signal: ac.signal, ...init, headers: { "X-EmDash-Request": "1", ...(init.body ? { "Content-Type": "application/json" } : {}), ...(init.headers || {}) } }); }
	catch (e: any) { clearTimeout(timer); const err: any = new Error(e?.name === "AbortError" ? "TIMEOUT" : "NETWORK"); err.status = 0; throw err; }
	clearTimeout(timer);
	let body: any = null; try { body = await res.json(); } catch {}
	if (!res.ok || body?.success === false) { const e: any = new Error(body?.error?.message || body?.message || `HTTP ${res.status}`); e.status = res.status; throw e; }
	return body?.data ?? body;
}
const rid = () => Array.from(crypto.getRandomValues(new Uint8Array(9)), (b) => "abcdefghijkmnpqrstuvwxyz23456789"[b % 32]).join("").slice(0, 12);
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
const plain = (l: string) => String(l || "").replace(/\s*\((optional|from [^)]*|e\.g\.[^)]*)\)\s*/gi, " ").trim();
const ADV = /^(anchor_id|email_field)$/;
const isStyle = (f: Field) => ["select", "boolean", "integer", "number", "multiSelect"].includes(f.type);
const PATCHABLE = new Set(["string", "text"]);
// Required fields still empty in a section. Such a section stays out of the saved draft (EmDash would reject the
// whole save, freezing the preview for every other change) and shows as a "needs details" placeholder instead.
// Sample content (src/sections/placeholders.json) the customer hasn't replaced yet: flagged in the panel,
// counted in the status bar, and confirmed before publishing.
const PHRX = /sample|replace|your .+ here|placeholder|^feature (one|two|three)$| name( \d)?$|^role$|^\$?00$|connect-your-mailing-list|^a short sentence|^one short sentence|^a sentence or two|^book online$/i;
const leaves = (v: any, out: string[] = []): string[] => { if (typeof v === "string") out.push(v); else if (Array.isArray(v)) v.forEach((x) => leaves(x, out)); else if (v && typeof v === "object") Object.values(v).forEach((x) => leaves(x, out)); return out; };
const PHSET: Record<string, Record<string, Set<string>>> = {};
for (const [t, fs] of Object.entries(PH as any)) if (!t.startsWith("_")) { PHSET[t] = {}; for (const [k, v] of Object.entries(fs as any)) PHSET[t][k] = new Set(leaves(v).filter((x) => PHRX.test(x))); }
function sampleFields(b: Block): string[] {
	const m = PHSET[b._type]; if (!m) return [];
	return Object.keys(m).filter((k) => m[k].size && leaves(b[k]).some((x) => m[k].has(x)));
}
const empty = (v: any) => v === undefined || v === null || v === "" || (Array.isArray(v) && !v.length);
// A value EmDash would reject by pattern also blocks the whole save, so treat it like a missing field.
function bad(f: Field, v: any) { const p = f.validation?.pattern; if (!p || typeof v !== "string" || v === "") return false; try { return !new RegExp(p).test(v); } catch { return false; } }
function missing(b: Block, t?: BlockType): string[] {
	if (!t) return [];
	const out: string[] = [];
	for (const f of t.fields) {
		const v = b[f.slug];
		if (f.required && empty(v)) out.push(plain(f.label));
		if (bad(f, v)) out.push(plain(f.label) + " (a valid link)");
		const subs: Field[] = f.validation?.subFields || [];
		if (Array.isArray(v) && subs.length) v.forEach((it: any, i: number) => subs.forEach((sf) => { if (sf.required && empty(it?.[sf.slug])) out.push(`${plain(f.label)} ${i + 1}: ${plain(sf.label)}`); if (bad(sf, it?.[sf.slug])) out.push(`${plain(f.label)} ${i + 1}: ${plain(sf.label)} (a valid link)`); }));
	}
	return out;
}

const CSS = `
.vx{position:fixed;inset:0;z-index:60;display:flex;flex-direction:column;background:#eef0f3;font:14px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif;color:#111827}
.vx *{box-sizing:border-box}
.vx-top{height:56px;display:flex;align-items:center;gap:10px;padding:0 14px;background:#fff;border-bottom:1px solid #e5e7eb}
.vx-brand{font-weight:700;font-size:15px;margin-right:6px;white-space:nowrap}
.vx select,.vx input,.vx textarea{font:inherit;color:inherit}
.vx-btn{border:1px solid #d1d5db;background:#fff;border-radius:8px;padding:7px 12px;font-weight:600;cursor:pointer;white-space:nowrap;color:#111827;text-decoration:none;display:inline-flex;align-items:center;gap:6px}
.vx-btn:hover{background:#f9fafb}.vx-btn:disabled{opacity:.45;cursor:default}
.vx-btn.pri{background:#2563eb;border-color:#2563eb;color:#fff}.vx-btn.pri:hover{background:#1d4ed8}
.vx-btn.danger{color:#b91c1c}.vx-btn.ghost{border-color:transparent;background:transparent}
.vx-seg{display:inline-flex;border:1px solid #d1d5db;border-radius:8px;overflow:hidden}.vx-seg button{border:0;background:#fff;padding:7px 11px;cursor:pointer;font-weight:600}.vx-seg button.on{background:#111827;color:#fff}
.vx-status{font-size:13px;color:#6b7280;min-width:120px;text-align:right}
.vx-main{flex:1;display:flex;min-height:0}
.vx-stage{flex:1;display:flex;justify-content:center;align-items:stretch;padding:16px;min-width:0;overflow:auto}
.vx-frame{border:0;background:#fff;border-radius:10px;box-shadow:0 1px 3px rgba(0,0,0,.12),0 8px 30px rgba(0,0,0,.08);width:100%;height:100%;transition:width .25s}
.vx-frame.mobile{width:390px;max-width:100%}
.vx-panel{width:380px;flex:none;background:#fff;border-left:1px solid #e5e7eb;display:flex;flex-direction:column;min-height:0}
.vx-ph{padding:16px 18px 12px;border-bottom:1px solid #f0f1f3}
.vx-ph h2{margin:0;font-size:17px}.vx-ph p{margin:4px 0 0;color:#6b7280;font-size:13px}
.vx-tools{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px}.vx-tools .vx-btn{padding:5px 9px;font-size:13px}
.vx-body{flex:1;overflow:auto;padding:6px 18px 30px}
.vx-grp{margin-top:16px}.vx-grp>h3{font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#6b7280;margin:0 0 6px}
.vx-f{margin:12px 0}.vx-f.is-ph>label::after{content:"Sample";margin-left:8px;padding:1px 7px;border-radius:99px;background:#fef3c7;color:#92400e;font-size:11px;font-weight:600;vertical-align:1px}.vx-f>label{display:block;font-weight:600;margin-bottom:5px;font-size:13.5px}
.vx-f input[type=text],.vx-f input[type=url],.vx-f input[type=number],.vx-f textarea,.vx-f select{width:100%;border:1px solid #d1d5db;border-radius:8px;padding:8px 10px;background:#fff}
.vx-f textarea{min-height:84px;resize:vertical}
.vx-f input:focus,.vx-f textarea:focus,.vx-f select:focus{outline:2px solid #93c5fd;border-color:#2563eb}
.vx-f.flash input,.vx-f.flash textarea{animation:vxflash 1.2s}
@keyframes vxflash{0%{box-shadow:0 0 0 4px rgba(37,99,235,.35)}100%{box-shadow:none}}
.vx-tog{display:flex;align-items:center;justify-content:space-between;gap:10px}
.vx-sw{width:42px;height:24px;border-radius:12px;background:#d1d5db;position:relative;border:0;cursor:pointer;flex:none}.vx-sw.on{background:#2563eb}
.vx-sw::after{content:"";position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:50%;background:#fff;transition:left .15s}.vx-sw.on::after{left:21px}
.vx-img{display:flex;gap:10px;align-items:center}.vx-img img{width:72px;height:54px;object-fit:cover;border-radius:6px;border:1px solid #e5e7eb;background:#f3f4f6}
.vx-rep{border:1px solid #e5e7eb;border-radius:10px;margin:8px 0;padding:4px 12px 8px}.vx-rep-h{display:flex;justify-content:space-between;align-items:center;margin-top:6px;font-weight:600;font-size:13px;color:#374151}
.vx-empty{padding:40px 22px;color:#6b7280;text-align:center}.vx-empty b{display:block;color:#111827;font-size:16px;margin-bottom:6px}
.vx-outline{margin-top:14px;text-align:left}.vx-outline button{display:block;width:100%;text-align:left;border:1px solid #e5e7eb;background:#fff;border-radius:8px;padding:9px 11px;margin:6px 0;cursor:pointer}
.vx-outline button small{display:block;color:#6b7280;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.vx-modal{position:fixed;inset:0;background:rgba(17,24,39,.45);z-index:70;display:flex;align-items:center;justify-content:center;padding:24px}
.vx-card{background:#fff;border-radius:14px;max-width:880px;width:100%;max-height:86vh;overflow:auto;padding:22px;box-shadow:0 20px 60px rgba(0,0,0,.25)}
.vx-card h2{margin:0 0 4px}.vx-gal{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:12px;margin-top:14px}
.vx-gi{border:1px solid #e5e7eb;border-radius:12px;padding:0;background:#fff;cursor:pointer;text-align:left;overflow:hidden}.vx-gi:hover{border-color:#2563eb;box-shadow:0 0 0 3px rgba(37,99,235,.15)}
.vx-gi .th{height:92px;background:linear-gradient(135deg,#eef2ff,#f8fafc);display:flex;align-items:center;justify-content:center;padding:10px}
.vx-gi .tx{padding:10px 12px}.vx-gi b{display:block}.vx-gi span{display:block;color:#6b7280;font-size:12.5px;margin-top:3px}
.vx-cat{margin-top:18px;font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#6b7280}
.vx-media{display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:8px;margin-top:10px}.vx-media button{border:1px solid #e5e7eb;border-radius:8px;padding:0;overflow:hidden;cursor:pointer;background:#f3f4f6;height:84px}.vx-media img{width:100%;height:100%;object-fit:cover}
.vx-err{background:#fef2f2;color:#991b1b;padding:8px 14px;font-size:13px;border-bottom:1px solid #fecaca}
`;

// Small wireframe thumbnails so the gallery is visual without per-site screenshots.
function Thumb({ t }: { t: string }) {
	const bar = (w: number, h = 6, o = 1) => <div style={{ width: `${w}%`, height: h, background: "#c7d2fe", borderRadius: 3, opacity: o, margin: "3px auto" }} />;
	const box = (n: number) => <div style={{ display: "flex", gap: 5, width: "100%" }}>{Array.from({ length: n }, (_, i) => <div key={i} style={{ flex: 1, height: 30, background: "#dbeafe", borderRadius: 4 }} />)}</div>;
	const k = t.replace(/_.*/, "");
	const m: Record<string, any> = {
		hero: <div style={{ width: "100%" }}>{bar(70, 10)}{bar(50)}{bar(22, 9, 0.7)}</div>,
		video: <div style={{ width: "70%", height: 52, background: "#c7d2fe", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", color: "#4f46e5" }}>▶</div>,
		gallery: box(3), team: box(3), services: box(3), feature: box(3), pricing: box(3), stats: box(4), testimonials: box(2), link: box(2), logo: box(5),
		faq: <div style={{ width: "100%" }}>{bar(90)}{bar(90)}{bar(90)}</div>,
		email: <div style={{ width: "100%" }}>{bar(50, 8)}<div style={{ display: "flex", gap: 5, justifyContent: "center" }}><div style={{ width: "55%", height: 14, border: "1px solid #a5b4fc", borderRadius: 4 }} /><div style={{ width: "22%", height: 14, background: "#6366f1", borderRadius: 4 }} /></div></div>,
		contact: <div style={{ width: "100%" }}>{bar(40, 8)}{bar(80, 12, 0.6)}{bar(80, 12, 0.6)}{bar(25, 10)}</div>,
		cta: <div style={{ width: "100%", background: "#6366f1", borderRadius: 6, padding: 8 }}><div style={{ width: "60%", height: 7, background: "#fff", borderRadius: 3, margin: "auto" }} /></div>,
		promo: <div style={{ display: "flex", gap: 6, width: "100%", border: "1px solid #c7d2fe", borderRadius: 6, padding: 6 }}><div style={{ width: 36, height: 28, background: "#c7d2fe", borderRadius: 4 }} /><div style={{ flex: 1 }}>{bar(80)}{bar(50)}</div></div>,
		brand: <div style={{ width: "100%" }}>{bar(45, 16)}{bar(60)}</div>,
		rich: <div style={{ width: "100%" }}>{bar(40, 8)}{bar(95, 4)}{bar(95, 4)}{bar(80, 4)}</div>,
		opening: <div style={{ width: "100%" }}>{bar(60, 5)}{bar(60, 5)}{bar(60, 5)}{bar(60, 5)}</div>,
		booking: <div style={{ width: "100%" }}>{bar(40, 8)}{bar(70, 30, 0.5)}</div>,
	};
	return m[k] || <div style={{ width: "100%" }}>{bar(60, 8)}{bar(85)}{bar(70)}</div>;
}

function fieldValueText(b: Block, bt?: BlockType) {
	for (const f of bt?.fields || []) { const v = b[f.slug]; if (typeof v === "string" && v.trim() && !/^(https?:|\/)/.test(v)) return v.trim(); }
	return "";
}

export function VisualEditor() {
	const qs = new URLSearchParams(location.search);
	const [pages, setPages] = useState<any[]>([]);
	const [pageId, setPageId] = useState<string | null>(qs.get("id"));
	const [item, setItem] = useState<any>(null);
	const [blocks, setBlocks] = useState<Block[]>([]);
	const [types, setTypes] = useState<Record<string, BlockType>>({});
	// ?field=content.<key>.<field> (from EmDash's toolbar "Open in admin") selects that section and field
	const qf = (qs.get("field") || "").split(".");
	const [sel, setSel] = useState<string | null>(qf[0] === "content" && qf[1] ? qf[1] : null);
	const [focusField, setFocusField] = useState<string | null>(qf[0] === "content" && qf[2] ? qf.slice(2).join(".") : null);
	const [status, setStatus] = useState<"saved" | "dirty" | "saving" | "error">("saved");
	const [err, setErr] = useState("");
	const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
	const [preview, setPreview] = useState("");
	const [frameN, setFrameN] = useState(0);
	const [gallery, setGallery] = useState<null | { at: number }>(null);
	const [confirmDel, setConfirmDel] = useState<string | null>(null);
	const [mediaFor, setMediaFor] = useState<null | ((v: any) => void)>(null);
	const [canPublish, setCanPublish] = useState(false);
	const [publishing, setPublishing] = useState(false);
	const [toast, setToast] = useState("");
	// EmDash edit lock: one editor at a time per page. null = unknown/not enabled
	const [lock, setLock] = useState<null | { held: boolean; who?: string }>(null);
	const lockTok = useRef(rid() + rid());
	const typesRef = useRef<Record<string, BlockType>>({}); typesRef.current = types;
	const hist = useRef<Block[][]>([]);
	const burst = useRef<string | null>(null);
	const saveT = useRef<any>(0);
	const frame = useRef<HTMLIFrameElement>(null);
	const scrollY = useRef(0);
	// A text field whose element isn't on the page yet (was empty): offer a manual refresh, never auto-reload.
	const [hidden, setHidden] = useState<string | null>(null);
	const latest = useRef<Block[]>([]);
	latest.current = blocks;

	// Load pages + block types
	useEffect(() => {
		(async () => {
			try {
				const [p, bt] = await Promise.all([api("/content/pages?limit=100"), api("/schema/block-types")]);
				const list = p.items || p || [];
				setPages(list);
				const map: Record<string, BlockType> = {};
				for (const t of bt.items || bt.blockTypes || bt || []) {
					const cur = t.currentVersion ?? t.current_version ?? 1;
					const v = (t.versions || []).find((x: any) => x.version === cur) || (t.versions || []).at?.(-1) || { fields: t.fields || [] };
					map[t.slug] = { slug: t.slug, label: t.label, description: t.description, category: t.category, version: cur, fields: v.fields || [] };
				}
				setTypes(map);
				if (!pageId) { const home = list.find((x: any) => x.slug === "home") || list[0]; if (home) setPageId(home.id); }
			} catch (e: any) { setErr(e.status === 403 ? "Your account can't edit pages. Ask the site owner to give you Editor access." : "Couldn't load your pages: " + e.message); }
		})();
	}, []);

	const loadPage = useCallback(async (id: string) => {
		try {
			const d = await api(`/content/pages/${encodeURIComponent(id)}`);
			const it = d.item || d;
			setItem(it);
			const c = Array.isArray(it?.data?.content) ? it.data.content : [];
			setBlocks(c); latest.current = c; hist.current = []; setStatus("saved");
			lastSent.current = JSON.stringify({ data: { content: c } }); changedSinceRefresh.current = false;
			setCanPublish(!!(it.draftRevisionId && it.draftRevisionId !== it.liveRevisionId) || it.status !== "published");
			const pv = await api(`/content/pages/${encodeURIComponent(id)}/preview-url`, { method: "POST", body: JSON.stringify({ expiresIn: "12h" }) });
			const u = new URL(pv.previewUrl || pv.url, location.origin); u.searchParams.set("vx_frame", "1");
			setPreview(u.pathname + u.search); setFrameN((n) => n + 1);
			const url = new URL(location.href); url.searchParams.set("id", id); history.replaceState(history.state, "", url);
			await takeLock(id, false);
		} catch (e: any) { setErr(e.status === 403 ? "You don't have permission to edit this page." : "Couldn't open this page: " + e.message); }
	}, []);
	const takeLock = async (id: string, takeover: boolean) => {
		try {
			const d = await api(`/content/pages/${encodeURIComponent(id)}/lock`, { method: "POST", body: JSON.stringify({ token: lockTok.current, ...(takeover ? { takeover: true } : {}) }) });
			if (d.enabled === false) { setLock(null); return true; }
			setLock({ held: !!d.heldByCaller, who: d.holder?.userName || "Someone" });
			return !!d.heldByCaller;
		} catch { return true; }
	};
	useEffect(() => { if (pageId) loadPage(pageId); }, [pageId]);
	// Heartbeat while open; release when leaving (same token, so other tabs of this account keep theirs)
	useEffect(() => {
		if (!item) return;
		const id = item.id;
		const t = setInterval(() => { if (lockRef.current?.held || lockRef.current === null) takeLock(id, false); }, 45000);
		const rel = () => { fetch(`${API}/content/pages/${encodeURIComponent(id)}/lock?token=${lockTok.current}`, { method: "DELETE", keepalive: true, credentials: "same-origin", headers: { "X-EmDash-Request": "1" } }).catch(() => {}); };
		addEventListener("pagehide", rel);
		return () => { clearInterval(t); removeEventListener("pagehide", rel); rel(); };
	}, [item?.id]);
	const lockRef = useRef(lock); lockRef.current = lock;

	// Frame messages
	useEffect(() => {
		const on = (e: MessageEvent) => {
			if (e.origin !== location.origin || !e.data?.vxFrame) return;
			const d = e.data;
			if (d.t === "refreshed" && d.id === refreshId.current) { clearTimeout(refreshT.current); showPlaceholdersRef.current(d.keys); (window as any).__vxSwaps = ((window as any).__vxSwaps || 0) + 1; }
			if (d.t === "refreshFailed" && d.id === refreshId.current) { clearTimeout(refreshT.current); setFrameN((n) => n + 1); }
			if (d.t === "ready") { frameReady.current = true; showPlaceholdersRef.current(d.keys); frame.current?.contentWindow?.postMessage({ vxFrame: 1, t: "scrollTo", y: scrollY.current }, location.origin); if (selRef.current) post({ t: "select", key: selRef.current }); }
			if (d.t === "scroll") scrollY.current = d.y;
			if (d.t === "select") { fromFrame.current = true; setSel(d.key); setFocusField(d.field || null); }
			if (d.t === "patched") { setHidden(d.n ? null : d.field); if (!d.n) wantReload.current = true; } // empty text had no element: re-render after the save
		};
		addEventListener("message", on); return () => removeEventListener("message", on);
	}, []);
	const showPlaceholdersRef = useRef<(k?: string[]) => void>(() => {}); const frameReady = useRef(false);
	const selRef = useRef<string | null>(null); selRef.current = sel;
	const post = (m: any) => frame.current?.contentWindow?.postMessage({ vxFrame: 1, ...m }, location.origin);
	const fromFrame = useRef(false);
	// Selection only highlights; it never saves or reloads. Scroll the preview only when picked from the panel.
	useEffect(() => { if (sel) post({ t: "select", key: sel, scroll: !fromFrame.current && !focusField }); fromFrame.current = false; }, [sel]);

	// Unsaved-change warning
	useEffect(() => {
		const h = (e: BeforeUnloadEvent) => { if (status === "dirty" || status === "saving") { e.preventDefault(); e.returnValue = ""; } };
		addEventListener("beforeunload", h); return () => removeEventListener("beforeunload", h);
	}, [status]);

	// Saves are serialised: one PUT in flight, newer edits coalesce into one follow-up PUT of the latest content,
	// so responses can't land out of order. The preview refreshes once the queue drains (if a change needs it).
	const itemRef = useRef<any>(null); itemRef.current = item;
	const inflight = useRef<Promise<boolean> | null>(null);
	const again = useRef(false); const wantReload = useRef(false);
	// Safety net: a section the server still rejects (a rule we don't check here) is set aside like an
	// unfinished one, so it can't block every other save. Cleared as soon as that section is edited.
	const rejected = useRef<Map<string, string>>(new Map());
	const inc = (b: Block) => missing(b, typesRef.current[b._type]).length > 0 || rejected.current.has(b._key);
	const lastSent = useRef(""); const changedSinceRefresh = useRef(false);
	// Refresh the preview in place (frame swaps just the sections); fall back to a full frame reload if that fails.
	const refreshT = useRef<any>(0); const refreshId = useRef(0);
	const refreshFrame = () => {
		changedSinceRefresh.current = false;
		const id = ++refreshId.current; clearTimeout(refreshT.current);
		if (!frameReady.current) { setFrameN((n) => n + 1); return; } // frame has no editor script: plain reload
		post({ t: "refresh", id });
		refreshT.current = setTimeout(() => { if (refreshId.current === id) setFrameN((n) => n + 1); }, 10000);
	};
	const showPlaceholders = (present?: string[]) => latest.current.forEach((b, i) => {
		const m = missing(b, typesRef.current[b._type]); if (rejected.current.has(b._key)) m.push("the highlighted fields");
		// Complete but rendered nothing (e.g. opening hours with no hours set): say so instead of showing nothing
		if (!m.length && present && !present.includes(b._key)) post({ t: "placeholder", key: b._key, after: latest.current[i - 1]?._key, label: typesRef.current[b._type]?.label || b._type, need: true, scroll: false, note: "Nothing to show yet, so this is hidden on your page. Add its content to show it." });
		if (m.length) post({ t: "placeholder", key: b._key, after: latest.current[i - 1]?._key, label: typesRef.current[b._type]?.label || b._type, need: true, scroll: false, note: "Fill in " + m.slice(0, 2).join(", ") + (m.length > 2 ? "…" : "") + " to show this section" });
	});
	const ver = useRef(0);
	const [retry, setRetry] = useState<null | (() => void)>(null);
	const save = useCallback((reload: boolean): Promise<boolean> => {
		clearTimeout(saveT.current);
		const it = itemRef.current; if (!it) return Promise.resolve(false);
		if (reload) wantReload.current = true;
		if (lockRef.current && !lockRef.current.held) { setStatus("dirty"); return Promise.resolve(false); }
		if (inflight.current) { again.current = true; return inflight.current; }
		const run = async (): Promise<boolean> => {
			do {
				again.current = false;
				const sent = ver.current;
				const body = JSON.stringify({ data: { content: latest.current.filter((b) => !inc(b)) } });
				if (body === lastSent.current) { setStatus("saved"); continue; } // nothing the server would store changed
				setStatus("saving"); setRetry(null);
				try {
					await api(`/content/pages/${encodeURIComponent(it.id)}`, { method: "PUT", body });
					lastSent.current = body; changedSinceRefresh.current = true;
					if (!again.current) { setStatus(ver.current === sent ? "saved" : "dirty"); }
				} catch (e: any) {
					again.current = false;
					const bi = /content\[(\d+)\]/.exec(String(e.message || ""));
					if (bi && e.status !== 409) { const sentBlocks = latest.current.filter((b) => !inc(b)); const rb = sentBlocks[+bi[1]]; if (rb && !rejected.current.has(rb._key)) { rejected.current.set(rb._key, friendly(e.message, sentBlocks, typesRef.current)); wantReload.current = true; again.current = true; continue; } }
					if (e.status === 409 || /holding this entry/i.test(e.message)) { setStatus("dirty"); setLock({ held: false, who: String(e.message).replace(/ is holding this entry.*/i, "") }); return false; }
					setStatus("error");
					setErr(e.message === "TIMEOUT" ? "Saving took longer than 15 seconds, so we stopped waiting. Your changes are still here."
						: e.message === "NETWORK" ? "We couldn't reach your site to save. Check your internet connection. Your changes are still here."
						: e.status === 403 ? "You don't have permission to change this page."
						: friendly(e.message, latest.current, typesRef.current) + " Your changes are kept here and will save once that's fixed.");
					setRetry(() => () => save(true));
					return false;
				}
			} while (again.current);
			setCanPublish(true); setErr("");
			if (wantReload.current) { wantReload.current = false; if (changedSinceRefresh.current) refreshFrame(); else showPlaceholders(); }
			return true;
		};
		inflight.current = run().finally(() => { inflight.current = null; });
		return inflight.current;
	}, []);

	showPlaceholdersRef.current = showPlaceholders;
	// A new frame document starts without the editor script until it says "ready"
	useEffect(() => { frameReady.current = false; }, [frameN, preview]);
	// Apply a change. kind: "type" (text typing, live-patched), "struct" (needs a frame reload)
	const change = (next: Block[], kind: "type" | "struct", burstKey?: string) => {
		if (kind === "struct" || burst.current !== burstKey) { hist.current.push(clone(latest.current)); if (hist.current.length > 100) hist.current.shift(); }
		burst.current = kind === "type" ? burstKey || null : null;
		for (const b of next) if (rejected.current.has(b._key) && !latest.current.includes(b)) rejected.current.delete(b._key);
		const prevBlocks = latest.current; const prevKeys = prevBlocks.map((b) => b._key).join(",");
		latest.current = next; setBlocks(next); setStatus("dirty"); ver.current++;
		// Optimistic preview: reorder/hide existing sections at once; the refresh after the save fills in the rest.
		if (kind === "struct" && next.map((b) => b._key).join(",") !== prevKeys) post({ t: "order", keys: next.map((b) => b._key) });
		clearTimeout(saveT.current);
		const done = (bs: Block[]) => bs.filter((b) => !inc(b)).map((b) => b._key).join(",");
		if (kind === "type" && done(next) !== done(prevBlocks)) kind = "struct";
		if (kind === "struct") save(true);
		else saveT.current = setTimeout(() => save(false), 1200);
	};
	const undo = () => { const prev = hist.current.pop(); if (!prev) return; burst.current = null; latest.current = prev; setBlocks(prev); setStatus("dirty"); ver.current++; post({ t: "order", keys: prev.map((b) => b._key) }); save(true); };
	useEffect(() => {
		const k = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey && !(e.target as any)?.closest?.(".vx-panel input,.vx-panel textarea")) { e.preventDefault(); undo(); } if ((e.metaKey || e.ctrlKey) && e.key === "s") { e.preventDefault(); save(true); } };
		addEventListener("keydown", k); return () => removeEventListener("keydown", k);
	});

	const idx = blocks.findIndex((b) => b._key === sel);
	const block = idx >= 0 ? blocks[idx] : null;
	const bt = block ? types[block._type] : undefined;

	const setField = (slug: string, value: any, f: Field) => {
		if (!block) return;
		const next = blocks.map((b) => (b._key === block._key ? { ...b, [slug]: value } : b));
		if (PATCHABLE.has(f.type)) { post({ t: "patch", key: block._key, field: slug, value }); change(next, "type", block._key + "." + slug); }
		else change(next, "struct");
	};
	const move = (d: number) => { if (idx < 0) return; const j = idx + d; if (j < 0 || j >= blocks.length) return; const n = blocks.slice(); [n[idx], n[j]] = [n[j], n[idx]]; change(n, "struct"); };
	const dup = () => { if (!block) return; const c = { ...clone(block), _key: rid() }; const n = blocks.slice(); n.splice(idx + 1, 0, c); change(n, "struct"); setSel(c._key); setToast("Section duplicated"); };
	const del = (key: string) => { const n = blocks.filter((b) => b._key !== key); change(n, "struct"); setSel(null); setConfirmDel(null); setToast("Section deleted · Undo to bring it back"); };
	const add = (t: BlockType, at: number) => {
		const b: Block = { _type: t.slug, _key: rid(), _version: t.version };
		for (const f of t.fields) if (f.defaultValue !== undefined) b[f.slug] = clone(f.defaultValue);
		const n = blocks.slice(); n.splice(at, 0, b);
		const m = missing(b, t);
		post({ t: "placeholder", key: b._key, after: blocks[at - 1]?._key, label: t.label, need: !!m.length, note: m.length ? "Fill in " + m.slice(0, 2).join(", ") + " to show this section" : "Adding…" });
		change(n, "struct"); setGallery(null); setSel(b._key); setFocusField(null);
	};
	const publish = async () => {
		const it = itemRef.current; if (!it) return;
		const withSample = latest.current.filter((b) => sampleFields(b).length).map((b) => typesRef.current[b._type]?.label || b._type);
		if (withSample.length && !confirm(`These sections still have sample text: ${withSample.join(", ")}.\n\nVisitors will see it. Publish anyway?`)) return;
		setPublishing(true); setRetry(null);
		try {
			if (status !== "saved" || inflight.current) { const ok = await save(false); if (!ok) { setPublishing(false); return; } }
			await api(`/content/pages/${encodeURIComponent(it.id)}/publish`, { method: "POST", body: "{}" });
			setCanPublish(false); { const k = latest.current.filter((b) => inc(b)).length; setToast(k ? `Published. ${k} unfinished section${k > 1 ? "s" : ""} stayed out until filled in.` : "Published. Your changes are live."); } setErr("");
		} catch (e: any) {
			setErr(e.status === 403 ? "You don't have permission to publish. Ask an admin to publish your draft."
				: e.message === "TIMEOUT" ? "Publishing took longer than 15 seconds, so we stopped waiting. It may still have worked; check your site, or try again."
				: e.message === "NETWORK" ? "We couldn't reach your site to publish. Check your internet connection."
				: "Couldn't publish (" + e.message + ").");
			setRetry(() => () => publish());
		}
		setPublishing(false);
	};
	useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(""), 3500); return () => clearTimeout(t); }, [toast]);

	// Scroll the panel to the clicked field
	useEffect(() => {
		if (!focusField || !block) return;
		const t = setTimeout(() => { const el = document.querySelector<HTMLElement>(`[data-vef="${CSS_escape(focusField)}"]`); if (el) { el.scrollIntoView({ block: "center" }); const i = el.querySelector<HTMLElement>("input,textarea,select,button"); i?.focus(); el.classList.add("flash"); setTimeout(() => el.classList.remove("flash"), 1300); } }, 60);
		return () => clearTimeout(t);
	}, [focusField, sel]);

	const classicHref = item ? `/_emdash/admin/content/pages/${encodeURIComponent(item.id)}?classic=1` : "/_emdash/admin/content/pages?classic=1";
	const nSample = blocks.filter((b) => sampleFields(b).length).length;
	const nIncomplete = blocks.filter((b) => missing(b, types[b._type]).length || rejected.current.has(b._key)).length;
	const statusText = nIncomplete && status === "saved" && !(lock && !lock.held) ? `Draft saved · ${nIncomplete} section${nIncomplete > 1 ? "s" : ""} need${nIncomplete > 1 ? "" : "s"} details` : nSample && status === "saved" && !(lock && !lock.held) ? `${canPublish ? "Draft saved" : "Published"} · sample text in ${nSample} section${nSample > 1 ? "s" : ""}` : lock && !lock.held ? (status === "dirty" ? "Waiting to save…" : "View only") : { saved: canPublish ? "Draft saved · not published" : "All changes published", dirty: "Unsaved changes…", saving: "Saving draft…", error: "Not saved" }[status];
	const leave = (href: string) => (e: React.MouseEvent) => { if ((status === "dirty" || status === "saving") && !confirm("You have unsaved changes. Leave anyway?")) e.preventDefault(); else void href; };

	const renderField = (f: Field, value: any, onChange: (v: any) => void, path: string) => {
		const label = plain(f.label);
		const common = { "data-vef": path, className: "vx-f" + (block && !path.includes(".") && sampleFields(block).includes(path) ? " is-ph" : "") } as any;
		if (f.type === "boolean") return <div {...common} key={path}><div className="vx-tog"><label style={{ margin: 0 }}>{label}</label><button type="button" aria-label={label} aria-pressed={!!value} className={"vx-sw" + (value ? " on" : "")} onClick={() => onChange(!value)} /></div></div>;
		if (f.type === "select") { const opts: string[] = f.validation?.options || []; return <div {...common} key={path}><label>{label}</label><select value={value ?? f.defaultValue ?? ""} onChange={(e) => onChange(e.target.value)}>{!f.required && <option value="">—</option>}{opts.map((o) => <option key={o}>{o}</option>)}</select></div>; }
		if (f.type === "multiSelect") { const opts: string[] = f.validation?.options || []; const cur: string[] = Array.isArray(value) ? value : []; return <div {...common} key={path}><label>{label}</label>{opts.map((o) => <label key={o} style={{ display: "flex", gap: 8, fontWeight: 400 }}><input type="checkbox" checked={cur.includes(o)} onChange={(e) => onChange(e.target.checked ? [...cur, o] : cur.filter((x) => x !== o))} />{o}</label>)}</div>; }
		if (f.type === "integer" || f.type === "number") return <div {...common} key={path}><label>{label}</label><input type="number" value={value ?? ""} onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))} /></div>;
		if (f.type === "text") return <div {...common} key={path}><label>{label}</label><textarea value={value ?? ""} onChange={(e) => onChange(e.target.value)} /></div>;
		if (f.type === "image") { const src = value?.src || value?.previewUrl || ""; return <div {...common} key={path}><label>{label}</label><div className="vx-img">{src ? <img src={src} alt="" /> : <img alt="" />}<button className="vx-btn" type="button" onClick={() => setMediaFor(() => onChange)}>{src ? "Replace image" : "Choose image"}</button>{src && <button className="vx-btn ghost danger" type="button" onClick={() => onChange(null)}>Remove</button>}</div></div>; }
		if (f.type === "repeater") {
			const items: any[] = Array.isArray(value) ? value : []; const subs: Field[] = f.validation?.subFields || [];
			const set = (i: number, k: string, v: any) => onChange(items.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
			return <div {...common} key={path}><label>{label}</label>{items.map((it, i) => <div className="vx-rep" key={i}><div className="vx-rep-h"><span>{String((typeof it[subs[0]?.slug] === "object" ? it[subs[0]?.slug]?.alt : it[subs[0]?.slug]) || `Item ${i + 1}`).slice(0, 40)}</span><span><button className="vx-btn ghost" title="Move up" disabled={i === 0} onClick={() => { const n = items.slice(); [n[i - 1], n[i]] = [n[i], n[i - 1]]; onChange(n); }}>↑</button><button className="vx-btn ghost danger" title="Remove" onClick={() => onChange(items.filter((_, j) => j !== i))}>✕</button></span></div>{subs.map((s) => renderField(s, it[s.slug], (v) => set(i, s.slug, v), `${path}.${i}.${s.slug}`))}</div>)}<button className="vx-btn" type="button" onClick={() => onChange([...items, Object.fromEntries(subs.map((s) => [s.slug, s.defaultValue ?? (s.type === "boolean" ? false : s.required && (s.type === "string" || s.type === "text") ? "New " + plain(s.label).toLowerCase() : "")]))])}>+ Add item</button></div>;
		}
		if (f.type === "portableText") return <div {...common} key={path}><label>{label}</label><p style={{ color: "#6b7280", margin: "4px 0 8px" }}>Long formatted text is edited in the classic editor for now.</p><a className="vx-btn" href={classicHref} onClick={leave(classicHref)}>Open classic editor</a></div>;
		const isUrl = f.type === "url" || /_url$/.test(f.slug);
		return <div {...common} key={path}><label>{label}</label>{/^(logo_url|image_url|poster_url)$/.test(f.slug) && value ? <div className="vx-img" style={{ marginBottom: 6 }}><img src={value} alt="" /></div> : null}<input type={isUrl ? "url" : "text"} value={value ?? ""} placeholder={isUrl ? "https://… or /path" : ""} onChange={(e) => onChange(e.target.value)} /></div>;
	};

	const fields = bt?.fields || [];
	const groups: [string, Field[]][] = [
		["Content", fields.filter((f) => !isStyle(f) && !ADV.test(f.slug))],
		["Style", fields.filter((f) => isStyle(f) && !ADV.test(f.slug))],
		["Advanced", fields.filter((f) => ADV.test(f.slug))],
	];
	const cats = useMemo(() => { const m = new Map<string, BlockType[]>(); for (const t of Object.values(types)) { const c = t.category || "Other"; m.set(c, [...(m.get(c) || []), t]); } return [...m.entries()]; }, [types]);

	return <div className="vx">
		<style>{CSS}</style>
		<div className="vx-top">
			<a className="vx-btn ghost" href="/_emdash/admin/?classic=1" onClick={leave("")} title="Back to dashboard">←</a>
			<span className="vx-brand">Edit page</span>
			<select aria-label="Page" value={pageId || ""} onChange={(e) => { if ((status === "dirty" || status === "saving") && !confirm("You have unsaved changes. Switch page anyway?")) return; setSel(null); setPageId(e.target.value); }} style={{ border: "1px solid #d1d5db", borderRadius: 8, padding: "7px 10px", maxWidth: 240 }}>
				{pages.map((p) => <option key={p.id} value={p.id}>{p.data?.title || p.title || p.slug}</option>)}
			</select>
			<div className="vx-seg" role="group" aria-label="Preview size"><button className={device === "desktop" ? "on" : ""} onClick={() => setDevice("desktop")}>Desktop</button><button className={device === "mobile" ? "on" : ""} onClick={() => setDevice("mobile")}>Mobile</button></div>
			<button className="vx-btn" onClick={undo} disabled={!hist.current.length} title="Undo (Ctrl/⌘+Z)">↶ Undo</button>
			<div style={{ flex: 1 }} />
			<span className="vx-status" aria-live="polite">{statusText}</span>
			<a className="vx-btn ghost" href={classicHref} onClick={leave(classicHref)}>Classic editor</a>
			<button className="vx-btn" disabled={!preview} onClick={() => { const u = new URL(preview, location.origin); u.searchParams.delete("vx_frame"); open(u.href, "_blank"); }}>Preview</button>
			<button className="vx-btn" onClick={() => save(true)} disabled={status === "saving"}>Save draft</button>
			<button className="vx-btn pri" onClick={publish} disabled={publishing || (!canPublish && status === "saved")}>{publishing ? "Publishing…" : "Publish"}</button>
		</div>
		{lock && !lock.held && <div className="vx-err" role="alert" style={{ background: "#fffbeb", color: "#92400e", borderColor: "#fde68a", display: "flex", alignItems: "center", gap: 12 }}><span><b>{lock.who}</b> is editing this page in another window, so your changes can't be saved yet. They're kept here.</span><button className="vx-btn" onClick={async () => { if (item && confirm(`Take over editing from ${lock.who}? Their unsaved changes in the other window may be lost.`)) { if (await takeLock(item.id, true)) save(true); } }}>Take over editing</button><button className="vx-btn ghost" onClick={async () => { if (item && (await takeLock(item.id, false)) && status === "dirty") save(true); }}>Try again</button></div>}
		{err && <div className="vx-err" role="alert" style={{ display: "flex", alignItems: "center", gap: 12 }}><span>{err}</span>{retry && <button className="vx-btn" onClick={() => { setErr(""); retry(); }}>Try again</button>}</div>}
		{toast && <div style={{ position: "fixed", bottom: 22, left: "50%", transform: "translateX(-50%)", background: "#111827", color: "#fff", padding: "10px 16px", borderRadius: 10, zIndex: 80, fontWeight: 600 }} role="status">{toast}</div>}
		<div className="vx-main">
			<div className="vx-stage">{preview ? <iframe ref={frame} key={frameN} title="Page preview" className={"vx-frame" + (device === "mobile" ? " mobile" : "")} sandbox="allow-scripts allow-same-origin" onLoad={() => { (window as any).__vxFrameLoads = ((window as any).__vxFrameLoads || 0) + 1; setHidden(null); }} src={preview + "&n=" + frameN} /> : <div className="vx-empty"><b>Loading your page…</b></div>}</div>
			<aside className="vx-panel" aria-label="Section settings">
				{block ? <>
					<div className="vx-ph">
						<p style={{ margin: 0 }}><button className="vx-btn ghost" style={{ padding: "2px 0" }} onClick={() => setSel(null)}>← All sections</button></p>
						<h2>{bt?.label || block._type}</h2>
						{bt?.description && <p>{bt.description}</p>}
						<div className="vx-tools">
							<button className="vx-btn" onClick={() => setGallery({ at: idx })}>+ Add above</button>
							<button className="vx-btn" onClick={() => setGallery({ at: idx + 1 })}>+ Add below</button>
							<button className="vx-btn" onClick={() => move(-1)} disabled={idx <= 0} title="Move up">↑</button>
							<button className="vx-btn" onClick={() => move(1)} disabled={idx >= blocks.length - 1} title="Move down">↓</button>
							<button className="vx-btn" onClick={dup}>Duplicate</button>
							<button className="vx-btn danger" onClick={() => setConfirmDel(block._key)}>Delete</button>
						</div>
					</div>
					<div className="vx-body">
						{sampleFields(block).length > 0 && <div style={{ background: "#fefce8", border: "1px solid #fde68a", borderRadius: 8, padding: "8px 10px", marginTop: 10, fontSize: 13, color: "#854d0e" }}>This section has <b>sample content</b> to replace (marked <i>Sample</i> below).</div>}
						{rejected.current.has(block._key) && <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "8px 10px", marginTop: 10, fontSize: 13, color: "#92400e" }}>{rejected.current.get(block._key)?.replace(/ Your changes are kept.*$/, "")} This section is left out of the draft until that's fixed; everything else keeps saving.</div>}
						{missing(block, bt).length > 0 && <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "8px 10px", marginTop: 10, fontSize: 13, color: "#92400e" }}>Fill in <b>{missing(block, bt).join(", ")}</b> and this section appears on your page. Everything else keeps saving meanwhile.</div>}
						{hidden && <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8, padding: "8px 10px", marginTop: 10, fontSize: 13 }}>This text was empty, so it isn't in the preview yet. <button className="vx-btn ghost" style={{ padding: "0 4px", color: "#1d4ed8" }} onClick={() => { changedSinceRefresh.current = true; refreshFrame(); }}>Refresh preview</button></div>}
						{groups.map(([g, fs]) => fs.length ? <div className="vx-grp" key={g}>{g !== "Content" || groups[1][1].length ? <h3>{g}</h3> : null}{g === "Advanced" ? <details><summary style={{ cursor: "pointer", color: "#6b7280" }}>Show advanced settings</summary>{fs.map((f) => renderField(f, block[f.slug], (v) => setField(f.slug, v, f), f.slug))}</details> : fs.map((f) => renderField(f, block[f.slug], (v) => setField(f.slug, v, f), f.slug))}</div> : null)}
					</div>
				</> : <div className="vx-body">
					<div className="vx-empty" style={{ padding: "26px 4px 10px" }}><b>Click any part of your page to edit it</b>Or pick a section below.</div>
					<div className="vx-outline">{blocks.map((b, i) => <button key={b._key} onClick={() => { setSel(b._key); setFocusField(null); }} onMouseEnter={() => post({ t: "select", key: b._key, scroll: true })}><b>{i + 1}. {types[b._type]?.label || b._type}</b><small>{fieldValueText(b, types[b._type]) || " "}</small></button>)}</div>
					<button className="vx-btn pri" style={{ width: "100%", justifyContent: "center", marginTop: 8 }} onClick={() => setGallery({ at: blocks.length })}>+ Add a section</button>
				</div>}
			</aside>
		</div>
		{gallery && <div className="vx-modal" onClick={(e) => e.target === e.currentTarget && setGallery(null)}><div className="vx-card" role="dialog" aria-label="Add a section">
			<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><h2>Add a section</h2><button className="vx-btn ghost" onClick={() => setGallery(null)} aria-label="Close">✕</button></div>
			<p style={{ margin: 0, color: "#6b7280" }}>Pick a section. It's added with example content you can change.</p>
			{cats.map(([c, ts]) => <div key={c}><div className="vx-cat">{c}</div><div className="vx-gal">{ts.map((t) => <button key={t.slug} className="vx-gi" onClick={() => add(t, gallery.at)}><div className="th"><Thumb t={t.slug} /></div><div className="tx"><b>{t.label}</b><span>{(t.description || "").slice(0, 90)}</span></div></button>)}</div></div>)}
		</div></div>}
		{confirmDel && <div className="vx-modal"><div className="vx-card" style={{ maxWidth: 420 }} role="alertdialog" aria-label="Delete section">
			<h2>Delete this section?</h2><p style={{ color: "#4b5563" }}>“{types[blocks.find((b) => b._key === confirmDel)?._type || ""]?.label}” will be removed from the draft. You can Undo straight after, and nothing changes on your live site until you publish.</p>
			<div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}><button className="vx-btn" onClick={() => setConfirmDel(null)}>Cancel</button><button className="vx-btn pri" style={{ background: "#dc2626", borderColor: "#dc2626" }} onClick={() => del(confirmDel)}>Delete section</button></div>
		</div></div>}
		{mediaFor && <MediaPicker onPick={(v) => { mediaFor(v); setMediaFor(null); }} onClose={() => setMediaFor(null)} />}
	</div>;
}
// "content[6].items.2.answer: required (empty value not allowed)" -> plain English
function friendly(msg: string, blocks: Block[], types: Record<string, BlockType>) {
	const m = /content\[(\d+)\]\.([\w.]+):\s*(.*)/.exec(msg || "");
	if (!m) return "Couldn't save (" + msg + ").";
	const b = blocks[+m[1]]; const t = b && types[b._type]; const parts = m[2].split(".");
	const f = t?.fields.find((x) => x.slug === parts[0]);
	let where = `“${plain(f?.label || parts[0])}”`;
	if (parts.length >= 3) { const sub = (f?.validation?.subFields || []).find((x: Field) => x.slug === parts[2]); where = `“${plain(sub?.label || parts[2])}” in item ${+parts[1] + 1} of ${where}`; }
	const why = /required|empty/i.test(m[3]) ? "needs filling in" : /pattern|url|format/i.test(m[3]) ? "doesn't look like a valid address" : "isn't valid (" + m[3] + ")";
	return `${where} in the ${t?.label || "section"} section ${why}.`;
}
function CSS_escape(s: string) { return (window as any).CSS?.escape ? (window as any).CSS.escape(s) : s.replace(/"/g, '\\"'); }

function MediaPicker({ onPick, onClose }: { onPick: (v: any) => void; onClose: () => void }) {
	const [items, setItems] = useState<any[] | null>(null); const [url, setUrl] = useState(""); const [msg, setMsg] = useState("");
	useEffect(() => { api("/media?mimeType=image/&limit=60").then((d) => setItems(d.items || [])).catch(() => setItems([])); }, []);
	const pick = (it: any) => { const local = !it.provider || it.provider === "local"; const u = it.url || it.previewUrl || "/_emdash/api/media/file/" + it.storageKey; const v: any = { id: it.id, provider: it.provider || "local", alt: it.alt || "", width: it.width, height: it.height, meta: it.meta }; if (local) v.src = u; else v.previewUrl = u; Object.keys(v).forEach((k) => v[k] === undefined && delete v[k]); onPick(v); };
	const upload = async (f: File) => { setMsg("Uploading…"); try { const fd = new FormData(); fd.append("file", f); const r = await fetch(API + "/media", { method: "POST", body: fd, credentials: "same-origin", headers: { "X-EmDash-Request": "1" } }); const b = await r.json(); if (!r.ok || !b?.data?.item) throw new Error(b?.error?.message || "Upload failed"); pick(b.data.item); } catch (e: any) { setMsg("Upload isn't available on this site yet (" + e.message + "). Paste an image address instead."); } };
	return <div className="vx-modal" onClick={(e) => e.target === e.currentTarget && onClose()}><div className="vx-card" style={{ maxWidth: 640 }} role="dialog" aria-label="Choose an image">
		<div style={{ display: "flex", justifyContent: "space-between" }}><h2>Choose an image</h2><button className="vx-btn ghost" onClick={onClose}>✕</button></div>
		<label className="vx-btn" style={{ marginTop: 8 }}>Upload from your computer<input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} /></label>
		{msg && <p style={{ color: "#6b7280" }}>{msg}</p>}
		<div className="vx-media">{items === null ? <p>Loading…</p> : items.map((it) => <button key={it.id} onClick={() => pick(it)}><img src={it.url || it.previewUrl || "/_emdash/api/media/file/" + it.storageKey} alt={it.alt || ""} /></button>)}</div>
		{items && !items.length && <p style={{ color: "#6b7280" }}>Your media library is empty.</p>}
		<div className="vx-f"><label>Or paste an image address</label><div style={{ display: "flex", gap: 8 }}><input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" /><button className="vx-btn pri" disabled={!url} onClick={() => onPick({ provider: "local", src: url, alt: "" })}>Use</button></div></div>
	</div></div>;
}

export const pages = { "/": VisualEditor };
export default { pages };
