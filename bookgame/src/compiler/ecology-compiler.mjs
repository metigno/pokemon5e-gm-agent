import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { ECOLOGY_ORDINARY_CLASSES, ECOLOGY_SPECIAL_CLASSES } from "../engine/ecology.mjs";

const ID_RE = /^[A-Za-z0-9_-]+$/;

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function diag(code, message, at) {
  return { code, message, at };
}

async function listJsonFiles(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...await listJsonFiles(full));
    else if (entry.isFile() && entry.name.endsWith(".json")) files.push(full);
  }
  return files.sort((a, b) => a.localeCompare(b));
}

export async function compileEcologyCatalog({
  profilesDir,
  zonePoolsFile,
  distributionFile,
  faunaIndexFile
}) {
  const errors = [];
  const [zonePools, distribution, faunaIndex] = await Promise.all([
    readFile(zonePoolsFile, "utf8").then(JSON.parse),
    readFile(distributionFile, "utf8").then(JSON.parse),
    readFile(faunaIndexFile, "utf8").then(JSON.parse)
  ]);

  if (!isObject(zonePools.zones) || !isObject(zonePools.rules?.weights)) {
    errors.push(diag("INVALID_ZONE_POOLS", "ZONE_POOLS.json is missing zones/rules.weights", zonePoolsFile));
  }
  if (!Array.isArray(distribution.species)) {
    errors.push(diag("INVALID_SPECIES_DISTRIBUTION", "SPECIES_DISTRIBUTION.json is missing species[]", distributionFile));
  }
  if (!Array.isArray(faunaIndex.entries)) {
    errors.push(diag("INVALID_FAUNA_INDEX", "ASTERIA_FAUNA_INDEX.json is missing entries[]", faunaIndexFile));
  }
  if (errors.length) return { valid: false, errors, catalog: null };

  const distById = new Map(distribution.species.map((entry) => [entry.id, entry]));
  const habitatById = new Map(faunaIndex.entries.map((entry) => [
    entry.id,
    entry.source_habitat?.biomes ?? []
  ]));

  const profiles = [];
  const files = await listJsonFiles(profilesDir);
  for (const file of files) {
    const parsed = JSON.parse(await readFile(file, "utf8"));
    if (!isObject(parsed) || parsed.schemaVersion !== 1 || !Array.isArray(parsed.zones)) {
      errors.push(diag("INVALID_ECOLOGY_PROFILE", "Ecology profile requires schemaVersion=1 and zones[]", file));
      continue;
    }
    for (const zone of parsed.zones) {
      profiles.push({ ...zone, moduleId: zone.moduleId ?? parsed.moduleId ?? null, sourceFile: file });
    }
  }

  const zones = {};
  for (const profile of profiles) {
    const at = profile.sourceFile + "#" + String(profile.id);
    if (typeof profile.id !== "string" || !ID_RE.test(profile.id)) {
      errors.push(diag("INVALID_ECOLOGY_ZONE_ID", "Ecology zone id must be stable", at));
      continue;
    }
    if (Object.hasOwn(zones, profile.id)) {
      errors.push(diag("DUPLICATE_ECOLOGY_ZONE_ID", "Duplicate ecology zone profile: " + profile.id, at));
      continue;
    }
    if (typeof profile.sourceZoneId !== "string" || !zonePools.zones[profile.sourceZoneId]) {
      errors.push(diag("UNKNOWN_ECOLOGY_SOURCE_ZONE", "Unknown authoritative source zone: " + String(profile.sourceZoneId), at));
      continue;
    }
    if (!Array.isArray(profile.habitats) || profile.habitats.length === 0) {
      errors.push(diag("INVALID_ECOLOGY_HABITATS", "Ecology zone requires habitats[]", at));
      continue;
    }
    if (!Array.isArray(profile.methods) || profile.methods.length === 0) {
      errors.push(diag("INVALID_ECOLOGY_METHODS", "Ecology zone requires methods[]", at));
      continue;
    }

    const sourceZone = zonePools.zones[profile.sourceZoneId];
    const species = [];
    for (const [rarity, ids] of Object.entries(sourceZone.pools ?? {})) {
      const authoritativeWeight = zonePools.rules.weights[rarity];
      if (!Number.isInteger(authoritativeWeight) || authoritativeWeight < 1) {
        errors.push(diag("UNKNOWN_RARITY_WEIGHT", "Missing authoritative weight for " + rarity, at));
        continue;
      }

      for (const speciesId of ids) {
        const dist = distById.get(speciesId);
        if (!dist) {
          errors.push(diag("MISSING_ECOLOGY_SPECIES", "Zone pool species missing distribution record: " + speciesId, at));
          continue;
        }
        if (ECOLOGY_SPECIAL_CLASSES.has(dist.distribution_class)) {
          errors.push(diag("SPECIAL_SPECIES_IN_ORDINARY_POOL", "Special species leaked into ordinary pool: " + speciesId, at));
          continue;
        }
        if (!ECOLOGY_ORDINARY_CLASSES.has(dist.distribution_class)) {
          errors.push(diag("UNKNOWN_ORDINARY_DISTRIBUTION_CLASS", "Unsupported ordinary distribution class: " + dist.distribution_class, at));
          continue;
        }
        if (dist.rarity !== rarity || dist.random_pool_weight !== authoritativeWeight) {
          errors.push(diag(
            "ECOLOGY_AUTHORITY_MISMATCH",
            "Authoritative rarity/weight mismatch for " + speciesId,
            at
          ));
          continue;
        }
        if (!dist.locations.includes(profile.sourceZoneId)) {
          errors.push(diag("ECOLOGY_LOCATION_MISMATCH", speciesId + " does not include source zone " + profile.sourceZoneId, at));
          continue;
        }

        const habitats = habitatById.get(speciesId) ?? [];
        if (!habitats.some((habitat) => profile.habitats.includes(habitat))) continue;
        if (!(dist.encounter_methods ?? []).some((method) => profile.methods.includes(method))) continue;

        species.push({
          id: speciesId,
          rarity,
          weight: authoritativeWeight,
          distributionClass: dist.distribution_class,
          activity: structuredClone(dist.activity ?? []),
          encounterMethods: structuredClone(dist.encounter_methods ?? []),
          habitats: structuredClone(habitats)
        });
      }
    }

    species.sort((a, b) => a.id.localeCompare(b.id));
    zones[profile.id] = {
      id: profile.id,
      moduleId: profile.moduleId,
      sourceZoneId: profile.sourceZoneId,
      habitats: structuredClone(profile.habitats),
      methods: structuredClone(profile.methods),
      species
    };
  }

  const catalog = {
    format: "p5e-librogame-ecology",
    schemaVersion: 1,
    offline: true,
    authority: {
      zonePools: "campaign/world/ecology/ZONE_POOLS.json",
      distribution: "campaign/world/ecology/SPECIES_DISTRIBUTION.json",
      rarity: "campaign/world/ecology/RARITY_SYSTEM.md",
      habitatSupport: "campaign/world/fauna/ASTERIA_FAUNA_INDEX.json"
    },
    weights: structuredClone(zonePools.rules.weights),
    zones
  };

  return { valid: errors.length === 0, errors, catalog };
}
