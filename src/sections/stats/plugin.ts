// EmDash plugin that ships the "Stats" section. Install = add it to astro.config.mjs plugins
// (done automatically for every folder in src/sections) and run `python3 scripts/mkseed.py` to register its block type.
import { defineSectionPlugin } from "../plugin-base";
import def from "./section.json";
export const createPlugin = () => defineSectionPlugin("stats", def);
export default createPlugin;
