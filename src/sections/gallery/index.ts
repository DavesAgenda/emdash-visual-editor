// Section "gallery": render component + assets. Block fields live in section.json (single source of truth).
import Component from "./Gallery.astro";
import def from "./section.json";
import css from "./gallery.css?url";
import type { SectionModule } from "../types";

export default {
	slug: "gallery",
	Component,
	def: def as any,
	assets: (b: any) => ({ css: [css], js: [] }),
} satisfies SectionModule;
