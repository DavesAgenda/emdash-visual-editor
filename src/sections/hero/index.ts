// Section "hero": render component + assets. Block fields live in section.json (single source of truth).
import Component from "./Hero.astro";
import def from "./section.json";
import css from "./hero.css?url";
import js from "./hero.js?url";
import type { SectionModule } from "../types";

export default {
	slug: "hero",
	Component,
	def: def as any,
	assets: (b: any) => ({ css: [css], js: (b.effect === "parallax" && b.image || b.effect === "agent-field") ? [js] : [] }),
} satisfies SectionModule;
