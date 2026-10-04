# P5E LIBROGAME — NODE SPEC v1.8

Status: implementation contract for the offline bookgame compiler.
Authority: subordinate to P5E_LIBROGAME_ENGINE_SOURCE_OF_TRUTH.md. If this document conflicts with the Source of Truth, the Source of Truth wins.

## 1. Purpose

Node Spec v1 defines the authored scene format accepted by the local compiler.

Pipeline:

Source of Truth + authored modules
→ scene JSON
→ local validator/compiler
→ story.bundle.json
→ local runtime
→ local save

The shipped game must not require an AI, API, network request, or remote rules service.

An AI authoring agent may create or edit source content during development, but generated content is not trusted until the compiler accepts it.

## 1.1 M1 scale lock

The first production module is **M01 — Le Prime Strade**.

Locked content budget:

- 5,047 stitches
- 3,116 player choice options

The compiler reports implemented/target counts from the M01 module manifest. These are production targets, not a requirement that every playthrough visits every stitch.

## 2. Scene file

Each scene is one UTF-8 JSON file under:

    bookgame/content/scenes/

Required top-level fields:

- schemaVersion: integer, currently 1
- id: unique scene identifier
- title: display title
- locationId: authored location identifier
- nodes: object keyed by node ID

Optional:

- moduleId: owning campaign module (for example M01)
- entryNodeId: explicit entry node. If absent, the first authored node is the entry for graph analysis.

A node may author narration in either of two backward-compatible forms:

- `text`: one legacy stitch
- `stitches`: an ordered array of `{ id, text }` narrative atoms

Use one form or the other, never both. The runtime concatenates authored stitches for display while the compiler counts them individually.

For the current runtime, the scene filename must be:

    <scene.id>.json

## 3. Node

A node contains:

- text: non-empty narration text
- choices: array; may be empty for a terminal or subsystem-handoff node

Node IDs must be stable. Never reuse an old ID for a different semantic event after content has shipped, because saves and history may reference it.

## 3.1 Conditions — E1

Scenes and choices may declare an optional `conditions` object. Conditions are evaluated locally against the durable game state. They control whether a scene is legal to present and whether a choice is visible/selectable.

No JavaScript, expressions, function calls, or `eval` are allowed.

Allowed state paths in v1.2:

- `player.name`
- `player.trainerLevel`
- `player.roster.length`
- `world.day`
- `world.time`
- `world.locationId`
- `world.flags.<flag_id>`
- `story.sceneId`
- `story.nodeId`

Allowed leaf comparators:

- `eq`
- `ne`
- `gt`
- `gte`
- `lt`
- `lte`
- `in`
- `exists`

Allowed logical groups:

- `all`
- `any`
- `not`

Example:

    {
      "conditions": {
        "all": [
          { "path": "competition.rank", "eq": "F" },
          { "path": "player.roster.length", "gte": 2 },
          { "path": "competition.trials.RANK_F_TO_E.available", "eq": true }
        ]
      }
    }

A hidden choice cannot be executed by supplying its ID directly: `choose()` re-evaluates the same condition before mutating state.

A scene-level failed condition is a runtime guard and presentation fails rather than silently exposing illegal content.

## 3.2 Time / calendar — E2

The offline runtime stores an absolute in-game clock:

- `world.elapsedMinutes`: minutes elapsed since Day 1 00:00
- `world.day`: 1-based in-game day
- `world.minuteOfDay`: 0–1439
- `world.time`: derived time-of-day band

New careers start deterministically on **Day 1 at 08:00**. This is an implementation default, not device time.

Derived time-of-day bands:

- night: 00:00–05:59
- morning: 06:00–11:59
- afternoon: 12:00–17:59
- evening: 18:00–23:59

Legacy saves that only contain `world.day` + `world.time` are normalized locally when the clock is first used.

A choice may declare:

    "timeCostMinutes": 70

The cost is consumed exactly once when the legal choice is executed. Crossing midnight increments `world.day` automatically.

`timeCostMinutes` must be a non-negative integer. The compiler rejects malformed values.

E1 conditions may also read:

- `world.elapsedMinutes`
- `world.minuteOfDay`

M01 canonical topology uses:

- Campus → Ginestre: 20 minutes
- Ginestre → Valedarsena: 70 minutes
- Ginestre → Fattoria del Vento: 70 minutes

Direct Valedarsena ↔ Fattoria transitions consume 140 minutes because the current canonical topology passes through Ginestre.

## 3.3 Quest state — E3

Quests are durable structured state under `state.quests`, keyed by stable quest ID. Do not mirror quest status in `world.flags`.

Supported quest statuses:

- `available`: authored offer exists but is not in the active journal
- `active`
- `completed`
- `failed`
- `expired`

The Quest Journal exposes Active, Completed, Failed and Expired groups. `available` offers are world state, not accepted quests.

Supported quest effects:

    { "type": "quest_offer", "questId": "QUEST_ID", "title": "...", "objective": "..." }

    { "type": "quest_start", "questId": "QUEST_ID", "title": "...", "objective": "..." }

    { "type": "quest_complete", "questId": "QUEST_ID", "resolution": "player_completed" }

    { "type": "quest_fail", "questId": "QUEST_ID", "resolution": "abandoned" }

`quest_offer` may use `expiresInMinutes`. `quest_start` may use `deadlineMinutes`.

Both may define a data-only deadline outcome:

    {
      "status": "completed",
      "resolution": "completed_by_npc",
      "resolvedBy": "world"
    }

Allowed deadline statuses are `completed`, `failed`, and `expired`.

When E2 advances time, active/available quest deadlines are processed before the next scene is entered. This means travel cannot bypass quest consequences.

E1 conditions may safely read:

- `quests.<questId>.status`
- `quests.<questId>.resolution`
- `quests.<questId>.startedAtMinutes`
- `quests.<questId>.deadlineAtMinutes`
- `quests.<questId>.resolvedAtMinutes`

Terminal quests cannot be restarted until a future repeatable-quest system explicitly supports that behavior.

## 3.4 Persistent NPCs, schedules and relationships — E4

Named persistent NPCs live under `state.npcs`.

M01 initializes the four non-player members of the Five plus Blue:

- Mattew
- Daniel
- Edward
- Fab
- Blue

Their late-career canon does not pre-populate future achievements or teams.

Each persistent NPC contains:

- hidden relationship score, clamped to -100..100;
- player-facing qualitative relationship;
- current authored schedule;
- small typed persistent state map.

Qualitative relationship bands are:

- Hostile
- Distrustful
- Neutral
- Friendly
- Loyal

The numeric score is internal. UI should normally expose only the qualitative state.

Supported NPC effects:

    {
      "type": "npc_relationship_adjust",
      "npcId": "Blue",
      "delta": 10
    }

    {
      "type": "npc_state_set",
      "npcId": "Blue",
      "key": "met",
      "value": true
    }

    {
      "type": "npc_schedule_set",
      "npcId": "Blue",
      "scheduleId": "blue_vale_arena_01",
      "locationId": "valedarsena_arena",
      "availability": "available",
      "activity": "trial_information",
      "startsAtMinutes": 540,
      "endsAtMinutes": 720
    }

`npc_register` exists for authored persistent named NPCs introduced later. Do not register anonymous background roles that do not require continuity.

Schedule availability values:

- available
- busy
- away
- traveling

A schedule is considered present only while its time window is active and availability is `available`.

E1 conditions may safely read:

- `npcs.<npcId>.relationship.score`
- `npcs.<npcId>.relationship.qualitative`
- `npcs.<npcId>.schedule.id`
- `npcs.<npcId>.schedule.locationId`
- `npcs.<npcId>.schedule.availability`
- `npcs.<npcId>.schedule.activity`
- `npcs.<npcId>.schedule.startsAtMinutes`
- `npcs.<npcId>.schedule.endsAtMinutes`
- `npcs.<npcId>.schedule.present`
- `npcs.<npcId>.state.<key>`

The runtime also provides a deterministic FRIEND_BEAT candidate selector. It considers only authored candidates who are actually present at the requested location, then prefers the strongest current relationship; ties preserve canonical candidate order. Later E6/world-event logic may add more compatibility inputs without replacing the authored schedule requirement.

E4 does **not** assign arbitrary schedules by itself. A named NPC appears only because authored content/world progression assigned a schedule.

## 3.5 Living world / authored world events — E6

World events are authored JSON assets under:

    bookgame/content/events/

They are compiled into the offline story bundle. The runtime does not invent events.

Each event declares:

- stable `id`;
- optional `moduleId`;
- `once` (defaults to one-shot behavior);
- an E1 `trigger`;
- one or more ordered outcomes.

Example:

    {
      "id": "A1_WORLD_MOVES",
      "once": true,
      "trigger": {
        "any": [
          { "path": "world.day", "gte": 3 },
          { "path": "world.flags.first_settlement_reached", "eq": true }
        ]
      },
      "outcomes": [
        {
          "id": "noticed",
          "when": { "path": "world.flags.m1_world_pressure_known", "eq": true },
          "effects": [
            { "type": "set_flag", "key": "m1_world_pressure_state", "value": "pressure_noticed" }
          ]
        },
        {
          "id": "unnoticed",
          "effects": [
            { "type": "set_flag", "key": "m1_world_pressure_state", "value": "pressure_unnoticed" }
          ]
        }
      ]
    }

The first matching outcome is used. An unconditional fallback, if present, must be last.

Resolved event state is persisted under `state.events.<eventId>` with:

- `status`
- `outcomeId`
- `firedAtMinutes`

E1 may read those fields.

After a legal player action finishes applying time and authored effects, E6 evaluates the compiled world-event catalog. Triggered events may apply the same validated flag, quest and persistent-NPC effects already supported by the runtime.

One-shot events never fire twice. Recurring events, when authored later, may fire at most once per processing call and never twice at the same in-game minute.

E6 supports off-screen progression but does not fabricate simulation results. Any NPC result, quest resolution or schedule change must be explicitly authored in an event outcome or delegated to an approved resolver.

## 3.6 Official competition / Circuit Rank — E5

Competitive progression is durable structured state under `state.competition`.

Core fields:

- `competition.rank`: F → E → D → C → B → A → S
- `competition.rankOrder`: numeric order for authored `gte` checks
- `competition.circuitPoints`: parallel ranking value; never bypasses Promotion Trials
- `competition.firstOfficialResolved`
- `competition.history`
- `competition.activeMatch`
- `competition.trials.<checkpointId>`

M01 begins at Rank F.

Promotion Trial state records:

- availability;
- registration;
- attempts;
- required roster size;
- last result;
- best result;
- completion;
- from/to rank;
- retryability.

Supported competition effects:

    {
      "type": "competition_trial_available",
      "checkpointId": "RANK_F_TO_E",
      "fromRank": "F",
      "toRank": "E",
      "requiredRosterSize": 2,
      "retryable": true
    }

    {
      "type": "competition_trial_register",
      "checkpointId": "RANK_F_TO_E"
    }

Registration is rejected unless the current rank and real player roster satisfy the authored checkpoint requirement.

Official battles continue to use the normal Pokémon 5e combat handoff. An official combat adds data-only metadata:

    {
      "combat": {
        "...": "...",
        "opponentRegistered": true,
        "competition": {
          "type": "promotion_trial",
          "matchId": "A1_FIRST_GATE_ATTEMPT",
          "checkpointId": "RANK_F_TO_E",
          "fromRank": "F",
          "toRank": "E",
          "format": "Singles",
          "officialRosterSize": 2,
          "difficulty": "HARD",
          "retryable": true
        }
      }
    }

For `official_match`, use the same structure without checkpoint/fromRank/toRank/retryable. Set `firstOfficial: true` only for the canonical first sanctioned match.

Rules:

- E5 never computes battle mechanics or decides the winner.
- Official opponents are treated as registered Trainer Pokémon, so capture is illegal.
- Competitive combat must provide `win` and `lose` return nodes.
- A Promotion Trial attempt increments when the battle handoff begins.
- Loss leaves rank unchanged and, when retryable, reopens registration.
- Win is the only result that completes the checkpoint and promotes rank.
- The first official match may be won or lost; either real result can mark it resolved.
- HP, PP, conditions and other battle consequences remain owned by the Pokémon 5e resolver.

E1 may read:

- `competition.rank`
- `competition.rankOrder`
- `competition.circuitPoints`
- `competition.firstOfficialResolved`
- `competition.history.length`
- `competition.trials.<checkpointId>.available`
- `competition.trials.<checkpointId>.registered`
- `competition.trials.<checkpointId>.attempts`
- `competition.trials.<checkpointId>.bestResult`
- `competition.trials.<checkpointId>.lastResult`
- `competition.trials.<checkpointId>.completed`
- `competition.trials.<checkpointId>.requiredRosterSize`

Do not mirror Circuit Rank or Trial state into `world.flags`.

## 3.7 Canonical ecology / wild encounters — E7

E7 ports the Pokémon 5e GM Agent ecology contract into the offline bookgame without runtime AI.

Authority order:

1. `campaign/world/ecology/SPECIES_DISTRIBUTION.json`
2. `campaign/world/ecology/ZONE_POOLS.json`
3. `campaign/world/ecology/FAUNA_COVERAGE.json`
4. `campaign/world/ecology/RARITY_SYSTEM.md`
5. `campaign/world/ecology/SPECIAL_ENCOUNTERS.md`
6. GM-private special anchors only for authored special-event content

`campaign/world/fauna/ASTERIA_FAUNA_INDEX.json` is used only as supporting habitat-tag metadata. It never overrides authoritative zone, rarity, weight, distribution class or activity from `campaign/world/ecology/`.

Canonical ordinary rarity weights are preserved exactly after filtering:

- common: 100
- uncommon: 45
- rare: 15
- very_rare: 5
- exceptional: 1
- protected_rare: 2
- protected_very_rare: 1

These are relative weights, not percentages.

Ordinary selection pipeline:

1. choose the authored Asteria ecology zone;
2. use only the authoritative source-zone pool;
3. filter by authored microhabitat;
4. filter by in-game time/activity;
5. filter by encounter method;
6. apply any authored species subset/exclusions required by the local scene;
7. apply the canonical relative weights;
8. enter a small authored wildlife scene.

Special classes can never pass this selector:

- Legendary
- Mythical
- Ultra Beast
- Paradox
- fossil/paleo restricted
- unique special event

A scene choice may use the `ecology` transition mode:

    {
      "id": "observe_wildlife",
      "text": "Osservo la fauna.",
      "ecology": {
        "requestId": "M1_GINESTRE_FIELD_01",
        "zoneId": "AST-GINESTRE",
        "habitat": "field",
        "method": "wild_observation",
        "allowedSpecies": ["wooloo", "shinx"],
        "returnNodes": {
          "noEncounter": "no_sighting",
          "wooloo": "wooloo_scene",
          "shinx": "shinx_scene"
        }
      }
    }

Every allowed species requires an authored return node. A no-encounter branch is also mandatory.

The selected encounter is persisted under:

- `ecology.lastEncounter`
- `ecology.history[]`

Internal ecology metadata is not automatically shown in the player-facing `present()` view.

### Wildlife behavior contract

Species selection does not mean combat.

Every authored wild branch follows `campaign/world/WILD_ENCOUNTER_BEHAVIOR.md`:

- the creature is already doing something;
- observable posture/movement/calls are narrated before mechanics;
- social context and escape routes matter;
- de-escalation, observation, avoidance and cooperation are valid outcomes;
- combat occurs only after fiction/player action makes it happen;
- capture is never the default resolution;
- combat/capture use the exact Pokémon 5e resolver;
- meaningful ecological consequences may persist.

Alpha/Beta are never assigned automatically by E7. The ordinary selector records `alphaBetaRole: null`. Any future Alpha/Beta role must be explicitly authored and may not invent stat bonuses.

### Capture rule

Rarity is not capture legality.

If an ordinary wild Pokémon is selected and the fiction reaches a legal capture attempt, use normal Pokémon 5e capture mechanics. Do not mark an otherwise ordinary encountered Pokémon uncapturable merely because it is rare or belongs to a protected population.

### Mechanical data gate

An authored branch may offer battle/capture only when the exact Pokémon 5e stat block, legal ability and at least one executable move are present in the offline combat pack.

The ecology catalog may contain many more species than the current combat pack. Those species are valid ecological data but must not be routed into an unsupported mechanical battle.

M01 currently wires executable local opportunities for Wooloo, Shinx and Hisuian Growlithe, in addition to the pre-existing scripted Houndour encounter.

## 4. Choice

Every choice requires:

- id: unique within its node
- text: player-facing text

A choice uses exactly one transition mode.

Targets may be local or cross-scene:

- `next_node`
- `other-scene#entry_node`

Cross-scene targets are validated globally by the compiler.

### 4.1 Direct transition

    {
      "id": "leave",
      "text": "Continuo.",
      "goto": "next_node"
    }

Optional direct effects may be attached with effects.

### 4.2 Check transition

    {
      "id": "approach",
      "text": "Mi avvicino. (CT Animal Handling)",
      "check": {
        "ability": "WIS",
        "skill": "Animal Handling",
        "dc": 12
      },
      "outcomes": {
        "success": { "goto": "calm" },
        "failure": { "goto": "warning" }
      }
    }

v1 ability codes:

- STR
- DEX
- CON
- INT
- WIS
- CHA

The UI may reveal the check type. The authored DC remains engine data and is not required to be shown to the player.

### 4.3 Pokémon 5e combat handoff

    {
      "id": "fight",
      "text": "Mando avanti il mio Pokémon.",
      "combat": {
        "encounterId": "ENCOUNTER_001",
        "goto": "combat_handoff",
        "opponent": {
          "species": "Houndour",
          "level": 3
        },
        "returnNodes": {
          "win": "combat_win",
          "lose": "combat_loss",
          "fled": "combat_fled"
        }
      }
    }

The narrative graph does not calculate battle damage, HP, AC, PP, status, range, capture, faint/death, or winner. Those remain under the Pokémon 5e combat resolver.

## 5. Effects supported by schema v1

Current runtime effect types:

- set_flag
- set_location
- quest_offer
- quest_start
- quest_complete
- quest_fail
- npc_register
- npc_relationship_adjust
- npc_state_set
- npc_schedule_set
- competition_trial_available
- competition_trial_register

Examples:

    { "type": "set_flag", "key": "blue_met", "value": true }

    { "type": "set_location", "locationId": "valedarsena" }

New effect types require an engine + compiler version change. The authoring agent must not invent effect names.

## 6. Compiler hard errors

Compilation fails for at least:

- invalid JSON;
- unsupported schemaVersion;
- invalid or duplicate scene IDs;
- filename/scene ID mismatch;
- missing or invalid nodes;
- duplicate choice IDs inside a node;
- malformed direct/check/combat transitions;
- invalid ability code;
- missing check outcomes;
- malformed effects;
- malformed/unsafe conditions or condition paths;
- invalid time costs;
- malformed quest transitions, IDs, deadlines, or deadline outcomes;
- malformed NPC IDs, schedules, relationship changes, or NPC state values;
- malformed world-event triggers, outcomes, fallback ordering, or event effects;
- malformed official competition metadata, Trial state effects, roster requirements, or competitive return outcomes;
- invalid ecology zones, habitats, encounter methods, species mappings, or special-class leakage;
- goto/outcome/combat targets that do not exist;
- invalid combat encounter/opponent/return-node data.

No broken graph is allowed into a release bundle.

## 7. Compiler warnings

Warnings do not fail compilation.

v1 reports:

- nodes unreachable from the scene entry;
- terminal nodes.

Terminal nodes are legal because they can represent endings, map returns, or subsystem handoffs.

## 8. Compiled bundle

The compiler emits one deterministic local JSON asset:

    bookgame/build/story.bundle.json

Format identifier:

    p5e-librogame-story-bundle

The bundle contains:

- schema version;
- offline=true declaration;
- all compiled scenes;
- compiled authored world events;
- scene/node/choice metrics;
- non-fatal diagnostics.

The bundle contains no remote URL dependency required for gameplay.

## 9. Agent contract

A future Story Builder Agent may:

- read Source of Truth and module designs;
- propose new scene files;
- expand modules into nodes;
- connect branches;
- add callbacks using declared state;
- run the compiler;
- repair compiler errors;
- run tests.

It may not:

- change Pokémon 5e mechanics to make a story work;
- invent runtime effect types;
- bypass the compiler;
- write directly into save files;
- make internet/LLM access a gameplay requirement;
- silently rewrite locked canon.

The compiler, tests, and Source of Truth are authoritative over generated content.

## 10. Offline release rule

A release is offline-valid only when:

1. authored content compiles locally;
2. the compiled bundle can be loaded by the local repository;
3. the BookgameEngine can present and traverse it without network access;
4. saves remain local;
5. Pokémon 5e combat handoffs resolve through local rules/data.

This rule is mandatory for every future module.
