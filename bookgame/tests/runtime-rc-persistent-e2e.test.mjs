import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { BookgameEngine } from "../src/engine/bookgame-engine.mjs";
import { compileStory } from "../src/compiler/story-compiler.mjs";
import { SaveStore } from "../src/engine/save-store.mjs";
import { createNewGameState } from "../src/engine/state.mjs";

const scenesDir = fileURLToPath(new URL("../content/scenes/", import.meta.url));
const modulesDir = fileURLToPath(new URL("../content/modules/", import.meta.url));
const eventsDir = fileURLToPath(new URL("../content/events/", import.meta.url));
const ecologyProfilesDir = fileURLToPath(new URL("../content/ecology/", import.meta.url));
const zonePoolsFile = fileURLToPath(
  new URL("../../campaign/world/ecology/ZONE_POOLS.json", import.meta.url)
);
const distributionFile = fileURLToPath(
  new URL("../../campaign/world/ecology/SPECIES_DISTRIBUTION.json", import.meta.url)
);
const faunaIndexFile = fileURLToPath(
  new URL("../../campaign/world/fauna/ASTERIA_FAUNA_INDEX.json", import.meta.url)
);
const ecologyOptions = {
  profilesDir: ecologyProfilesDir,
  zonePoolsFile,
  distributionFile,
  faunaIndexFile
};
const fixedNow = () => "2026-10-07T00:00:00.000Z";
const highDice = { roll: (sides) => sides };

async function makeEngine() {
  const bundle = await compileStory({
    scenesDir,
    modulesDir,
    eventsDir,
    ecologyOptions
  });
  const scenes = {
    async load(id) {
      const scene = bundle.scenes[id];
      if (!scene) throw new Error(`Unknown compiled scene: ${id}`);
      return structuredClone(scene);
    },
    async loadWorldEvents() {
      return structuredClone(bundle.worldEvents ?? []);
    },
    async loadEcology() {
      return structuredClone(bundle.ecology);
    }
  };
  return new BookgameEngine({ scenes, dice: highDice, now: fixedNow });
}

class MaxHeap {
  constructor() {
    this.values = [];
  }
  get size() {
    return this.values.length;
  }
  push(entry) {
    const a = this.values;
    a.push(entry);
    let i = a.length - 1;
    while (i > 0) {
      const p = Math.floor((i - 1) / 2);
      if (a[p].priority >= entry.priority) break;
      a[i] = a[p];
      i = p;
    }
    a[i] = entry;
  }
  pop() {
    const a = this.values;
    if (a.length === 0) return null;
    const top = a[0];
    const tail = a.pop();
    if (a.length > 0) {
      let i = 0;
      while (true) {
        let best = i;
        const left = i * 2 + 1;
        const right = left + 1;
        if (left < a.length && a[left].priority > (best === i ? tail.priority : a[best].priority)) {
          best = left;
        }
        if (right < a.length) {
          const currentBest = best === i ? tail.priority : a[best].priority;
          if (a[right].priority > currentBest) best = right;
        }
        if (best === i) break;
        a[i] = a[best];
        i = best;
      }
      a[i] = tail;
    }
    return top;
  }
}

function signature(state) {
  const flags = Object.fromEntries(
    Object.entries(state.world?.flags ?? {})
      .filter(([, value]) =>
        value === null ||
        ["string", "number", "boolean"].includes(typeof value)
      )
      .sort(([a], [b]) => a.localeCompare(b))
  );
  const trials = Object.fromEntries(
    Object.entries(state.competition?.trials ?? {})
      .map(([id, trial]) => [id, {
        registered: Boolean(trial?.registered),
        completed: Boolean(trial?.completed),
        passed: trial?.passed ?? null
      }])
      .sort(([a], [b]) => a.localeCompare(b))
  );
  const quests = Object.fromEntries(
    Object.entries(state.quests ?? {})
      .map(([id, quest]) => [id, {
        status: quest?.status ?? null,
        resolution: quest?.resolution ?? null
      }])
      .sort(([a], [b]) => a.localeCompare(b))
  );
  const events = Object.fromEntries(
    Object.entries(state.events ?? {})
      .map(([id, event]) => [id, {
        status: event?.status ?? null,
        outcomeId: event?.outcomeId ?? null
      }])
      .sort(([a], [b]) => a.localeCompare(b))
  );
  const worldCompetition = state.competition?.world ?? {};
  const npcs = Object.fromEntries(
    Object.entries(state.npcs ?? {})
      .map(([id, npc]) => [id, {
        scheduleId: npc?.schedule?.scheduleId ?? null,
        locationId: npc?.schedule?.locationId ?? null,
        present: npc?.schedule?.present ?? null,
        state: npc?.state ?? null
      }])
      .sort(([a], [b]) => a.localeCompare(b))
  );
  return JSON.stringify({
    sceneId: state.story?.sceneId ?? null,
    nodeId: state.story?.nodeId ?? null,
    pending: state.pending
      ? {
          type: state.pending.type,
          encounterId: state.pending.encounterId,
          returnNodes: state.pending.returnNodes,
          competition: state.pending.competition
        }
      : null,
    locationId: state.world?.locationId ?? null,
    day: Math.min(Number(state.world?.day ?? 0), 30),
    time: state.world?.time ?? null,
    flags,
    rank: state.competition?.rank ?? null,
    rankOrder: state.competition?.rankOrder ?? null,
    trials,
    quests,
    events,
    npcs,
    trainerLevel: state.player?.trainerLevel ?? null,
    trainerPath: state.player?.trainerPath ?? null,
    trainerAbilities: state.player?.abilities ?? null,
    trainerProgressionPending: (state.player?.trainerProgression?.pendingChoices ?? []).map((entry) => ({
      level: entry.level,
      type: entry.type
    })),
    rosterSize: state.player?.roster?.length ?? 0,
    money: state.player?.money ?? null,
    worldCompetition: {
      drawComplete: worldCompetition.drawComplete ?? false,
      fieldLocked: worldCompetition.fieldLocked ?? false,
      groupStage: worldCompetition.groupStage ?? null,
      top16Locked: worldCompetition.top16Locked ?? false,
      top4Locked: worldCompetition.top4Locked ?? false,
      currentWorldChampion: worldCompetition.currentWorldChampion ?? null,
      knockout: worldCompetition.knockout ?? null
    }
  });
}

function completedModuleCount(state) {
  const f = state.world?.flags ?? {};
  let count = 0;
  for (let i = 1; i <= 12; i += 1) {
    if (f[`m${i}_complete`] || f[`m0${i}_complete`]) count += 1;
  }
  return count;
}

function progressionScore(state, route, depth) {
  const f = state.world?.flags ?? {};
  let score = completedModuleCount(state) * 100000;
  score += Object.values(f).filter((value) => value === true).length * 20;
  score += Object.entries(f).filter(([key, value]) => value === true && /_complete$/.test(key)).length * 500;
  score += Object.entries(f).filter(([key, value]) => value === true && /_available$/.test(key)).length * 250;
  score += Math.min(Number(state.world?.day ?? 0), 30) * 150;
  score += Number(state.competition?.rankOrder ?? 0) * 500;
  // Keep this pathfinder focused on story gates: earned XP now produces
  // legitimate intermediate Trainer levels that should not bias route search.

  for (const [key, value] of [
    ["world_qualified", 4000],
    ["world_group_advanced", 5000],
    ["world_qf_won", 6000],
    ["world_sf_won", 7000],
    ["world_champion", 12000],
    ["world_eliminated", route === "eliminated" ? 12000 : -12000],
    ["worlds_missed", route === "missed" ? 12000 : -12000],
    ["main_story_complete", 20000]
  ]) {
    if (f[key]) score += value;
  }

  if (route === "champion" && (f.world_eliminated || f.worlds_missed)) score -= 1000000;
  if (route === "missed" && f.world_qualified && !f.worlds_missed) score -= 2000;
  if (route === "eliminated" && f.worlds_missed) score -= 1000000;
  score += m2MilestoneScore(state);
  score += m7MilestoneScore(state);
  return score - depth;
}

function m2MilestoneScore(state) {
  const f = state.world?.flags ?? {};
  const trial = state.competition?.trials?.RANK_E_TO_D ?? {};
  const milestones = [
    f.n_met === true,
    f.local_problem_started === true,
    f.a2_friend_news_available === true,
    f.friend_beat_02_complete === true,
    (state.player?.roster?.length ?? 0) >= 3,
    f.poaching_network_state === "intervened",
    f.a2_network_outcome_available === true,
    f.network_outcome_complete === true,
    f.a2_rank_trial_e_d_available === true,
    trial.available === true,
    trial.registered === true,
    state.competition?.rank === "D",
    f.m2_complete === true
  ];
  let score = 0;
  for (let i = 0; i < milestones.length; i += 1) {
    if (!milestones[i]) break;
    score += 2500;
  }
  return score;
}

function m7MilestoneScore(state) {
  const f = state.world?.flags ?? {};
  const milestones = [
    f.m7_active === true,
    f.m7_meridiana_arrived === true,
    f.cynthia_met === true,
    f.m7_media_sponsor_reviewed === true,
    f.m7_pro_preparation_complete === true,
    f.friend_beat_07_complete === true,
    f.m7_qualifier_registered === true,
    f.m7_qualifier_complete === true,
    f.m7_qualifier_result_resolved === true,
    f.world_qualified === true,
    f.m7_before_lights_complete === true,
    f.m7_complete === true && f.m08_unlocked === true
  ];
  let score = 0;
  for (const reached of milestones) {
    if (!reached) break;
    score += 2500;
  }
  return score;
}

function preferredChoices(choices) {
  const positive = /trainer_|commit|complete|confirm|activate|continue|depart|travel|register|resolve|record|relationship|close|ready|open|advance|accept|enter|start|fight|win|audit|sync|lock|arrive|proceed|return|introduce|intro/i;
  const negative = /review|back|stay|repeat|defer|wait|existing|free_roam|inspect|listen|talk_again/i;
  return [...choices].sort((a, b) => {
    const score = (choice) =>
      (positive.test(choice.id) ? 10 : 0) -
      (negative.test(choice.id) ? 10 : 0);
    return score(b) - score(a) || a.id.localeCompare(b.id);
  });
}

function combatOutcomes(state, policy) {
  const keys = Object.keys(state.pending?.returnNodes ?? {});
  const canCapture =
    keys.includes("captured") &&
    state.pending?.opponentRegistered !== true &&
    (state.player?.roster?.length ?? 0) < 6;
  const legal = keys.filter((key) => key !== "captured" || canCapture);
  if (canCapture) {
    const rest = legal.filter((key) => key !== "captured");
    return ["captured", ...rest];
  }
  if (policy === "win" && legal.includes("win")) return ["win"];
  const ordered = ["win", "lose", "fled", "escape", ...legal];
  return [...new Set(ordered.filter((key) => legal.includes(key)))];
}

function resolvedCaptureOpponent(state) {
  const opponent = structuredClone(state.pending?.opponent ?? {});
  const speciesId = opponent.speciesId ?? opponent.id ?? "unknown";
  return {
    ...opponent,
    speciesId,
    name: opponent.name ?? speciesId,
    level: Number.isInteger(opponent.level) ? opponent.level : 1,
    hp: opponent.hp ?? { current: 1, max: 8 },
    statuses: opponent.statuses ?? { nonVolatile: null, volatile: [] },
    abilityId: opponent.abilityId ?? null,
    moveIds: Array.isArray(opponent.moveIds) ? opponent.moveIds : [],
    pp: opponent.pp ?? {}
  };
}

function resolveAutoplayCombat(engine, state, outcome) {
  let next = state;
  if (outcome === "captured") {
    next = engine.setCombatState(next, {
      encounterId: next.pending.encounterId,
      outcome: "captured",
      opponent: resolvedCaptureOpponent(next)
    });
  }
  return engine.resolveCombatHandoff(next, outcome);
}

async function replayActions(engine, start, actions) {
  let state = structuredClone(start);
  for (const action of actions) {
    if (action.kind === "combat") {
      state = resolveAutoplayCombat(engine, state, action.outcome);
    } else {
      state = await engine.choose(state, action.choiceId);
    }
  }
  return state;
}

async function searchTo({
  engine,
  start,
  goal,
  label,
  route = "champion",
  combatPolicy = "win",
  maxExpansions = 12000
}) {
  if (goal(start)) return start;

  const simulatedStart = structuredClone(start);
  simulatedStart.story.history = [];

  const heap = new MaxHeap();
  heap.push({
    state: simulatedStart,
    depth: 0,
    priority: progressionScore(simulatedStart, route, 0),
    actions: []
  });
  const seen = new Set();
  let expansions = 0;
  let last = null;

  while (heap.size > 0 && expansions < maxExpansions) {
    const current = heap.pop();
    const key = signature(current.state);
    if (seen.has(key)) continue;
    seen.add(key);
    expansions += 1;
    last = current;

    if (goal(current.state)) {
      const replayed = await replayActions(engine, start, current.actions);
      assert.equal(goal(replayed), true, `${label} replay must reach the searched goal`);
      return replayed;
    }

    if (current.state.pending?.type === "pokemon5e_combat") {
      for (const outcome of combatOutcomes(current.state, combatPolicy)) {
        try {
          const next = resolveAutoplayCombat(engine, current.state, outcome);
          next.story.history = [];
          const actions = [...current.actions, { kind: "combat", outcome }];
          if (goal(next)) {
            const replayed = await replayActions(engine, start, actions);
            assert.equal(goal(replayed), true, `${label} combat replay must reach goal`);
            return replayed;
          }
          heap.push({
            state: next,
            depth: current.depth + 1,
            priority: progressionScore(next, route, current.depth + 1),
            actions
          });
        } catch {
          // Illegal outcome for this subsystem state is simply not an edge.
        }
      }
      continue;
    }

    let view;
    try {
      view = await engine.present(current.state);
    } catch {
      continue;
    }

    for (const choice of preferredChoices(view.choices)) {
      try {
        const next = await engine.choose(current.state, choice.id);
        next.story.history = [];
        const actions = [...current.actions, { kind: "choice", choiceId: choice.id }];
        if (goal(next)) {
          const replayed = await replayActions(engine, start, actions);
          assert.equal(goal(replayed), true, `${label} choice replay must reach goal`);
          return replayed;
        }
        const bias =
          (/trainer_|commit|complete|confirm|activate|continue|advance|register|resolve|record|relationship|close|audit|lock/i.test(choice.id) ? 300 : 0) -
          (/review|back|stay|repeat|defer|wait|existing|free_roam/i.test(choice.id) ? 100 : 0);
        heap.push({
          state: next,
          depth: current.depth + 1,
          priority: progressionScore(next, route, current.depth + 1) + bias,
          actions
        });
      } catch {
        // Choices can still fail on subsystem-specific legality (money, roster, etc.).
      }
    }
  }

  const where = last
    ? `${last.state.story?.sceneId}#${last.state.story?.nodeId} actions=${last.actions.slice(-20).map((action) =>
        action.kind === "combat" ? `combat:${action.outcome}` : action.choiceId
      ).join(" -> ")}`
    : "no state expanded";
  throw new Error(
    `Persistent E2E search failed at ${label} after ${expansions} expansions; last=${where}`
  );
}

async function requireChoice(engine, state, choiceId, label = choiceId) {
  const view = await engine.present(state);
  assert.ok(
    view.choices.some((choice) => choice.id === choiceId),
    `${label}: expected visible choice ${choiceId} at ${view.sceneId}#${view.nodeId}`
  );
  return engine.choose(state, choiceId);
}

async function completeCanonicalM1(engine, start) {
  let state = structuredClone(start);

  state = await requireChoice(engine, state, "to_valedarsena", "M1 travel");
  state = await requireChoice(engine, state, "enter_center", "M1 enter Center");

  let view = await engine.present(state);
  if (view.choices.some((choice) => choice.id === "blue_center_intro")) {
    state = await requireChoice(engine, state, "blue_center_intro", "M1 Blue entry");
    state = await requireChoice(engine, state, "talk", "M1 Blue conversation");
    state = await requireChoice(engine, state, "back", "M1 Blue return");
  } else {
    state = await searchTo({
      engine,
      start: state,
      goal: (s) => s.world.flags.blue_met === true,
      label: "M1 Blue meeting",
      route: "champion",
      combatPolicy: "win",
      maxExpansions: 800
    });
  }

  state = await searchTo({
    engine,
    start: state,
    goal: (s) => s.world.flags.friend_beat_01_complete === true,
    label: "M1 Friend Beat",
    route: "champion",
    combatPolicy: "win",
    maxExpansions: 1200
  });

  state = await searchTo({
    engine,
    start: state,
    goal: (s) => (s.player.roster?.length ?? 0) >= 2,
    label: "M1 second Pokémon capture",
    route: "champion",
    combatPolicy: "branch",
    maxExpansions: 1600
  });

  state = await searchTo({
    engine,
    start: state,
    goal: (s) => s.world.flags.m1_complete === true,
    label: "M1 Promotion Trial and exit",
    route: "champion",
    combatPolicy: "win",
    maxExpansions: 2500
  });

  assert.equal(state.world.flags.blue_met, true);
  assert.equal(state.world.flags.friend_beat_01_complete, true);
  assert.equal(state.world.flags.friends_split, true);
  assert.ok(state.player.roster.length >= 2);
  assert.equal(state.competition.rank, "E");
  assert.equal(state.world.flags.m02_unlocked, true);
  assert.ok(state.player.trainerLevel >= 2);
  return state;
}

async function completeCanonicalM2(engine, start) {
  let state = structuredClone(start);

  const milestones = [
    {
      label: "M2 meet N",
      goal: (s) => s.world.flags.n_met === true,
      combatPolicy: "win",
      maxExpansions: 3500
    },
    {
      label: "M2 open local problem",
      goal: (s) => s.world.flags.local_problem_started === true,
      combatPolicy: "win",
      maxExpansions: 4500
    },
    {
      label: "M2 Friend News window",
      goal: (s) => s.world.flags.a2_friend_news_available === true,
      combatPolicy: "win",
      maxExpansions: 5000
    },
    {
      label: "M2 Friend Beat 02",
      goal: (s) => s.world.flags.friend_beat_02_complete === true,
      combatPolicy: "win",
      maxExpansions: 1800
    },
    {
      label: "M2 third Pokémon",
      goal: (s) => (s.player.roster?.length ?? 0) >= 3,
      combatPolicy: "branch",
      maxExpansions: 4500
    },
    {
      label: "M2 intervene in poaching network",
      goal: (s) => s.world.flags.poaching_network_state === "intervened",
      combatPolicy: "win",
      maxExpansions: 5000
    },
    {
      label: "M2 network outcome window",
      goal: (s) => s.world.flags.a2_network_outcome_available === true,
      combatPolicy: "win",
      maxExpansions: 2200
    },
    {
      label: "M2 network outcome",
      goal: (s) => s.world.flags.network_outcome_complete === true,
      combatPolicy: "win",
      maxExpansions: 2200
    },
    {
      label: "M2 Promotion Trial window",
      goal: (s) => s.world.flags.a2_rank_trial_e_d_available === true,
      combatPolicy: "win",
      maxExpansions: 1800
    },
    {
      label: "M2 Promotion Trial available",
      goal: (s) => s.competition.trials?.RANK_E_TO_D?.available === true,
      combatPolicy: "win",
      maxExpansions: 1400
    },
    {
      label: "M2 Promotion Trial registered",
      goal: (s) => s.competition.trials?.RANK_E_TO_D?.registered === true,
      combatPolicy: "win",
      maxExpansions: 900
    },
    {
      label: "M2 Promotion Trial win",
      goal: (s) => s.competition.rank === "D",
      combatPolicy: "win",
      maxExpansions: 900
    },
    {
      label: "M2 Promotion Trial exit",
      goal: (s) => s.world.flags.m2_complete === true,
      combatPolicy: "win",
      maxExpansions: 500
    }
  ];

  for (const milestone of milestones) {
    if (milestone.goal(state)) continue;
    state = await searchTo({
      engine,
      start: state,
      goal: milestone.goal,
      label: milestone.label,
      route: "champion",
      combatPolicy: milestone.combatPolicy,
      maxExpansions: milestone.maxExpansions
    });
  }

  assert.equal(state.world.flags.n_met, true);
  assert.equal(state.world.flags.local_problem_started, true);
  assert.equal(state.world.flags.friend_beat_02_complete, true);
  assert.ok((state.player.roster?.length ?? 0) >= 3);
  assert.equal(state.world.flags.network_outcome_complete, true);
  assert.ok(state.player.trainerLevel >= 4);
  assert.equal(state.competition.rank, "D");
  assert.equal(state.world.flags.m2_complete, true);
  assert.equal(state.world.flags.m03_unlocked, true);
  return state;
}

async function completeCanonicalM3TunnelWarnings(engine, start) {
  let state = structuredClone(start);
  if (state.world.flags.tunnel_warnings_complete === true) return state;

  let view = await engine.present(state);
  if (view.choices.some((choice) => choice.id === "hub_tunnel_warnings")) {
    state = await requireChoice(engine, state, "hub_tunnel_warnings", "M3 Tunnel Warnings entry");
  } else if (!(state.story.sceneId === "m03-tunnel-warnings" && state.story.nodeId === "warning_board")) {
    state = await searchTo({
      engine,
      start: state,
      goal: (s) => s.story.sceneId === "m03-tunnel-warnings" && s.story.nodeId === "warning_board",
      label: "M3 Tunnel Warnings entry",
      route: "champion",
      combatPolicy: "win",
      maxExpansions: 1000
    });
  }

  view = await engine.present(state);
  if (view.choices.some((choice) => choice.id === "synthesize_now")) {
    state = await requireChoice(engine, state, "synthesize_now", "M3 Tunnel Warnings synthesis");
  }

  view = await engine.present(state);
  const record = ["record_strong_warning", "record_partial_warning", "record_low_confidence"]
    .find((id) => view.choices.some((choice) => choice.id === id));
  assert.ok(record, "M3 Tunnel Warnings synthesis must expose one authored confidence result");
  state = await engine.choose(state, record);
  assert.equal(state.world.flags.tunnel_warnings_complete, true);
  return state;
}

async function completeCanonicalM3RescueOutcome(engine, start) {
  let state = structuredClone(start);
  if (state.world.flags.ferrox_rescue_outcome_complete === true) return state;

  let view = await engine.present(state);
  const leaveRescue = ["success_to_close", "declined_close", "missed_close"]
    .find((id) => view.choices.some((choice) => choice.id === id));
  if (leaveRescue) {
    state = await engine.choose(state, leaveRescue);
    state = await requireChoice(engine, state, "close_to_hub", "M3 Ferrox rescue return");
  }

  view = await engine.present(state);
  if (view.choices.some((choice) => choice.id === "hub_rescue_outcome")) {
    state = await requireChoice(engine, state, "hub_rescue_outcome", "M3 Ferrox outcome entry");
  } else if (!(state.story.sceneId === "m03-rescue-outcome" && state.story.nodeId === "outcome_board")) {
    state = await searchTo({
      engine,
      start: state,
      goal: (s) =>
        s.story.sceneId === "m03-rescue-outcome" &&
        s.story.nodeId === "outcome_board",
      label: "M3 Ferrox outcome entry",
      route: "champion",
      combatPolicy: "win",
      maxExpansions: 800
    });
  }

  view = await engine.present(state);
  const outcome = view.choices.find((choice) => /^outcome_/.test(choice.id));
  assert.ok(outcome, "M3 Ferrox outcome must expose the authored rescue-state branch");
  state = await engine.choose(state, outcome.id);

  view = await engine.present(state);
  const register = view.choices.find((choice) => /_register$/.test(choice.id));
  assert.ok(register, "M3 Ferrox outcome must expose a verified report registration");
  state = await engine.choose(state, register.id);

  state = await requireChoice(engine, state, "resp_systemic", "M3 Ferrox responsibility review");

  view = await engine.present(state);
  const reputation = ["rep_high", "rep_neutral", "rep_none"]
    .find((id) => view.choices.some((choice) => choice.id === id));
  assert.ok(reputation, "M3 Ferrox outcome must expose the matching local reputation result");
  state = await engine.choose(state, reputation);

  state = await requireChoice(engine, state, "close_hub", "M3 Ferrox outcome close");
  assert.equal(state.world.flags.ferrox_rescue_outcome_complete, true);
  return state;
}

async function completeCanonicalM3FriendBeat(engine, start) {
  let state = structuredClone(start);
  if (state.world.flags.friend_beat_03_complete === true) return state;

  if (state.world.flags.a3_friend_call_available !== true) {
    state = await searchTo({
      engine,
      start: state,
      goal: (s) => s.world.flags.a3_friend_call_available === true,
      label: "M3 Friend Call window",
      route: "champion",
      combatPolicy: "win",
      maxExpansions: 800
    });
  }

  let view = await engine.present(state);
  if (view.choices.some((choice) => choice.id === "hub_friend_beat_03")) {
    state = await requireChoice(engine, state, "hub_friend_beat_03", "M3 Friend Beat entry");
  } else if (!(state.story.sceneId === "m03-friend-beat-03" && state.story.nodeId === "friend_call")) {
    state = await searchTo({
      engine,
      start: state,
      goal: (s) =>
        s.story.sceneId === "m03-friend-beat-03" &&
        s.story.nodeId === "friend_call",
      label: "M3 Friend Beat entry",
      route: "champion",
      combatPolicy: "win",
      maxExpansions: 900
    });
  }

  view = await engine.present(state);
  const dispatch = view.choices.find((choice) => /^dispatch_/.test(choice.id));
  assert.ok(dispatch, "M3 Friend Beat must expose the event-selected friend");
  state = await engine.choose(state, dispatch.id);

  view = await engine.present(state);
  const contact = view.choices.find((choice) => /_answer_remote$/.test(choice.id))
    ?? view.choices.find((choice) => /_meet_physical$/.test(choice.id));
  assert.ok(contact, "M3 Friend Beat must respect the selected remote/physical contact mode");
  state = await engine.choose(state, contact.id);

  view = await engine.present(state);
  const brief = view.choices.find((choice) => /_remote_brief$/.test(choice.id))
    ?? view.choices.find((choice) => /_physical_brief$/.test(choice.id));
  assert.ok(brief, "M3 Friend Beat must provide a short authored completion branch");
  state = await engine.choose(state, brief.id);

  state = await requireChoice(engine, state, "close_friend_beat_03", "M3 Friend Beat close");
  assert.equal(state.world.flags.friend_beat_03_complete, true);
  return state;
}

async function completeCanonicalM3TrialWin(engine, start) {
  let state = structuredClone(start);
  if (state.competition.rank === "C") return state;

  let view = await engine.present(state);
  if (view.choices.some((choice) => choice.id === "enter_trial")) {
    state = await requireChoice(engine, state, "enter_trial", "M3 Trial D→C enter");
  } else if (view.choices.some((choice) => choice.id === "audit_enter")) {
    state = await requireChoice(engine, state, "audit_enter", "M3 Trial D→C enter from audit");
  } else if (view.choices.some((choice) => choice.id === "prep_enter")) {
    state = await requireChoice(engine, state, "prep_enter", "M3 Trial D→C enter from prep");
  } else if (!(state.story.sceneId === "m03-promotion-trial-d-c")) {
    state = await searchTo({
      engine,
      start: state,
      goal: (s) => s.story.sceneId === "m03-promotion-trial-d-c",
      label: "M3 Trial D to C arena entry",
      route: "champion",
      combatPolicy: "win",
      maxExpansions: 500
    });
  }

  view = await engine.present(state);
  if (view.choices.some((choice) => choice.id === "briefing")) {
    state = await requireChoice(engine, state, "briefing", "M3 Trial D→C briefing");
  } else if (view.choices.some((choice) => choice.id === "rules_ready")) {
    state = await requireChoice(engine, state, "rules_ready", "M3 Trial D→C rules return");
  }

  view = await engine.present(state);
  if (!view.choices.some((choice) => choice.id === "begin_trial")) {
    state = await searchTo({
      engine,
      start: state,
      goal: (s) => s.story.sceneId === "m03-promotion-trial-d-c" && s.story.nodeId === "examiner_briefing",
      label: "M3 Trial D to C briefing node",
      route: "champion",
      combatPolicy: "win",
      maxExpansions: 200
    });
  }

  state = await requireChoice(engine, state, "begin_trial", "M3 Trial D→C begin");
  assert.equal(state.pending?.type, "pokemon5e_combat");
  state = resolveAutoplayCombat(engine, state, "win");
  assert.equal(state.competition.rank, "C");
  return state;
}

async function completeCanonicalM3(engine, start) {
  let state = structuredClone(start);

  const milestones = [
    {
      label: "M3 activation",
      goal: (s) => s.world.flags.m3_active === true,
      combatPolicy: "win",
      maxExpansions: 700
    },
    {
      label: "M3 Steven meeting",
      goal: (s) => s.world.flags.steven_met === true,
      combatPolicy: "win",
      maxExpansions: 5000
    },
    {
      label: "M3 tunnel warnings",
      goal: (s) => s.world.flags.tunnel_warnings_complete === true,
      combatPolicy: "win",
      maxExpansions: 2600
    },
    {
      label: "M3 Ferrox rescue state",
      goal: (s) => typeof s.world.flags.ferrox_rescue_state === "string",
      combatPolicy: "win",
      maxExpansions: 3200
    },
    {
      label: "M3 Ferrox rescue outcome",
      goal: (s) => s.world.flags.ferrox_rescue_outcome_complete === true,
      combatPolicy: "win",
      maxExpansions: 2600
    },
    {
      label: "M3 Trial D to C window",
      goal: (s) => s.world.flags.a3_rank_trial_d_c_available === true,
      combatPolicy: "win",
      maxExpansions: 1200
    },
    {
      label: "M3 Trial D to C available",
      goal: (s) => s.competition.trials?.RANK_D_TO_C?.available === true,
      combatPolicy: "win",
      maxExpansions: 1000
    },
    {
      label: "M3 Trial D to C registered",
      goal: (s) => s.competition.trials?.RANK_D_TO_C?.registered === true,
      combatPolicy: "win",
      maxExpansions: 900
    },
    {
      label: "M3 Trial D to C win",
      goal: (s) => s.competition.rank === "C",
      combatPolicy: "win",
      maxExpansions: 900
    },
    {
      label: "M3 completion",
      goal: (s) => s.world.flags.m3_complete === true,
      combatPolicy: "win",
      maxExpansions: 900
    }
  ];

  for (const milestone of milestones) {
    if (milestone.label === "M3 tunnel warnings" && state.world.flags.tunnel_warnings_complete !== true) {
      state = await completeCanonicalM3TunnelWarnings(engine, state);
    }
    if (milestone.label === "M3 Ferrox rescue outcome" && state.world.flags.ferrox_rescue_outcome_complete !== true) {
      state = await completeCanonicalM3RescueOutcome(engine, state);
    }
    if (milestone.label === "M3 Trial D to C window" && state.world.flags.friend_beat_03_complete !== true) {
      state = await completeCanonicalM3FriendBeat(engine, state);
    }
    if (milestone.label === "M3 Trial D to C win" && state.competition.rank !== "C") {
      state = await completeCanonicalM3TrialWin(engine, state);
    }
    if (milestone.goal(state)) continue;
    state = await searchTo({
      engine,
      start: state,
      goal: milestone.goal,
      label: milestone.label,
      route: "champion",
      combatPolicy: milestone.combatPolicy,
      maxExpansions: milestone.maxExpansions
    });
  }

  if (state.world.flags.friend_beat_03_complete !== true) {
    state = await completeCanonicalM3FriendBeat(engine, state);
  }

  assert.equal(state.world.flags.steven_met, true);
  assert.equal(state.world.flags.friend_beat_03_complete, true);
  assert.ok(typeof state.world.flags.ferrox_rescue_state === "string");
  assert.equal(state.world.flags.ferrox_rescue_outcome_complete, true);
  assert.equal(state.competition.rank, "C");
  assert.equal(state.world.flags.m3_complete, true);
  assert.equal(state.world.flags.m04_unlocked, true);
  assert.ok(state.player.trainerLevel >= 7);
  return state;
}

async function captureCanonicalM4FourthPokemon(engine, start) {
  let state = structuredClone(start);
  if ((state.player.roster?.length ?? 0) >= 4) return state;

  state = await searchTo({
    engine,
    start: state,
    goal: (s) => s.story.sceneId === "m04-mareasale-arrival" && s.story.nodeId === "city_hub",
    label: "M4 return to Mareasale for roster preparation",
    route: "champion",
    combatPolicy: "win",
    maxExpansions: 1200
  });

  let view = await engine.present(state);
  while (view.sceneId === "trainer-level-up") {
    assert.ok(view.choices.length > 0, "Trainer progression must expose a resolvable choice");
    state = await engine.choose(state, view.choices[0].id);
    view = await engine.present(state);
  }

  state = await requireChoice(engine, state, "hub_coast_route", "M4 coastal capture route");
  state = await requireChoice(engine, state, "take_high_path", "M4 coastal high path");
  state = await requireChoice(engine, state, "high_watch_fauna", "M4 coastal fauna viewpoint");
  state = await requireChoice(engine, state, "observe_coast_fauna", "M4 coastal fauna encounter");

  view = await engine.present(state);
  if (view.choices.some((choice) => choice.id.endsWith("_back")) && !view.choices.some((choice) => choice.id.endsWith("_engage"))) {
    state = await engine.choose(state, view.choices.find((choice) => choice.id.endsWith("_back")).id);
    state = await requireChoice(engine, state, "take_high_path", "M4 coastal retry high path");
    state = await requireChoice(engine, state, "high_watch_fauna", "M4 coastal retry viewpoint");
    state = await requireChoice(engine, state, "observe_coast_fauna", "M4 coastal retry encounter");
    view = await engine.present(state);
  }

  const engage = view.choices.find((choice) => choice.id.endsWith("_engage"));
  assert.ok(engage, "M4 capturable coastal ecology result must expose a wild combat handoff");
  state = await engine.choose(state, engage.id);
  assert.equal(state.pending?.opponentRegistered, false);
  assert.ok(state.pending?.returnNodes?.captured, "M4 wild combat must expose captured return");
  state = resolveAutoplayCombat(engine, state, "captured");
  assert.ok((state.player.roster?.length ?? 0) >= 4);
  return state;
}

async function completeCanonicalM4(engine, start) {
  let state = structuredClone(start);
  const milestones = [
    ["M4 activation", s => s.world.flags.m4_active === true, 800],
    ["M4 Mareasale arrival", s => s.world.flags.mareasale_discovered === true, 1600],
    ["M4 Archie meeting", s => s.world.flags.archie_met === true, 2400],
    ["M4 port pressure", s => s.world.flags.port_pressure_complete === true, 3000],
    ["M4 smuggling outcome", s => typeof s.world.flags.smuggling_state === "string", 3600],
    ["M4 Friend Beat 04", s => s.world.flags.friend_beat_04_complete === true, 3000],
    ["M4 Upper Regional registration", s => s.world.flags.upper_regional_registration_complete === true || typeof s.world.flags.upper_regional_result === "string", 2400],
    ["M4 Upper Regional result", s => typeof s.world.flags.upper_regional_result === "string", 3600],
    ["M4 fourth Pokémon", s => (s.player.roster?.length ?? 0) >= 4, 4200],
    ["M4 Trial C to B window", s => s.world.flags.a4_rank_trial_c_b_available === true, 1800],
    ["M4 Trial C to B available", s => s.competition.trials?.RANK_C_TO_B?.available === true, 1400],
    ["M4 Trial C to B registered", s => s.competition.trials?.RANK_C_TO_B?.registered === true, 1200],
    ["M4 Trial C to B win", s => s.competition.rank === "B", 1200],
    ["M4 completion", s => s.world.flags.m4_complete === true, 1200]
  ];
  for (const [label, goal, maxExpansions] of milestones) {
    if (label === "M4 fourth Pokémon" && !goal(state)) {
      state = await captureCanonicalM4FourthPokemon(engine, state);
    }
    if (goal(state)) continue;
    state = await searchTo({engine,start:state,goal,label,route:"champion",combatPolicy:"win",maxExpansions});
  }
  assert.equal(state.world.flags.archie_met, true);
  assert.equal(state.world.flags.friend_beat_04_complete, true);
  assert.ok(typeof state.world.flags.upper_regional_result === "string");
  assert.ok(typeof state.world.flags.smuggling_state === "string");
  assert.equal(state.competition.rank, "B");
  assert.equal(state.world.flags.m4_complete, true);
  assert.equal(state.world.flags.m05_unlocked, true);
  return state;
}

async function completeCanonicalM5InterregionalLicense(engine, start) {
  let state = structuredClone(start);
  if (state.world.flags.interregional_license === true) return state;

  if (!(state.story.sceneId === "m05-interregional-license" && state.story.nodeId === "license_entry")) {
    state = await searchTo({
      engine,
      start: state,
      goal: (s) => s.story.sceneId === "m05-interregional-license" && s.story.nodeId === "license_entry",
      label: "M5 Interregional License entry",
      route: "champion",
      combatPolicy: "win",
      maxExpansions: 1200
    });
  }

  state = await requireChoice(engine, state, "entry_eligibility", "M5 license eligibility");
  state = await requireChoice(engine, state, "eligible_register", "M5 license registration");
  state = await requireChoice(engine, state, "register_now", "M5 license register");
  state = await requireChoice(engine, state, "prep_assess", "M5 license assessment prep");
  state = await requireChoice(engine, state, "assessment_begin", "M5 license assessment start");
  state = await requireChoice(engine, state, "fight_assessment", "M5 license assessment combat");
  assert.equal(state.pending?.competition?.matchId, "A5_INTERREGIONAL_ASSESSMENT");
  state = resolveAutoplayCombat(engine, state, "win");
  state = await requireChoice(engine, state, "win_record", "M5 license assessment result");
  state = await requireChoice(engine, state, "result_issue", "M5 license issue review");
  state = await requireChoice(engine, state, "issue_license", "M5 license issue");

  assert.equal(state.world.flags.interregional_registration_complete, true);
  assert.equal(state.world.flags.interregional_assessment_complete, true);
  assert.equal(state.world.flags.interregional_license, true);
  assert.equal(state.competition.rank, "B");
  return state;
}

async function captureCanonicalM5FifthPokemon(engine, start) {
  let state = structuredClone(start);
  const targetRosterSize = 6;
  if ((state.player.roster?.length ?? 0) >= targetRosterSize) return state;

  for (let attempt = 0; attempt < 6 && (state.player.roster?.length ?? 0) < targetRosterSize; attempt += 1) {
    state = await searchTo({
      engine,
      start: state,
      goal: (s) => s.story.sceneId === "m05-fulgore-ascent" && s.story.nodeId === "ascent_gate",
      label: `M5 Fulgore ascent gate attempt ${attempt + 1}`,
      route: "champion",
      combatPolicy: "win",
      maxExpansions: 1800
    });

    let view = await engine.present(state);
    const gateChoice = view.choices.find((choice) =>
      choice.id === "gate_direct" || choice.id === "gate_sheltered"
    );
    assert.ok(gateChoice, "M5 ascent gate must expose the authored route selected in M5_04");
    state = await engine.choose(state, gateChoice.id);

    view = await engine.present(state);
    const faunaChoice = view.choices.find((choice) =>
      choice.id === "direct_fauna" || choice.id === "shelter_fauna"
    );
    assert.ok(faunaChoice, "M5 authored ascent route must expose the Fulgore fauna viewpoint");
    state = await engine.choose(state, faunaChoice.id);

    state = await requireChoice(engine, state, "observe_fulgore_fauna", "M5 observe Fulgore fauna");
    view = await engine.present(state);
    const engage = view.choices.find((choice) => choice.id.endsWith("_engage"));
    if (engage) {
      state = await engine.choose(state, engage.id);
      assert.equal(state.pending?.opponentRegistered, false);
      assert.ok(state.pending?.returnNodes?.captured);
      state = resolveAutoplayCombat(engine, state, "captured");
      state = await requireChoice(engine, state, "wild_captured_continue", "M5 fauna capture continuation");
      if ((state.player.roster?.length ?? 0) < targetRosterSize) {
        state = await requireChoice(engine, state, "edge_retreat", "M5 fauna retry leaves the plateau edge");
        state = await requireChoice(engine, state, "retreat_altacima", "M5 fauna retry returns to Altacima");
      }
      continue;
    }

    const continueChoice = view.choices.find((choice) => choice.id === "none_continue");
    assert.ok(continueChoice, "M5 no-sighting ecology result must remain traversable");
    state = await engine.choose(state, continueChoice.id);
    state = await requireChoice(engine, state, "edge_retreat", "M5 fauna retry leaves the plateau edge");
    state = await requireChoice(engine, state, "retreat_altacima", "M5 fauna retry returns to Altacima");
  }

  assert.ok(
    (state.player.roster?.length ?? 0) >= targetRosterSize,
    "M5 canonical lineage must leave Fulgore with six real Pokémon for the later A→S gate"
  );
  return state;
}

async function completeCanonicalM5TrialWin(engine, start) {
  let state = structuredClone(start);
  if (state.competition.rank === "A") return state;

  state = await searchTo({
    engine,
    start: state,
    goal: (s) => s.pending?.type === "pokemon5e_combat" && s.pending?.competition?.checkpointId === "RANK_B_TO_A",
    label: "M5 Trial B to A combat handoff",
    route: "champion",
    combatPolicy: "win",
    maxExpansions: 1400
  });
  state = resolveAutoplayCombat(engine, state, "win");
  assert.equal(state.competition.rank, "A");
  return state;
}

async function completeCanonicalM5(engine, start) {
  let state = structuredClone(start);
  const milestones = [
    ["M5 activation", s => s.world.flags.m5_active === true, 700],
    ["M5 Altacima arrival", s => s.world.flags.altacima_discovered === true, 1800],
    ["M5 Lance meeting", s => s.world.flags.lance_met === true, 1800],
    ["M5 Fulgore departure", s => s.world.flags.m5_fulgore_departure_ready === true, 2200],
    ["M5 fifth Pokémon", s => (s.player.roster?.length ?? 0) >= 5, 1800],
    ["M5 Fulgore arrival", s => s.world.flags.fulgore_visited === true, 1800],
    ["M5 Ancient Trace", s => s.world.flags.ancient_mystery_layer_1 !== undefined, 2200],
    ["M5 interregional license", s => s.world.flags.interregional_license === true, 2600],
    ["M5 Five Cross", s => s.world.flags.five_cross_complete === true, 1800],
    ["M5 Friend Beat 05", s => s.world.flags.friend_beat_05_complete === true, 1800],
    ["M5 high altitude event", s => s.world.flags.m5_high_altitude_event_complete === true, 2200],
    ["M5 Trial B to A window", s => s.world.flags.a5_rank_trial_b_a_available === true, 1200],
    ["M5 Trial B to A available", s => s.competition.trials?.RANK_B_TO_A?.available === true, 900],
    ["M5 Trial B to A registered", s => s.competition.trials?.RANK_B_TO_A?.registered === true, 1200],
    ["M5 Trial B to A win", s => s.competition.rank === "A", 1400],
    ["M5 Masters window", s => s.world.flags.a5_masters_entry_available === true, 1400],
    ["M5 outcome window", s => s.world.flags.m5_module_outcome_available === true, 1200],
    ["M5 completion", s => s.world.flags.m5_complete === true, 1200]
  ];

  for (const [label, goal, maxExpansions] of milestones) {
    if (label === "M5 interregional license" && !goal(state)) {
      state = await completeCanonicalM5InterregionalLicense(engine, state);
    }
    if (label === "M5 fifth Pokémon" && !goal(state)) {
      state = await captureCanonicalM5FifthPokemon(engine, state);
    }
    if (label === "M5 Trial B to A win" && !goal(state)) {
      state = await completeCanonicalM5TrialWin(engine, state);
    }
    if (goal(state)) continue;
    state = await searchTo({
      engine,
      start: state,
      goal,
      label,
      route: "champion",
      combatPolicy: "win",
      maxExpansions
    });
  }

  assert.equal(state.competition.rank, "A");
  assert.equal(state.world.flags.lance_met, true);
  assert.equal(state.world.flags.friend_beat_05_complete, true);
  assert.equal(state.world.flags.interregional_license, true);
  assert.ok(state.world.flags.ancient_mystery_layer_1 !== undefined);
  assert.ok((state.player.roster?.length ?? 0) >= 5);
  assert.equal(state.world.flags.m5_complete, true);
  assert.equal(state.world.flags.m06_unlocked, true);
  return state;
}

async function completeCanonicalM6(engine, start) {
  let state = structuredClone(start);
  const milestones = [
    ["M6 activation", (s) => s.world.flags.m6_active === true, 1200],
    ["M6 route selection", (s) => s.world.flags.m6_route_selection_complete === true, 1800],
    ["M6 interregional travel", (s) => s.world.flags.m6_interregional_travel_complete === true, 2400],
    ["M6 Red meeting", (s) => s.world.flags.red_met === true, 1800],
    ["M6 Masters Circuit", (s) => s.world.flags.m6_masters_event_complete === true, 3000],
    ["M6 Hidden Trajectories", (s) => s.world.flags.m6_hidden_trajectories_complete === true, 2600],
    ["M6 Friend Beat 06", (s) => s.world.flags.friend_beat_06_complete === true, 2600],
    ["M6 Continental Cup", (s) => s.world.flags.continental_complete === true, 4200],
    ["M6 Ancient Layer Two", (s) => s.world.flags.ancient_mystery_layer_2 !== undefined, 2600],
    ["M6 First Lighthouse return", (s) => s.world.flags.m6_first_lighthouse_return_complete === true, 2600],
    ["M6 A to S trial available", (s) => s.competition.trials?.RANK_A_TO_S?.available === true, 1600],
    ["M6 A to S trial registered", (s) => s.competition.trials?.RANK_A_TO_S?.registered === true, 2200],
    ["M6 A to S trial win", (s) => s.competition.rank === "S", 3200],
    ["M6 World cutoff review", (s) => s.world.flags.m6_world_cutoff_review_complete === true, 2600],
    ["M6 outcome window", (s) => s.world.flags.m6_module_outcome_available === true, 1600],
    ["M6 completion", (s) => s.world.flags.m6_complete === true, 2200]
  ];

  for (const [label, goal, maxExpansions] of milestones) {
    if (goal(state)) continue;
    state = await searchTo({
      engine,
      start: state,
      goal,
      label,
      route: "champion",
      combatPolicy: "win",
      maxExpansions
    });
  }

  assert.equal(state.competition.rank, "S");
  assert.equal(state.world.flags.red_met, true);
  assert.equal(state.world.flags.friend_beat_06_complete, true);
  assert.ok(state.world.flags.ancient_mystery_layer_2 !== undefined);
  assert.equal(state.world.flags.m6_first_lighthouse_return_complete, true);
  assert.equal(state.world.flags.m6_world_cutoff_review_complete, true);
  assert.equal(state.world.flags.m6_complete, true);
  assert.equal(state.world.flags.m07_unlocked, true);
  return state;
}


async function completeMilestoneSequence(engine, start, milestones, {
  route = "champion",
  combatPolicy = "win"
} = {}) {
  let state = structuredClone(start);
  for (const [label, goal, maxExpansions = 2600] of milestones) {
    if (goal(state)) continue;
    state = await searchTo({
      engine,
      start: state,
      goal,
      label,
      route,
      combatPolicy,
      maxExpansions
    });
  }
  return state;
}

async function completeCanonicalM7Qualified(engine, start) {
  const state = await completeMilestoneSequence(engine, start, [
    ["M7 activation", flag("m7_active"), 1200],
    ["M7 Meridiana arrival", flag("m7_meridiana_arrived"), 1800],
    ["M7 Cynthia meeting", flag("cynthia_met"), 1800],
    ["M7 sponsor/media review", flag("m7_media_sponsor_reviewed"), 2200],
    ["M7 professional preparation", flag("m7_pro_preparation_complete"), 2200],
    ["M7 Friend Beat 07 entry", (s) => s.story?.sceneId === "m07-friend-beat-07", 2600],
    ["M7 Friend Beat 07", flag("friend_beat_07_complete"), 400],
    ["M7 qualifier registration", flag("m7_qualifier_registered"), 2200],
    ["M7 qualifier complete", flag("m7_qualifier_complete"), 3200],
    ["M7 qualifier result resolved", flag("m7_qualifier_result_resolved"), 2200],
    ["M7 World qualification", (s) => s.world.flags.world_qualified === true, 2200],
    ["M7 Before the Lights", flag("m7_before_lights_complete"), 2600],
    ["M7 qualified completion", (s) => s.world.flags.m7_complete === true && s.world.flags.m08_unlocked === true, 2200]
  ], { route: "champion", combatPolicy: "win" });

  assert.equal(state.world.flags.world_qualified, true);
  assert.equal(state.world.flags.m7_complete, true);
  assert.equal(state.world.flags.m08_unlocked, true);
  return state;
}

async function completeCanonicalM7Missed(engine, start) {
  const state = await completeMilestoneSequence(engine, start, [
    ["M7 missed activation", flag("m7_active"), 1200],
    ["M7 missed Meridiana arrival", flag("m7_meridiana_arrived"), 1800],
    ["M7 missed professional preparation", flag("m7_pro_preparation_complete"), 2600],
    ["M7 missed Friend Beat 07 entry", (s) => s.story?.sceneId === "m07-friend-beat-07", 3000],
    ["M7 missed Friend Beat 07", flag("friend_beat_07_complete"), 400],
    ["M7 missed qualifier registration", flag("m7_qualifier_registered"), 2400],
    ["M7 missed qualifier complete", flag("m7_qualifier_complete"), 4200],
    ["M7 initial elimination", (s) =>
      s.world.flags.world_qualified === false &&
      s.world.flags.last_chance_eligible === true &&
      s.world.flags.a7_last_chance_available === true, 4200],
    ["M7 last chance loss", (s) =>
      s.world.flags.m7_last_chance_complete === true &&
      s.world.flags.m7_last_chance_result === "lost" &&
      s.world.flags.world_qualified === false, 4200],
    ["M7 Worlds Missed resolution", (s) =>
      s.world.flags.worlds_missed === true &&
      s.world.flags.m7_worlds_missed_resolved === true, 2600],
    ["M7 missed completion", (s) =>
      s.world.flags.m7_complete === true &&
      s.world.flags.m12_unlocked === true, 2200]
  ], { route: "missed", combatPolicy: "branch" });

  assert.equal(state.world.flags.worlds_missed, true);
  assert.equal(state.world.flags.world_qualified, false);
  assert.equal(state.world.flags.m12_unlocked, true);
  return state;
}

async function completeCanonicalM8(engine, start) {
  let state = await completeMilestoneSequence(engine, start, [
    ["M8 activation", flag("m8_active"), 1200],
    ["M8 World arrival", flag("m8_world_arrived"), 1800],
    ["M8 accreditation", flag("m8_accreditation_complete"), 1800],
    ["M8 medical control", flag("m8_medical_control_complete"), 1800],
    ["M8 registration", flag("m8_world_registration_complete"), 2200],
    ["M8 village arrival", flag("m8_world_village_arrived"), 1800],
    ["M8 village orientation", flag("m8_world_village_orientation_complete"), 2200],
    ["M8 Astrid availability", flag("m8_astrid_available"), 400],
    ["M8 Astrid scene", (s) => s.story?.sceneId === "m08-astrid-enters", 2200]
  ], { route: "champion", combatPolicy: "win" });

  const astridView = await engine.present(state);
  const astridChoice = astridView.choices.some((choice) => choice.id === "astrid_introduce")
    ? "astrid_introduce" : "astrid_reengage";
  state = await requireChoice(engine, state, astridChoice, "M8 Astrid introduction/reengagement");
  assert.equal(state.world.flags.astrid_met, true);

  state = await completeMilestoneSequence(engine, state, [
    ["M8 Friend Beat 08", flag("friend_beat_08_complete"), 2600],
    ["M8 training hall", flag("m8_training_hall_complete"), 2600],
    ["M8 media day", flag("m8_media_day_complete"), 2200],
    ["M8 opening ceremony", flag("m8_opening_ceremony_complete"), 2200],
    ["M8 World draw", flag("world_draw_complete"), 3200],
    ["M8 group reveal", flag("m8_group_reveal_complete"), 2200],
    ["M8 completion", (s) => s.world.flags.m8_complete === true && s.world.flags.m09_unlocked === true, 1800]
  ], { route: "champion", combatPolicy: "win" });

  assert.equal(state.world.flags.world_draw_complete, true);
  assert.equal(state.world.flags.m8_complete, true);
  assert.equal(state.world.flags.m09_unlocked, true);
  return state;
}

async function completeCanonicalM9Advanced(engine, start) {
  const state = await completeMilestoneSequence(engine, start, [
    ["M9 groups open", flag("m9_groups_open_complete"), 2200],
    ["M9 matchday one", flag("m9_matchday_one_complete"), 2600],
    ["M9 interday one", flag("m9_interday_one_complete"), 2200],
    ["M9 Kaia thread", flag("m9_kaia_thread_complete"), 2200],
    ["M9 matchday two", flag("m9_matchday_two_complete"), 2600],
    ["M9 Friend Beat 09", flag("friend_beat_09_complete"), 2600],
    ["M9 interday two", flag("m9_interday_two_complete"), 2200],
    ["M9 matchday three", (s) => s.world.flags.world_group_md3_resolved === true, 2800],
    ["M9 group resolution", (s) =>
      s.competition.world?.groupStage?.resolved === true &&
      s.world.flags.world_top16_locked === true, 3000],
    ["M9 group advance", (s) => s.world.flags.world_group_advanced === true, 2200],
    ["M9 advancing completion", (s) =>
      s.world.flags.m9_complete === true &&
      s.world.flags.m10_unlocked === true, 1800]
  ], { route: "champion", combatPolicy: "win" });

  assert.equal(state.world.flags.world_group_advanced, true);
  assert.equal(state.world.flags.m10_unlocked, true);
  return state;
}

async function completeCanonicalM9Eliminated(engine, start) {
  const state = await completeMilestoneSequence(engine, start, [
    ["M9 eliminated groups open", flag("m9_groups_open_complete"), 2200],
    ["M9 eliminated matchday one", flag("m9_matchday_one_complete"), 3200],
    ["M9 eliminated interday one", flag("m9_interday_one_complete"), 2200],
    ["M9 eliminated Kaia thread", flag("m9_kaia_thread_complete"), 2200],
    ["M9 eliminated matchday two", flag("m9_matchday_two_complete"), 3200],
    ["M9 eliminated Friend Beat 09", flag("friend_beat_09_complete"), 3000],
    ["M9 eliminated interday two", flag("m9_interday_two_complete"), 2200],
    ["M9 eliminated matchday three", (s) => s.world.flags.world_group_md3_resolved === true, 3400],
    ["M9 eliminated group resolution", (s) =>
      s.competition.world?.groupStage?.resolved === true &&
      s.world.flags.world_eliminated === true, 4200],
    ["M9 eliminated completion", (s) =>
      s.world.flags.m9_complete === true &&
      s.world.flags.m12_unlocked === true, 2400]
  ], { route: "eliminated", combatPolicy: "branch" });

  assert.equal(state.world.flags.world_eliminated, true);
  assert.equal(state.world.flags.m12_unlocked, true);
  return state;
}

async function completeCanonicalM10FinalFour(engine, start) {
  const state = await completeMilestoneSequence(engine, start, [
    ["M10 R16 bracket", (s) => s.competition.world?.knockout?.opened === true, 2600],
    ["M10 Silas thread", flag("m10_silas_thread_complete"), 2400],
    ["M10 R16 prep", flag("m10_r16_prep_complete"), 2200],
    ["M10 R16 win", (s) => s.world.flags.world_r16_won === true, 3000],
    ["M10 top eight lock", flag("world_top8_locked"), 2600],
    ["M10 Friend Beat 10", flag("friend_beat_10_complete"), 2800],
    ["M10 QF prep", flag("m10_qf_prep_complete"), 2200],
    ["M10 QF win", (s) => s.world.flags.world_qf_won === true, 3200],
    ["M10 top four lock", flag("world_top4_locked"), 2600],
    ["M10 final-four completion", (s) =>
      s.world.flags.m10_complete === true &&
      s.world.flags.m11_unlocked === true, 2200]
  ], { route: "champion", combatPolicy: "win" });

  assert.equal(state.world.flags.world_qf_won, true);
  assert.equal(state.world.flags.m11_unlocked, true);
  return state;
}

async function completeCanonicalM11Champion(engine, start) {
  const state = await completeMilestoneSequence(engine, start, [
    ["M11 Final Four lock", flag("m11_final_four_lock_complete"), 2600],
    ["M11 Rei thread", flag("m11_rei_thread_complete"), 2400],
    ["M11 semifinal prep", flag("m11_sf_prep_complete"), 2200],
    ["M11 semifinal win", (s) => s.world.flags.world_sf_won === true, 3200],
    ["M11 finalist lock", (s) => s.world.flags.world_finalist === true, 2600],
    ["M11 Friend Beat 11", flag("friend_beat_11_complete"), 2800],
    ["M11 final prep", flag("m11_final_prep_complete"), 2400],
    ["M11 World Champion", (s) => s.world.flags.world_champion === true, 3600],
    ["M11 champion completion", (s) =>
      s.world.flags.m11_complete === true &&
      s.world.flags.m12_unlocked === true, 2400]
  ], { route: "champion", combatPolicy: "win" });

  assert.equal(state.world.flags.world_champion, true);
  assert.equal(state.world.flags.m12_unlocked, true);
  return state;
}

async function completeCanonicalM12(engine, start, route) {
  const combatPolicy = route === "champion" ? "win" : "branch";
  const state = await completeMilestoneSequence(engine, start, [
    ["M12 World exit branch", flag("m12_world_exit_branch_complete"), 2600],
    ["M12 return to Asteria", flag("m12_return_asteria_complete"), 2600],
    ["M12 Valedarsena callbacks", flag("m12_valedarsena_callbacks_complete"), 2400],
    ["M12 Bruma callbacks", flag("m12_bruma_callbacks_complete"), 2400],
    ["M12 Ferrox callbacks", flag("m12_ferrox_callbacks_complete"), 2400],
    ["M12 coast callbacks", flag("m12_coast_callbacks_complete"), 2400],
    ["M12 highlands callbacks", flag("m12_highlands_callbacks_complete"), 2400],
    ["M12 interregional callbacks", flag("m12_interregional_callbacks_complete"), 2400],
    ["M12 Meridiana callbacks", flag("m12_meridiana_callbacks_complete"), 2600],
    ["M12 Friend Beat 12", flag("friend_beat_12_complete"), 2800],
    ["M12 postgame hooks", flag("m12_postgame_hooks_complete"), 2400],
    ["M12 main story complete", flag("main_story_complete"), 2600]
  ], { route, combatPolicy });

  assert.equal(state.world.flags.main_story_complete, true);
  assert.equal(state.world.flags.m12_complete, true);
  assert.equal(state.world.flags.postgame_free_roam, true);
  return state;
}

async function completeRepeatEdition(engine, start, store, edition) {
  let state = structuredClone(start);
  assert.equal(state.story.sceneId, "m12-main-story-complete");
  assert.equal(state.story.nodeId, "free_roam");
  assert.equal(state.competition.world.edition, edition - 1);

  await engine.present(state); // register preceding edition in career ledger
  const previousPokemon = structuredClone(state.player.roster);
  const previousHistory = structuredClone(state.postgame.championships);
  for (let i = 0; i < 4; i += 1) state = await requireChoice(engine, state, "postgame_year");
  state = await requireChoice(engine, state, "postgame_qualifier");
  assert.equal(state.competition.world.edition, edition);
  assert.equal(state.story.sceneId, "m07-world-qualifier");
  assert.equal(state.competition.world.drawComplete, false);
  assert.deepEqual(state.player.roster, previousPokemon);
  assert.deepEqual(state.postgame.championships, previousHistory);

  state = await completeMilestoneSequence(engine, state, [
    [`World ${edition}: qualifier matches`, flag("m7_qualifier_complete"), 4500],
    [`World ${edition}: qualification recorded`, (s) =>
      s.world.flags.world_qualified === true && s.world.flags.m7_qualifier_result_resolved === true, 3500],
    [`World ${edition}: M08 handoff`, (s) =>
      s.world.flags.m08_unlocked === true && s.story.sceneId === "m08-world-arrival", 5000]
  ], { route: "champion", combatPolicy: "win" });

  assert.equal(state.world.flags.world_qualified, true);
  state = await persistReload(store, state, state.slot, `World ${edition} qualification`);

  state = await completeCanonicalM8(engine, state);
  assert.equal(state.competition.world.edition, edition);
  assert.equal(state.competition.world.drawComplete, true);
  state = await persistReload(store, state, state.slot, `World ${edition} draw`);

  state = await completeCanonicalM9Advanced(engine, state);
  state = await completeCanonicalM10FinalFour(engine, state);
  state = await completeCanonicalM11Champion(engine, state);
  assert.equal(state.competition.world.finalResolved, true);
  assert.equal(state.competition.world.currentWorldChampion.name, state.player.name);

  state = await searchTo({
    engine, start: state, route: "champion", combatPolicy: "win",
    goal: (s) => s.story.sceneId === "m12-world-exit-branch" &&
      s.story.nodeId === "world_exit_entry",
    label: `World ${edition}: final-to-postgame handoff`, maxExpansions: 4000
  });
  state = await requireChoice(engine, state, "postgame_finish_edition");
  assert.equal(state.story.sceneId, "m12-main-story-complete");
  assert.equal(state.story.nodeId, "free_roam");
  assert.equal(state.postgame.championships.length, edition);
  assert.equal(state.competition.world.hallOfFame.length, edition);
  assert.equal(state.postgame.championships.at(-1).champion.name, state.player.name);
  assert.equal(state.world.flags.main_story_complete, true);
  return persistReload(store, state, state.slot, `World ${edition} champion`);
}

async function persistReload(store, state, slot, label) {
  const saved = structuredClone(state);
  saved.slot = slot;
  await store.save(saved);
  const loaded = await store.load(slot);
  assert.deepEqual(loaded, saved, `${label} must survive save/reload exactly`);
  return loaded;
}

function flag(name) {
  return (state) => state.world?.flags?.[name] === true;
}

test("RC persistent E2E traverses real authored M1→M12 and all three World outcome routes", async () => {
  let dir;
  try {
    dir = await mkdtemp(path.join(os.tmpdir(), "p5e-rc-persistent-e2e-"));
    const store = new SaveStore(dir);
    const engine = await makeEngine();

    let common = createNewGameState({
      protagonist: "Luke",
      slot: "rc-lineage",
      now: fixedNow
    });

    assert.equal(common.story.sceneId, "m01-release");
    assert.equal(common.story.nodeId, "free_roam");

    common = await completeCanonicalM1(engine, common);
    common = await persistReload(store, common, "rc-lineage", "M1");

    common = await completeCanonicalM2(engine, common);
    common = await persistReload(store, common, "rc-lineage", "M2");

    common = await completeCanonicalM3(engine, common);
    common = await persistReload(store, common, "rc-lineage", "M3");

    common = await completeCanonicalM4(engine, common);
    common = await persistReload(store, common, "rc-lineage", "M4");

    common = await completeCanonicalM5(engine, common);
    common = await persistReload(store, common, "rc-lineage", "M5");

    common = await completeCanonicalM6(engine, common);
    common = await persistReload(store, common, "rc-lineage", "M6");

    const postM6 = structuredClone(common);

    let champion = structuredClone(postM6);
    champion.slot = "rc-champion";
    champion = await completeCanonicalM7Qualified(engine, champion);
    champion = await persistReload(store, champion, champion.slot, "M7 qualified");

    champion = await completeCanonicalM8(engine, champion);
    champion = await persistReload(store, champion, champion.slot, "M8");
    const postM8Champion = structuredClone(champion);

    champion = await completeCanonicalM9Advanced(engine, champion);
    champion = await persistReload(store, champion, champion.slot, "M9");

    champion = await completeCanonicalM10FinalFour(engine, champion);
    champion = await persistReload(store, champion, champion.slot, "M10");

    champion = await completeCanonicalM11Champion(engine, champion);
    champion = await persistReload(store, champion, champion.slot, "M11 champion");

    champion = await completeCanonicalM12(engine, champion, "champion");
    champion = await persistReload(store, champion, champion.slot, "M12 champion");
    assert.equal(champion.world.flags.world_champion, true);

    champion = await requireChoice(engine, champion, "enter_free_roam");
    champion = await completeRepeatEdition(engine, champion, store, 2);
    champion = await completeRepeatEdition(engine, champion, store, 3);
    assert.deepEqual(champion.postgame.championships.map((entry) => entry.year),
      [2060, 2064, 2068]);

    let missed = structuredClone(postM6);
    missed.slot = "rc-worlds-missed";
    missed = await completeCanonicalM7Missed(engine, missed);
    missed = await persistReload(store, missed, missed.slot, "M7 Worlds Missed");

    missed = await completeCanonicalM12(engine, missed, "missed");
    missed = await persistReload(store, missed, missed.slot, "M12 Worlds Missed");
    assert.equal(missed.world.flags.worlds_missed, true);
    assert.equal(missed.world.flags.world_qualified, false);

    let eliminated = structuredClone(postM8Champion);
    eliminated.slot = "rc-world-eliminated";
    eliminated = await completeCanonicalM9Eliminated(engine, eliminated);
    eliminated = await persistReload(store, eliminated, eliminated.slot, "World Eliminated");

    eliminated = await completeCanonicalM12(engine, eliminated, "eliminated");
    eliminated = await persistReload(store, eliminated, eliminated.slot, "M12 eliminated");
    assert.equal(eliminated.world.flags.world_eliminated, true);
    assert.equal(eliminated.world.flags.world_champion, false);

    for (const finalState of [champion, missed, eliminated]) {
      assert.equal(finalState.world.flags.main_story_complete, true);
      assert.equal(finalState.world.flags.postgame_free_roam, true);
      assert.equal(finalState.pending, null);
      assert.ok(finalState.story.history.length > 0);
    }
  } finally {
    if (dir) await rm(dir, { recursive: true, force: true });
  }
});
