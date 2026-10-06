import {
  altitude,
  distance,
  horizontalDistance,
  point,
  shapeContains2d
} from "./spatial.mjs";

function clonePoint(value) {
  return point(value.x, value.y, Number.isFinite(value.z) ? value.z : undefined);
}

function baseZone({
  id,
  shape,
  moveId,
  sourceSide,
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
  noSave = false,
  triggerOnEnter = true,
  triggerOnLeave = false
}) {
  return {
    id,
    shape,
    moveId,
    sourceSide,
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
    noSave,
    triggerOnEnter,
    triggerOnLeave
  };
}

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
  noSave = false,
  triggerOnEnter = true,
  triggerOnLeave = false
}) {
  return {
    ...baseZone({
      id,
      shape: "circle",
      moveId,
      sourceSide,
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
      immuneTypes,
      noSave,
      triggerOnEnter,
      triggerOnLeave
    }),
    center: clonePoint(center),
    radius: Number(radius)
  };
}

export function createSphereZone(args) {
  return {
    ...baseZone({ ...args, shape: "sphere" }),
    center: clonePoint(args.center),
    radius: Number(args.radius)
  };
}

export function createRectangleZone(args) {
  const zone = baseZone({ ...args, shape: "rectangle" });
  if (args.min && args.max) {
    zone.min = clonePoint(args.min);
    zone.max = clonePoint(args.max);
  } else {
    zone.center = clonePoint(args.center);
    zone.width = Number(args.width);
    zone.height = Number(args.height);
  }
  if (Number.isFinite(args.zMin)) zone.zMin = Number(args.zMin);
  if (Number.isFinite(args.zMax)) zone.zMax = Number(args.zMax);
  return zone;
}

function normalizeDirection(direction) {
  const dx = Number(direction?.x ?? 0);
  const dy = Number(direction?.y ?? 0);
  const dz = Number(direction?.z ?? 0);
  const magnitude = Math.hypot(dx, dy, dz);
  if (magnitude <= 1e-9) throw new Error("Zone direction must be non-zero");
  return { x: dx / magnitude, y: dy / magnitude, z: dz / magnitude };
}

export function createConeZone(args) {
  return {
    ...baseZone({ ...args, shape: "cone" }),
    origin: clonePoint(args.origin),
    direction: normalizeDirection(args.direction),
    length: Number(args.length),
    angle: Number(args.angle ?? 90)
  };
}

export function createLineZone(args) {
  const origin = clonePoint(args.origin);
  const width = Number(args.width ?? 5);
  if (args.end) {
    return {
      ...baseZone({ ...args, shape: "line" }),
      origin,
      end: clonePoint(args.end),
      width
    };
  }
  const direction = normalizeDirection(args.direction);
  const length = Number(args.length);
  return {
    ...baseZone({ ...args, shape: "line" }),
    origin,
    direction,
    length,
    width
  };
}

export function createEmanationZone(args) {
  return {
    ...baseZone({ ...args, shape: "emanation" }),
    center: clonePoint(args.center),
    radius: Number(args.radius),
    innerRadius: Math.max(0, Number(args.innerRadius ?? 0))
  };
}

function vector(from, to) {
  return {
    x: to.x - from.x,
    y: to.y - from.y,
    z: altitude(to) - altitude(from)
  };
}

function dot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function magnitude(value) {
  return Math.hypot(value.x, value.y, value.z);
}

function lineEnd(zone) {
  if (zone.end) return zone.end;
  return point(
    zone.origin.x + zone.direction.x * zone.length,
    zone.origin.y + zone.direction.y * zone.length,
    Number.isFinite(zone.origin.z) || Math.abs(zone.direction.z) > 1e-9
      ? altitude(zone.origin) + zone.direction.z * zone.length
      : undefined
  );
}

function distanceToSegment(position, start, end) {
  const ab = vector(start, end);
  const ap = vector(start, position);
  const denominator = dot(ab, ab);
  if (denominator <= 1e-9) return distance(position, start);
  const t = Math.max(0, Math.min(1, dot(ap, ab) / denominator));
  const closest = point(
    start.x + ab.x * t,
    start.y + ab.y * t,
    Number.isFinite(start.z) || Number.isFinite(end.z)
      ? altitude(start) + ab.z * t
      : undefined
  );
  return distance(position, closest);
}

export function zoneContains(zone, position) {
  switch (zone.shape) {
    case "circle":
      return horizontalDistance(zone.center, position) <= zone.radius + 1e-9;
    case "sphere":
      return distance(zone.center, position) <= zone.radius + 1e-9;
    case "rectangle": {
      if (!shapeContains2d(zone, position)) return false;
      const z = altitude(position);
      if (Number.isFinite(zone.zMin) && z < zone.zMin - 1e-9) return false;
      if (Number.isFinite(zone.zMax) && z > zone.zMax + 1e-9) return false;
      return true;
    }
    case "emanation": {
      const d = distance(zone.center, position);
      return d + 1e-9 >= zone.innerRadius && d <= zone.radius + 1e-9;
    }
    case "cone": {
      const relative = vector(zone.origin, position);
      const d = magnitude(relative);
      if (d > zone.length + 1e-9) return false;
      if (d <= 1e-9) return true;
      const cos = dot(relative, zone.direction) / d;
      const threshold = Math.cos((zone.angle * Math.PI / 180) / 2);
      return cos + 1e-9 >= threshold;
    }
    case "line":
      return distanceToSegment(position, zone.origin, lineEnd(zone)) <= zone.width / 2 + 1e-9;
    default:
      throw new Error(`Unsupported zone shape: ${zone.shape}`);
  }
}

export function zoneTransition(zone, from, to) {
  const wasInside = zoneContains(zone, from);
  const isInside = zoneContains(zone, to);
  return {
    wasInside,
    isInside,
    entered: !wasInside && isInside,
    left: wasInside && !isInside,
    crossedBoundary: wasInside !== isInside
  };
}

export function zonesContaining(zones, position) {
  return zones.filter((zone) => zoneContains(zone, position));
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
