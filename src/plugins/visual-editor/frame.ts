// Script injected only into the Visual editor's draft-preview frame. Talks to the parent admin page
// (same origin) with postMessage: hover/select sections, live-patch text, keep scroll across reloads.
export const FRAME_JS = String.raw`(function(){
if (window.parent === window) return;
var P = window.parent, O = location.origin, hovered = null, selected = null;
var st = document.createElement("style");
st.textContent = "[data-vx-key]{cursor:pointer;transition:box-shadow .12s}"+
 ".vx-hl{box-shadow:inset 0 0 0 2px rgba(37,99,235,.85)!important}"+
 ".vx-sel{box-shadow:inset 0 0 0 3px #2563eb!important}"+
 "[data-vx-f]{border-radius:3px}[data-vx-key] [data-vx-f]:hover{outline:1px dashed rgba(37,99,235,.9);outline-offset:3px}"+
 "#vx-tag{position:absolute;z-index:2147483647;background:#2563eb;color:#fff;font:600 12px/1 system-ui,-apple-system,sans-serif;padding:6px 9px;border-radius:0 0 7px 0;pointer-events:none;display:none;letter-spacing:.01em}"+
 ".vx-ph{display:flex;align-items:center;justify-content:center;min-height:220px;margin:12px;border:2px dashed #93c5fd;border-radius:14px;background:repeating-linear-gradient(135deg,#eff6ff 0 14px,#f8fafc 14px 28px);font:15px/1.4 system-ui,-apple-system,sans-serif;color:#1e3a8a}"+
 ".vx-ph-in{text-align:center}.vx-ph-in b{display:block;font-size:18px;margin-bottom:4px}.vx-ph-in span{color:#475569}"+
 ".vx-ph:not(.need) .vx-ph-in span::after{content:'';display:inline-block;width:10px;height:10px;margin-left:8px;border:2px solid #93c5fd;border-top-color:#2563eb;border-radius:50%;animation:vxspin .8s linear infinite;vertical-align:-1px}@keyframes vxspin{to{transform:rotate(360deg)}}"+
 "#vx-tag.sel{background:#1d4ed8}#emdash-toolbar{display:none!important}";
document.head.appendChild(st);
var tag = document.createElement("div"); tag.id = "vx-tag"; document.body.appendChild(tag);
function send(m){ m.vxFrame = 1; P.postMessage(m, O); }
function place(el, cls){
  if (!el) { tag.style.display = "none"; return; }
  var r = el.getBoundingClientRect();
  tag.textContent = el.getAttribute("data-vx-label") + (cls === "sel" ? "  ·  editing" : "");
  tag.className = cls || ""; tag.style.display = "block";
  tag.style.left = (r.left + scrollX) + "px"; tag.style.top = (r.top + scrollY) + "px";
}
function sec(t){ return t && t.closest ? t.closest("[data-vx-key]") : null; }
document.addEventListener("mouseover", function(e){
  var s = sec(e.target); if (s === hovered) return;
  if (hovered) hovered.classList.remove("vx-hl");
  hovered = s;
  if (s && s !== selected) s.classList.add("vx-hl");
  place(s || selected, s && s !== selected ? "" : "sel");
});
document.addEventListener("mouseleave", function(){ if (hovered) hovered.classList.remove("vx-hl"); hovered = null; place(selected, "sel"); });
function select(key, scroll){
  if (selected) selected.classList.remove("vx-sel");
  selected = key ? document.querySelector('[data-vx-key="'+CSS.escape(key)+'"]') : null;
  if (selected) { selected.classList.remove("vx-hl"); selected.classList.add("vx-sel"); if (scroll) selected.scrollIntoView({behavior:"smooth", block:"center"}); }
  place(selected, "sel");
}
// Swallow every activation inside the frame before any page script (EmDash toolbar, links, forms, players) sees it.
["auxclick","dblclick","submit","mouseup","pointerup"].forEach(function(t){ window.addEventListener(t, function(e){ e.preventDefault(); e.stopImmediatePropagation(); }, true); });
window.addEventListener("keydown", function(e){ if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopImmediatePropagation(); } }, true);
window.addEventListener("click", function(e){
  e.preventDefault(); e.stopImmediatePropagation();
  var s = sec(e.target); if (!s) return;
  var f = e.target.closest("[data-vx-f]");
  var field = f ? f.getAttribute("data-vx-f").split(".").slice(1).join(".") : null;
  select(s.getAttribute("data-vx-key"), false);
  send({ t: "select", key: s.getAttribute("data-vx-key"), field: field });
}, true);
document.querySelectorAll("video[autoplay],video[data-autoplay]").forEach(function(v){ try { v.pause(); } catch(_){} });
var sT = 0; addEventListener("scroll", function(){ clearTimeout(sT); sT = setTimeout(function(){ send({ t: "scroll", y: scrollY }); }, 120); if (selected) place(selected, "sel"); }, { passive: true });
addEventListener("message", function(e){
  if (e.origin !== O || !e.data || !e.data.vxFrame) return;
  var d = e.data;
  if (d.t === "patch") {
    var els = document.querySelectorAll('[data-vx-f="'+CSS.escape(d.key+"."+d.field)+'"]'), n = 0;
    els.forEach(function(el){
      if (el.tagName === "IMG") { if (d.value) { el.src = d.value; n++; } }
      else if (el.tagName === "VIDEO") {}
      else if (!el.children.length && d.value) { el.textContent = d.value; n++; }
    });
    send({ t: "patched", key: d.key, field: d.field, n: n });
  }
  if (d.t === "order") {
    var els = {}, first = document.querySelector("[data-vx-key]"); if (!first) return;
    var parent = first.parentNode;
    document.querySelectorAll("[data-vx-key]").forEach(function(x){ els[x.getAttribute("data-vx-key")] = x; });
    Object.keys(els).forEach(function(k){ if (d.keys.indexOf(k) < 0) els[k].style.display = "none"; });
    d.keys.forEach(function(k){ var x = els[k]; if (x && x.parentNode === parent) parent.appendChild(x); });
    if (selected) place(selected, "sel");
  }
  if (d.t === "placeholder") {
    // Instant feedback for a new section: a labelled skeleton at its spot until the real render arrives.
    var ph = document.createElement("section"); ph.className = "vx-ph" + (d.need ? " need" : ""); ph.setAttribute("data-vx-key", d.key); ph.setAttribute("data-vx-label", d.label || "New section");
    ph.innerHTML = '<div class="vx-ph-in"><b></b><span></span></div>'; ph.querySelector("b").textContent = d.label || "New section";
    ph.querySelector("span").textContent = d.note || "Adding…";
    var old = document.querySelector('[data-vx-key="'+CSS.escape(d.key)+'"]'); if (old) old.replaceWith(ph);
    else { var all = document.querySelectorAll("[data-vx-key]"), root = document.getElementById("vx-blocks"); if (!root) return;
      var host = all[0] ? all[0].parentNode : root, ref = d.after ? document.querySelector('[data-vx-key="'+CSS.escape(d.after)+'"]') : null;
      if (ref && ref.parentNode === host) ref.after(ph); else host.insertBefore(ph, host.firstChild); }
    if (d.scroll !== false) ph.scrollIntoView({ behavior: "smooth", block: "center" });
  }
  if (d.t === "refresh") refresh(d.id);
  if (d.t === "select") select(d.key, d.scroll);
  if (d.t === "scrollTo") window.scrollTo(0, d.y || 0);
});
// In-place refresh: fetch the fresh draft render and swap only the sections, adding any new CSS/JS first.
// Much faster than reloading the frame (no fonts/images/scripts re-fetched, no flash, scroll and selection kept).
var rq = 0;
function refresh(id){
  var my = ++rq, u = new URL(location.href); u.searchParams.set("n", String(Date.now()));
  fetch(u.href, { credentials: "same-origin", cache: "no-store" }).then(function(r){ if (!r.ok) throw new Error("http " + r.status); return r.text(); }).then(function(html){
    if (my !== rq) return; // a newer refresh superseded this one
    var nd = new DOMParser().parseFromString(html, "text/html"), nr = nd.getElementById("vx-blocks"), cr = document.getElementById("vx-blocks");
    if (!nr || !cr || nd.body.className !== document.body.className) throw new Error("layout");
    if (nr.parentNode.className !== cr.parentNode.className) cr.parentNode.className = nr.parentNode.className; // e.g. header offset when the first section changes
    var waits = [], have = {};
    document.head.querySelectorAll("link[href],script[src],style").forEach(function(el){ have[el.getAttribute("href") || el.getAttribute("src") || el.textContent] = 1; });
    nd.head.querySelectorAll("link[rel=stylesheet][href],link[rel=preload][href],script[src],style").forEach(function(el){
      var k = el.getAttribute("href") || el.getAttribute("src") || el.textContent; if (have[k]) return;
      var n;
      if (el.tagName === "SCRIPT") { n = document.createElement("script"); for (var i = 0; i < el.attributes.length; i++) n.setAttribute(el.attributes[i].name, el.attributes[i].value); }
      else n = document.importNode(el, true);
      if (el.tagName === "LINK" && el.rel === "stylesheet") waits.push(new Promise(function(res){ n.onload = n.onerror = res; setTimeout(res, 2500); }));
      document.head.appendChild(n);
    });
    return Promise.all(waits).then(function(){
      if (my !== rq) return;
      var y = scrollY, nn = document.importNode(nr, true);
      cr.replaceWith(nn);
      nn.querySelectorAll("script").forEach(function(o){ var s = document.createElement("script"); for (var i = 0; i < o.attributes.length; i++) s.setAttribute(o.attributes[i].name, o.attributes[i].value); s.textContent = o.textContent; o.replaceWith(s); });
      nn.querySelectorAll("video[autoplay],video[data-autoplay]").forEach(function(v){ try { v.pause(); } catch(_){} });
      window.scrollTo(0, y); hovered = null;
      var sk = selected && selected.getAttribute("data-vx-key"); selected = null; if (sk) select(sk, false); else place(null);
      send({ t: "refreshed", id: id, keys: Array.prototype.map.call(document.querySelectorAll("[data-vx-key]"), function(x){ return x.getAttribute("data-vx-key"); }) });
    });
  }).catch(function(e){ if (my === rq) send({ t: "refreshFailed", id: id, why: String(e && e.message || e) }); });
}
send({ t: "ready", keys: Array.prototype.map.call(document.querySelectorAll("[data-vx-key]"), function(x){ return x.getAttribute("data-vx-key"); }) });
})();`;
