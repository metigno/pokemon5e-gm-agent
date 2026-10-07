# P5E LIBROGAME — UI/UX MASTER SPEC V1

**Status:** LOCKED REFERENCE  
**Applies to:** Pokémon 5e Digital Bookgame UI  
**Core rule:** **THE RUNTIME OWNS THE RULES. THE UI PRESENTS STATE AND LEGAL ACTIONS.**

## 1. Authority and scope
This document governs player-facing information architecture, interaction patterns, screen responsibilities, responsive behavior, accessibility, UI/runtime boundaries, QA and definition of done.

It does not replace:
1. `P5E_LIBROGAME_ENGINE_SOURCE_OF_TRUTH.md`;
2. `P5E_NARRATIVE_REFERENCE_MASTER_V1.md`;
3. module design / production mapping;
4. runtime and combat contracts.

Validated mechanics must never be reimplemented inside the browser merely to make a screen convenient.

## 2. Product principles
- Offline-first.
- Mobile-first, desktop-compatible.
- One screen = one primary purpose.
- Progressive disclosure: overview → selection → detail → action.
- No mega-menu that exposes every system at once.
- Story, Trainer, Pokémon, Battle, Inventory, Journal and Settings are distinct surfaces.
- Technical runtime vocabulary stays out of player-facing copy.
- Existing game state is authoritative; the UI does not invent hidden values or outcomes.

## 3. Application shell
The default shell contains:
- compact top status/header;
- one primary content surface;
- persistent navigation to Trainer / Pokémon / Inventory / Journal / Settings;
- drawers or dedicated detail surfaces for secondary information;
- safe-area support on mobile.

Navigation must never destroy current story/combat state.

## 4. Story screen — LOCKED progressive reveal
After a player selects a narrative choice, the next authored text is revealed progressively instead of appearing all at once.

**Default:** 32 ms per character.

Required behavior:
- punctuation adds readable pauses;
- tap/click on the text completes the current reveal;
- “Mostra tutto” completes the current block immediately;
- the next choices remain hidden and non-interactive until reveal completes;
- settings: **Lenta / Normale / Veloce / Istantanea**;
- `prefers-reduced-motion` forces instant reveal;
- authored stitches remain separate readable paragraphs;
- a new node cancels the previous reveal cleanly.

Choices describe in-world intent/action. They never expose flags, branches, node IDs, resolver terminology or hidden mechanical consequences.

## 5. Trainer screen
Trainer is a real Pokémon 5e character sheet, not a simplified custom rules page.

It must be able to present, when available:
- Trainer name, class and level;
- Specialization(s);
- Trainer Path only when legally available;
- ability scores/modifiers;
- saving throw and skill proficiencies;
- tools/proficiencies;
- HP, AC and conditions when represented by the ruleset;
- Pokéslots and Max SR;
- class/path/specialization features;
- equipment and inventory links;
- durable progression state.

UI actions must follow the actual Pokémon 5e engine. No convenience button may bypass a rule, resource cost, action economy or prerequisite.

## 6. Pokémon / Team screen
Default roster view is concise: identity, sprite/art, level and essential status.

Selecting a Pokémon opens detail containing only runtime-backed data, such as:
- species/form/name;
- level;
- HP / AC;
- type(s), ability and relevant traits;
- moves and PP;
- status/conditions;
- roster role / active state where applicable;
- progression/evolution information when the engine exposes it.

## 7. Battle screen
Battle UI is a view/controller over `Pokemon5eCombatEngine`.

It may expose only legal engine actions:
- current actor / round / initiative state;
- HP, AC, status and conditions;
- movement remaining;
- action / bonus-action availability;
- legal moves and PP;
- legal switching;
- battle log and outcome.

The UI never decides hits, damage, saves, capture, movement legality, targeting legality or battle outcome.

**Hidden information remains hidden.** In particular, player-facing checks must not expose hidden DC values merely because the runtime stores them.

## 8. Inventory, Journal and Map
Inventory presents owned items and legal item actions only.

Journal presents authored/runtime quest state without showing internal flags.

Map/navigation, when present, represents known locations and available travel; it does not reveal hidden content or locked information merely because it exists in data.

## 9. States
Every screen/component must define:
- default;
- selected/focused;
- disabled;
- locked;
- loading;
- empty;
- error;
- success/confirmation where meaningful.

Errors must explain the player-facing problem without dumping engine internals.

## 10. Responsive and accessibility
- Mobile-first touch targets.
- Keyboard navigation on desktop.
- Visible focus state.
- Semantic controls and labels.
- Sufficient contrast.
- Content remains usable under text scaling.
- Safe areas respected.
- `prefers-reduced-motion` disables progressive animation.
- No critical meaning conveyed by color alone.

## 11. UI ↔ runtime contract
The UI reads snapshots and requests actions. The runtime validates and mutates state.

Canonical responsibilities:
- `BookgameEngine`: scenes, conditions, choices, checks, effects, narrative handoffs;
- `SaveStore`: persistence;
- `Pokemon5eCombatEngine`: combat state and legal combat actions;
- authored content: player-facing text and choices.

The browser must not contain a shadow copy of Pokémon 5e rules.

## 12. Vertical Slice V1
The first production slice must prove:
- New Game / Continue;
- canonical Intro → M1 flow;
- progressive narrative reveal;
- real choices;
- persistence after actions;
- Trainer / Pokémon / Inventory / Journal / Settings access;
- battle handoff to the Pokémon 5e combat engine;
- return from battle to narrative.

## 13. QA
At minimum validate:
- fresh save starts at the canonical Intro gate;
- choice → save → reload preserves exact state;
- choices remain hidden until reveal completion;
- tap completes reveal without double-submitting a choice;
- instant/reduced-motion mode works;
- UI cannot select an illegal engine action;
- hidden DC/internal identifiers do not leak;
- drawers/navigation do not mutate game state;
- battle outcome returns to the correct authored node.

## 14. Screen template
For every new screen define:
1. player goal;
2. authoritative state source;
3. primary information;
4. allowed actions;
5. hidden information;
6. empty/loading/error states;
7. mobile layout;
8. keyboard/accessibility behavior;
9. persistence implications;
10. tests.

## 15. Governance
Changes are classified as:
- **LOCKED:** must not change without an explicit source-of-truth decision;
- **DEFAULT:** preferred implementation, adjustable if evidence requires it;
- **MODULE:** local presentation choice that cannot violate locked contracts.

A visual redesign is not permission to rewrite gameplay rules or narrative state.

## 16. Definition of Done
A UI surface is done when it:
- represents authoritative runtime state;
- exposes only legal actions;
- contains no duplicate rule engine;
- works on mobile and desktop;
- handles empty/loading/error/disabled states;
- respects accessibility;
- preserves save/reload behavior;
- has automated coverage for critical interaction contracts.
