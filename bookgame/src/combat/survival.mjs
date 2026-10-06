import { rollD20 } from "./poke5e-rules.mjs";

export function createPokemonDeathState({ sanctioned = false } = {}) {
  return {
    state: sanctioned ? "fainted_stable" : "alive",
    deathSaveSuccesses: 0,
    deathSaveFailures: 0,
    stable: Boolean(sanctioned),
    dead: false,
    inPokeball: false,
    pokeballMinutes: 0
  };
}

export function faintPokemon(pokemon, { sanctioned = false } = {}) {
  pokemon.hp.current = 0;
  pokemon.death ??= createPokemonDeathState();
  pokemon.death.state = sanctioned ? "fainted_stable" : "dying";
  pokemon.death.deathSaveSuccesses = 0;
  pokemon.death.deathSaveFailures = 0;
  pokemon.death.stable = Boolean(sanctioned);
  pokemon.death.dead = false;
  pokemon.death.pokeballMinutes = 0;
  return pokemon.death;
}

export function recallFaintedPokemon(pokemon) {
  if ((pokemon.hp?.current ?? 0) > 0) {
    return { recalled: false, reason: "pokemon_not_fainted" };
  }
  pokemon.death ??= createPokemonDeathState();
  pokemon.death.inPokeball = true;
  pokemon.death.pokeballMinutes = 0;
  return {
    recalled: true,
    deathSavesPaused: true,
    state: pokemon.death.state
  };
}

export function releasePokemonFromBall(pokemon) {
  pokemon.death ??= createPokemonDeathState();
  pokemon.death.inPokeball = false;
  pokemon.death.pokeballMinutes = 0;
  return pokemon.death;
}

export function advancePokeballStabilization(pokemon, minutes) {
  pokemon.death ??= createPokemonDeathState();
  if (!pokemon.death.inPokeball || (pokemon.hp?.current ?? 0) > 0 || pokemon.death.dead) {
    return {
      advanced: false,
      stabilized: Boolean(pokemon.death.stable),
      minutes: pokemon.death.pokeballMinutes ?? 0
    };
  }

  pokemon.death.pokeballMinutes = Math.max(
    0,
    Number(pokemon.death.pokeballMinutes ?? 0) + Math.max(0, Number(minutes) || 0)
  );
  if (pokemon.death.pokeballMinutes >= 10) {
    pokemon.death.state = "stable";
    pokemon.death.stable = true;
    pokemon.death.deathSaveSuccesses = 0;
    pokemon.death.deathSaveFailures = 0;
  }
  return {
    advanced: true,
    stabilized: Boolean(pokemon.death.stable),
    minutes: pokemon.death.pokeballMinutes
  };
}

export function resolvePokemonDeathSave(pokemon, dice) {
  pokemon.death ??= createPokemonDeathState();

  if ((pokemon.hp?.current ?? 0) > 0) {
    return { rolled: false, reason: "pokemon_conscious", state: pokemon.death.state };
  }
  if (pokemon.death.dead) {
    return { rolled: false, reason: "pokemon_dead", state: "dead" };
  }
  if (pokemon.death.stable) {
    return { rolled: false, reason: "pokemon_stable", state: pokemon.death.state };
  }
  if (pokemon.death.inPokeball) {
    return { rolled: false, reason: "death_saves_paused_in_pokeball", state: pokemon.death.state };
  }

  const natural = dice.roll(20);
  let successes = Number(pokemon.death.deathSaveSuccesses ?? 0);
  let failures = Number(pokemon.death.deathSaveFailures ?? 0);
  let regainedHp = 0;

  if (natural === 20) {
    pokemon.hp.current = 1;
    regainedHp = 1;
    successes = 0;
    failures = 0;
    pokemon.death.state = "alive";
    pokemon.death.stable = false;
  } else if (natural === 1) {
    failures += 2;
  } else if (natural >= 10) {
    successes += 1;
  } else {
    failures += 1;
  }

  if (natural !== 20) {
    if (failures >= 3) {
      failures = 3;
      pokemon.death.state = "dead";
      pokemon.death.dead = true;
      pokemon.death.stable = false;
    } else if (successes >= 3) {
      successes = 3;
      pokemon.death.state = "stable";
      pokemon.death.stable = true;
    } else {
      pokemon.death.state = "dying";
    }
  }

  pokemon.death.deathSaveSuccesses = successes;
  pokemon.death.deathSaveFailures = failures;

  return {
    rolled: true,
    natural,
    successes,
    failures,
    regainedHp,
    state: pokemon.death.state,
    stable: pokemon.death.stable,
    dead: pokemon.death.dead
  };
}

function normalizeCheck(check) {
  if (typeof check === "number") return { modifier: check };
  return {
    modifier: Number(check?.modifier ?? 0),
    advantage: Boolean(check?.advantage),
    disadvantage: Boolean(check?.disadvantage),
    id: check?.id ?? null
  };
}

export function resolveGroupFleeCheck({
  participants,
  dc,
  dice,
  advantage = false,
  disadvantage = false
}) {
  if (!Array.isArray(participants) || participants.length === 0) {
    throw new Error("A flee group check requires at least one participant");
  }
  if (!Number.isFinite(dc)) throw new Error("A flee group check requires a numeric DC");

  const checks = participants.map((raw, index) => {
    const check = normalizeCheck(raw);
    const roll = rollD20(dice, {
      advantage: advantage || check.advantage,
      disadvantage: disadvantage || check.disadvantage
    });
    const total = roll.natural + check.modifier;
    return {
      id: check.id ?? index,
      modifier: check.modifier,
      ...roll,
      total,
      success: total >= dc
    };
  });
  const successes = checks.filter((entry) => entry.success).length;
  const requiredSuccesses = Math.ceil(checks.length / 2);

  return {
    dc,
    checks,
    successes,
    failures: checks.length - successes,
    requiredSuccesses,
    escaped: successes >= requiredSuccesses
  };
}

export function createChaseState({
  quarry = "party",
  pursuer = "wild",
  lead = 0,
  escapeLead = 3,
  captureLead = -3,
  maxRounds = 10
} = {}) {
  return {
    quarry,
    pursuer,
    round: 1,
    lead: Number(lead) || 0,
    escapeLead,
    captureLead,
    maxRounds,
    outcome: null,
    log: []
  };
}

export function resolveChaseRound(state, {
  quarryCheck,
  pursuerCheck,
  dice,
  quarryAdvantage = false,
  pursuerAdvantage = false
}) {
  if (state.outcome) return structuredClone(state);
  const next = structuredClone(state);
  const quarry = normalizeCheck(quarryCheck);
  const pursuer = normalizeCheck(pursuerCheck);
  const qRoll = rollD20(dice, {
    advantage: quarryAdvantage || quarry.advantage,
    disadvantage: quarry.disadvantage
  });
  const pRoll = rollD20(dice, {
    advantage: pursuerAdvantage || pursuer.advantage,
    disadvantage: pursuer.disadvantage
  });
  const quarryTotal = qRoll.natural + quarry.modifier;
  const pursuerTotal = pRoll.natural + pursuer.modifier;

  if (quarryTotal > pursuerTotal) next.lead += 1;
  else if (pursuerTotal > quarryTotal) next.lead -= 1;

  if (next.lead >= next.escapeLead) next.outcome = "escaped";
  else if (next.lead <= next.captureLead) next.outcome = "caught";
  else if (next.round >= next.maxRounds) next.outcome = next.lead > 0 ? "escaped" : "caught";

  next.log.push({
    round: next.round,
    quarryRoll: { ...qRoll, modifier: quarry.modifier, total: quarryTotal },
    pursuerRoll: { ...pRoll, modifier: pursuer.modifier, total: pursuerTotal },
    lead: next.lead,
    outcome: next.outcome
  });
  if (!next.outcome) next.round += 1;
  return next;
}
