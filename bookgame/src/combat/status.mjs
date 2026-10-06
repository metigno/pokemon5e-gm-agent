const NON_VOLATILE = new Set([
  "Asleep",
  "Burned",
  "Frozen",
  "Paralysis",
  "Poisoned",
  "BadlyPoisoned"
]);

const VOLATILE = new Set(["Confused", "Flinched"]);

export function createStatusState() {
  return {
    nonVolatile: null,
    remainingRounds: null,
    sourceProficiencyBonus: null,
    confusedRounds: 0,
    flinchedTurns: 0
  };
}

function abilityStatusImmunity(combatant, status) {
  if (status === "Asleep" && ["comatose", "insomnia"].includes(combatant.abilityId)) {
    return combatant.abilityId;
  }
  if (status === "Confused" && combatant.abilityId === "own-tempo") return "own-tempo";
  if (status === "Flinched" && combatant.abilityId === "inner-focus") return "inner-focus";
  if (status === "Paralysis" && combatant.abilityId === "limber") return "limber";
  if (
    ["Poisoned", "BadlyPoisoned"].includes(status) &&
    ["immunity", "pastel-veil"].includes(combatant.abilityId)
  ) {
    return combatant.abilityId;
  }
  if (
    status === "Burned" &&
    ["heatproof", "water-veil"].includes(combatant.abilityId)
  ) {
    return combatant.abilityId;
  }
  if (status === "Frozen" && combatant.abilityId === "magma-armor") return "magma-armor";
  if (NON_VOLATILE.has(status) && combatant.abilityId === "purifying-salt") {
    return "purifying-salt";
  }
  return null;
}

export function statusImmunity(combatant, status) {
  if (status === "Burned" && combatant.types.includes("fire")) return "fire_type";
  if (status === "Frozen" && combatant.types.includes("ice")) return "ice_type";
  if (status === "Paralysis" && combatant.types.includes("electric")) return "electric_type";
  if (
    (status === "Poisoned" || status === "BadlyPoisoned") &&
    (combatant.types.includes("poison") || combatant.types.includes("steel"))
  ) {
    return "poison_or_steel_type";
  }
  return null;
}

export function applyStatus(
  combatant,
  status,
  { sourceProficiencyBonus = null, ignoreTypeImmunity = false } = {}
) {
  combatant.statuses ??= createStatusState();

  const abilityImmunity = abilityStatusImmunity(combatant, status);
  if (abilityImmunity) {
    return { applied: false, status, reason: `ability:${abilityImmunity}` };
  }

  if (status === "Flinched") {
    combatant.statuses.flinchedTurns = Math.max(combatant.statuses.flinchedTurns ?? 0, 1);
    return { applied: true, status };
  }

  if (status === "Confused") {
    combatant.statuses.confusedRounds = Math.max(combatant.statuses.confusedRounds ?? 0, 3);
    return { applied: true, status };
  }

  if (!NON_VOLATILE.has(status)) throw new Error(`Unsupported status: ${status}`);

  const immunity = statusImmunity(combatant, status);
  if (immunity && !ignoreTypeImmunity) return { applied: false, status, reason: immunity };

  if (combatant.statuses.nonVolatile && combatant.statuses.nonVolatile !== status) {
    return { applied: false, status, reason: "non_volatile_already_present" };
  }

  combatant.statuses.nonVolatile = status;
  combatant.statuses.remainingRounds = status === "Asleep" ? 3 : null;
  combatant.statuses.sourceProficiencyBonus =
    Number.isFinite(sourceProficiencyBonus) ? sourceProficiencyBonus : null;
  return { applied: true, status };
}

export function clearStatus(combatant, status) {
  if (!combatant.statuses) return false;

  if (status === "Flinched") {
    const had = (combatant.statuses.flinchedTurns ?? 0) > 0;
    combatant.statuses.flinchedTurns = 0;
    return had;
  }
  if (status === "Confused") {
    const had = (combatant.statuses.confusedRounds ?? 0) > 0;
    combatant.statuses.confusedRounds = 0;
    return had;
  }

  if (combatant.statuses.nonVolatile !== status) return false;
  combatant.statuses.nonVolatile = null;
  combatant.statuses.remainingRounds = null;
  combatant.statuses.sourceProficiencyBonus = null;
  return true;
}

export function hasStatus(combatant, status) {
  if (status === "Flinched") return (combatant.statuses?.flinchedTurns ?? 0) > 0;
  if (status === "Confused") return (combatant.statuses?.confusedRounds ?? 0) > 0;
  return combatant.statuses?.nonVolatile === status;
}

export function attackHasDisadvantage(combatant) {
  const poisoned =
    ["Poisoned", "BadlyPoisoned"].includes(combatant.statuses?.nonVolatile) &&
    combatant.abilityId !== "guts";
  return poisoned || (combatant.statuses?.flinchedTurns ?? 0) > 0;
}

export function abilityCheckHasDisadvantage(combatant) {
  const poisoned =
    ["Poisoned", "BadlyPoisoned"].includes(combatant.statuses?.nonVolatile) &&
    combatant.abilityId !== "guts";
  return poisoned || (combatant.statuses?.flinchedTurns ?? 0) > 0;
}

export function damageHasDisadvantage(combatant) {
  return (
    combatant.statuses?.nonVolatile === "Burned" &&
    combatant.abilityId !== "guts"
  );
}

export function saveHasDisadvantage(combatant, attribute) {
  if ((combatant.statuses?.flinchedTurns ?? 0) > 0) return true;
  if (combatant.statuses?.nonVolatile === "Asleep") return true;
  return (
    combatant.statuses?.nonVolatile === "Paralysis" &&
    ["str", "dex"].includes(attribute)
  );
}

export function isIncapacitated(combatant) {
  return ["Asleep", "Frozen"].includes(combatant.statuses?.nonVolatile);
}

export function isRestrained(combatant) {
  return ["Asleep", "Frozen"].includes(combatant.statuses?.nonVolatile);
}

export function reactionsDisabled(combatant) {
  return isIncapacitated(combatant) || (combatant.statuses?.confusedRounds ?? 0) > 0;
}

export function startTurnStatus(combatant, dice) {
  const rolls = [];

  // Pokémon 5e 2024 explicitly resolves Paralysis before Asleep/Confused.
  if (combatant.statuses?.nonVolatile === "Paralysis") {
    const roll = dice.roll(4);
    rolls.push({ status: "Paralysis", die: "d4", roll });
    if (roll === 1) {
      return { skipTurn: true, reason: "Paralysis", rolls, forcedAction: null };
    }
  }

  if (combatant.statuses?.nonVolatile === "Frozen") {
    return { skipTurn: true, reason: "Frozen", rolls, forcedAction: null };
  }

  if (combatant.statuses?.nonVolatile === "Asleep") {
    return { skipTurn: true, reason: "Asleep", rolls, forcedAction: null };
  }

  if ((combatant.statuses?.confusedRounds ?? 0) > 0) {
    const roll = dice.roll(8);
    rolls.push({ status: "Confused", die: "d8", roll });

    if (roll === 8) {
      combatant.statuses.confusedRounds = 0;
      return { skipTurn: false, reason: null, rolls, forcedAction: null, statusEnded: "Confused" };
    }
    if (roll === 3) {
      return { skipTurn: true, reason: "Confused", rolls, forcedAction: null };
    }
    if (roll === 1) {
      return { skipTurn: false, reason: "Confused", rolls, forcedAction: "STRUGGLE_SELF" };
    }
    if (roll === 2) {
      return { skipTurn: false, reason: "Confused", rolls, forcedAction: "STRUGGLE_NEAREST" };
    }
  }

  return { skipTurn: false, reason: null, rolls, forcedAction: null };
}

function activeSaveModifier(combatant, round = null) {
  return (combatant.effects?.saveModifierSources ?? [])
    .filter((source) =>
      round == null ||
      ((source.startsRound == null || round >= source.startsRound) &&
       (source.expiresRound == null || round < source.expiresRound))
    )
    .reduce((sum, source) => sum + Number(source.value ?? 0), 0);
}

function hasSaveAdvantage(combatant, round = null) {
  return (combatant.effects?.saveAdvantageSources ?? []).some(
    (source) =>
      round == null ||
      ((source.startsRound == null || round >= source.startsRound) &&
       (source.expiresRound == null || round < source.expiresRound))
  );
}

export function endTurnStatus(combatant, dice, proficiencyBonus, round = null) {
  const events = [];
  const nonVolatile = combatant.statuses?.nonVolatile;

  if (["Burned", "Poisoned", "BadlyPoisoned"].includes(nonVolatile)) {
    const multiplier = nonVolatile === "BadlyPoisoned" ? 2 : 1;
    const damage = proficiencyBonus * multiplier;
    combatant.hp.current = Math.max(0, combatant.hp.current - damage);
    events.push({
      type: "status_damage",
      status: nonVolatile,
      damage,
      hpAfter: combatant.hp.current
    });
  }

  if (nonVolatile === "Asleep") {
    const rolls = combatant.abilityId === "early-bird"
      ? [dice.roll(20), dice.roll(20)]
      : [dice.roll(20)];
    const roll = Math.max(...rolls);
    combatant.statuses.remainingRounds = Math.max(
      0,
      (combatant.statuses.remainingRounds ?? 1) - 1
    );
    const wake = roll >= 11 || combatant.statuses.remainingRounds === 0;
    events.push({
      type: "wake_check",
      roll,
      rolls,
      advantage: combatant.abilityId === "early-bird",
      wake
    });
    if (wake) clearStatus(combatant, "Asleep");
  }

  if (nonVolatile === "Frozen") {
    const advantage = hasSaveAdvantage(combatant, round);
    const rolls = advantage ? [dice.roll(20), dice.roll(20)] : [dice.roll(20)];
    const natural = Math.max(...rolls);
    const effectModifier = activeSaveModifier(combatant, round);
    const modifier = Math.floor((combatant.attributes.str - 10) / 2) +
      (combatant.savingThrows?.includes("str") ? proficiencyBonus : 0) +
      effectModifier;
    const sourcePb = combatant.statuses.sourceProficiencyBonus ?? proficiencyBonus;
    const dc = 10 + sourcePb;
    const total = natural + modifier;
    const thaw = total >= dc;
    events.push({
      type: "frozen_break_check",
      natural,
      rolls,
      advantage,
      effectModifier,
      modifier,
      total,
      dc,
      thaw
    });
    if (thaw) clearStatus(combatant, "Frozen");
  }

  if ((combatant.statuses?.confusedRounds ?? 0) > 0) {
    combatant.statuses.confusedRounds -= 1;
    if (combatant.statuses.confusedRounds === 0) {
      events.push({ type: "status_end", status: "Confused" });
    }
  }

  if ((combatant.statuses?.flinchedTurns ?? 0) > 0) {
    combatant.statuses.flinchedTurns -= 1;
    if (combatant.statuses.flinchedTurns === 0) {
      events.push({ type: "status_end", status: "Flinched" });
    }
  }

  return events;
}

export function endFrozenOnFireDamage(combatant, move, damage) {
  if (damage <= 0 || combatant.statuses?.nonVolatile !== "Frozen") return false;
  const canBurn = /burn/i.test(move?.description ?? "");
  if (move?.type !== "fire" && !canBurn) return false;
  return clearStatus(combatant, "Frozen");
}

export const STATUS_IDS = Object.freeze([...NON_VOLATILE, ...VOLATILE]);
