# NPC CHARACTER LIBRARY V1 — LOCK

**Status:** LOCKED BASELINE / M12 DELTA PENDING  
**Branch origin:** `m11-00-04-work` after M11 runtime validation  
**Machine-readable registry:** `content/npcs/NPC_CHARACTER_LIBRARY_V1.json`

## 1. Authority

This library is subordinate to:

1. `P5E_LIBROGAME_ENGINE_SOURCE_OF_TRUTH.md`
2. `P5E_LIBROGAME_12_MODULES_MASTER.md`
3. the production mappings M01→M12

It does not create new canon. It centralizes already-approved character/NPC canon so later authoring can reuse it without re-deriving identities, roles or persistence rules.

## 2. What is locked now

### The Five

Luke, Mattew, Daniel, Edward and Fab are the five selectable protagonists. The selected character is the player; the other four are persistent autonomous NPCs.

### Module Anchor chain

| Module | Anchor |
|---|---|
| M01 | Blue |
| M02 | N |
| M03 | Steven Stone |
| M04 | Archie |
| M05 | Lance |
| M06 | Red |
| M07 | Cynthia |
| M08 | Astrid Vahl |
| M09 | Kaia Solari |
| M10 | Silas Crowe |
| M11 | Rei |
| M12 | cast completo / WORLD_EXIT |

M12 is intentionally not assigned a new Anchor.

## 3. Reuse classes

- **core_five** — one player + four persistent friends, depending on New Game selection.
- **module_anchor** — the M01→M11 Anchor chain; persistent, causal, no plot armor.
- **wider_world_persistent** — named world characters that are registered persistently but are not the module Anchor.
- **local_persistent** — named local NPCs with E4 state/schedule/relationship continuity.
- **local_named_callback** — named authored characters that can receive callbacks but are not yet verified as an E4 persistent registration.
- **scene_scoped_functional** — workers, staff, spectators, shop personnel, officials and other functional roles that do not need a persistent identity unless a scene explicitly registers them.

## 4. Verified non-Anchor named characters in the baseline

- **Ranger Elio Mar** — runtime ID `ElioMar`; persistent; M01/M02 Ranger/fauna continuity.
- **Maxie** — runtime ID `Maxie`; persistent wider-world trainer introduced in M04.
- **Sera Noll** — named Valedarsena Job Board coordinator; tracked as callback-capable, but not promoted to verified E4 persistence by this lock.

This list is deliberately evidence-based. A character is not marked persistent only because prose gives them a name.

## 5. M12 rule

M12 is a callback/closure module. It may reuse the Five, prior Anchors and prior named characters only when actual world state permits it.

No NPC may be teleported into a reunion. Location, schedule, competition state, relationship state and prior meetings remain authoritative.

Any newly authored named persistent NPC in M12 must be added to the machine-readable registry in the final delta pass.

## 6. Delta audit after M12

When M12 production closes:

1. scan every M12 scene for `npc_register`, `npcId`, persistent schedule writes and named callbacks;
2. compare all discovered runtime IDs with `NPC_CHARACTER_LIBRARY_V1.json`;
3. add any real new named persistent/callback characters;
4. reject duplicate IDs or name/ID drift;
5. verify that M12 still has no new Anchor unless the Master is explicitly changed;
6. rerun the registry test before merge.

Until that pass, the **narrative/core cast is complete**, while the exhaustive list of incidental M12 names remains intentionally open.

## 7. Authoring protocol

Before creating a new named NPC:

1. search this registry;
2. reuse the existing ID if the character already exists;
3. preserve existing relationship/schedule/history state;
4. create a new persistent ID only when continuity across scenes/modules is actually needed;
5. keep unnamed functional NPCs scene-scoped by default.

This library is the character equivalent of Library V2: reuse first, add only when genuinely new.
