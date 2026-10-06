import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const docsDir = path.resolve(process.cwd(), "docs");
const modulesDir = path.join(docsDir, "modules");

test("Node Library V2 baseline exists and remains R01-R38", () => {
  const catalogPath = path.join(docsDir, "NODE_REUSE_CATALOG.md");
  const lockPath = path.join(docsDir, "NODE_LIBRARY_V2_LOCK.md");

  assert.ok(fs.existsSync(catalogPath), "NODE_REUSE_CATALOG.md must exist");
  assert.ok(fs.existsSync(lockPath), "NODE_LIBRARY_V2_LOCK.md must exist");

  const catalog = fs.readFileSync(catalogPath, "utf8");
  const lock = fs.readFileSync(lockPath, "utf8");

  assert.match(catalog, /NODE REUSE CATALOG V2/);
  assert.match(catalog, /NODE REUSE LIBRARY V2 = R01→R38/);
  assert.match(catalog, /M05→M12 LIBRARY-FIRST AUTHORING PROTOCOL/);
  assert.match(lock, /LOCKED BASELINE FOR M05→M12 AUTHORING/);
  assert.match(lock, /R01→R38/);
});

test("completed M05-M12 mappings must declare library-first reuse per block", () => {
  if (!fs.existsSync(modulesDir)) return;

  const files = fs.readdirSync(modulesDir).filter((name) =>
    /^M(?:0[5-9]|1[0-2])_PRODUCTION_MAPPING\.md$/.test(name)
  );

  for (const name of files) {
    const fullPath = path.join(modulesDir, name);
    const text = fs.readFileSync(fullPath, "utf8");

    const isComplete =
      /Module implementation status:\*\*.*(?:FULLY COMPLETE|COMPLETE\s*\/\s*MODEL-ALIGNED)/i.test(text);

    if (!isComplete) continue;

    const blockHeaders = [...text.matchAll(/^## (M(?:0[5-9]|1[0-2])_\d{2}_[A-Z0-9_]+)/gm)];
    assert.ok(blockHeaders.length > 0, `${name}: completed mapping must contain block sections`);

    for (let i = 0; i < blockHeaders.length; i++) {
      const start = blockHeaders[i].index;
      const end = i + 1 < blockHeaders.length ? blockHeaders[i + 1].index : text.length;
      const section = text.slice(start, end);
      assert.match(
        section,
        /\*\*Reuse class:\*\*\s*(?:REUSE|ADAPT|UNIQUE)/i,
        `${name} ${blockHeaders[i][1]}: missing **Reuse class:** declaration`
      );
      assert.match(
        section,
        /\*\*Source archetypes:\*\*/i,
        `${name} ${blockHeaders[i][1]}: missing **Source archetypes:** declaration`
      );
    }
  }
});
