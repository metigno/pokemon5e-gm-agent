import test from "node:test";
import assert from "node:assert/strict";

import { Pokemon5eCombatEngine } from "../src/combat/combat-engine.mjs";
import { expireZonesAtTurnStart, zoneContains } from "../src/combat/zones.mjs";
import { SequenceDice } from "../src/engine/dice.mjs";

function handoff() {
  return {
    encounterId: "ZONE_TEST",
    playerPokemon: { species: "Koffing", level: 5 },
    opponent: { species: "Houndour", level: 3 },
    playerPosition: { x: 0, y: 0 },
    opponentPosition: { x: 20, y: 0 }
  };
}

test("Smog creates a persistent concentration zone with authored radius", async () => {
  const combat = new Pokemon5eCombatEngine({
    dice: new SequenceDice([15, 5])
  });
  let battle = await combat.createBattle(handoff());

  battle = await combat.usePlayerMove(battle, "smog", {
    targetPoint: { x: 20, y: 0 }
  });

  assert.equal(battle.zones.length, 1);
  const zone = battle.zones[0];
  assert.equal(zone.moveId, "smog");
  assert.equal(zone.radius, 10);
  assert.equal(zone.concentration, true);
  assert.equal(battle.player.concentration.zoneId, zone.id);
  assert.equal(zoneContains(zone, battle.opponent.position), true);
  assert.equal(zoneContains(zone, battle.player.position), false);
});

test("creature beginning its turn in Smog saves, takes damage and can become poisoned", async () => {
  const combat = new Pokemon5eCombatEngine({
    dice: new SequenceDice([15, 5, 2, 6])
  });
  let battle = await combat.createBattle(handoff());

  battle = await combat.usePlayerMove(battle, "smog", {
    targetPoint: { x: 20, y: 0 }
  });
  battle = await combat.endPlayerTurn(battle);
  battle = await combat.prepareCurrentTurn(battle);

  const tick = battle.log.find((entry) => entry.type === "zone_tick");
  assert.equal(tick.moveId, "smog");
  assert.equal(tick.actor, "opponent");
  assert.equal(tick.save.success, false);
  assert.ok(tick.damage > 0);
  assert.ok(battle.opponent.hp.current < battle.opponent.hp.max);
  assert.equal(battle.opponent.statuses.nonVolatile, "Poisoned");
});

test("damage can break Smog concentration and remove its zone", async () => {
  const combat = new Pokemon5eCombatEngine({
    dice: new SequenceDice([
      15, 5,
      20, 6,
      15, 6,
      1
    ])
  });
  let battle = await combat.createBattle(handoff());

  battle = await combat.usePlayerMove(battle, "smog", {
    targetPoint: { x: 20, y: 0 }
  });
  battle = await combat.endPlayerTurn(battle);
  battle = await combat.advanceToPlayerOrEnd(battle);

  const check = battle.log.find((entry) =>
    entry.type === "concentration_check" && entry.actor === "player"
  );
  assert.ok(check);
  assert.equal(check.success, false);
  assert.equal(battle.player.concentration, null);
  assert.equal(battle.zones.some((zone) => zone.moveId === "smog"), false);
  assert.ok(battle.log.some((entry) =>
    entry.type === "concentration_end" && entry.reason === "failed_damage_save"
  ));
});

test("Poison Gas zone expires at the beginning of its source's next turn", () => {
  const zone = {
    id: "gas-1",
    sourceSide: "player",
    moveId: "poison-gas",
    createdRound: 1,
    expiresRound: null,
    expiresAtSourceTurn: true
  };

  assert.equal(expireZonesAtTurnStart([zone], "opponent", 1).active.length, 1);
  assert.equal(expireZonesAtTurnStart([zone], "player", 1).active.length, 1);

  const expired = expireZonesAtTurnStart([zone], "player", 2);
  assert.equal(expired.active.length, 0);
  assert.equal(expired.expired[0].id, "gas-1");
});
