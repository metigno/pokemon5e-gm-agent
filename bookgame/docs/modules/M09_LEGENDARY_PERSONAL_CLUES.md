# M09 — Personal legendary clues during Interday 1

**Authority:** `bookgame/docs/P5E_LIBROGAME_ENGINE_SOURCE_OF_TRUTH.md` and `bookgame/docs/LEGENDARY_QUEST_LEVEL_GUARDRAILS.md`.

The existing `m09-interday-one#media_window` choice `media_resources` also allows the player to review personal press clippings. This is an optional action and retains the original destination `resource_guard`. No scene nodes, extra choice, free recovery, teleport, or World match outcome is added.

The five `legendary-m09-media-traces.json` world events require **all** of:

- The matching player name and personal `legendary_m08_qualified_*` flag
- `world_qualified` from a successful M07
- The actual M09 Matchday 1 completion flag
- The player's own optional press-notes review
- The matching M08 personal follow-up quest already offered or active

For the chosen protagonist, the event starts the **existing** personal follow-up quest rather than duplicating it, and stores one persistent `legendary_m09_clue_*` flag. Its updated investigation objective is shown when a previously available quest is started. An already active quest stays active and retains its prior objective, consistent with the quest runtime's idempotent semantics.

The clue differs by protagonist: Kyurem/Zekrom evidence (Luke), Zacian and the still-unrecovered sword (Mattew), Mewtwo's origin and autonomy (Daniel), Lugia and unusual marine weather (Edward), or Rayquaza and uncertain atmospheric readings (Fab).

These are narrative leads, **not encounter authorizations**. Nothing grants a Legendary Pokémon, an item, an evolution/form change, or a level. A Trainer eliminated before M08 cannot trigger this sequence. M09 results and subsequent World progression remain independent of the investigation.
