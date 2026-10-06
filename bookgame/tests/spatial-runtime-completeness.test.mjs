import test from "node:test";
import assert from "node:assert/strict";

import {
  canTargetMove,
  coverBetween,
  distance,
  fallDamageForDistance,
  lineOfSight,
  movementCost,
  point,
  validateMovement
} from "../src/combat/spatial.mjs";
import {
  createConeZone,
  createEmanationZone,
  createLineZone,
  createRectangleZone,
  createSphereZone,
  zoneContains,
  zoneTransition
} from "../src/combat/zones.mjs";

function combatant(speed = []) {
  return {
    speed,
    effects: {
      movementLockSources: [],
      restrainedSources: [],
      speedModifierSources: []
    },
    statuses: { nonVolatile: null }
  };
}

test("spatial distance is truly 3D while legacy 2D points remain backward compatible", () => {
  assert.deepEqual(point(1, 2), { x: 1, y: 2 });
  assert.deepEqual(point(1, 2, 3), { x: 1, y: 2, z: 3 });
  assert.equal(distance(point(0, 0, 0), point(3, 4, 12)), 13);
  assert.equal(distance(point(0, 0), point(3, 4)), 5);
});

test("line of sight respects obstacle height and total cover", () => {
  const battlefield = {
    obstacles: [{
      id: "wall",
      shape: "rectangle",
      min: { x: 4, y: -2 },
      max: { x: 6, y: 2 },
      zMin: 0,
      zMax: 8,
      blocksSight: true
    }]
  };
  assert.equal(lineOfSight(point(0, 0, 0), point(10, 0, 0), battlefield).visible, false);
  assert.equal(lineOfSight(point(0, 0, 12), point(10, 0, 12), battlefield).visible, true);
});

test("partial cover produces canonical AC bonuses without blocking targeting", () => {
  const battlefield = {
    obstacles: [{
      id: "crate",
      shape: "rectangle",
      min: { x: 4, y: -1 },
      max: { x: 6, y: 1 },
      zMin: 0,
      zMax: 4,
      blocksSight: false,
      cover: "half"
    }]
  };
  const cover = coverBetween(point(0, 0, 2), point(10, 0, 2), battlefield);
  assert.equal(cover.cover, "half");
  assert.equal(cover.acBonus, 2);

  const legal = canTargetMove(
    { position: point(0, 0, 2), reach: 5 },
    { position: point(10, 0, 2) },
    { range: { type: "distance", value: 30 } },
    battlefield
  );
  assert.equal(legal.legal, true);
  assert.equal(legal.coverAcBonus, 2);
});

test("difficult terrain charges exact path cost through rectangular regions", () => {
  const cost = movementCost(point(0, 0), point(20, 0), {
    movementType: "walking",
    battlefield: {
      terrain: [{
        id: "mud",
        shape: "rectangle",
        min: { x: 5, y: -10 },
        max: { x: 15, y: 10 },
        difficult: true
      }]
    }
  });
  assert.equal(cost.distance, 20);
  assert.equal(cost.difficultFeet, 10);
  assert.equal(cost.cost, 30);
  assert.deepEqual(cost.sources, ["mud"]);
});

test("movement modes enforce altitude, water and burrowing legality", () => {
  const mon = combatant([
    { type: "walking", value: 30 },
    { type: "flying", value: 60 },
    { type: "swimming", value: 30 },
    { type: "burrowing", value: 20 }
  ]);
  const walkUp = validateMovement(mon, point(0, 0, 0), point(0, 0, 10), { movementType: "walking" });
  assert.equal(walkUp.legal, false);
  assert.equal(walkUp.reason, "movement_mode_cannot_change_altitude");

  const flyUp = validateMovement(mon, point(0, 0, 0), point(0, 0, 10), { movementType: "flying" });
  assert.equal(flyUp.legal, true);
  assert.equal(flyUp.cost, 10);

  const drySwim = validateMovement(mon, point(0, 0, 0), point(5, 0, -5), { movementType: "swimming" });
  assert.equal(drySwim.legal, false);
  assert.equal(drySwim.reason, "destination_not_water");

  const swim = validateMovement(mon, point(0, 0, 0), point(5, 0, -5), {
    movementType: "swimming",
    battlefield: { underwater: true }
  });
  assert.equal(swim.legal, true);

  const noBurrow = validateMovement(mon, point(0, 0, 0), point(5, 0, -5), {
    movementType: "burrowing",
    battlefield: { burrowable: false }
  });
  assert.equal(noBurrow.legal, false);
});

test("Pokemon 5e falling uses 1d6 per 10ft, max 20d6, while hover takes none", () => {
  assert.deepEqual(fallDamageForDistance(9), { feet: 9, dice: 0, expression: null, damageType: "typeless" });
  assert.equal(fallDamageForDistance(50).expression, "5d6");
  assert.equal(fallDamageForDistance(500).expression, "20d6");
  assert.equal(fallDamageForDistance(50, { hover: true }).expression, null);
});

test("cone, line, emanation, rectangle and sphere zones resolve numeric geometry", () => {
  const base = { id: "z", moveId: "test", sourceSide: "player", createdRound: 1 };
  const cone = createConeZone({
    ...base,
    origin: point(0, 0),
    direction: { x: 1, y: 0 },
    length: 30,
    angle: 90
  });
  assert.equal(zoneContains(cone, point(20, 0)), true);
  assert.equal(zoneContains(cone, point(-5, 0)), false);

  const line = createLineZone({
    ...base,
    id: "line",
    origin: point(0, 0),
    end: point(30, 0),
    width: 5
  });
  assert.equal(zoneContains(line, point(15, 2)), true);
  assert.equal(zoneContains(line, point(15, 3)), false);

  const emanation = createEmanationZone({
    ...base,
    id: "emanation",
    center: point(0, 0),
    radius: 15,
    innerRadius: 5
  });
  assert.equal(zoneContains(emanation, point(0, 0)), false);
  assert.equal(zoneContains(emanation, point(10, 0)), true);

  const rectangle = createRectangleZone({
    ...base,
    id: "rect",
    min: point(-5, -5),
    max: point(5, 5),
    zMin: 0,
    zMax: 10
  });
  assert.equal(zoneContains(rectangle, point(0, 0, 5)), true);
  assert.equal(zoneContains(rectangle, point(0, 0, 15)), false);

  const sphere = createSphereZone({
    ...base,
    id: "sphere",
    center: point(0, 0, 0),
    radius: 10
  });
  assert.equal(zoneContains(sphere, point(0, 0, 10)), true);
  assert.equal(zoneContains(sphere, point(0, 0, 11)), false);
});

test("zone transitions distinguish entering and leaving for trigger legality", () => {
  const zone = createSphereZone({
    id: "sphere",
    moveId: "test",
    sourceSide: "player",
    center: point(0, 0, 0),
    radius: 10,
    createdRound: 1
  });
  assert.deepEqual(
    zoneTransition(zone, point(20, 0), point(5, 0)),
    { wasInside: false, isInside: true, entered: true, left: false, crossedBoundary: true }
  );
  assert.equal(zoneTransition(zone, point(5, 0), point(20, 0)).left, true);
});
