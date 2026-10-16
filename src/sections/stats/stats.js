// Count-up numbers when the stats block scrolls into view (skipped for reduced motion).
if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
	const els = document.querySelectorAll("[data-count]");
	const io = new IntersectionObserver((es) => { for (const e of es) if (e.isIntersecting) { io.unobserve(e.target); run(e.target); } }, { threshold: 0.4 });
	els.forEach((el) => io.observe(el));
	function run(el) {
		const end = parseFloat(el.dataset.count), dec = (el.dataset.count.split(".")[1] || "").length, t0 = performance.now(), D = 1400;
		const step = (t) => { const k = Math.min(1, (t - t0) / D), e = 1 - Math.pow(1 - k, 3); el.textContent = (end * e).toFixed(dec); if (k < 1) requestAnimationFrame(step); else el.textContent = el.dataset.count; };
		requestAnimationFrame(step);
	}
}
