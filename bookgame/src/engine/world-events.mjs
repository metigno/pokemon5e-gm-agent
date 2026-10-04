import { evaluateCondition } from "./conditions.mjs";
import { ensureWorldClock } from "./time.mjs";

function ensureEventTable(state) {
  state.events ??= {};
  return state.events;
}

function matchingOutcome(state, event) {
  for (const outcome of event.outcomes ?? []) {
    if (outcome.when === undefined || evaluateCondition(state, outcome.when)) return outcome;
  }
  return null;
}

export function processWorldEvents(state, events = [], applyEffects) {
  if (!Array.isArray(events)) throw new TypeError("world events must be an array");
  if (typeof applyEffects !== "function") throw new TypeError("applyEffects callback is required");

  ensureWorldClock(state.world);
  const eventState = ensureEventTable(state);
  const fired = [];
  let progress = true;
  let passes = 0;

  while (progress) {
    progress = false;
    passes += 1;
    if (passes > Math.max(1, events.length + 1)) {
      throw new Error("World event chain exceeded deterministic pass limit");
    }

    for (const event of events) {
      if (event.once !== false && eventState[event.id]?.status === "resolved") continue;
      if (!evaluateCondition(state, event.trigger)) continue;

      const outcome = matchingOutcome(state, event);
      if (!outcome) continue;

      applyEffects(state, outcome.effects ?? []);
      eventState[event.id] = {
        status: "resolved",
        outcomeId: outcome.id,
        firedAtMinutes: state.world.elapsedMinutes
      };
      fired.push({
        eventId: event.id,
        outcomeId: outcome.id,
        firedAtMinutes: state.world.elapsedMinutes
      });
      progress = true;
    }
  }

  return fired;
}
