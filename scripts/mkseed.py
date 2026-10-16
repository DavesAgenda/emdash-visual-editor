#!/usr/bin/env python3
"""Generate seed/seed.json: one block type per src/sections/<slug>/section.json, a "pages" collection whose
"content" field is a list of those blocks, a primary menu and an example home page."""
import json, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); SEC = os.path.join(ROOT, "src", "sections")
ORDER = ["hero", "rich_text", "feature_grid", "stats", "testimonials", "gallery", "pricing", "faq", "cta_band"]
DEFS = {d: json.load(open(os.path.join(SEC, d, "section.json"))) for d in sorted(os.listdir(SEC)) if os.path.exists(os.path.join(SEC, d, "section.json"))}
BLOCKS = [DEFS[k]["blockType"] for k in sorted(DEFS, key=lambda k: ORDER.index(k) if k in ORDER else 99)]
def block(slug, key):
    bt = DEFS[slug]["blockType"]; v = [x for x in bt["versions"] if x["version"] == bt["currentVersion"]][0]
    b = {"_type": slug, "_key": key, "_version": bt["currentVersion"]}
    for f in v["fields"]:
        if "defaultValue" in f: b[f["slug"]] = f["defaultValue"]
    return b
seed = {
  "$schema": "https://emdashcms.com/seed.schema.json", "version": "1",
  "meta": {"name": "Visual editor example", "description": "Pages built from typed section blocks, edited side by side with a live preview."},
  "settings": {"title": "My site", "tagline": "Edit me in the Visual editor."},
  "blockTypes": BLOCKS,
  "collections": [{"slug": "pages", "label": "Pages", "labelSingular": "Page", "supports": ["drafts", "revisions", "seo", "preview"], "urlPattern": "/{slug}",
     "fields": [{"slug": "title", "label": "Title", "type": "string", "required": True, "searchable": True},
                {"slug": "content", "label": "Sections (top to bottom)", "type": "blocks", "validation": {"allowedTypes": [b["slug"] for b in BLOCKS], "maxItems": 40}}]}],
  "menus": [{"name": "primary", "label": "Main menu", "items": [{"type": "custom", "label": "Home", "url": "/"}]}],
  "content": {"pages": [{"id": "home", "slug": "home", "status": "published", "data": {"title": "Home", "content": [block("hero", "k1"), block("feature_grid", "k2"), block("faq", "k3"), block("cta_band", "k4")]}}]},
}
os.makedirs(os.path.join(ROOT, "seed"), exist_ok=True)
json.dump(seed, open(os.path.join(ROOT, "seed", "seed.json"), "w"), indent=1, ensure_ascii=False)
print("block types:", len(BLOCKS))
