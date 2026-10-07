function hpRatio(pokemon) {
  const max = Math.max(1, Number(pokemon?.hp?.max ?? 1));
  return Math.max(0, Number(pokemon?.hp?.current ?? 0)) / max;
}

function typePressure(candidate, enemy) {
  const candidateTypes = new Set(candidate?.types ?? candidate?.baseTypes ?? []);
  const enemyTypes = new Set(enemy?.types ?? enemy?.baseTypes ?? []);
  let score = 0;
  for (const type of candidateTypes) if (!enemyTypes.has(type)) score += 1;
  return score;
}

export function chooseForcedOpponentReplacement(battle) {
  const bench = battle.opponentBench ?? [];
  const legal = bench
    .map((pokemon, index) => ({ pokemon, index }))
    .filter(({ pokemon }) => Number(pokemon?.hp?.current ?? 0) > 0);
  if (legal.length === 0) return null;

  legal.sort((a, b) => {
    const hp = hpRatio(b.pokemon) - hpRatio(a.pokemon);
    if (Math.abs(hp) > 1e-9) return hp;
    const pressure = typePressure(b.pokemon, battle.player) - typePressure(a.pokemon, battle.player);
    if (pressure !== 0) return pressure;
    const level = Number(b.pokemon.level ?? 0) - Number(a.pokemon.level ?? 0);
    if (level !== 0) return level;
    return a.index - b.index;
  });
  return legal[0].index;
}
