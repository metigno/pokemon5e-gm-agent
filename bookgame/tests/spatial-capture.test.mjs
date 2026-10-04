import test from "node:test";
import assert from "node:assert/strict";

import {
  calculateCaptureDc,
  attemptCapture,
  captureAdvantage
} from "../src/combat/capture.mjs";
import {
  canTargetMove,
  distance,
  leavesReach,
  movementSpeed,
  reachForSize
} from "../src/combat/spatial.mjs";
import { SequenceDice } from "../src/engine/dice.mjs";

const trainer = {
  level: 5,
  abilities: { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 14, CHA: 12 },
  skills: ["Animal Handling", "Nature", "Persuasion"]
};

const activePokemon = {
  attributes: { cha: 14 }
};

function target(overrides = {}) {
  return {
    level: 3,
    sr: 0.5,
    size: "tiny",
    types: ["dark", "fire"],
    hp: { current: 20, max: 20 },
    statuses: { nonVolatile: null },
    ...overrides
  };
}

test("distance and reach primitives use real feet", () => {
  assert.equal(distance({ x: 0, y: 0 }, { x: 3, y: 4 }), 5);
  assert.equal(reachForSize("tiny"), 5);
  assert.equal(reachForSize("large"), 5);
  assert.equal(reachForSize("huge"), 10);
});

test("move range legality supports melee and ranged moves", () => {
  const attacker = { position: { x: 0, y: 0 }, reach: 5 };
  const defender = { position: { x: 5, y: 0 } };

  assert.equal(canTargetMove(attacker, defender, { range: { type: "melee" } }).legal, true);
  defender.position = { x: 10, y: 0 };
  assert.equal(canTargetMove(attacker, defender, { range: { type: "melee" } }).legal, false);
  assert.equal(canTargetMove(attacker, defender, { range: { type: "distance", value: 30 } }).legal, true);
});

test("leaving melee reach triggers spatial opportunity condition", () => {
  const reactor = { position: { x: 0, y: 0 }, reach: 5 };
  assert.equal(leavesReach({
    moverStart: { x: 5, y: 0 },
    moverEnd: { x: 10, y: 0 },
    reactor
  }), true);
  assert.equal(leavesReach({
    moverStart: { x: 10, y: 0 },
    moverEnd: { x: 15, y: 0 },
    reactor
  }), false);
});

test("Paralysis halves movement speed", () => {
  const combatant = {
    speed: [{ type: "walking", value: 30 }],
    statuses: { nonVolatile: "Paralysis" }
  };
  assert.equal(movementSpeed(combatant).value, 15);
});

test("2024 capture DC applies SR, level and HP reductions cumulatively", () => {
  assert.equal(calculateCaptureDc({
    trainer,
    target: target(),
    activePokemon,
    ball: "pokeball"
  }), 13);

  assert.equal(calculateCaptureDc({
    trainer,
    target: target({ hp: { current: 9, max: 20 } }),
    activePokemon,
    ball: "pokeball"
  }), 8);

  assert.equal(calculateCaptureDc({
    trainer,
    target: target({ hp: { current: 1, max: 20 } }),
    activePokemon,
    ball: "pokeball"
  }), 3);
});

test("ball variants modify capture DC according to 2024 rules", () => {
  assert.equal(calculateCaptureDc({
    trainer, target: target(), activePokemon, ball: "great-ball"
  }), 8);
  assert.equal(calculateCaptureDc({
    trainer, target: target(), activePokemon, ball: "ultra-ball"
  }), 3);
  assert.equal(calculateCaptureDc({
    trainer, target: target(), activePokemon, ball: "quick-ball", round: 1
  }), 0);
  assert.equal(calculateCaptureDc({
    trainer, target: target(), activePokemon, ball: "nest-ball"
  }), 8);
});

test("status grants advantage on a capture throw", () => {
  const wild = target({ statuses: { nonVolatile: "Paralysis" } });
  assert.equal(captureAdvantage(wild), true);

  const result = attemptCapture({
    trainer,
    target: wild,
    activePokemon,
    ball: "pokeball",
    distanceFeet: 30,
    dice: new SequenceDice([4, 15])
  });

  assert.equal(result.roll.mode, "advantage");
  assert.deepEqual(result.roll.rolls, [4, 15]);
  assert.equal(result.modifier, 5);
  assert.equal(result.total, 20);
  assert.equal(result.captured, true);
  assert.equal(result.consumed, true);
});

test("capture legality enforces range, level and fainting before consuming a ball", () => {
  const highLevel = attemptCapture({
    trainer: { ...trainer, level: 2 },
    target: target({ level: 3 }),
    activePokemon,
    distanceFeet: 30,
    dice: new SequenceDice([])
  });
  assert.equal(highLevel.legal, false);
  assert.equal(highLevel.reason, "target_level_above_trainer");
  assert.equal(highLevel.consumed, false);

  const fainted = attemptCapture({
    trainer,
    target: target({ hp: { current: 0, max: 20 } }),
    activePokemon,
    distanceFeet: 30,
    dice: new SequenceDice([])
  });
  assert.equal(fainted.reason, "fainted");

  const far = attemptCapture({
    trainer,
    target: target(),
    activePokemon,
    distanceFeet: 61,
    dice: new SequenceDice([])
  });
  assert.equal(far.reason, "out_of_range");
});

test("Master Ball automatically succeeds only after legality checks", () => {
  const result = attemptCapture({
    trainer,
    target: target(),
    activePokemon,
    ball: "master-ball",
    distanceFeet: 60,
    dice: new SequenceDice([])
  });
  assert.equal(result.automatic, true);
  assert.equal(result.captured, true);
  assert.equal(result.consumed, true);
});
