import { cp, mkdir, readFile, stat } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const map = JSON.parse(await readFile(new URL("../assets/pokemon/sprite-runtime-map.json", import.meta.url), "utf8"));
const source = resolve(process.argv[2] ?? "");
const destination = resolve(process.argv[3] ?? new URL("../assets/pokemon/files/", import.meta.url).pathname);
const strict = process.argv.includes("--strict");

if (!process.argv[2]) {
  console.error("Usage: node scripts/import-sprite-package.mjs <extracted-package-dir> [destination] [--strict]");
  process.exit(2);
}

const requiredRoles = ["battleFront", "battleBack", "icon"];
const optionalRoles = ["overworld"];
const missing = [];
let copied = 0;

for (const [spriteId, assets] of Object.entries(map.sprites)) {
  if (/gmax|gigantamax/i.test(spriteId)) throw new Error(`Gigantamax entry is forbidden: ${spriteId}`);
  for (const role of [...requiredRoles, ...optionalRoles]) {
    const asset = assets[role];
    if (!asset) continue;
    const from = join(source, spriteId, asset);
    try {
      const info = await stat(from);
      if (!info.isFile()) throw new Error("not a file");
    } catch {
      if (requiredRoles.includes(role)) missing.push({ spriteId, role, asset });
      continue;
    }
    const to = join(destination, spriteId, basename(asset));
    await mkdir(join(destination, spriteId), { recursive: true });
    await cp(from, to);
    copied += 1;
  }
}

const report = {
  format: map.format,
  expectedSprites: Object.keys(map.sprites).length,
  copiedFiles: copied,
  missingRequiredAssets: missing.length,
  missing
};
console.log(JSON.stringify(report, null, 2));
if (strict && missing.length) process.exit(1);
