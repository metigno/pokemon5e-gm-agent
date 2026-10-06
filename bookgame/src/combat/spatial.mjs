const EPSILON = 1e-9;

export function point(x = 0, y = 0, z = undefined) {
  if (!Number.isFinite(x) || !Number.isFinite(y) || (z !== undefined && !Number.isFinite(z))) {
    throw new Error("Coordinates must be finite numbers");
  }
  return z === undefined ? { x, y } : { x, y, z };
}

export function altitude(value) {
  return Number.isFinite(value?.z) ? Number(value.z) : 0;
}

export function horizontalDistance(a, b) {
  return Math.hypot(Number(b.x) - Number(a.x), Number(b.y) - Number(a.y));
}

export function distance(a, b) {
  return Math.hypot(
    Number(b.x) - Number(a.x),
    Number(b.y) - Number(a.y),
    altitude(b) - altitude(a)
  );
}

export function reachForSize(size) {
  return ["huge", "gargantuan"].includes(String(size).toLowerCase()) ? 10 : 5;
}

function activeSource(source, round) {
  return round == null ||
    ((source.startsRound == null || round >= source.startsRound) &&
     (source.expiresRound == null || round < source.expiresRound));
}

export function movementSpeedForType(combatant, type = "walking", round = null) {
  const speed = (combatant.speed ?? []).find((entry) => entry.type === type);
  const base = Number(speed?.value ?? 0);
  const movementLocked =
    (combatant.effects?.movementLockSources ?? []).some((source) => activeSource(source, round)) ||
    (combatant.effects?.restrainedSources ?? []).some((source) => activeSource(source, round));
  const modifier = (combatant.effects?.speedModifierSources ?? [])
    .filter((source) => activeSource(source, round))
    .filter((source) => !Array.isArray(source.types) || source.types.includes(type))
    .reduce((sum, source) => sum + Number(source.value ?? 0), 0);
  const modified = movementLocked ? 0 : Math.max(0, base + modifier);
  const value = combatant.statuses?.nonVolatile === "Paralysis"
    ? modified / 2
    : modified;
  return { type, value };
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
  return movementSpeedForType(combatant, baseMovementSpeed(combatant).type, round);
}

export function moveRange(move, attacker) {
  if (move.range?.type === "self") return 0;
  if (move.range?.type === "melee") return attacker.reach;
  if (move.range?.type === "distance") return move.range.value;
  return null;
}

function rectBounds(shape) {
  if (shape.min && shape.max) {
    return {
      minX: Math.min(shape.min.x, shape.max.x),
      maxX: Math.max(shape.min.x, shape.max.x),
      minY: Math.min(shape.min.y, shape.max.y),
      maxY: Math.max(shape.min.y, shape.max.y)
    };
  }
  const width = Number(shape.width ?? 0);
  const height = Number(shape.height ?? 0);
  const center = shape.center ?? { x: 0, y: 0 };
  return {
    minX: Number(center.x) - width / 2,
    maxX: Number(center.x) + width / 2,
    minY: Number(center.y) - height / 2,
    maxY: Number(center.y) + height / 2
  };
}

function segmentRectangleInterval(start, end, shape) {
  const { minX, maxX, minY, maxY } = rectBounds(shape);
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  let t0 = 0;
  let t1 = 1;
  const checks = [
    [-dx, start.x - minX],
    [dx, maxX - start.x],
    [-dy, start.y - minY],
    [dy, maxY - start.y]
  ];
  for (const [p, q] of checks) {
    if (Math.abs(p) <= EPSILON) {
      if (q < 0) return null;
      continue;
    }
    const r = q / p;
    if (p < 0) t0 = Math.max(t0, r);
    else t1 = Math.min(t1, r);
    if (t0 - t1 > EPSILON) return null;
  }
  return [Math.max(0, t0), Math.min(1, t1)];
}

function segmentCircleInterval(start, end, shape) {
  const center = shape.center ?? { x: 0, y: 0 };
  const radius = Number(shape.radius ?? 0);
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const fx = start.x - center.x;
  const fy = start.y - center.y;
  const a = dx * dx + dy * dy;
  if (a <= EPSILON) {
    return fx * fx + fy * fy <= radius * radius + EPSILON ? [0, 1] : null;
  }
  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - radius * radius;
  const disc = b * b - 4 * a * c;
  if (disc < -EPSILON) return null;
  const root = Math.sqrt(Math.max(0, disc));
  let t0 = (-b - root) / (2 * a);
  let t1 = (-b + root) / (2 * a);
  if (t1 < 0 || t0 > 1) return null;
  t0 = Math.max(0, t0);
  t1 = Math.min(1, t1);
  return t0 <= t1 + EPSILON ? [t0, t1] : null;
}

function cross2d(ax, ay, bx, by) {
  return ax * by - ay * bx;
}

function segmentLineInterval(start, end, shape) {
  const a = shape.start;
  const b = shape.end;
  if (!a || !b) throw new Error("Segment obstacle requires start and end");
  const rx = end.x - start.x;
  const ry = end.y - start.y;
  const sx = b.x - a.x;
  const sy = b.y - a.y;
  const denominator = cross2d(rx, ry, sx, sy);
  const qpx = a.x - start.x;
  const qpy = a.y - start.y;

  if (Math.abs(denominator) <= EPSILON) {
    if (Math.abs(cross2d(qpx, qpy, rx, ry)) > EPSILON) return null;
    const rr = rx * rx + ry * ry;
    if (rr <= EPSILON) return null;
    const tA = (qpx * rx + qpy * ry) / rr;
    const tB = ((b.x - start.x) * rx + (b.y - start.y) * ry) / rr;
    const lo = Math.max(0, Math.min(tA, tB));
    const hi = Math.min(1, Math.max(tA, tB));
    return lo <= hi + EPSILON ? [lo, hi] : null;
  }

  const t = cross2d(qpx, qpy, sx, sy) / denominator;
  const u = cross2d(qpx, qpy, rx, ry) / denominator;
  return t >= -EPSILON && t <= 1 + EPSILON && u >= -EPSILON && u <= 1 + EPSILON
    ? [Math.max(0, t), Math.min(1, t)]
    : null;
}

export function segmentShapeInterval(start, end, shape) {
  switch (shape?.shape ?? shape?.type) {
    case "circle": return segmentCircleInterval(start, end, shape);
    case "rectangle": return segmentRectangleInterval(start, end, shape);
    case "segment":
    case "line": return segmentLineInterval(start, end, shape);
    default: throw new Error(`Unsupported spatial shape: ${shape?.shape ?? shape?.type}`);
  }
}

function zAt(start, end, t) {
  return altitude(start) + (altitude(end) - altitude(start)) * t;
}

function intervalPassesVerticalRange(start, end, interval, shape) {
  if (!interval) return false;
  const zMin = Number.isFinite(shape.zMin) ? Number(shape.zMin) : -Infinity;
  const zMax = Number.isFinite(shape.zMax)
    ? Number(shape.zMax)
    : Number.isFinite(shape.height)
      ? Number(shape.height)
      : Infinity;
  const [a, b] = interval;
  const za = zAt(start, end, a);
  const zb = zAt(start, end, b);
  return Math.max(za, zb) >= zMin - EPSILON && Math.min(za, zb) <= zMax + EPSILON;
}

export function shapeContains2d(shape, position) {
  switch (shape?.shape ?? shape?.type) {
    case "circle":
      return horizontalDistance(shape.center, position) <= Number(shape.radius) + EPSILON;
    case "rectangle": {
      const { minX, maxX, minY, maxY } = rectBounds(shape);
      return position.x >= minX - EPSILON && position.x <= maxX + EPSILON &&
        position.y >= minY - EPSILON && position.y <= maxY + EPSILON;
    }
    default:
      throw new Error(`Unsupported area shape: ${shape?.shape ?? shape?.type}`);
  }
}

function normalizeCover(value) {
  if (value === "half" || value === 0.5 || value === 2) return "half";
  if (value === "three-quarters" || value === "three_quarters" || value === 0.75 || value === 5) {
    return "three-quarters";
  }
  if (value === "total" || value === 1 || value === Infinity) return "total";
  return null;
}

export function lineOfSight(origin, target, battlefield = {}) {
  const blockers = [];
  for (const obstacle of battlefield.obstacles ?? []) {
    if (obstacle.blocksSight === false) continue;
    const interval = segmentShapeInterval(origin, target, obstacle);
    if (!interval || !intervalPassesVerticalRange(origin, target, interval, obstacle)) continue;
    const [lo, hi] = interval;
    if (hi <= EPSILON || lo >= 1 - EPSILON) continue;
    if (obstacle.blocksSight === true || normalizeCover(obstacle.cover) === "total") {
      blockers.push(obstacle.id ?? null);
    }
  }
  return {
    visible: blockers.length === 0,
    blockers
  };
}

export function coverBetween(origin, target, battlefield = {}) {
  const sight = lineOfSight(origin, target, battlefield);
  if (!sight.visible) return { cover: "total", acBonus: Infinity, blocksTargeting: true, sources: sight.blockers };

  let rank = 0;
  const sources = [];
  for (const obstacle of battlefield.obstacles ?? []) {
    const cover = normalizeCover(obstacle.cover);
    if (!cover || cover === "total") continue;
    const interval = segmentShapeInterval(origin, target, obstacle);
    if (!interval || !intervalPassesVerticalRange(origin, target, interval, obstacle)) continue;
    const [lo, hi] = interval;
    if (hi <= EPSILON || lo >= 1 - EPSILON) continue;
    const value = cover === "three-quarters" ? 2 : 1;
    if (value >= rank) {
      if (value > rank) sources.length = 0;
      rank = value;
      sources.push(obstacle.id ?? null);
    }
  }
  return rank === 2
    ? { cover: "three-quarters", acBonus: 5, blocksTargeting: false, sources }
    : rank === 1
      ? { cover: "half", acBonus: 2, blocksTargeting: false, sources }
      : { cover: "none", acBonus: 0, blocksTargeting: false, sources: [] };
}

export function canTargetMove(attacker, defender, move, battlefield = null) {
  const max = moveRange(move, attacker);
  if (max == null) return { legal: false, reason: "unsupported_range" };
  if (move.range?.type === "self") {
    return { legal: true, distance: 0, maxRange: 0, cover: "none", coverAcBonus: 0 };
  }

  const actual = distance(attacker.position, defender.position);
  if (actual > max + EPSILON) {
    return { legal: false, distance: actual, maxRange: max, reason: "out_of_range" };
  }

  if (battlefield) {
    const cover = coverBetween(attacker.position, defender.position, battlefield);
    if (cover.blocksTargeting) {
      return {
        legal: false,
        distance: actual,
        maxRange: max,
        reason: "no_line_of_sight",
        cover: cover.cover,
        coverAcBonus: cover.acBonus,
        blockers: cover.sources
      };
    }
    return {
      legal: true,
      distance: actual,
      maxRange: max,
      reason: null,
      cover: cover.cover,
      coverAcBonus: cover.acBonus
    };
  }

  return { legal: true, distance: actual, maxRange: max, reason: null, cover: "none", coverAcBonus: 0 };
}

export function leavesReach({ moverStart, moverEnd, reactor }) {
  const before = distance(moverStart, reactor.position);
  const after = distance(moverEnd, reactor.position);
  return before <= reactor.reach + EPSILON && after > reactor.reach + EPSILON;
}

export function moveToward(start, target, feet) {
  const d = distance(start, target);
  if (d === 0 || feet <= 0) return { ...start };
  const travel = Math.min(feet, d);
  const ratio = travel / d;
  const zDefined = Number.isFinite(start.z) || Number.isFinite(target.z);
  return point(
    start.x + (target.x - start.x) * ratio,
    start.y + (target.y - start.y) * ratio,
    zDefined ? altitude(start) + (altitude(target) - altitude(start)) * ratio : undefined
  );
}

export function withinLineOfSightDistance(origin, target, maxFeet, battlefield = null) {
  if (distance(origin, target) > maxFeet + EPSILON) return false;
  return battlefield ? lineOfSight(origin, target, battlefield).visible : true;
}

function terrainInterval(start, end, terrain, movementType) {
  const modes = terrain.affectsModes ?? ["walking", "climbing", "burrowing"];
  if (!modes.includes(movementType)) return null;
  return segmentShapeInterval(start, end, terrain);
}

export function movementCost(start, end, {
  movementType = "walking",
  battlefield = {}
} = {}) {
  const total = distance(start, end);
  if (total <= EPSILON) return { distance: 0, cost: 0, difficultFeet: 0 };

  const intervals = [];
  for (const terrain of battlefield.terrain ?? []) {
    const interval = terrainInterval(start, end, terrain, movementType);
    if (!interval) continue;
    intervals.push({
      interval,
      multiplier: Math.max(1, Number(terrain.multiplier ?? (terrain.difficult ? 2 : 1))),
      id: terrain.id ?? null
    });
  }

  const cuts = new Set([0, 1]);
  for (const { interval } of intervals) {
    cuts.add(Math.max(0, Math.min(1, interval[0])));
    cuts.add(Math.max(0, Math.min(1, interval[1])));
  }
  const ordered = [...cuts].sort((a, b) => a - b);
  let cost = 0;
  let difficultFeet = 0;
  const sources = new Set();
  for (let index = 0; index < ordered.length - 1; index += 1) {
    const lo = ordered[index];
    const hi = ordered[index + 1];
    if (hi - lo <= EPSILON) continue;
    const mid = (lo + hi) / 2;
    let multiplier = 1;
    for (const entry of intervals) {
      if (mid + EPSILON < entry.interval[0] || mid - EPSILON > entry.interval[1]) continue;
      if (entry.multiplier > multiplier) multiplier = entry.multiplier;
      if (entry.multiplier > 1 && entry.id) sources.add(entry.id);
    }
    const segment = total * (hi - lo);
    cost += segment * multiplier;
    if (multiplier > 1) difficultFeet += segment;
  }

  if (movementType === "burrowing" && altitude(end) < altitude(start) - EPSILON) {
    const descent = altitude(start) - altitude(end);
    cost += descent;
    difficultFeet += descent;
    sources.add("burrow-descent");
  }

  return { distance: total, cost, difficultFeet, sources: [...sources] };
}

export function validateMovement(combatant, start, end, {
  movementType = null,
  battlefield = {},
  round = null,
  forced = false
} = {}) {
  const type = movementType ?? baseMovementSpeed(combatant).type;
  const speed = movementSpeedForType(combatant, type, round).value;
  const deltaZ = altitude(end) - altitude(start);

  if (Math.abs(deltaZ) > EPSILON && !["flying", "hover", "swimming", "burrowing", "climbing"].includes(type)) {
    return { legal: false, reason: "movement_mode_cannot_change_altitude", movementType: type, speed };
  }
  if (type === "burrowing" && battlefield.burrowable === false) {
    return { legal: false, reason: "terrain_not_burrowable", movementType: type, speed };
  }
  if (type === "swimming" && battlefield.underwater !== true && !(battlefield.waterRegions ?? []).some((shape) => shapeContains2d(shape, end))) {
    return { legal: false, reason: "destination_not_water", movementType: type, speed };
  }

  if (battlefield.bounds) {
    const bounds = battlefield.bounds;
    if (
      end.x < bounds.minX - EPSILON || end.x > bounds.maxX + EPSILON ||
      end.y < bounds.minY - EPSILON || end.y > bounds.maxY + EPSILON ||
      altitude(end) < Number(bounds.minZ ?? 0) - EPSILON ||
      altitude(end) > Number(bounds.maxZ ?? Infinity) + EPSILON
    ) {
      return { legal: false, reason: "outside_battlefield", movementType: type, speed };
    }
  }

  if (!forced) {
    for (const obstacle of battlefield.obstacles ?? []) {
      if (obstacle.blocksMovement === false) continue;
      if (Array.isArray(obstacle.passableBy) && obstacle.passableBy.includes(type)) continue;
      const interval = segmentShapeInterval(start, end, obstacle);
      if (!interval || !intervalPassesVerticalRange(start, end, interval, obstacle)) continue;
      const [lo, hi] = interval;
      if (hi <= EPSILON) continue;
      return {
        legal: false,
        reason: "movement_blocked",
        movementType: type,
        speed,
        obstacleId: obstacle.id ?? null
      };
    }
  }

  const cost = movementCost(start, end, { movementType: type, battlefield });
  return { legal: true, movementType: type, speed, ...cost };
}

export function fallDamageForDistance(feet, { hover = false } = {}) {
  const distanceFallen = Math.max(0, Number(feet ?? 0));
  const dice = hover ? 0 : Math.min(20, Math.floor(distanceFallen / 10));
  return {
    feet: distanceFallen,
    dice,
    expression: dice > 0 ? `${dice}d6` : null,
    damageType: "typeless"
  };
}

export function isRaised(combatant, {
  movementType = null,
  heldItemId = null
} = {}) {
  if (movementType === "flying" || movementType === "hover") return true;
  if (combatant.abilityId === "levitate") return true;
  if (String(heldItemId ?? combatant.heldItemId ?? "").toLowerCase() === "air-balloon") return true;
  return (combatant.effects?.raisedSources ?? []).length > 0;
}
