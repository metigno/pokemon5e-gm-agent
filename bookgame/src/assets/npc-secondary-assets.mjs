import { createHash } from "node:crypto";
import { readFile, lstat } from "node:fs/promises";
import { join } from "node:path";
import { WORLD_2060_SPECIES } from "../rules/world-roster-2060.mjs";
import { validPng } from "../../scripts/verify-offline-character-sprites.mjs";

export const NPC_SECONDARY_CATALOG_SHA256 = "07c8339f149556e5b82dce2b68efa79688fe96f07ba6a8bf3db73bc4d29cbab3";
export const NPC_SECONDARY_ZIP_SHA256 = "f87e063447d9e79d5f1ba55ba1d1233250bcf7e4d2adb96aecb191dae0d9488a";
const SAFE_ID = /^[a-z][a-z0-9_]*$/;
const SHA = /^[0-9a-f]{64}$/;
const ROLE_IDS = new Set([
  "nurse","doctor","mart_clerk","receptionist","registrar","ranger_m","ranger_f",
  "worker_m","worker_f","technician","security","referee","reporter_m","reporter_f",
  "trainer_m","trainer_f","rookie","guide","harbor_official","researcher",
  "field_staff","organizer","vendor","trainer_staff"
]);
const ROLES = ["battleFront", "overworld"];
const digest = buffer => createHash("sha256").update(buffer).digest("hex");

export function validateSecondaryCatalog(catalog, npcRegistry) {
  if (catalog?.schemaVersion !== 1 || !catalog.worldEntrants || !catalog.roles || !catalog.sceneRoles) {
    throw new Error("Invalid secondary NPC sprite catalog schema");
  }
  const known = new Set([...(npcRegistry.five ?? []), ...(npcRegistry.moduleAnchors ?? []),
    ...(npcRegistry.verifiedAdditionalCharacters ?? [])].map(v => v.name));
  const remainingWorld = Object.keys(WORLD_2060_SPECIES).filter(name => !known.has(name));
  const world = Object.entries(catalog.worldEntrants);
  const roles = Object.entries(catalog.roles);
  if (world.length !== 18 || roles.length !== ROLE_IDS.size ||
      new Set(world.map(([,v]) => v.name)).size !== 18 ||
      world.some(([,v]) => !remainingWorld.includes(v.name)) ||
      roles.some(([id]) => !ROLE_IDS.has(id))) {
    throw new Error("Secondary NPC catalog differs from 2060 roster or approved functional roles");
  }
  for (const [group, records] of [["world", world], ["role", roles]]) {
    for (const [id, entry] of records) {
      if (!SAFE_ID.test(id) || entry.battleFront !== "battleFront.png" ||
          entry.overworld !== "overworld.png" || !Number.isInteger(entry.frames) ||
          entry.frames < 1 || entry.frames > 15 ||
          entry.frameWidth !== 16 || entry.frameHeight !== 32 ||
          !ROLES.every(role => SHA.test(entry[role + "Sha256"] ?? ""))) {
        throw new Error("Invalid NPC sprite definition: " + group + "/" + id);
      }
      if (group === "role" && entry.identityMatch !== "functional-role-archetype") {
        throw new Error("A functional archetype cannot impersonate a named Trainer");
      }
      if (group === "world" && !["canon-specific", "name-labelled-user-supplied",
          "neutral-class-not-identity"].includes(entry.identityMatch)) {
        throw new Error("Unapproved secondary Trainer identity assignment");
      }
      const provenance = JSON.stringify(entry.provenance ?? {}).toLowerCase();
      if (/swimmer|triathlete|tennis|ninja|biker|cue.ball|aroma.lady|guitarist|tuber/.test(provenance)) {
        throw new Error("Prohibited gimmick Trainer sprite: " + id);
      }
    }
  }
  for (const [scene, nodes] of Object.entries(catalog.sceneRoles)) {
    if (!/^[a-z0-9_-]+$/.test(scene) || !nodes || typeof nodes !== "object") throw new Error("Invalid scene role key");
    for (const [node, ids] of Object.entries(nodes)) {
      if (!/^[a-z0-9_-]+$/.test(node) || !Array.isArray(ids) ||
          ids.length < 1 || ids.length > 2 || ids.some(id => !ROLE_IDS.has(id))) {
        throw new Error("Unapproved scene-scoped functional NPC role");
      }
    }
  }
  return { world: world.length, functionalRoles: roles.length, png: (world.length + roles.length) * 2 };
}

export async function readVerifiedSecondaryNpcSprite(group, id, role, available, dir) {
  if (!(group === "world" || group === "role") || !SAFE_ID.test(id) || !ROLES.includes(role)) return null;
  const entry = available?.[group]?.[id];
  if (!entry) return null;
  const path = join(dir, group, id, role + ".png");
  try {
    if (!(await lstat(join(dir, group, id))).isDirectory() || !(await lstat(path)).isFile()) return null;
    const bytes = await readFile(path);
    if (!validPng(bytes)) return null;
    const w = bytes.readUInt32BE(16), h = bytes.readUInt32BE(20);
    if ((role === "battleFront" && (w !== 64 || h !== 64)) ||
        (role === "overworld" && (w !== entry.frames * 16 || h !== 32))) return null;
    return digest(bytes) === entry[role] ? bytes : null;
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

export async function verifyOfflineSecondaryNpcAssets(npcRegistry, base) {
  const path = join(base, "catalog.json");
  let raw;
  try { raw = await readFile(path); }
  catch (error) {
    if (error?.code !== "ENOENT") throw error;
    return { valid: false, verified: 0, expected: 84, missing: ["catalog.json"],
      available: { world: Object.create(null), role: Object.create(null) }, catalog: null };
  }
  if (digest(raw) !== NPC_SECONDARY_CATALOG_SHA256) throw new Error("Secondary NPC catalog is not approved");
  const catalog = JSON.parse(raw.toString("utf8"));
  const inventory = validateSecondaryCatalog(catalog, npcRegistry);
  const available = { world: Object.create(null), role: Object.create(null) };
  const missing = [];
  const dir = join(base, "files");
  for (const group of ["world", "role"]) {
    const records = group === "world" ? catalog.worldEntrants : catalog.roles;
    for (const [id, entry] of Object.entries(records)) {
      const pins = { battleFront: entry.battleFrontSha256,
        overworld: entry.overworldSha256, frames: entry.frames };
      const probe = { [group]: { [id]: pins } };
      const valid = await Promise.all(ROLES.map(role => readVerifiedSecondaryNpcSprite(group, id, role, probe, dir)));
      for (let i=0;i<ROLES.length;i++) if (!valid[i]) missing.push(group + "/" + id + "/" + ROLES[i] + ".png");
      if (valid.every(Boolean)) available[group][id] = pins;
    }
  }
  return { valid: !missing.length, verified: inventory.png - missing.length,
    expected: inventory.png, missing, available, catalog };
}

export function npcSceneRoles(verified, sceneId, nodeId) {
  if (!verified?.catalog || !verified?.available) return [];
  return (verified.catalog.sceneRoles?.[sceneId]?.[nodeId] ?? [])
    .filter(id => Object.hasOwn(verified.available.role, id))
    .map(id => ({ id, label: verified.catalog.roles[id].displayRole }));
}

export function npcWorldSpriteId(verified, trainerName) {
  if (!verified?.catalog || typeof trainerName !== "string") return null;
  const found = Object.entries(verified.catalog.worldEntrants)
    .find(([id, entry]) => Object.hasOwn(verified.available.world, id) &&
      (entry.name === trainerName || id === trainerName));
  return found?.[0] ?? null;
}
