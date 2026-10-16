// Section "stats": render component + assets. Block fields live in section.json (single source of truth).
import Component from "./Stats.astro";
import def from "./section.json";
import css from "./stats.css?url";
import js from "./stats.js?url";
import type { SectionModule } from "../types";

export default {
	slug: "stats",
	Component,
	def: def as any,
	assets: (b: any) => ({ css: [css], js: (b.count_up !== false) ? [js] : [] }),
} satisfies SectionModule;
