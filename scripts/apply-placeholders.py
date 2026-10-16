#!/usr/bin/env python3
"""Write src/sections/placeholders.json into each block type's field defaultValues:
  1. src/sections/*/section.json (seed source, so new sites get them), and
  2. the live D1 block-type versions (--remote DB name as arg), with a revert file in build/ve/.
Usage: python3 scripts/apply-placeholders.py [d1-db-name]"""
import json, glob, os, sys, subprocess
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); os.chdir(ROOT)
PH = {k: v for k, v in json.load(open("src/sections/placeholders.json")).items() if not k.startswith("_")}
def merge(fields, ph):
    n = 0
    for f in fields:
        if f["slug"] in ph: f["defaultValue"] = ph[f["slug"]]; n += 1
    return n
for f in sorted(glob.glob("src/sections/*/section.json")):
    j = json.load(open(f)); bt = j["blockType"]; ph = PH.get(bt["slug"])
    if not ph: continue
    v = [x for x in bt["versions"] if x["version"] == bt["currentVersion"]][0]
    if merge(v["fields"], ph) != len(ph): print("WARN unknown field in", bt["slug"], set(ph) - {x["slug"] for x in v["fields"]})
    open(f, "w").write(json.dumps(j, indent=1, ensure_ascii=False) + "\n")
print("section.json updated")
if len(sys.argv) > 1:
    db = sys.argv[1]; q = lambda s: "'" + s.replace("'", "''") + "'"
    r = subprocess.run(["npx", "wrangler", "d1", "execute", db, "--remote", "--json", "--command",
        "SELECT v.id, t.slug, v.fields FROM _emdash_block_type_versions v JOIN _emdash_block_types t ON t.id=v.block_type_id AND v.version=t.current_version"], capture_output=True, text=True, check=True)
    rows = json.loads(r.stdout)[0]["results"]; up, rev = [], []
    for row in rows:
        ph = PH.get(row["slug"]); 
        if not ph: continue
        fields = json.loads(row["fields"]); merge(fields, ph)
        up.append(f"UPDATE _emdash_block_type_versions SET fields={q(json.dumps(fields, ensure_ascii=False))} WHERE id={q(row['id'])};")
        rev.append(f"UPDATE _emdash_block_type_versions SET fields={q(row['fields'])} WHERE id={q(row['id'])};")
    os.makedirs("build/ve", exist_ok=True)
    open("build/ve/placeholders-apply.sql", "w").write("\n".join(up) + "\n"); open("build/ve/placeholders-revert.sql", "w").write("\n".join(rev) + "\n")
    subprocess.run(["npx", "wrangler", "d1", "execute", db, "--remote", "-y", "--file", "build/ve/placeholders-apply.sql"], check=True, stdout=subprocess.DEVNULL)
    print(f"live: updated {len(up)} block types (revert: build/ve/placeholders-revert.sql)")
