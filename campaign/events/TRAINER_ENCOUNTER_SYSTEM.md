# TRAINER ENCOUNTER & PROGRESSION SYSTEM

## Purpose

Asteria must feel populated by real trainers, not by isolated boss fights.

Main quests, side quests, roads, towns, tournaments, jobs and faction problems may all contain trainers with their own teams, goals, schedules and consequences.

This system is authoritative for deciding **which version of a trainer and team can exist at a given point in the campaign**.

## Pokémon 5e balance rule

Do **not** convert Pokémon Species Rating (SR) into D&D Challenge Rating (CR).

Pokémon 5e encounter guidance explicitly treats SR and CR as different concepts and recommends balancing Pokémon encounters primarily through **Pokémon levels**.

For trainer encounters, use:

1. current Trainer Level;
2. current Pokémon levels;
3. number of active/available Pokémon;
4. Trainer Path and specializations;
5. feats/TMs/stat boosts actually earned;
6. battle format and terrain;
7. tactical competence;
8. persistent injuries/resources/world state.

"Quest CR" in campaign planning therefore means **encounter difficulty band**, not a fabricated CR value.

## Difficulty bands

Relative to the player Trainer Level (PTL):

- ROUTINE: opposing trainer TL = PTL-2 to PTL-1, never below 1.
- STANDARD: opposing trainer TL = PTL-1 to PTL+1.
- HARD: opposing trainer TL = PTL to PTL+2.
- ELITE: opposing trainer TL = PTL+1 to PTL+3.
- STORY_THREAT: may exceed that range, but the fiction must clearly communicate the danger and retreat/refusal must remain possible unless circumstances prevent it.

Pokémon levels should normally cluster around the trainer's current legal progression. Same-level Pokémon are the default balance reference. A signature ace may sit near the top of the encounter's intended level band; do not inflate every team member equally.

## Team size by campaign stage

These are encounter-building defaults, not ownership caps:

- Trainer Lv 1-2: usually 1-2 battle-ready Pokémon.
- Lv 3-4: usually 2-3.
- Lv 5-8: usually 3-4.
- Lv 9-12: usually 4.
- Lv 13-16: usually 4-5.
- Lv 17-20: usually 5-6.

Official formats may register fewer Pokémon. Veteran trainers can own more Pokémon than they bring.

## Persistent trainer rule

NPC trainers are persistent people.

Once a named trainer is instantiated in a save:
- store their Trainer Level, Path, known team, known evolutions, injuries, resources and important results;
- they may progress off-screen when sufficient campaign time and opportunity pass;
- they never de-level because the player meets them again;
- a fainted/dead/lost Pokémon does not silently reappear;
- a revealed evolution never reverses.

Generic trainers can be generated from a role template, but if one becomes narratively important, promote them to persistent state.

## Named roster characters

Use `canon/ROSTER2060_CHARACTER_BIBLE.json` for identity, personality, tactical style and long-term roster destinations.

The 2060 ace/team entries are **future trajectory targets**, not permission to spawn final forms early.

When a roster NPC appears before their mature career stage, resolve their current team in this order:

1. Determine whether this is their genuine current career team or a regulated exhibition/official roster.
2. Read the future target species/form.
3. Verify the actual Pokémon 5e evolution chain and requirements.
4. Walk backward to the strongest form the Pokémon could legally have reached by this NPC's current history, level, resources and story opportunities.
5. Remove future mechanics that have not been earned: Mega Evolution, Gigamax/Dynamax access, Alpha status, special items, legendary ownership, rare tutors/TMs, etc.
6. Fill remaining roster slots with plausible Pokémon from the NPC's established identity, origin, prior catches and Asteria ecology.
7. Persist the result. Later growth must proceed from that state rather than regenerating a new scaled team.

### Example: Lucas / Torterra

If Lucas is encountered while his career is still in an early quest band, his future Torterra does not justify spawning a Torterra automatically.

The same partner can appear as the appropriate earlier evolutionary stage if the real Pokémon 5e requirements support it, then evolve later through actual campaign progression.

### Example: Campione di Borrius / Shiny Mega Metagross

The mature target is Shiny Mega Metagross.

An early-career version can instead possess the same individual earlier in the Beldum evolutionary line if that is chronologically and mechanically legal. Shiny status may remain if it identifies the same individual; Mega Evolution is a separate late unlock and is never granted just because the future target contains "Mega".

## Established veterans encountered early

Do not make an already-established champion nonsensically forget experience or physically de-evolve a known partner simply to match the player.

If a famous veteran appears during a low-level quest, choose one of these:

- SOCIAL: they are present but not a combat opponent.
- MENTOR: they use a teaching team or limited roster.
- REGULATED: the event specifies a legal challenge roster appropriate to the division.
- OVERMATCH: their actual team is much stronger and the fiction communicates that clearly.

Only use an earlier evolutionary snapshot when the campaign chronology actually places that NPC earlier in their career.

## Trainer construction

For every trainer who can battle, record at minimum:

- trainer_id / persistent identity if named;
- Trainer Level;
- Trainer Path when level permits;
- relevant Specializations;
- Pokémon list with actual levels and evolution state;
- legal moves/feats/TMs/items;
- battle format;
- motivation;
- surrender/withdrawal behavior;
- tactical profile;
- reward/consequence;
- whether the encounter is official, informal, criminal or lethal.

Use the current Pokémon 5e rules for exact mechanics.

## Main quest population

`MAIN_EVENT_GRAPH.json` includes `trainer_content` on each event.

Interpret it as a minimum dramatic population target, not a requirement that every trainer must fight.

A trainer may function as:
- opponent;
- rival;
- witness;
- mentor;
- teammate;
- official;
- suspect;
- ranger;
- criminal;
- researcher;
- challenger;
- tournament participant.

## Side quests

Use `SIDE_QUEST_GRAPH.json`.

Side quests are optional and may expire, transform or resolve off-screen.

They must not exist only as combat delivery systems. Every trainer should have a reason to be there and may negotiate, flee, refuse, surrender, help or return later.

## Roster appearance frequency

Named roster characters are valuable continuity assets, so do not spam them.

- Acts 1-2: rare cameo only when geography/career logic fits.
- Acts 3-4: occasional named intersections; Act 4 guarantees at least one wider-world name.
- Acts 5-6: regular interregional intersections.
- Act 7: many elite/named competitors may converge.
- Act 8: World field comes from actual qualification state.

A named appearance never guarantees a battle.

## No invisible rubber banding

The world does not continuously rescale every NPC to the player.

Quest bands determine who is appropriate to place in that content.

Persistent NPCs keep their earned state. If the player enters content too early, too late, or after unusual progression, the encounter can become easier or harder.