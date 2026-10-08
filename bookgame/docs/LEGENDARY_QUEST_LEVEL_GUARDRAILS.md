# Legendary encounters — module-level consistency guardrails

This content policy applies to Luke (Black Kyurem), Mattew (Zacian), Daniel (Mewtwo), Edward (Lugia), and Fab (Rayquaza).

- M06 introduces optional investigation leads only. A quest offer never implies a Pokémon spawn, combat, capture, ownership, or guaranteed success.
- For M07–M12, every authored legendary combat/encounter must specify its module, checkpoint, species/form, encounter level, and applicable Pokémon level cap in a reviewable encounter record. A narrative sighting or clue does not need a combat level.
- Never hardcode an arbitrary high legendary level. Resolve the current module's canonical Pokémon level cap and encounter balance before setting a numeric encounter level; the Source of Truth sections 44–45 explicitly leave exact cap values TBD. If no authoritative cap exists, leave the combat encounter unimplemented rather than inventing one.
- A legendary encounter must use existing Pokémon 5e battle/capture rules, legal forms, persistent outcomes, and the same progression constraints as other encounters. A legendary must not be scaled automatically to the player's current party or given a guaranteed capture.
- Legendary quests are optional and nonblocking. Missed or failed quests can return only through an explicitly authored cooldown/future trigger, not an unbounded repeated offer.
- Reuse existing Asteria locations; do not recreate locations from original Pokémon games or add new maps solely for these quests.
- Black Kyurem requires lore-consistent treatment of Kyurem and Zekrom; Crowned Zacian requires the Rusted Sword; Mega Rayquaza requires its applicable Pokémon 5e form requirements. These are later milestones, not automatic M06 rewards.

Before implementing an M07–M12 battle, record: `moduleId`, `checkpointId`, `speciesId`, `formId` (if relevant), `pokemonLevelCap` (authoritative source), `encounterLevel`, `locationId`, `outcomes`, and tests for level legality and persistence.
