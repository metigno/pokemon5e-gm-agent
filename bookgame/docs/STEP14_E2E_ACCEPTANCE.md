# Step 14 — End-to-end acceptance matrix (M01–M12)

## Canonical scope

No new scenes, levels, towns, legendary assignments, trainer paths, competition rewards or gameplay rules. All tests execute the existing `BookgameEngine`, `SaveStore`, canonical scene files and Pokémon 5e runtime.

## Automated acceptance gates

| Area | Test in CI | Acceptance assertion |
| --- | --- | --- |
| M01–M12 campaign, Luke | `runtime-rc-persistent-e2e.test.mjs` | Real scene choices and checkpointed save/reload after each module; M07 qualifier through M11 final and M12 free roam |
| Championship results | `runtime-rc-persistent-e2e.test.mjs` | Champion, fail-to-qualify, eliminated routes; unplayed winners must not be the player |
| Four other protagonists | `runtime-rc-persistent-e2e.test.mjs` (Step 14 matrix) | From actual intro, legal free specialization and tutorial through all 12 modules; four NPC friends remain independent, six-Pokémon cap never breached |
| Five personal legendary quests | `legendary-world-capture-m09.test.mjs` (Step 14 matrix) | M09 personal clue → authored optional encounter → real Pokémon 5e combat capture → quest completion → save/reload, correct per-Five legendary |
| Wild captures and level caps | `phase5-live-regressions.test.mjs`, `six-pokemon-capture-limit.test.mjs`, `pokemon-xp-caps.test.mjs` | Real wild encounter and capture, consumption of ball, max six roster, trainer/Pokémon level boundary |
| Battle, trainer resources and effects | `phase5-live-regressions.test.mjs`, `trainer-gameplay-e2e.test.mjs`, `poke5e-full-runtime.test.mjs` | Actual combat engine, KO/XP atomic handoff, 2024 trainer mechanics |
| Three career slots, permanent death, abrupt termination | `career-slots.test.mjs`, `trainer-survival.test.mjs` | Isolation, terminal dead career, no accidental overwrite, autosave resumes after SIGKILL |
| Repeat editions and postgame | `runtime-rc-persistent-e2e.test.mjs`, `postgame-cycle.test.mjs` | World editions 2 and 3, historical champions retained, same team/NPC continuity |
| UI and release host | `mobile-offline-host.test.mjs`, `mobile-local-auth.test.mjs`, `compiled-catalogs-live-ui.test.mjs` | Native host/API contract on supported Node version; source-based checks |

## Test honesty and remaining manual acceptance

The narrative search driver resolves competition outcomes by calling the **existing combat handoff** with an explicit test outcome. It verifies branching, persistence, ranking and chapter reachability, **not** player combat strategy or random battle win probability. Independent combat tests use the actual Pokémon 5e engine and dice. In the Step 14 legendary capture test, a qualified trainer already owns a Master Ball, the wild enemy has one HP at a valid battle checkpoint, and the battle engine executes the capture. The test **does not** grant a Master Ball during gameplay or convert optional capture into a guaranteed story reward.

CI `Bookgame Tests`, `mobile-runtime-compat` and `mobile-android-shell` must all be GREEN before merge. The optional sprite/audio packs are externally provided; their absence in a clean source checkout cannot be interpreted as a physically verified complete APK. Android installation, physical taps, airplane-mode launch and a real-device full playthrough remain separate manual release checks under Step 13; do not label those PASS from this CI alone.

If any matrix case fails, preserve the regression result, identify the minimal canonical runtime defect and repair it before merging. Do not force-patch the scenario or fabricate an ending to make tests green.
