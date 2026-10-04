import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { BookgameEngine } from "./engine/bookgame-engine.mjs";
import { SaveStore } from "./engine/save-store.mjs";
import { createNewGameState } from "./engine/state.mjs";

const FRIENDS = ["Luke", "Mattew", "Daniel", "Edward", "Fab"];
const rl = createInterface({ input, output });
const engine = new BookgameEngine();
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
      console.log(`\n[${view.lastRoll.notation} vs DC ${view.lastRoll.dc} — ${view.lastRoll.passed ? "successo" : "fallimento"}]`);
    }

    if (view.pending?.type === "pokemon5e_combat") {
      console.log("\n[HANDOFF POKÉMON 5e]");
      console.log(`Avversario: ${view.pending.opponent.species} Lv.${view.pending.opponent.level}`);
      console.log("Il vertical slice ha raggiunto il confine del combat resolver.");
      await saves.save(state);
      break;
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
