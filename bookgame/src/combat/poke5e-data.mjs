import { readFile } from "node:fs/promises";

const DATA_URL = new URL("../../data/poke5e/vertical-slice-2024.json", import.meta.url);
let cached;

async function loadPack() {
  cached ??= JSON.parse(await readFile(DATA_URL, "utf8"));
  return cached;
}

function normalizeSpeciesId({ species, form }) {
  const base = String(species).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (base === "growlithe" && String(form).toLowerCase() === "hisuian") return "growlithe-hisui";
  return base;
}

function movePoolsForLevel(species, level) {
  const ids = [...(species.moves.start ?? [])];
  if (level >= 2) ids.push(...(species.moves.level2 ?? []));
  if (level >= 6) ids.push(...(species.moves.level6 ?? []));
  if (level >= 10) ids.push(...(species.moves.level10 ?? []));
  if (level >= 14) ids.push(...(species.moves.level14 ?? []));
  if (level >= 18) ids.push(...(species.moves.level18 ?? []));
  return [...new Set(ids)];
}

export class Poke5eDataRepository {
  async getSpecies(descriptor) {
    const pack = await loadPack();
    const id = typeof descriptor === "string" ? descriptor : normalizeSpeciesId(descriptor);
    const species = pack.species[id];
    if (!species) throw new Error(`Species not in offline combat pack: ${id}`);
    return structuredClone(species);
  }

  async getMove(id) {
    const pack = await loadPack();
    const move = pack.moves[id];
    if (!move) throw new Error(`Move not supported by offline core resolver: ${id}`);
    return structuredClone(move);
  }

  async getSupportedMoves(species, level) {
    const pack = await loadPack();
    return movePoolsForLevel(species, level)
      .filter((id) => pack.moves[id])
      .map((id) => structuredClone(pack.moves[id]));
  }

  async metadata() {
    const pack = await loadPack();
    return structuredClone(pack.source);
  }
}
