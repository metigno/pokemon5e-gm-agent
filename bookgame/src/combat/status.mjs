const NON_VOLATILE = new Set(["Asleep", "Burned", "Paralysis", "Poisoned"]);

export function createStatusState() {
  return {
    nonVolatile: null,
    remainingRounds: null,
    flinchedTurns: 0
  };
}

export function statusImmunity(combatant, status) {
  if (status === "Burned" && combatant.types.includes("fire")) return "fire_type";
  if (status === "Paralysis" && combatant.types.includes("electric")) return "electric_type";
  if (status === "Poisoned" && (combatant.types.includes("poison") || combatant.types.includes("steel"))) {
    return "poison_or_steel_type";
  }
  return null;
}

export function applyStatus(combatant, status) {
  if (status === "Flinched") {
    combatant.statuses.flinchedTurns = Math.max(combatant.statuses.flinchedTurns, 1);
    return { applied: true, status };
  }

  if (!NON_VOLATILE.has(status)) throw new Error(`Unsupported status: ${status}`);

  const immunity = statusImmunity(combatant, status);
  if (immunity) return { applied: false, status, reason: immunity };

  if (combatant.statuses.nonVolatile && combatant.statuses.nonVolatile !== status) {
    return { applied: false, status, reason: "non_volatile_already_present" };
  }

  combatant.statuses.nonVolatile = status;
  combatant.statuses.remainingRounds = status === "Asleep" ? 3 : null;
  return { applied: true, status };
}

export function attackHasDisadvantage(combatant) {
  return combatant.statuses.nonVolatile === "Poisoned" || combatant.statuses.flinchedTurns > 0;
}

export function damageHasDisadvantage(combatant) {
  return combatant.statuses.nonVolatile === "Burned";
}

export function saveHasDisadvantage(combatant, attribute) {
  if (combatant.statuses.flinchedTurns > 0) return true;
  if (combatant.statuses.nonVolatile === "Asleep") return true;
  return combatant.statuses.nonVolatile === "Paralysis" && ["str", "dex"].includes(attribute);
}

export function startTurnStatus(combatant, dice) {
  if (combatant.statuses.nonVolatile === "Asleep") {
    return { skipTurn: true, reason: "Asleep", rolls: [] };
  }

  if (combatant.statuses.nonVolatile === "Paralysis") {
    const roll = dice.roll(4);
    if (roll === 1) {
      return { skipTurn: true, reason: "Paralysis", rolls: [roll] };
    }
    return { skipTurn: false, reason: null, rolls: [roll] };
  }

  return { skipTurn: false, reason: null, rolls: [] };
}

export function endTurnStatus(combatant, dice, proficiencyBonus) {
  const events = [];

  if (combatant.statuses.nonVolatile === "Burned" || combatant.statuses.nonVolatile === "Poisoned") {
    const status = combatant.statuses.nonVolatile;
    const damage = proficiencyBonus;
    combatant.hp.current = Math.max(0, combatant.hp.current - damage);
    events.push({ type: "status_damage", status, damage, hpAfter: combatant.hp.current });
  }

  if (combatant.statuses.nonVolatile === "Asleep") {
    const roll = dice.roll(20);
    combatant.statuses.remainingRounds = Math.max(0, (combatant.statuses.remainingRounds ?? 1) - 1);
    const wake = roll >= 11 || combatant.statuses.remainingRounds === 0;
    events.push({ type: "wake_check", roll, wake });
    if (wake) {
      combatant.statuses.nonVolatile = null;
      combatant.statuses.remainingRounds = null;
    }
  }

  if (combatant.statuses.flinchedTurns > 0) {
    combatant.statuses.flinchedTurns -= 1;
    if (combatant.statuses.flinchedTurns === 0) {
      events.push({ type: "status_end", status: "Flinched" });
    }
  }

  return events;
}
