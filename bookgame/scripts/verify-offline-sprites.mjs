import { readFile, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_SPRITE_DIR = fileURLToPath(new URL("../assets/pokemon/files/", import.meta.url));
const DEFAULT_MAP = new URL("../assets/pokemon/sprite-runtime-map.json", import.meta.url);
const REQUIRED_ROLES = ["battleFront", "battleBack", "icon"];
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

export async function verifyOfflineSpriteAssets(map, spriteDir) {
  const missing = [];
  const invalid = [];
  let checked = 0;
  const sprites = Object.entries(map.sprites ?? {});

  for (const [spriteId, assets] of sprites) {
    if (/gmax|gigantamax/i.test(spriteId)) {
      invalid.push(`${spriteId}: Gigantamax is forbidden`);
      continue;
    }
    for (const role of [...REQUIRED_ROLES, "overworld"]) {
      const asset = assets[role];
      if (!asset) {
        if (REQUIRED_ROLES.includes(role)) missing.push(`${spriteId}:${role} (mapping)`);
        continue;
      }
      const filename = join(spriteDir, spriteId, asset);
      try {
        const info = await stat(filename);
        if (!info.isFile()) throw new Error("not a file");
        const content = await readFile(filename);
        if (!content.subarray(0, 8).equals(PNG_SIGNATURE)) {
          invalid.push(`${spriteId}:${role} (invalid PNG signature)`);
        } else {
          checked++;
        }
      } catch {
        missing.push(`${spriteId}:${role} (${asset})`);
      }
    }
  }
  return {
    valid: missing.length === 0 && invalid.length === 0 && sprites.length === 619,
    expectedSpecies: 619,
    mappedSpecies: sprites.length,
    verifiedPng: checked,
    missing,
    invalid
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const spriteDir = resolve(process.env.P5E_SPRITE_DIR ?? DEFAULT_SPRITE_DIR);
  const map = JSON.parse(await readFile(DEFAULT_MAP, "utf8"));
  const report = await verifyOfflineSpriteAssets(map, spriteDir);
  console.log(JSON.stringify({
    ...report,
    missing: report.missing.slice(0, 20),
    invalid: report.invalid.slice(0, 20)
  }, null, 2));
  if (!report.valid) process.exitCode = 1;
}
