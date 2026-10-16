// Section "feature_grid": render component + assets. Block fields live in section.json (single source of truth).
import Component from "./FeatureGrid.astro";
import def from "./section.json";
import css from "./feature_grid.css?url";
import type { SectionModule } from "../types";

export default {
	slug: "feature_grid",
	Component,
	def: def as any,
	assets: (b: any) => ({ css: [css], js: [] }),
} satisfies SectionModule;
