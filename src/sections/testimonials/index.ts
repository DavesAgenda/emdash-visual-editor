// Section "testimonials": render component + assets. Block fields live in section.json (single source of truth).
import Component from "./Testimonials.astro";
import def from "./section.json";
import css from "./testimonials.css?url";
import type { SectionModule } from "../types";

export default {
	slug: "testimonials",
	Component,
	def: def as any,
	assets: (b: any) => ({ css: [css], js: [] }),
} satisfies SectionModule;
