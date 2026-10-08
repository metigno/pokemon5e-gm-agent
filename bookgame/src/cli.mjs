import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { Pokemon5eCombatEngine } from "./combat/combat-engine.mjs";
import { handleAuxiliaryCommand, handleRequiredSwitch, printAuxiliaryOptions, printBattlefield } from "./combat/cli-controls.mjs";
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
  const state = createNewGameState({ protagonist, slot, startAtIntro: true });
  await saves.save(state);
  return state;
}

async function continueGame() {
  const slot = (await rl.question("Slot da caricare [slot1]: ")).trim() || "slot1";
  return saves.load(slot);
}

function formatD20(roll) {
  const list = roll.rolls?.join(",") ?? String(roll.natural);
  const marker = roll.mode === "advantage" ? "↑" : roll.mode === "disadvantage" ? "↓" : "";
  return roll.rolls?.length > 1 ? `d20[${list}]${marker}` : `d20=${roll.natural}`;
}

function actorName(battle, side) {
  return side === "player" ? battle.player.name : battle.opponent.name;
}

function printAttack(battle, entry) {
  const who = actorName(battle, entry.actor);
  const roll = `${formatD20(entry.attackRoll)} ${entry.attackModifier >= 0 ? "+" : ""}${entry.attackModifier} = ${entry.attackTotal}`;

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
        ? ` Nessun danno${entry.immunityAbility ? ` (${entry.immunityAbility})` : ""}.`
        : "";

  console.log(
    `${who} usa ${entry.moveName}: ${roll} vs AC ${entry.defenderAc} — colpisce.${crit} ` +
    `${entry.damage} danni ${entry.damageType}.${effect}`
  );

  if (entry.secondaryStatus && entry.statusResult) {
    console.log(
      entry.statusResult.applied
        ? `→ ${actorName(battle, entry.target)} subisce ${entry.secondaryStatus}.`
        : `→ ${entry.secondaryStatus} non viene applicato (${entry.statusResult.reason}).`
    );
  }
}

function printSaveMove(battle, entry) {
  const who = actorName(battle, entry.actor);
  const target = actorName(battle, entry.target);

  if (entry.immune) {
    console.log(`${who} usa ${entry.moveName}: ${target} è immune grazie a ${entry.immunityAbility}.`);
    return;
  }

  const save = entry.save;
  console.log(
    `${who} usa ${entry.moveName}: ${target} tira ${save.attribute.toUpperCase()} ` +
    `(${formatD20(save)} ${save.modifier >= 0 ? "+" : ""}${save.modifier} = ${save.total}) ` +
    `vs DC ${save.dc} — ${save.success ? "successo" : "fallimento"}.`
  );
}

function printNewCombatLogs(battle, fromIndex) {
  for (const entry of battle.log.slice(fromIndex)) {
    if (entry.type === "attack" || entry.type === "opportunity_attack") {
      if (entry.type === "opportunity_attack") console.log("→ Attacco d'opportunità!");
      printAttack(battle, entry);
    }
    if (entry.type === "save_move") printSaveMove(battle, entry);
    if (entry.type === "ability_use" && entry.abilityId === "intimidate") {
      console.log(`→ ${actorName(battle, entry.actor)} usa Intimidate: il prossimo attacco viene tirato con svantaggio.`);
    }
    if (entry.type === "ability_trigger" && entry.abilityId === "flash-fire") {
      console.log(`→ Flash Fire annulla il Fuoco e potenzia la prossima mossa Fuoco.`);
    }
    if (entry.type === "turn_skipped") {
      console.log(`→ ${actorName(battle, entry.actor)} perde il turno per ${entry.reason}.`);
    }
    if (entry.type === "status_damage") {
      console.log(`→ ${actorName(battle, entry.actor)} subisce ${entry.damage} danni da ${entry.status}.`);
    }
    if (entry.type === "wake_check") {
      console.log(`→ Risveglio: ${entry.roll} — ${entry.wake ? "si sveglia" : "resta addormentato"}.`);
    }
    if (entry.type === "combat_end") {
      console.log(
        entry.outcome === "win"
          ? `${battle.opponent.name} non è più in grado di continuare lo scontro.`
          : `${battle.player.name} non è più in grado di continuare lo scontro.`
      );
    }
  }
  return battle.log.length;
}

async function saveBattleIntoState(state, battle) {
  const next = engine.setCombatState(state, battle);
  await saves.save(next);
  return next;
}

async function runCombat(state) {
  let battle = state.pending.battle;

  if (!battle) {
    battle = await combatEngine.createBattle(state.pending);
    state = await saveBattleIntoState(state, battle);
    console.log("\n=== COMBATTIMENTO POKÉMON 5e ===");
    console.log(
      `Iniziativa: ${battle.player.name} ${battle.initiative.player.total}, ` +
      `${battle.opponent.name} ${battle.initiative.opponent.total}.`
    );
  } else {
    console.log("\n=== RIPRESA COMBATTIMENTO POKÉMON 5e ===");
  }

  let printed = battle.log.length;

  while (!battle.outcome) {
    if (battle.awaitingSwitch === "player") {
      try {
        battle = await handleRequiredSwitch({ battle, combatEngine, rl });
        printed = printNewCombatLogs(battle, printed);
        state = await saveBattleIntoState(state, battle);
      } catch (error) {
        console.log(error.message);
      }
      continue;
    }

    battle = await combatEngine.prepareCurrentTurn(battle);
    printed = printNewCombatLogs(battle, printed);
    state = await saveBattleIntoState(state, battle);
    if (battle.outcome) break;

    if (combatEngine.actor(battle) === "opponent") {
      let useIntimidate = false;
      if (combatEngine.canUseIntimidate(battle, "player")) {
        const answer = (await rl.question("Usare Intimidate sul prossimo attacco avversario? [s/N] ")).trim().toLowerCase();
        useIntimidate = answer === "s" || answer === "si" || answer === "y" || answer === "yes";
      }

      battle = await combatEngine.advanceToPlayerOrEnd(battle, {
        usePlayerIntimidate: useIntimidate
      });
      printed = printNewCombatLogs(battle, printed);
      state = await saveBattleIntoState(state, battle);
      continue;
    }

    printBattlefield(battle);

    const moves = await combatEngine.availablePlayerMoves(battle);
    moves.forEach((move, index) => {
      const kind = move.time.unit === "bonus action" ? "Bonus" : "Azione";
      console.log(`${index + 1}. [${kind}] ${move.name} (PP ${battle.player.pp[move.id]}/${move.pp})`);
    });
    console.log("0. Termina turno");

    const raw = await rl.question("> ");
    if (raw.trim() === "0") {
      battle = await combatEngine.endPlayerTurn(battle);
      printed = printNewCombatLogs(battle, printed);
      state = await saveBattleIntoState(state, battle);
      continue;
    }

    const answer = Number(raw) - 1;
    const move = moves[answer];
    if (!move) {
      console.log("Mossa non valida.");
      continue;
    }

    battle = await combatEngine.usePlayerMove(battle, move.id);
    printed = printNewCombatLogs(battle, printed);
    state = await saveBattleIntoState(state, battle);
  }

  state = await engine.resolveCombatHandoffWithXp(state, battle.outcome);
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
