# P5E LIBROGAME — NODE SPEC v1.3

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
          { "path": "world.flags.current_rank", "eq": "F" },
          { "path": "player.roster.length", "gte": 2 },
          { "path": "world.flags.rank_trial_F_E_available", "eq": true }
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
