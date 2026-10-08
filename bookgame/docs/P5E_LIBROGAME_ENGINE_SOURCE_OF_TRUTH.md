# P5E LIBROGAME ENGINE — SOURCE OF TRUTH

**File:** `P5E_LIBROGAME_ENGINE_SOURCE_OF_TRUTH.md`  
**Project:** Pokémon 5e Digital Librogame  
**Status:** CANONICAL ENGINE / GAMEPLAY SOURCE OF TRUTH  
**Scope:** Engine, gameplay loop, rules integration, UI logic, persistence, progression, world simulation  
**Explicitly separate from:** Pokémon Sports Career (PSC) and Pokémon 5e GM Agent

---

# 0. AUTHORITY

This document is the canonical source of truth for the standalone **Pokémon 5e Digital Librogame**.

The project is:

- a standalone project;
- offline-first;
- not a replacement for the existing Pokémon 5e GM Agent;
- not part of Pokémon Sports Career (PSC);
- based on Pokémon 5e rules plus the already-agreed engine extensions from the Pokémon 5e GM Agent;
- designed as a digital gamebook with an RPG engine underneath.

When implementation choices conflict with this document, this document wins unless explicitly superseded by a newer approved source of truth.

Development principle:

**SCRIPT FIRST → RULES VALIDATION → STATE UPDATE → NARRATION → PLAYER CHOICE**

The engine must never invent arbitrary world canon when a scripted result or rule already exists.

---

# 1. CORE PRODUCT IDENTITY — LOCKED

The final product is a true **digital gamebook / librogame** with RPG systems.

The intended experience is:

> "I am living a Pokémon RPG through text, choices, rules, maps, state, consequences and tactical combat."

The player starts a **New Career**, chooses a Trainer, selects a Trainer class, receives the scripted opening setup, and plays through:

- narrative scenes;
- contextual choices;
- D&D/Pokémon 5e checks;
- Pokémon encounters;
- tactical combat;
- quests;
- world travel;
- relationships;
- morality;
- reputation;
- progression;
- championships;
- repeated World Championships in post-game.

The game must work without an AI during normal play.

---

# 2. OFFLINE-FIRST REQUIREMENT — LOCKED

The complete gameplay loop must work locally and offline.

Offline systems include:

- dice rolls;
- Trainer checks;
- passive checks;
- combat;
- Pokémon AI/rules resolution;
- quest logic;
- trigger evaluation;
- random encounters;
- event selection;
- world state;
- calendar and time;
- shops and stock refresh;
- Trainer progression;
- Pokémon progression;
- saves;
- permadeath;
- scripted narration;
- World Championship simulation;
- post-game loops.

Internet is optional only for external resources such as a direct link to the Pokémon 5e rules website.

No internet connection may be required to continue a career.

---

# 3. NAVIGATION MODEL — LOCKED

The world uses a navigation model inspired by **Sorcery!**.

There is no traditional free-walking overworld requirement for the core engine.

The player navigates through a **clickable node-based map**.

Example flow:

`Map → choose destination → travel resolution → scene → choices → consequences → next scene or return to map`

A zone may contain:

- sublocations;
- scripted encounters;
- quests;
- NPCs;
- shops;
- Pokémon habitats;
- hidden locations;
- time-gated events.

The detailed map and zone catalog are **DEFERRED** to a dedicated map/world design phase.

---

# 4. SCENE DESIGN — LOCKED

Scenes must be:

- immersive;
- descriptive;
- concise;
- direct;
- immediately actionable.

They must not become long novel-like walls of text.

Target feeling:

> enough description to create place, tension and atmosphere, then quickly give the player something meaningful to do.

The narrator behaves like a **D&D Game Master**, not like a detached novelist and not like a technical log.

Scenes may chain directly:

`Scene A → Scene B → Scene C`

when active quest or event triggers require it.

The game returns to the map only when the current scripted sequence releases the player back to free navigation.

---

# 5. PLAYER CHOICES — LOCKED

Choices are contextual.

Do not rely on a giant permanent action menu as the primary interaction model.

The current scene should present only actions relevant to that moment.

Example:

- Approach slowly.
- Examine the tracks. *(CT Perception)*
- Order your Pokémon to prepare.
- Leave the area.

If a choice requires a roll, the required check is shown in parentheses.

Examples:

- `(CT Athletics)`
- `(CT Perception)`
- `(CT Persuasion)`
- `(CT Intimidation)`

The numeric Difficulty Class is **never shown before the roll**.

The player should choose based on roleplay and situation, not numerical optimization.

---

# 6. ADVANTAGE / DISADVANTAGE DISPLAY — LOCKED

When a choice has advantage or disadvantage, show it directly in the choice label.

Examples:

- `(CT Perception — Advantage)`
- `(CT Athletics — Disadvantage)`

Do not display the mechanical reason beside the choice.

The reason must be inferable from the narration and world context.

---

# 7. MORAL CHOICE TAGS — LOCKED

Choices with moral/alignment significance display a tag inspired by Pathfinder-style dialogue choices.

Examples:

- `(Good)`
- `(Evil)`
- `(Lawful)`
- `(Chaotic)`
- `(Lawful Good)`
- `(Chaotic Good)`

A choice may contain both a moral tag and a check.

Example:

`Threaten him until he talks. (Evil) (CT Intimidation)`

Choices without moral significance display no alignment tag.

---

# 8. DICE AND CHECK RESOLUTION — LOCKED

The game follows D&D/Pokémon 5e logic.

A roll is required only when there is:

- uncertainty;
- meaningful risk;
- opposition;
- a real consequence for failure.

Simple actions do not require unnecessary rolls.

Player rolls are visible.

Example:

`d20 + 7 = 18`

NPC/enemy rolls are hidden.

Passive systems such as:

- Passive Perception;
- Passive Insight;
- similar passive checks;

are resolved silently by the engine.

The player only sees information their Trainer actually detects.

---

# 9. DEGREE OF SUCCESS / FAILURE — LOCKED

Resolution is not purely binary.

The system must support:

- critical failure;
- normal failure;
- normal success;
- critical success;

with contextual severity.

Normal failure/success may also have multiple scripted variants depending on:

- margin;
- context;
- previous state;
- relevant conditions;
- advantages/disadvantages;
- scene-specific rules.

Critical failure should produce a severe result when appropriate.

Critical success should produce an exceptional result when appropriate.

The narrator explains the outcome naturally after the visible player roll.

---

# 10. POKÉMON 5E RULES AUTHORITY — LOCKED

The rules engine uses **Pokémon 5e** as the mechanical base.

It also reuses the already-agreed gameplay/rules extensions developed for the Pokémon 5e GM Agent where applicable.

Do not create parallel simplified systems when Pokémon 5e already defines the mechanic.

This applies to:

- Trainer rules;
- Pokémon rules;
- combat;
- conditions;
- checks;
- advantage/disadvantage;
- classes;
- progression;
- equipment;
- Trainer Gear;
- items;
- rest;
- healing;
- leveling;
- moves;
- evolution;
- battle actions;
- death;
- capture;
- interaction rules.

The UI may simplify presentation.

The mechanics must not be simplified unless an explicit future source-of-truth decision authorizes it.

---

# 11. COMBAT — LOCKED

Combat uses the full Pokémon 5e ruleset.

No arcade combat simplification.

No reduced "give one command" substitute.

The engine must know every valid option available in the current turn.

However, the UI must show only actions that are:

- legal;
- relevant;
- possible from the current position/state;
- allowed by range;
- allowed by conditions;
- allowed by resources;
- allowed by action economy.

Example:

If Grapple is impossible because the target is too far away, Grapple is not shown.

Combat uses real spatial logic under the hood:

- distance;
- range;
- positioning;
- reach;
- conditions;
- movement.

Presentation remains narrative.

Exact distance values appear only when they matter for a decision.

---

# 12. TRAINER AND POKÉMON DEATH — LOCKED

Death is real.

## Trainer

If the protagonist dies:

**CAREER ENDED**

The run is permanently concluded.

## Pokémon

Pokémon death uses **permadeath**.

A dead Pokémon:

- cannot be revived by a custom game shortcut;
- is permanently removed from the active team;
- remains part of the historical state of the career.

Official/non-lethal situations may resolve as KO/fainting according to Pokémon 5e rules.

Real lethal encounters may cause death according to the ruleset.

---

# 13. SAVE SYSTEM — LOCKED

Initial release supports:

**3 Career Slots**

Each slot is an independent career.

Manual saving is allowed.

The player must not be forced to lose long stretches of progress merely because a checkpoint was not reached.

Permadeath/career-death logic remains part of the career state.

---

# 14. WORLD STATE AND SCRIPTED TRIGGERS — LOCKED

The world is alive, but not freely hallucinated.

World evolution must use scripted triggers.

Trigger inputs may include:

- current node;
- current zone;
- time;
- day;
- quest state;
- checkpoint state;
- Trainer choice;
- NPC state;
- morality;
- reputation;
- item ownership;
- Pokémon ownership;
- prior decisions;
- event flags;
- legendary quest state.

Example:

`day >= 3 AND quest_X_complete AND NPC_alive AND player_enters_zone_Y → event_Z`

Major events should be authored.

The engine may select between authored variants, but must not invent unapproved canonical events.

---

# 15. MAIN STORY STRUCTURE — LOCKED

The campaign is not a pure railroad and not a pure sandbox.

Use a **diamond structure**:

`Main node → multiple approaches → different consequences → reconverge on major checkpoint`

Different routes may change:

- relationships;
- HP/resources;
- NPC presence;
- enemies;
- information;
- rewards;
- morality;
- reputation;
- quest states;
- future dialogue;
- world state.

Major story checkpoints are mandatory.

Different runs may reach the same checkpoint in very different states.

Checkpoint scenes must adapt to prior decisions.

---

# 16. QUEST TYPES — LOCKED

The game supports both:

## Linear quests
Simple structures such as:

`Accept → Objective → Return → Reward`

## Branching quests
Multiple approaches and consequences with later reconvergence where appropriate.

Quest content is scripted.

Quest details may be generated from authored templates only where explicitly allowed.

---

# 17. QUEST FAILURE — LOCKED

Some quests and events have real timing windows.

A quest may fail if the player:

- arrives too late;
- ignores the event;
- misses the required time;
- misses the required location;
- fails required conditions.

Such a quest is marked:

**QUEST FAILED**

The world continues coherently after failure.

The world does not freeze waiting for the player.

---

# 18. IGNORED QUESTS — LOCKED

The player may ignore quests entirely.

If the player does not engage:

- the event may resolve without them;
- an NPC may act instead;
- the situation may worsen;
- the event may disappear;
- another scripted world outcome may occur.

Ignoring content is a valid choice.

---

# 19. QUEST LOG — LOCKED

The game contains a real Quest Journal.

Minimum categories:

- Active
- Completed
- Failed

Objective wording is quest-specific.

Some quests may be explicit.

Some may be intentionally vague.

This is controlled by script.

---

# 20. IMPORTANT PEOPLE JOURNAL — LOCKED

The Journal contains a minimal **Important People** page.

Entries are intentionally short.

Example:

`Red — field Trainer, one of the greatest Trainers of all time.`

Do not turn this into a large encyclopedia.

No unnecessary numeric relationship data is displayed here.

---

# 21. DIALOGUE MODEL — LOCKED

Dialogue structure is inspired by **Oblivion-style topic dialogue**.

NPCs expose authored contextual topics such as:

- local area;
- Pokémon;
- rumors;
- people;
- dangers;
- quests;
- organizations;
- recent events.

Topics may appear/disappear based on:

- knowledge;
- relationship;
- quest state;
- time;
- location;
- reputation;
- morality;
- previous dialogue.

Dialogue is not based on unlimited free-text AI generation.

---

# 22. SOCIAL CHECKS — LOCKED

Dialogue may offer:

- Persuasion;
- Intimidation;
- Deception;
- other Pokémon 5e-valid social checks.

These use normal check rules.

The player sees the check type.

The DC remains hidden.

Successful intimidation/deception may still produce negative future consequences.

---

# 23. NPC INFORMATION QUALITY — LOCKED

NPC knowledge is not universal.

Depending on the NPC, they may provide:

- no useful information;
- partial information;
- complete information.

Knowledge depends on:

- occupation;
- experience;
- location;
- role;
- personal knowledge;
- quest/world state.

Do not assume every NPC knows everything.

---

# 24. RELATIONSHIPS — LOCKED

NPC relationships may use hidden numeric values internally.

The player sees only qualitative states.

Example scale:

- Hostile
- Distrustful
- Neutral
- Friendly
- Loyal

Exact thresholds remain hidden.

Choice consequence notifications such as:

`Edward will remember this`

should generally **not** be shown.

The player discovers consequences later through the world.

---

# 25. MORALITY / ALIGNMENT — LOCKED

The game uses a simple visible alignment model inspired by D&D.

Possible labels include:

- Lawful Good
- Neutral Good
- Chaotic Good
- Lawful Neutral
- Neutral
- Chaotic Neutral
- Lawful Evil
- Neutral Evil
- Chaotic Evil

The engine may store hidden values.

The player sees only the current alignment label.

Alignment can be influenced by meaningful actions such as:

- altruism;
- cruelty;
- honesty;
- deception;
- loyalty;
- betrayal;
- Pokémon treatment;
- quest decisions.

When alignment changes, a short **scripted narrator message** communicates the change.

Do not use a purely technical popup.

---

# 26. REPUTATION — LOCKED

Reputation is separate from alignment.

Reputation may exist for:

- cities;
- organizations;
- local groups;
- factions;
- communities.

Player-facing reputation uses qualitative labels.

Example:

- Unknown
- Tolerated
- Respected
- Feared
- Hated

Numeric reputation values may remain hidden.

Specific faction lore is **DEFERRED** to the lore/quest phase.

---

# 27. TIME SYSTEM — LOCKED

Time is **semi-real**.

It is persistent but does not need to match real-world device time.

Time advances through gameplay actions such as:

- travel;
- rest;
- training;
- quests;
- scenes;
- waiting;
- time skip.

Events may require specific:

- times of day;
- days;
- temporal windows;
- quest timing.

Time is an active gameplay system.

---

# 28. TIME SKIP — LOCKED

The player may skip empty periods of time.

A time skip must still process:

- quest deadlines;
- quest failures;
- event triggers;
- shop restocks;
- world state changes;
- scripted events;
- relevant recurring systems.

Time skip accelerates time.

It does not bypass consequences.

After a time skip, the narrator gives a brief diegetic summary of meaningful events.

---

# 29. TRAVEL — LOCKED

Travel between discovered nodes is fast from the player's point of view.

The player does not need to manually walk every path.

Travel time depends on actual distance.

Even when no encounter occurs, the required in-world time passes.

During travel, the engine performs encounter/event checks using a D&D-style probability scale.

Often:

- nothing happens.

Sometimes:

- a minor event occurs.

More rarely:

- a meaningful or dangerous encounter occurs.

Special transportation systems are **DEFERRED** to map/lore design.

---

# 30. WILD POKÉMON ECOLOGY — LOCKED

Wild Pokémon use the ecological logic already defined for the Pokémon 5e GM Agent.

Pokémon are treated like real wildlife.

Possible behaviors include:

- timid;
- territorial;
- curious;
- predatory;
- social;
- solitary;
- herd/pack-based;
- defensive;
- protective of young;
- aggressive;
- cooperative;
- habituated to humans.

Wild encounters may include:

- individuals;
- pairs;
- families;
- packs;
- herds;
- Alpha/Beta variants where applicable.

A Pokémon may be dangerous to humans where species/context makes that plausible.

A Pokémon may cooperate with humans where appropriate.

---

# 31. WILD ENCOUNTER POOLS — LOCKED

Each zone has an authored ecological encounter pool.

Encounters are not completely fixed and not completely random.

Weights may depend on:

- habitat;
- rarity;
- time of day;
- weather;
- season;
- zone state;
- human activity;
- local events;
- species ecology;
- group behavior;
- special conditions.

Legendary/Mythical/Paradox/special entities do not enter ordinary random encounter tables unless specifically authored to do so.

---

# 32. WILD POKÉMON DISCOVERY — LOCKED

The player does not see a complete zone encounter table in advance.

They learn local fauna by:

- exploring;
- seeing Pokémon;
- asking NPCs;
- finding clues;
- observing the environment;
- receiving local information.

The Pokédex is not unlocked by hearsay alone.

---

# 33. CAPTURE — LOCKED

All ordinary wild Pokémon encountered are capturable.

Do not create arbitrary "uncapturable" ordinary wild Pokémon solely for narrative convenience.

The world script controls:

- where species appear;
- rarity;
- conditions;
- encounter state.

Capture follows Pokémon 5e rules.

---

# 34. ACTIVE TEAM LIMIT — LOCKED

The player may have a maximum of:

**6 active Pokémon**

There is no Pokémon storage box in the current design.

If the player captures a seventh Pokémon, the game asks:

> Do you want to replace one of your Pokémon with this one?

If the player replaces a team member, the removed Pokémon is released permanently.

---

# 35. POKÉDEX — LOCKED

Pokédex entries use:

- Seen
- Caught

Hearing about a Pokémon from an NPC does not mark it as Seen.

The Pokédex is part of the Trainer Menu.

---

# 36. INVENTORY — LOCKED

The player has an Inventory panel.

Opening it shows all owned items.

Item rules, Trainer Gear, usage, restrictions and equipment behavior follow Pokémon 5e.

Do not invent custom equipment slots.

Money is always visible in the main interface.

HP/conditions are not permanently visible.

They appear:

- when relevant;
- in combat;
- during healing/injury contexts;
- when the player opens the relevant Trainer/Squad panel.

---

# 37. SHOPS — LOCKED

Shop inventories are scripted by progression/zone.

Early areas sell basic items.

Later areas may sell more advanced or valuable items.

Example progression:

`Poké Ball → better capture items → high-end items`

Exact catalogs are authored later.

Shops have limited stock.

All shop stock refreshes on a fixed cycle:

**every 3 in-game days**

---

# 38. TRAINER SELECTION — LOCKED

The player first chooses a Trainer character.

Each selectable Trainer has:

- fixed starting statistics;
- distinct personality;
- distinct dialogue tone;
- exclusive dialogue options;
- shared core story access.

No free point-buy for base Trainer statistics.

The Trainer choice is meaningful because the starting stat profile differs.

---

# 39. TRAINER-SPECIFIC DIALOGUE — LOCKED

Dialogue contains:

- common options available to all Trainers;
- Trainer-specific options available only to the chosen Trainer.

Trainer-specific dialogue reflects:

- personality;
- background;
- stat profile;
- narrative identity.

The overall main campaign remains shared.

---

# 40. TRAINER-SPECIFIC LEGENDARY QUEST — LOCKED
The major character-specific quest line is the Trainer's Legendary quest.

Each Trainer has a dedicated Legendary path.

The exact Legendary mapping is content/lore data and is **DEFERRED** to the campaign content phase.

If the Legendary quest fails or is missed, it may return after a defined cooldown or future trigger.

The career continues without requiring immediate Legendary acquisition.

---

# 41. TRAINER CLASS — LOCKED

Trainer character selection and Trainer class selection are separate.

Flow:

`Choose Trainer → Choose Trainer Class`

The selected Trainer does not automatically determine the class.

No multiclassing.

Each career uses one Trainer class.

Class rules follow Pokémon 5e.

---

# 42. CLASS PROGRESSION — LOCKED

The player controls class progression choices.

When Pokémon 5e offers choices such as:

- Trainer Path;
- specialization;
- feat;
- ASI;
- class option;
- other progression branch;

the player selects the option.

The Trainer character does not auto-select these choices.

---

# 43. TRAINER EXPERIENCE — LOCKED

Trainer progression is independent from Pokémon progression.

Trainer XP may be awarded for:

- battles;
- quests;
- exploration;
- successful meaningful checks;
- dialogue resolutions;
- major checkpoints;
- other significant scripted accomplishments.

**Trainer XP balance V1:** rewards are independent of Pokémon XP. A successful
Trainer battle gives 25% of the XP gap between the Trainer's current level and
the next level; completing an authored quest gives 25%; meaningful scripted
exploration gives 10%; a successful check or saving throw gives 8%; a meaningful
NPC relationship/dialogue resolution gives 6%. Each result uses the floor of
its percentage with a minimum of 1 XP for levels below 20. At Trainer level
20 all grants yield 0. An authored one-time story reward uses its
scene/node/choice identity so revisiting the node cannot farm it. Failed
checks, empty navigation, losses, fleeing and captures do not award battle XP.
These budgets do not change Pokémon XP awards.

---

# 44. TRAINER LEVEL CAPS — LOCKED SYSTEM / TBD VALUES

Trainer level is subject to progression caps tied to campaign checkpoints.

The Trainer may gain XP normally until the current cap.

When the Trainer reaches the current cap:

- further XP is lost;
- XP is not banked;
- XP is not retroactively restored.

Completing the required checkpoint raises the available cap.

**Trainer cap balance V1 (independent of the Pokémon table below):**

| Module / checkpoint band | Maximum Trainer level |
| --- | ---: |
| M01 — F→E / M01_COMPLETE | 3 |
| M02 — E→D / M02_NETWORK_OUTCOME, M02_COMPLETE | 5 |
| M03 — D→C / M03_FERROX_OUTCOME, M03_COMPLETE | 9 |
| M04 — C→B / M04_COMPLETE | 12 |
| M05 — B→A / M05_COMPLETE | 15 |
| M06 — A→S / M06_COMPLETE | 18 |
| M07 — World Qualifier | 20 |
| M08–M12 — World Championship and postgame | 20 |

The cap is unlocked by campaign-module progression and cannot be lowered by
revisiting earlier authored scenes. The existing explicit Trainer milestone
effects remain authoritative guaranteed level rewards, including M02 level 4
and M03 level 6 intermediate checkpoints; earned activity XP can level the
Trainer earlier within the current module band. Required Trainer Path, ASI,
specialization and level-19 feat choices still pause level-up advancement until
resolved. At level 19 the Pokémon 5e 2024 rule also permits **another feat for
which the Trainer qualifies** instead of an Epic Boon; the current mobile
selector offers the implemented repeatable Ability Score Improvement (General
Feat) option. It applies real ability increases and resolves the pending
choice; an unimplemented Epic Boon is never silently selected or granted.
Other feat/boon options require their own verified mechanics before exposure. XP granted after a cap is reached is immediately discarded and
never restored when the cap rises. The cap uses the **exact experience
threshold of the capped level**, not the next level's threshold.

---

# 45. POKÉMON LEVEL CAPS — LOCKED SYSTEM / MODULE BALANCE V1

Pokémon use level caps tied to campaign checkpoints. The first cap starts at
Pokémon Lv5, matching the canonical starters. Each completed module milestone
raises the cap for the next module; returning to an older scene never lowers it.

| Module | Pokémon cap |
| --- | ---: |
| M01 | 5 |
| M02 | 6 |
| M03 | 8 |
| M04 | 10 |
| M05 | 12 |
| M06 | 14 |
| M07 | 16 |
| M08 | 18 |
| M09 | 20 |
| M10 | 20 |
| M11 | 20 |
| M12 | 20 |

When a Pokémon reaches the current cap:

- further XP is lost, not banked or restored at later checkpoints;
- XP is clamped to the current cap's exact level threshold (not the threshold
  for the next level), so it cannot be used for an instant future level-up;
- any pending evolution/level-up decision must respect the same cap;
- Trainer caps and Trainer XP remain separate and are not changed by this table.

**Pokémon combat XP balance V1:** an actual victory over one or more fainted
opposing Pokémon awards one-third of each defeated opponent's experience
threshold delta to the next level (minimum 1 XP per defeated Pokémon). The
total is divided equally, rounding down, between Pokémon actually sent out,
including those withdrawn or fainted during the match. Bench Pokémon that
never entered do not gain XP. Defeat, fleeing and capture grant no battle XP.
The battle reward is assigned once at the combat-to-story handoff and persisted.
Level-ups, moves, evolutions and HP continue to follow the existing Pokémon 5e
runtime, including its explicit pending player decisions.

---

# 46. TRAINER LEVEL-UP SCREEN — LOCKED

When the Trainer levels up, open a dedicated level-up screen.

The screen shows:

- new level;
- new class features;
- newly available options;
- any required choices.

If the rules require a choice, the player must resolve it before continuing.

---

# 47. POKÉMON LEVEL-UP SCREEN — LOCKED

When a Pokémon levels up, open a dedicated Pokémon level-up screen.

Show all Pokémon 5e-relevant changes, including where applicable:

- HP/stat changes;
- new moves;
- evolution availability;
- choices;
- other progression unlocks.

Do not omit relevant Pokémon 5e progression.

---

# 48. TRAINER MENU — LOCKED

The main Trainer Menu is divided into multiple pages to keep the UI readable.

Core pages:

1. **Trainer**
2. **Class**
3. **Squad**
4. **Inventory**
5. **Pokédex**
6. **Journal**
7. **Reputation**

Additional subpages are allowed when needed for clean presentation.

The menu organization is UI-only.

Rules remain Pokémon 5e.

---

# 49. TRAINER PAGE — LOCKED

The Trainer page is a complete Pokémon 5e character sheet presented in a cleaner digital UI.

It must include all relevant Pokémon 5e Trainer data, such as:

- ability scores;
- skills;
- class;
- level;
- HP;
- AC;
- conditions;
- features;
- saves;
- relevant resources;
- Trainer Gear/equipment data;
- other rule-required fields.

Do not invent custom stats.

Do not omit mechanically relevant stats.

---

# 50. SQUAD PAGE — LOCKED

The Squad page represents the Trainer's active Pokémon according to Pokémon 5e.

Pokémon sheets must contain Pokémon 5e data only.

The UI may be reorganized for clarity.

The mechanics must remain faithful to Pokémon 5e.

---

# 51. EQUIPMENT / TRAINER GEAR — LOCKED

Equipment behavior follows Pokémon 5e exactly.

Do not invent:

- custom armor slots;
- custom accessory slots;
- custom gear rarity systems;
- custom equipment bonuses;
- parallel inventory rules.

Only Pokémon 5e-valid equipment/Trainer Gear systems are allowed unless later explicitly approved.

---

# 52. IMPORTANT COMPANIONS / RIVALS — LOCKED

The four major companions/rivals have scripted progression.

They begin with their canonical Ace.

Their team progression follows authored triggers/events until they reach their canonical 2060 roster.

The AI/engine does not freely generate their team composition.

Important acquisitions/evolutions may be shown to the player only if the player reaches the scripted scene/trigger that contains them.

Example structure:

`Node 3 → choice → Node 40 → scripted rival capture scene`

If the player never reaches that scene, they do not arbitrarily witness it.

---

# 53. WORLD CHAMPIONSHIP — LOCKED

The World Championship uses the canonical **2060 roster**.

The roster remains the same across repeat World Championships.

What may change between editions:

- seeds;
- groups;
- brackets;
- NPC results;
- standings;
- progression through the tournament.

NPC vs NPC wins/losses are determined by approved scripted/simulation logic.

Teams are not randomly regenerated.

---

# 54. WORLD CHAMPIONSHIP OUTCOME — LOCKED

The primary competitive goal is winning the World Championship.

Winning the World Championship does **not** end the career.

The victory script adapts to career state.

Possible variations include:

- celebrating with friends;
- celebrating alone;
- crowd admiration;
- crowd hostility;
- being respected;
- being feared;
- being booed;
- other authored outcomes.

The trophy result may be the same.

The epilogue tone reflects the run.

---

# 55. POST-GAME — LOCKED

Post-game continues indefinitely.

The player may:

- continue the same career;
- change team over time;
- continue capturing/training;
- play new World Championship editions;
- accumulate championship history.

Each World Championship cycle is separated by:

**4 in-game years**

During those years the world can process recurring authored events and quests.

---

# 56. REPEATABLE QUEST / EVENT CATALOG — LOCKED

Between World Championships, use a catalog of authored reusable quest/event templates inspired by Bethesda-style repeatable/radiant structures.

A template may vary:

- year;
- quest giver;
- target;
- location;
- enemy;
- reward;
- state-specific parameters.

The structure is authored.

The engine fills approved variables.

The engine does not freely invent new quest canon.

---

# 57. SUSPENSION OF DISBELIEF IN LONG POST-GAME — LOCKED

Repeated four-year cycles do not require realistic aging simulation.

Major NPCs do not automatically:

- age out;
- retire;
- die of age;
- disappear;

unless a specific script says so.

The four-year cycle exists for World Championship rhythm.

Use deliberate suspension of disbelief.

---

# 58. HALL OF FAME / CHAMPIONSHIP HISTORY — LOCKED

The game records World Championship winners over time.

The same career can produce multiple championship entries.

The history should persist in that career.

A Hall of Fame/history screen may display winners and relevant editions.

Exact presentation is a UI/content decision.

---

# 59. MAIN MENU — LOCKED

Suggested initial menu:

- New Career
- Load Career
- Hall of Fame
- Codex / Rules
- Settings

The Codex / Rules section is complete from the start.

It is not progressively unlocked.

When online, it may include a direct link to the Pokémon 5e reference website.

The game must remain playable without opening that link.

---

# 60. GRAPHICS — DEFERRED

Final graphical presentation is intentionally deferred.

First complete:

- engine;
- rules;
- state;
- persistence;
- scripts;
- UI structure;
- progression;
- quest logic;
- combat integration.

Then connect:

- illustrations;
- portraits;
- scene art;
- polished map assets;
- effects;
- final visual identity.

The engine must not depend on final graphics to function.

---

# 61. MAP / WORLD CONTENT — DEFERRED

A separate design phase/chat will define:

- regions;
- cities;
- routes;
- sublocations;
- zone graph;
- travel distances;
- encounter pools;
- shops;
- services;
- hidden areas;
- map progression;
- transport systems.

The current engine only needs to support these systems generically.

---

# 62. LORE / FACTIONS — DEFERRED

Specific organized factions are not locked yet.

Future lore/script design may define:

- criminal organizations;
- law enforcement;
- leagues;
- local groups;
- political/civic organizations;
- special institutions.

The reputation engine must support faction reputation before the faction list is finalized.

---

# 63. SCRIPT / QUEST CONTENT — DEFERRED

This source of truth defines the engine behavior.

It does not yet define:

- every main quest;
- every side quest;
- every dialogue;
- every NPC;
- every encounter;
- every Legendary quest;
- every checkpoint scene;
- every World Championship script.

Those are authored later using the systems defined here.

---

# 64. NON-GOALS — LOCKED

Do NOT turn this project into:

- a traditional free-walking Pokémon ROM;
- an always-online AI game;
- a generic chatbot RPG;
- a pure visual novel;
- a fully procedural sandbox;
- a simplified arcade Pokémon battler;
- PSC;
- a replacement for the Pokémon 5e GM Agent.

---

# 65. IMPLEMENTATION PRIORITY

Implementation should proceed in this order:

1. Core data model
2. Save system / 3 Career Slots
3. Trainer selection
4. Trainer class selection
5. Trainer/Pokémon character data
6. Pokémon 5e rule integration
7. Dice/check engine
8. Scene engine
9. Choice/condition engine
10. Trigger/state engine
11. Quest engine
12. Time/calendar engine
13. Travel engine
14. Encounter engine
15. Combat engine
16. Inventory/shops
17. Progression / level caps
18. Trainer Menu
19. Journal / Pokédex / Reputation
20. World Championship engine
21. Post-game cycle
22. Repeatable scripted event catalog
23. Full offline regression
24. Graphics integration
25. Content production / final scripting

---

# 66. ENGINE DESIGN RULE

Every gameplay event should be representable through data.

A scene should be able to define at minimum:

- scene ID;
- location/node;
- prerequisites;
- time conditions;
- quest conditions;
- world-state conditions;
- narration text;
- optional passive checks;
- available choices;
- checks required;
- advantage/disadvantage;
- alignment tags;
- success/failure branches;
- state mutations;
- relationship changes;
- reputation changes;
- morality changes;
- item changes;
- Pokémon changes;
- time cost;
- next scene / return-to-map behavior.

This enables the game to remain authored, deterministic and testable.

---

# 67. EXAMPLE SCENE DATA LOGIC

Conceptual example only:

```text
SCENE: route_03_injured_growlithe

PREREQUISITES:
- player_has_not_seen_event = true
- time = morning OR afternoon

NARRATION:
A Growlithe stands between you and the brush...

CHOICES:

1. Approach slowly.
   CHECK: Animal Handling
   DC: hidden
   RESULT:
   - critical success → scene_A
   - success → scene_B
   - failure → scene_C
   - critical failure → scene_D

2. Examine the tracks. (CT Perception — Advantage)
   CHECK: Perception
   DC: hidden
   RESULT:
   - success → reveal hidden information
   - failure → no discovery

3. Leave.
   TIME_COST: 5 minutes
   NEXT: map
```

Actual schemas/serialization formats are implementation decisions.

---

# 68. TESTING REQUIREMENTS

The engine should be testable without graphics.

Minimum automated coverage should validate:

- deterministic trigger evaluation;
- valid/invalid choice visibility;
- hidden DCs;
- visible player rolls;
- hidden NPC rolls;
- advantage/disadvantage;
- critical outcomes;
- quest completion/failure;
- timed quest expiry;
- time skip processing;
- shop refresh every 3 days;
- encounter selection;
- team limit = 6;
- seventh Pokémon replacement flow;
- Pokémon release;
- Trainer level caps;
- Pokémon level caps;
- XP loss at cap;
- class progression choices;
- permadeath;
- Career End state;
- save/reload consistency;
- World Championship repeat loop;
- persistent championship history;
- offline operation.

---

# 69. CURRENTLY TBD

The following are intentionally not yet fixed:

- exact Pokémon level caps by checkpoint;
- exact Trainer roster choices;
- exact Legendary mapping per Trainer;
- exact map graph;
- exact zone list;
- exact travel durations;
- exact encounter probabilities;
- exact shop catalogs/prices;
- exact faction list;
- exact quest catalog;
- exact scripted campaign checkpoint list;
- exact UI visual design;
- final art/graphics;
- final schema/file format.

These must be defined in later focused design passes.

---

# 70. FINAL CANON SUMMARY

The game is:

**Pokémon 5e rules + authored gamebook structure + Sorcery!-style node navigation + D&D-style GM narration + scripted Bethesda-like world triggers + persistent choices + real death + checkpoint-gated progression + repeatable World Championships + fully offline execution.**

The world may feel dynamic.

The content remains authored.

The rules remain Pokémon 5e.

The player always retains meaningful agency.

The engine must never require AI to make the game function.