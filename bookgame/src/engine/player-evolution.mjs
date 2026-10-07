import { availableEvolutions, evolvePokemon } from "./pokemon-progression.mjs";
import { evolutionPresentationFromResult } from "./evolution-presentation.mjs";

function clone(value) { return structuredClone(value); }

function evolutionContext(state) {
  return {
    inventory: clone(state.player?.inventory ?? []),
    money: Number(state.player?.money ?? 0),
    timeOfDay: state.world?.time,
    daypart: state.world?.time,
    world: clone(state.world ?? {}),
    party: clone(state.player?.roster ?? [])
  };
}

export async function playerEvolutionOptions(state, { rosterIndex = null, data } = {}) {
  const roster = state.player?.roster ?? [];
  const indexes = rosterIndex == null ? roster.map((_, index) => index) : [Number(rosterIndex)];
  const options = [];
  for (const index of indexes) {
    const pokemon = roster[index];
    if (!pokemon) continue;
    for (const evolution of await availableEvolutions(pokemon, evolutionContext(state), data)) {
      options.push({ rosterIndex: index, evolution: clone(evolution) });
    }
  }
  return options;
}

export async function applyPlayerEvolution(state, {
  rosterIndex,
  evolutionId,
  asiDistribution = null,
  reducedMotion = false,
  data
} = {}) {
  const index = Number(rosterIndex);
  if (!Number.isInteger(index) || index < 0 || !state.player?.roster?.[index]) {
    throw new Error("Invalid player roster index for evolution");
  }

  const options = await playerEvolutionOptions(state, { rosterIndex: index, data });
  const selected = options.find((entry) => entry.evolution.id === evolutionId);
  if (!selected) throw new Error(`Evolution is not currently available: ${evolutionId}`);

  const context = evolutionContext(state);
  const result = await evolvePokemon(state.player.roster[index], selected.evolution, {
    context,
    asiDistribution,
    data
  });

  if (result.status === "choice_required") {
    return { state: clone(state), result, presentation: null };
  }

  const next = clone(state);
  if (result.mode === "additional") {
    next.player.roster.push(clone(result.additionalPokemon));
    if (result.consumedInventory) next.player.inventory = clone(result.consumedInventory);
  } else {
    next.player.roster[index] = clone(result.pokemon);
    if (result.consumedInventory) next.player.inventory = clone(result.consumedInventory);
  }

  const decorated = {
    ...result,
    evolution: clone(selected.evolution)
  };
  return {
    state: next,
    result: decorated,
    presentation: evolutionPresentationFromResult(decorated, { reducedMotion }).presentation
  };
}
