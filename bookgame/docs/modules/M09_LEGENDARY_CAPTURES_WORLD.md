# M09 — Capturable Legendary Pokémon during the World Championship

**Canon and engine authority:** `bookgame/docs/P5E_LIBROGAME_ENGINE_SOURCE_OF_TRUTH.md`, `bookgame/src/engine/pokemon-xp-balance.mjs`, `bookgame/data/poke5e/2024/species.json`, and `bookgame/src/combat/capture.mjs`.

## Placement and playable flow

After the **real Matchday 1**, the existing `m09-interday-one#media_window` choice `media_resources` now proceeds to the **optional** `legendary-world-hunt#hunt_entry` side scene. This is a player-authored choice and preserves the canonical 13-node/30-choice main M09 scene. The existing M09 press-clipping flag still activates each trainer's prior `legendary_m08_lead_*` quest through `legendary-m09-media-traces.json`; the side scene reads the updated quest state.

Players who do not have a valid personal lead can return to `m09-interday-one#resource_guard` without detours, battle, or changed competition results. Every lead is optional. Following a lead costs 90 minutes of world time to travel from the Village to Meridiana's wider area; returning costs another 90 minutes. A battle also consumes 20 minutes. Locations are updated through the existing `set_location` effect, not by silently teleporting state.

Each encounter is a **real** Pokémon 5e wild battle using the existing `choice.combat` → battle engine → Poké Ball action → `captured` return outcome. The trainer can win without capture, lose, flee or die according to existing systems. Only `captured` records successful capture and completes the active personal lead. There are no scripted win/automatic legendary rewards or forced fights. Failed capture attempts do not pretend ownership.

## Levels and species

| Trainer | Pokémon 5e species ID | Encounter level | Species minimum | Trainer required |
|---|---|---:|---:|---:|
| Luke | `black-kyurem` | 20 | 20 | 20 |
| Mattew | `zacian` | 20 | 20 | 20 |
| Daniel | `mewtwo` | 20 | 20 | 20 |
| Edward | `lugia` | 20 | 20 | 20 |
| Fab | `rayquaza` | 18 | 15 | 18 |

The **M09 Pokémon cap is 20**, explicitly specified in `POKEMON_LEVEL_CAPS_BY_MODULE`. The existing `validateCapture` rule rejects targets above the Trainer's level. This means that **not every run will obtain its Legendary**. Players must attain the required trainer level and win the capture dice mechanics; do not lower the species' authoritative minimum level to bypass this rule.

Lore:
- Black Kyurem is already the result of **willing** Kyurem + Zekrom Absofusion mediated by a DNA Splicer in the authored site. The player is not granted Zekrom or a Splicer. The captured species is `black-kyurem`, which exists separately in the offline 2024 pack.
- Zacian is its ordinary form. Crowned Zacian is not automatically unlocked and the Rusted Sword is not granted.
- Mewtwo retains agency. It is not gifted by a scientist or an admin.
- Lugia is encountered through the grounded coastal weather lead, not ordinary ecology.
- Rayquaza is ordinary `rayquaza`, not Mega Rayquaza. No Gigamax references or mechanics are involved.

## Using the Pokémon before the World finishes

`resolveCombatHandoff` places a legitimately captured Pokémon into the persistent `player.roster`. The current E5 official match bridge reads **the first six roster slots**, so a seventh Pokémon would otherwise stay unused. The Team UI exposes an explicit `Schiera nei sei` action for reserve slots (index 6+), letting the player swap the capture into an official slot 2–6 outside combat. This *preserves the original starter at slot 0* and does not generate, delete, duplicate, heal, or level Pokémon. The ordinary World match then reads the current first six.

If an official-registration freeze on *species substitutions* is added to E5 in a later source-of-truth decision, the substitution action must honor that rule. The current structured World registration does **not** snapshot a separate immutable list of Pokémon: it checks legality against the live state.

## Sprite asset compatibility

The offline Pokémon 5e species ID `black-kyurem` maps to the installed `kyurem-black` sprite (same form, alternate naming order). The installed sprite package currently has **only Zacian Crowned artwork**, not ordinary Zacian artwork. The `zacian` sprite alias temporarily shows that available illustration as a **visual placeholder only**: the actual captured species remains `zacian`, Fairy-type base form, without the Rusted Sword, Crowned typing, or any transformation mechanics. Import a proper Hero of Many Battles sprite and repoint the alias before final visual release. Sprite coverage validates actual resolved assets rather than silently hiding missing references.

## Limitations

The encounters are authored during the World Championship **after Matchday 1**, not during an official battle, and cannot be captured with a registered Trainer opponent flag. They are gated by successful M07 qualification, M08 personal lead, the actual M09 clue event, Trainer level, and not-yet-captured status. An M07-eliminated Trainer never receives access. The route is a separate optional side scene with no M09 `moduleId`, so the locked canonical module logical counts stay intact. Existing quests for M10–M12 still run only when their own progression gates are satisfied.

Repeat visits after an encounter without capture remain possible at a real time cost; capture cannot repeat after the personal quest is completed and the capture flag has been set. Future balancing may add an authored rest-day/cooldown schedule, but not a guaranteed capture.
