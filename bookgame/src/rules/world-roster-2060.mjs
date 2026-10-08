// Canonical species only, extracted from Roster2060(1).md (post-2056 / 2060).
// Pokemon 5e battle species, NOT the videogame battle builds:
// no Mega, Gigamax, Dynamax, EV, IV, abilities, game-held items or auto bonuses.
const CANONICAL_SPECIES = `
Luke|Arcanine-Hisui|Venusaur|Kyurem-Black|Great Tusk|Blastoise|Kilowattrel
Mattew|Jolteon|Infernape|Gardevoir|Swampert|Corviknight|Zacian-Crowned
Daniel|Gengar|Machamp|Mewtwo|Charizard|Aggron|Poliwrath
Edward|Feraligatr|Lapras|Jolteon|Houndoom|Lugia|Tyranitar
Fab|Weezing|Rayquaza|Electivire|Skarmory|Sceptile|Alakazam
Cynthia|Garchomp|Lucario|Milotic|Togekiss|Cresselia|Roserade
Steven Stone|Metagross|Registeel|Archaludon|Garganacl|Skarmory|Excadrill
N|Reshiram|Zoroark|Galvantula|Ferrothorn|Excadrill|Mienshao
Red|Charizard|Jolteon|Lapras|Dodrio|Deoxys-Speed|Scizor
Lance|Dragonite|Salamence|Garchomp|Dragapult|Archaludon|Giratina-Origin
Campione di Borrius|Metagross|Incineroar|Torterra|Samurott-Hisui|Ninetales-Alola|Hoopa-Unbound
Alder|Volcarona|Accelgor|Escavalier|Druddigon|Audino|Cobalion
Kael|Ferrothorn|Tentacruel|Gliscor|Sableye|Skeledirge|Lunala
Darian|Blaziken|Swampert|Gardevoir|Hydreigon|Jolteon|Necrozma-Dusk-Mane
Ferred|Tyranitar|Breloom|Garchomp|Jirachi|Dragonite|Starmie
Ren|Ninetales|Landorus-Therian|Ferrothorn|Garchomp|Starmie|Houndoom
Ethan|Gyarados|Typhlosion|Raikou|Tyranitar|Togekiss|Scizor
Brendan|Sceptile|Latios|Swampert|Aggron|Cinderace|Gholdengo
Lucinda|Empoleon|Lucario|Mew|Weavile|Garchomp|Rotom-Heat
Rei|Samurott-Hisui|Zoroark-Hisui|Ursaluna|Scizor|Sneasler|Palkia-Origin
Blue|Blastoise|Machamp|Zapdos|Tyranitar|Alakazam|Arcanine
Giovanni|Miraidon|Iron Bundle|Great Tusk|Ursaluna-Bloodmoon|Gengar|Kingambit
Dandel / Leon|Charizard|Dragapult|Aegislash|Cinderace|Eternatus|Salamence
Archie|Kyogre|Sharpedo|Archaludon|Ferrothorn|Pelipper|Basculegion
Maxie|Groudon|Camerupt|Torkoal|Venusaur|Roaring Moon|Great Tusk
Astrid Vahl|Xerneas|Mawile|Corviknight|Rotom-Wash|Dragapult|Clodsire
Silas Crowe|Calyrex-Shadow|Ceruledge|Grimmsnarl|Baxcalibur|Glimmora|Gengar
Rurik Dune|Zygarde|Tyranitar|Excadrill|Toxapex|Corviknight|Clefable
Ayame Hoshino|Ho-Oh|Lopunny|Rillaboom|Gliscor|Slowking-Galar|Gholdengo
Orion Vale|Solgaleo|Volcarona|Melmetal|Great Tusk|Rotom-Wash|Scizor
Nyx Vesper|Yveltal|Weavile|Gyarados|Ferrothorn|Gliscor|Gholdengo
Kaia Solari|Koraidon|Houndoom|Flutter Mane|Walking Wake|Great Tusk|Corviknight
Lucas|Torterra|Infernape|Empoleon|Staraptor|Arceus|Mamoswine
Ronan Ward|Rillaboom|Zamazenta-Crowned|Incineroar|Dragonite|Volcarona|Blastoise
Soren Veyr|Garchomp|Gallade|Jolteon|Infernape|Dialga|Noctowl
`.trim();

export const WORLD_2060_SPECIES = Object.freeze(
  Object.fromEntries(CANONICAL_SPECIES.split("\n").map((line) => {
    const [name, ...team] = line.split("|");
    if (!name || team.length !== 6 || team.some((species) => !species)) {
      throw new Error("Invalid 2060 canonical team: " + name);
    }
    return [name, Object.freeze(team)];
  }))
);

const FORMS = new Map([
  ["Hisui", "Hisuian"], ["Alola", "Alolan"], ["Galar", "Galarian"],
  ["Black", "Black"], ["Crowned", "Crowned"], ["Origin", "Origin"],
  ["Speed", "Speed"], ["Therian", "Therian"], ["Dusk-Mane", "Dusk Mane"],
  ["Shadow", "Shadow"], ["Unbound", "Unbound"], ["Heat", "Heat"],
  ["Wash", "Wash"], ["Bloodmoon", "Bloodmoon"]
]);

// Preserve regional/legendary forms in Pokemon 5e where the offline pack
// supports them. Alpha/Shiny and videogame transformations are not species.
export function pokemon5eWorldSpeciesDescriptor(speciesName) {
  if (typeof speciesName !== "string" || !speciesName.trim()) {
    throw new Error("World roster species must be a nonempty name");
  }
  let label = speciesName.replace(/^(?:Shiny\s+)?(?:Mega\s+|Gigamax\s+|Primal\s+)?/i, "")
    .replace(/\s+Alpha$/i, "")
    .replace(/-Gmax$/i, "")
    .replace(/^Arcanine di Hisui$/i, "Arcanine-Hisui")
    .replace(/-W$/i, "-Wash")
    .replace(/-M$/i, "")
    .trim();
  for (const [suffix, form] of FORMS) {
    if (label.endsWith("-" + suffix)) {
      return { species: label.slice(0, -(suffix.length + 1)), form };
    }
  }
  return { species: label };
}

// World cap is Lv20, never Pokemon Lv100 and never scaled to the player.
// Friend NPC levels come from their real saved career; other canonical World
// entrants have fixed competition-level-20 species records (not random proxies).
export function canonicalWorldTeam(name, { npc = null, trainerId, regulation = "WORLD_GROUPS_L20" } = {}) {
  const expected = WORLD_2060_SPECIES[name];
  if (!expected) throw new Error("Missing canonical World 2060 species for " + name);
  let entries;
  if (npc?.canonicalCareer) {
    const career = [...(npc.rosterCareer ?? [])].sort((a, b) => a.slot - b.slot);
    if (career.length !== 6 || career.some((pokemon) => !pokemon.acquired)) {
      throw new Error("World participant " + name + " has not acquired a full persistent roster");
    }
    // Preserve the NPC's acquired slot identities; final canon specifies a
    // six-species set, not the ordering of the saved career slots (Luke's
    // Blastoise and Kilowattrel occupy opposite listed positions).
    const key = (descriptor) => descriptor.species + "|" + (descriptor.form ?? "");
    const expectedKeys = expected.map((species) => key(pokemon5eWorldSpeciesDescriptor(species))).sort();
    const careerKeys = career.map((pokemon) => key(pokemon5eWorldSpeciesDescriptor(pokemon.species))).sort();
    if (JSON.stringify(expectedKeys) !== JSON.stringify(careerKeys)) {
      throw new Error("Canonical World species mismatch for " + name);
    }
    entries = career.map((pokemon) => {
      const descriptor = pokemon5eWorldSpeciesDescriptor(pokemon.species);
      if (!Number.isInteger(pokemon.pokemonLevel) || pokemon.pokemonLevel < 1 || pokemon.pokemonLevel > 20) {
        throw new Error("Illegal persistent NPC Pokemon level for " + name);
      }
      return { ...descriptor, level: pokemon.pokemonLevel, careerPokemonId: pokemon.id };
    });
  } else {
    entries = expected.map((species) => ({
      ...pokemon5eWorldSpeciesDescriptor(species), level: 20
    }));
  }
  return entries.map((entry, rosterIndex) => ({
    ...entry, trainerId, rosterIndex, regulation, source: "canonical_2060_species"
  }));
}
