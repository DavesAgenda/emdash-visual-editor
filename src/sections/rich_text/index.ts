// Section "rich_text": render component + assets. Block fields live in section.json (single source of truth).
import Component from "./RichText.astro";
import def from "./section.json";
import css from "./rich_text.css?url";
import type { SectionModule } from "../types";

export default {
	slug: "rich_text",
	Component,
	def: def as any,
	assets: (b: any) => ({ css: [css], js: [] }),
} satisfies SectionModule;
