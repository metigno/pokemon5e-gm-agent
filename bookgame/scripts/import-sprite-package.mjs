import { cp, mkdir, readFile, stat } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const map = JSON.parse(await readFile(new URL("../assets/pokemon/sprite-runtime-map.json", import.meta.url), "utf8"));
const strict = process.argv.includes("--strict");
const positional = process.argv.slice(2).filter(arg => arg !== "--strict");
if (positional.length < 1 || positional.length > 2) {
  console.error("Usage: node scripts/import-sprite-package.mjs <extracted-package-dir> [destination] [--strict]");
  process.exit(2);
}
const source = resolve(positional[0]);
const destination = resolve(positional[1] ?? fileURLToPath(new URL("../assets/pokemon/files/", import.meta.url)));

const requiredRoles = ["battleFront", "battleBack", "icon"];
const optionalRoles = ["overworld"];
const missing = [];
let copied = 0;
const filesToCopy = [];

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
    filesToCopy.push({ from, to: join(destination, spriteId, basename(asset)), spriteId });
  }
}

if (strict && missing.length) {
  console.error(JSON.stringify({ missingRequiredAssets: missing.length, missing }, null, 2));
  process.exit(1);
}

for (const { from, to, spriteId } of filesToCopy) {
  await mkdir(join(destination, spriteId), { recursive: true });
  await cp(from, to);
  copied += 1;
}

const report = {
  format: map.format,
  expectedSprites: Object.keys(map.sprites).length,
  copiedFiles: copied,
  missingRequiredAssets: missing.length,
  missing
};
console.log(JSON.stringify(report, null, 2));
