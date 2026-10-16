// Section "pricing": render component + assets. Block fields live in section.json (single source of truth).
import Component from "./Pricing.astro";
import def from "./section.json";
import css from "./pricing.css?url";
import type { SectionModule } from "../types";

export default {
	slug: "pricing",
	Component,
	def: def as any,
	assets: (b: any) => ({ css: [css], js: [] }),
} satisfies SectionModule;
