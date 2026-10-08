# M07 — Personal legendary investigation checkpoint

This optional checkpoint is processed by the existing world-event engine after `m7_pro_preparation_complete`. It requires the matching protagonist's M06 legendary quest to be `available` or `active`. It is one-shot and does not change the qualifier, award a Pokémon, or start combat.

| Trainer | Quest | M07 clue flag | Evidence available to later authored scenes |
|---|---|---|---|
| Luke | `legendary_luke_kyurem_black` | `legendary_m07_clue_luke` | An incomplete dragon and a disputed connection to Zekrom |
| Mattew | `legendary_mattew_zacian` | `legendary_m07_clue_mattew` | Heraldic evidence of a lost sword, not possession of the Rusted Sword |
| Daniel | `legendary_daniel_mewtwo` | `legendary_m07_clue_daniel` | Redacted scientific testimony and ethical questions about autonomy |
| Edward | `legendary_edward_lugia` | `legendary_m07_clue_edward` | Recurring weather anomalies along documented sea routes |
| Fab | `legendary_fab_rayquaza` | `legendary_m07_clue_fab` | Unverified atmospheric observations about a sky guardian |

The clue flags are persistent evidence for future **authored** M08–M12 dialogue and decisions; they are not proof of an encounter. Do not present the clue to the player until a playable scene reads the matching flag. The M07 event by itself has no visible narrative output.

**Level safety:** M07's canonical Trainer band is 17–20. This does not establish a Pokémon level cap. No encounter level or legendary battle is authored here; see `bookgame/docs/LEGENDARY_QUEST_LEVEL_GUARDRAILS.md`.

**Implementation follow-up:** provide visible player choices and divergent consequences using the existing M08–M12 scenes, without changing locked node/choice budgets; ensure the relevant flags are consumed, not merely set.
