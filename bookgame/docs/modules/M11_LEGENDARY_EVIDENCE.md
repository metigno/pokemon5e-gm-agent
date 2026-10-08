# M11 — Five Legendary investigation threads during semifinal preparation

This module-level checkpoint follows `bookgame/docs/P5E_LIBROGAME_ENGINE_SOURCE_OF_TRUTH.md` and `bookgame/docs/LEGENDARY_QUEST_LEVEL_GUARDRAILS.md`. M11 does not add or grant any Legendary Pokémon, Mega form, fused form, item, battle, or Pokémon level.

In `m11-sf-prep#opponent_readiness`, the existing `opponent_readiness_alt` choice is used to review any already gathered personal evidence. It still leads to `commit` and preserves the locked **13 nodes / 29 choices**. The optional evidence-review flag alone does not start a Legendary quest.

Each of the five one-shot `legendary-m11-evidence.json` world events requires a matching protagonist, successful M07 World qualification, their personal M10 dossier flag and available/active quest, completed M11 Rei thread, an opened real semifinal bracket, and their explicit review choice. The M10 dossier becomes active and a personal `legendary_m11_evidence_*` flag is recorded. If already active, the existing runtime leaves it active and does not duplicate it.

- **Luke:** investigate contrasting claims concerning Kyurem, Zekrom and the original dragon; do not assume Black Kyurem is accessible
- **Mattew:** distinguish Zacian's pledge from the unrecovered Rusted Sword
- **Daniel:** protect Mewtwo's autonomy while verifying conflicting evidence
- **Edward:** compare marine currents and reports without presuming Lugia's presence
- **Fab:** verify atmospheric observations without asserting Rayquaza or its Mega form

M11 only runs for participants who legitimately reach the semifinals. Players eliminated earlier **do not lose or fail their open Legendary quests**; M12's existing postgame policy remains responsible for preserving unfinished arcs. Further playable exploration and encounters still need authoring against the Pokémon level cap from the Source of Truth.
