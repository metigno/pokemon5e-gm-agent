import { distance, point } from "./spatial.mjs";

export function createCircleZone({
  id,
  moveId,
  sourceSide,
  center,
  radius,
  createdRound,
  expiresRound = null,
  expiresAtSourceTurn = false,
  concentration = false,
  saveDc,
  saveAttribute,
  damageDice,
  damageModifier,
  damageType,
  effect,
  flatDamage = null,
  immuneTypes = [],
  noSave = false
}) {
  return {
    id,
    shape: "circle",
    moveId,
    sourceSide,
    center: point(center.x, center.y),
    radius,
    createdRound,
    expiresRound,
    expiresAtSourceTurn,
    concentration,
    saveDc,
    saveAttribute,
    damageDice,
    damageModifier,
    damageType,
    effect,
    flatDamage,
    immuneTypes: [...immuneTypes],
    noSave
  };
}

export function zoneContains(zone, position) {
  if (zone.shape !== "circle") throw new Error(`Unsupported zone shape: ${zone.shape}`);
  return distance(zone.center, position) <= zone.radius + 1e-9;
}

export function removeZone(zones, zoneId) {
  return zones.filter((zone) => zone.id !== zoneId);
}

export function expireZonesAtTurnStart(zones, side, round) {
  const expired = [];
  const active = zones.filter((zone) => {
    const byRound = zone.expiresRound != null && round >= zone.expiresRound;
    const bySourceTurn =
      zone.expiresAtSourceTurn &&
      zone.sourceSide === side &&
      round > zone.createdRound;
    const shouldExpire = byRound || bySourceTurn;
    if (shouldExpire) expired.push(zone);
    return !shouldExpire;
  });
  return { active, expired };
}
