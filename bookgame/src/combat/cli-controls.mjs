import { distance } from "./spatial.mjs";
import { battleFogView } from "./fog-of-war.mjs";

async function firstOpportunityMove(battle, combatEngine, side) {
  const combatant = battle[side];
  for (const id of combatant.moveIds) {
    if ((combatant.pp[id] ?? 0) <= 0) continue;
    const move = await combatEngine.data.getMove(id);
    if (move.time?.unit === "action" && move.range?.type === "melee" && move.attack) return id;
  }
  return null;
}

function ballEntries(battle) {
  return battle.trainer.inventory
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => /ball/i.test(typeof item === "string" ? item : item?.name ?? item?.id ?? ""));
}

export function printBattlefield(battle) {
  const gap = distance(battle.player.position, battle.opponent.position);
  const visible = battleFogView(battle, battle.playerKnowledge ?? { default: 0 });
  console.log("");
  console.log("Round " + battle.round + " — " + battle.player.name + " " + battle.player.hp.current + "/" + battle.player.hp.max + " HP | " + visible.opponent.name + " " + visible.opponent.hp.current + "/" + visible.opponent.hp.max + " HP");
  console.log("Distanza Pokémon: " + gap.toFixed(1) + " ft | Movimento rimasto: " + battle.player.turn.movementRemaining.toFixed(1) + " ft");
  console.log("Posizioni — Trainer (" + battle.trainer.position.x.toFixed(1) + ", " + battle.trainer.position.y.toFixed(1) + ") | " + battle.player.name + " (" + battle.player.position.x.toFixed(1) + ", " + battle.player.position.y.toFixed(1) + ") | " + battle.opponent.name + " (" + battle.opponent.position.x.toFixed(1) + ", " + battle.opponent.position.y.toFixed(1) + ")");
}

export function printAuxiliaryOptions(battle) {
  console.log("M. Muovi");
  if (battle.player.turn.actionAvailable) console.log("D. Disengage");
  if (battle.playerBench.length > 0 && battle.player.turn.actionAvailable) console.log("S. Switch");
  if (ballEntries(battle).length > 0) console.log("C. Lancia Pokéball");
  console.log("0. Termina turno");
}

export async function handleRequiredSwitch({ battle, combatEngine, rl }) {
  console.log("");
  console.log("Il Pokémon attivo è esausto: devi mandarne un altro.");
  battle.playerBench.forEach((pokemon, index) => {
    if (pokemon.hp.current > 0) console.log((index + 1) + ". " + pokemon.name + " " + pokemon.hp.current + "/" + pokemon.hp.max + " HP");
  });
  const index = Number(await rl.question("> ")) - 1;
  return combatEngine.switchPlayer(battle, index, { releasePosition: battle.trainer.position });
}

export async function handleAuxiliaryCommand({ raw, battle, combatEngine, rl }) {
  const command = raw.trim().toLowerCase();

  if (command === "0") {
    return { handled: true, battle: await combatEngine.endPlayerTurn(battle) };
  }

  if (command === "d") {
    return { handled: true, battle: await combatEngine.useDisengage(battle, "player") };
  }

  if (command === "m") {
    console.log("Inserisci destinazione x y in piedi. Movimento massimo rimasto: " + battle.player.turn.movementRemaining.toFixed(1) + " ft");
    const coords = (await rl.question("> ")).trim().split(/\\s+/).map(Number);
    if (coords.length !== 2 || coords.some((value) => !Number.isFinite(value))) throw new Error("Coordinate non valide. Esempio: 10 0");
    const opportunityMoveId = await firstOpportunityMove(battle, combatEngine, "opponent");
    const next = await combatEngine.moveCombatant(battle, "player", { x: coords[0], y: coords[1] }, { opportunityMoveId });
    return { handled: true, battle: next };
  }

  if (command === "s") {
    if (battle.playerBench.length === 0) throw new Error("Non hai Pokémon in panchina.");
    battle.playerBench.forEach((pokemon, index) => console.log((index + 1) + ". " + pokemon.name + " " + pokemon.hp.current + "/" + pokemon.hp.max + " HP"));
    const index = Number(await rl.question("> ")) - 1;
    const next = await combatEngine.switchPlayer(battle, index, { releasePosition: battle.trainer.position });
    return { handled: true, battle: next };
  }

  if (command === "c") {
    const balls = ballEntries(battle);
    if (balls.length === 0) throw new Error("Non hai Pokéball disponibili.");
    balls.forEach(({ item }, index) => console.log((index + 1) + ". " + (typeof item === "string" ? item : item.name ?? item.id)));
    const selected = balls[Number(await rl.question("> ")) - 1];
    if (!selected) throw new Error("Pokéball non valida.");
    const ball = typeof selected.item === "string" ? selected.item : selected.item.name ?? selected.item.id;
    const capture = await combatEngine.attemptPlayerCapture(battle, ball);
    return { handled: true, battle: capture.battle, captureResult: capture.result };
  }

  return { handled: false, battle };
}
