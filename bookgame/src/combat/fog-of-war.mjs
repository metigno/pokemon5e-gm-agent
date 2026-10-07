const LEVELS = Object.freeze({
  public: 0,
  basic: 1,
  advanced: 2,
  pro: 3
});

export function normalizeKnowledgeLevel(level) {
  if (Number.isInteger(level)) return Math.max(0, Math.min(3, level));
  return LEVELS[String(level ?? "public").toLowerCase()] ?? 0;
}

export function opponentKnowledgeView(pokemon, level = 0) {
  const knowledge = normalizeKnowledgeLevel(level);
  const view = {
    speciesId: pokemon.speciesId ?? null,
    name: pokemon.name ?? pokemon.speciesId ?? "Unknown",
    hp: { current: pokemon.hp?.current ?? null, max: pokemon.hp?.max ?? null },
    fainted: Number(pokemon.hp?.current ?? 0) <= 0
  };
  if (knowledge >= 1) {
    view.level = pokemon.level ?? null;
    view.types = [...(pokemon.types ?? pokemon.baseTypes ?? [])];
  }
  if (knowledge >= 2) {
    view.abilityId = pokemon.abilityId ?? null;
    view.moveIds = [...(pokemon.moveIds ?? [])];
  }
  if (knowledge >= 3) {
    view.stats = pokemon.stats ? structuredClone(pokemon.stats) : null;
    view.pp = pokemon.pp ? structuredClone(pokemon.pp) : null;
    view.effects = pokemon.effects ? structuredClone(pokemon.effects) : null;
  }
  return view;
}

export function battleFogView(battle, knowledge = {}) {
  const activeLevel = knowledge.active ?? knowledge.default ?? 0;
  const benchLevel = knowledge.bench ?? knowledge.default ?? 0;
  return {
    round: battle.round,
    outcome: battle.outcome ?? null,
    player: structuredClone(battle.player),
    opponent: opponentKnowledgeView(battle.opponent, activeLevel),
    opponentBench: (battle.opponentBench ?? []).map(p => opponentKnowledgeView(p, benchLevel)),
    awaitingSwitch: battle.awaitingSwitch ?? null
  };
}
