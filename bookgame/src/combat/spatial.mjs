export function point(x = 0, y = 0) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error("Coordinates must be finite numbers");
  return { x, y };
}

export function distance(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function reachForSize(size) {
  return ["huge", "gargantuan"].includes(String(size).toLowerCase()) ? 10 : 5;
}

export function baseMovementSpeed(combatant) {
  const preferred = ["walking", "hover", "flying", "burrowing", "swimming"];
  for (const type of preferred) {
    const speed = combatant.speed?.find((entry) => entry.type === type);
    if (speed) return { type, value: speed.value };
  }
  return { type: "walking", value: 0 };
}

export function movementSpeed(combatant, round = null) {
  const base = baseMovementSpeed(combatant);
  const movementLocked = (combatant.effects?.movementLockSources ?? [])
    .some((source) => round == null || source.expiresRound == null || round < source.expiresRound);
  const speedModifier = (combatant.effects?.speedModifierSources ?? [])
    .filter((source) => round == null || source.expiresRound == null || round < source.expiresRound)
    .reduce((sum, source) => sum + source.value, 0);
  const modified = movementLocked ? 0 : Math.max(0, base.value + speedModifier);
  const value = combatant.statuses?.nonVolatile === "Paralysis"
    ? modified / 2
    : modified;
  return { ...base, value };
}

export function moveRange(move, attacker) {
  if (move.range?.type === "self") return 0;
  if (move.range?.type === "melee") return attacker.reach;
  if (move.range?.type === "distance") return move.range.value;
  return null;
}

export function canTargetMove(attacker, defender, move) {
  const max = moveRange(move, attacker);
  if (max == null) return { legal: false, reason: "unsupported_range" };
  if (move.range?.type === "self") return { legal: true, distance: 0, maxRange: 0 };

  const actual = distance(attacker.position, defender.position);
  return {
    legal: actual <= max + 1e-9,
    distance: actual,
    maxRange: max,
    reason: actual <= max + 1e-9 ? null : "out_of_range"
  };
}

export function leavesReach({ moverStart, moverEnd, reactor }) {
  const before = distance(moverStart, reactor.position);
  const after = distance(moverEnd, reactor.position);
  return before <= reactor.reach + 1e-9 && after > reactor.reach + 1e-9;
}

export function moveToward(start, target, feet) {
  const d = distance(start, target);
  if (d === 0 || feet <= 0) return { ...start };
  const travel = Math.min(feet, d);
  return {
    x: start.x + ((target.x - start.x) / d) * travel,
    y: start.y + ((target.y - start.y) / d) * travel
  };
}

export function withinLineOfSightDistance(origin, target, maxFeet) {
  return distance(origin, target) <= maxFeet + 1e-9;
}
