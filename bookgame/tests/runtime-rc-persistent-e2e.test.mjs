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
  score += Number(state.player?.trainerLevel ?? 1) * 25;

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
  return score - depth;
}

function preferredChoices(choices) {
  const positive = /trainer_|commit|complete|confirm|activate|continue|depart|travel|register|resolve|record|ready|open|advance|accept|enter|start|fight|win|audit|sync|lock|arrive|proceed|return/i;
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
          (/trainer_|commit|complete|confirm|activate|continue|advance|register|resolve|record|audit|lock/i.test(choice.id) ? 300 : 0) -
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
      maxExpansions: 2200
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
    if (milestone.label === "M3 Trial D to C window" && state.world.flags.friend_beat_03_complete !== true) {
      state = await completeCanonicalM3FriendBeat(engine, state);
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

    for (let module = 5; module <= 6; module += 1) {
      common = await searchTo({
        engine,
        start: common,
        goal: flag(`m${module}_complete`),
        label: `M${module} completion`,
        route: "champion",
        combatPolicy: "win",
        maxExpansions: 12000
      });
      common = await persistReload(store, common, "rc-lineage", `M${module}`);
    }

    const postM6 = structuredClone(common);

    let champion = structuredClone(postM6);
    champion.slot = "rc-champion";
    champion = await searchTo({
      engine,
      start: champion,
      goal: (s) => s.world.flags.m7_complete === true && s.world.flags.m08_unlocked === true,
      label: "M7 qualified route",
      route: "champion",
      combatPolicy: "win"
    });
    champion = await persistReload(store, champion, champion.slot, "M7 qualified");

    let postM8Champion;
    for (const module of [8, 9, 10]) {
      const nextUnlock = module === 8 ? "m09_unlocked" : module === 9 ? "m10_unlocked" : "m11_unlocked";
      champion = await searchTo({
        engine,
        start: champion,
        goal: (s) =>
          s.world.flags[`m${module}_complete`] === true &&
          s.world.flags[nextUnlock] === true,
        label: `M${module} advancing route`,
        route: "champion",
        combatPolicy: "win"
      });
      champion = await persistReload(store, champion, champion.slot, `M${module}`);
      if (module === 8) postM8Champion = structuredClone(champion);
    }

    champion = await searchTo({
      engine,
      start: champion,
      goal: (s) => s.world.flags.m11_complete === true && s.world.flags.world_champion === true,
      label: "M11 World Champion route",
      route: "champion",
      combatPolicy: "win"
    });
    champion = await persistReload(store, champion, champion.slot, "M11 champion");
    champion = await searchTo({
      engine,
      start: champion,
      goal: flag("main_story_complete"),
      label: "M12 champion epilogue",
      route: "champion",
      combatPolicy: "win"
    });
    champion = await persistReload(store, champion, champion.slot, "M12 champion");
    assert.equal(champion.world.flags.m12_complete, true);
    assert.equal(champion.world.flags.postgame_free_roam, true);
    assert.equal(champion.world.flags.world_champion, true);

    let missed = structuredClone(postM6);
    missed.slot = "rc-worlds-missed";
    missed = await searchTo({
      engine,
      start: missed,
      goal: (s) =>
        s.world.flags.m7_complete === true &&
        s.world.flags.m12_unlocked === true &&
        s.world.flags.worlds_missed === true,
      label: "M7 Worlds Missed route",
      route: "missed",
      combatPolicy: "branch",
      maxExpansions: 20000
    });
    missed = await persistReload(store, missed, missed.slot, "M7 Worlds Missed");
    missed = await searchTo({
      engine,
      start: missed,
      goal: flag("main_story_complete"),
      label: "M12 Worlds Missed epilogue",
      route: "missed",
      combatPolicy: "branch",
      maxExpansions: 20000
    });
    missed = await persistReload(store, missed, missed.slot, "M12 Worlds Missed");
    assert.equal(missed.world.flags.worlds_missed, true);
    assert.equal(missed.world.flags.world_qualified, false);
    assert.equal(missed.world.flags.m12_complete, true);

    let eliminated = structuredClone(postM8Champion);
    eliminated.slot = "rc-world-eliminated";
    eliminated = await searchTo({
      engine,
      start: eliminated,
      goal: (s) =>
        s.world.flags.world_eliminated === true &&
        s.world.flags.m12_unlocked === true,
      label: "World Eliminated route",
      route: "eliminated",
      combatPolicy: "branch",
      maxExpansions: 25000
    });
    eliminated = await persistReload(store, eliminated, eliminated.slot, "World Eliminated");
    eliminated = await searchTo({
      engine,
      start: eliminated,
      goal: flag("main_story_complete"),
      label: "M12 World Eliminated epilogue",
      route: "eliminated",
      combatPolicy: "branch",
      maxExpansions: 20000
    });
    eliminated = await persistReload(store, eliminated, eliminated.slot, "M12 eliminated");
    assert.equal(eliminated.world.flags.world_eliminated, true);
    assert.equal(eliminated.world.flags.world_champion, false);
    assert.equal(eliminated.world.flags.m12_complete, true);

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
