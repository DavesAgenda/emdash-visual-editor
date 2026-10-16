// Hero motion: parallax background and the "agent field" canvas. Off for reduced motion.
const RM = matchMedia("(prefers-reduced-motion: reduce)");
for (const m of document.querySelectorAll(".blk-hero [data-parallax]")) {
	if (RM.matches) break;
	const sec = m.closest(".blk-hero"); let tick = false;
	const run = () => { tick = false; const r = sec.getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight) return; m.style.transform = `translate3d(0,${(-r.top * 0.25).toFixed(1)}px,0) scale(1.08)`; };
	addEventListener("scroll", () => { if (!tick) { tick = true; requestAnimationFrame(run); } }, { passive: true }); run();
}
for (const c of document.querySelectorAll(".hero-field")) {
	if (RM.matches) continue;
	let started = false;
	const start = () => { if (started) return; started = true; field(c); };
	["pointermove", "touchstart", "scroll", "keydown"].forEach((ev) => addEventListener(ev, start, { once: true, passive: true }));
	addEventListener("load", () => setTimeout(() => ("requestIdleCallback" in window ? requestIdleCallback(start) : start()), 4000));
}
function field(c) {
	const ctx = c.getContext("2d"); const cs = getComputedStyle(c);
	const brand = cs.getPropertyValue("--brand").trim() || "#0066FF", acc = cs.getPropertyValue("--accent").trim() || "#4D94FF";
	let W = 0, H = 0, run = true, raf = 0, last = 0; const dpr = Math.min(devicePixelRatio || 1, 2);
	const N = innerWidth < 700 ? 34 : 70, P = [], D = 140;
	const size = () => { W = c.clientWidth; H = c.clientHeight; c.width = W * dpr; c.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
	size(); for (let i = 0; i < N; i++) P.push({ x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - 0.5) * 0.25, vy: (Math.random() - 0.5) * 0.25, r: Math.random() < 0.18 ? 3 : 1.4, b: Math.random() < 0.35 });
	let mx = -1e4, my = -1e4; c.parentElement.addEventListener("pointermove", (e) => { const r = c.getBoundingClientRect(); mx = e.clientX - r.left; my = e.clientY - r.top; });
	function draw() {
		ctx.clearRect(0, 0, W, H); ctx.strokeStyle = acc;
		for (const p of P) { p.x += p.vx; p.y += p.vy; if (p.x < 0 || p.x > W) p.vx *= -1; if (p.y < 0 || p.y > H) p.vy *= -1; const dx = mx - p.x, dy = my - p.y, d = Math.hypot(dx, dy); if (d < 180) { p.x += dx * 0.004; p.y += dy * 0.004; } }
		for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) { const a = P[i], b = P[j], d = Math.hypot(a.x - b.x, a.y - b.y); if (d < D) { ctx.globalAlpha = (1 - d / D) * 0.35; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); } }
		for (const p of P) { ctx.globalAlpha = p.b ? 1 : 0.5; ctx.fillStyle = p.b ? brand : "#C8D7FF"; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.fill(); }
		ctx.globalAlpha = 1;
		if (run) raf = requestAnimationFrame((t) => { if (t - last < 32) { raf = requestAnimationFrame(draw); return; } last = t; draw(); });
	}
	new IntersectionObserver(([e]) => { run = e.isIntersecting && !document.hidden; cancelAnimationFrame(raf); if (run) draw(); }).observe(c);
	document.addEventListener("visibilitychange", () => { run = !document.hidden; cancelAnimationFrame(raf); if (run) draw(); });
	addEventListener("resize", size); draw();
}
