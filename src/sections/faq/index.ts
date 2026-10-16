// Section "faq": render component + assets. Block fields live in section.json (single source of truth).
import Component from "./Faq.astro";
import def from "./section.json";
import css from "./faq.css?url";
import type { SectionModule } from "../types";

export default {
	slug: "faq",
	Component,
	def: def as any,
	assets: (b: any) => ({ css: [css], js: [] }),
} satisfies SectionModule;
