import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { Pokemon5eCombatEngine } from "./combat/combat-engine.mjs";
import { BookgameEngine } from "./engine/bookgame-engine.mjs";
import { CryptoDice } from "./engine/dice.mjs";
import { SaveStore } from "./engine/save-store.mjs";
import { createNewGameState } from "./engine/state.mjs";

const FRIENDS = ["Luke", "Mattew", "Daniel", "Edward", "Fab"];
const rl = createInterface({ input, output });
const engine = new BookgameEngine();
const combatEngine = new Pokemon5eCombatEngine({ dice: new CryptoDice() });
const saves = new SaveStore();

async function chooseProtagonist() {
  console.log("\nScegli il protagonista:");
  FRIENDS.forEach((name, index) => console.log(`${index + 1}. ${name}`));
  const raw = await rl.question("> ");
  const index = Number(raw) - 1;
  return FRIENDS[index] ?? "Luke";
}

async function newGame() {
  const protagonist = await chooseProtagonist();
  const slot = (await rl.question("Slot di salvataggio [slot1]: ")).trim() || "slot1";
  const state = createNewGameState({ protagonist, slot });
  await saves.save(state);
  return state;
}

async function continueGame() {
  const slot = (await rl.question("Slot da caricare [slot1]: ")).trim() || "slot1";
  return saves.load(slot);
}

function printAttack(entry) {
  const who = entry.actor === "player" ? "Il tuo Pokémon" : "Houndour";
  const roll = `d20+${entry.attackModifier}=${entry.attackTotal}`;
  if (!entry.hit) {
    console.log(`${who} usa ${entry.moveName}: ${roll} vs AC ${entry.defenderAc} — manca il bersaglio.`);
    return;
  }

  const crit = entry.critical ? " CRITICO." : "";
  const effect = entry.typeMultiplier === 2
    ? " È vulnerabile."
    : entry.typeMultiplier === 0.5
      ? " Resiste."
      : entry.typeMultiplier === 0
        ? " È immune."
        : "";

  console.log(
    `${who} usa ${entry.moveName}: ${roll} vs AC ${entry.defenderAc} — colpisce.${crit} ` +
    `${entry.damage} danni ${entry.damageType}.${effect}`
  );
}

function printNewCombatLogs(battle, fromIndex) {
  for (const entry of battle.log.slice(fromIndex)) {
    if (entry.type === "attack") printAttack(entry);
    if (entry.type === "combat_end") {
      console.log(entry.outcome === "win" ? "Houndour non è più in grado di continuare lo scontro." : "Il tuo Pokémon non è più in grado di continuare lo scontro.");
    }
  }
  return battle.log.length;
}

async function runCombat(state) {
  let battle = state.pending.battle;

  if (!battle) {
    battle = await combatEngine.createBattle(state.pending);
    state = engine.setCombatState(state, battle);
    await saves.save(state);
    console.log("\n=== COMBATTIMENTO POKÉMON 5e ===");
    console.log(
      `Iniziativa: tuo Pokémon ${battle.initiative.player.total}, ` +
      `${battle.opponent.name} ${battle.initiative.opponent.total}.`
    );
  } else {
    console.log("\n=== RIPRESA COMBATTIMENTO POKÉMON 5e ===");
  }

  let printed = battle.log.length;

  while (!battle.outcome) {
    battle = await combatEngine.advanceToPlayerOrEnd(battle);
    printed = printNewCombatLogs(battle, printed);
    state = engine.setCombatState(state, battle);
    await saves.save(state);
    if (battle.outcome) break;

    console.log(
      `\nRound ${battle.round} — ${battle.player.name} ${battle.player.hp.current}/${battle.player.hp.max} HP ` +
      `| ${battle.opponent.name} ${battle.opponent.hp.current}/${battle.opponent.hp.max} HP`
    );

    const moves = await combatEngine.availablePlayerMoves(battle);
    moves.forEach((move, index) => {
      console.log(`${index + 1}. ${move.name} (PP ${battle.player.pp[move.id]}/${move.pp})`);
    });

    const answer = Number(await rl.question("> ")) - 1;
    const move = moves[answer];
    if (!move) {
      console.log("Mossa non valida.");
      continue;
    }

    battle = await combatEngine.usePlayerMove(battle, move.id);
    printed = printNewCombatLogs(battle, printed);
    state = engine.setCombatState(state, battle);
    await saves.save(state);
  }

  state = engine.resolveCombatHandoff(state, battle.outcome);
  await saves.save(state);
  return state;
}

async function run() {
  console.log("=== Pokémon 5e Digital Bookgame — Vertical Slice ===");
  console.log("1. Nuova partita");
  console.log("2. Continua");
  const mode = (await rl.question("> ")).trim();
  let state = mode === "2" ? await continueGame() : await newGame();

  while (true) {
    const view = await engine.present(state);
    console.log(`\n# ${view.sceneTitle}\n`);
    console.log(view.text);

    if (view.lastRoll) {
      console.log(
        `\n[${view.lastRoll.notation} vs DC ${view.lastRoll.dc} — ` +
        `${view.lastRoll.passed ? "successo" : "fallimento"}]`
      );
    }

    if (view.pending?.type === "pokemon5e_combat") {
      state = await runCombat(state);
      continue;
    }

    if (view.choices.length === 0) {
      console.log("\n[FINE DEL VERTICAL SLICE]");
      await saves.save(state);
      break;
    }

    console.log("");
    view.choices.forEach((choice, index) => console.log(`${index + 1}. ${choice.text}`));
    const answer = Number(await rl.question("> ")) - 1;
    const choice = view.choices[answer];
    if (!choice) {
      console.log("Scelta non valida.");
      continue;
    }

    state = await engine.choose(state, choice.id);
    await saves.save(state);
  }
}

run()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => rl.close());
