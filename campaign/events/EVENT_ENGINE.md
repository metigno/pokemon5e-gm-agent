# Event Director — Long Campaign Runtime

## Goal

The campaign should feel like a tabletop RPG inside a living Pokémon world rather than a linear visual novel.

The player can explore, catch Pokémon, refuse quests, lose, retreat, change plans and invent solutions.

At the same time, the world contains scripted anchors. Some events happen because the world reaches them, not because the player selected the correct quest marker.

`FREE PLAY → TRIGGER CHECK → EVENT → FREE RESOLUTION → CONSEQUENCE → CHECKPOINT → FREE PLAY`

## Event classes

### HARD_ANCHOR
The event itself must enter the fiction once its trigger becomes valid, but the player's response and the outcome remain free.

Examples: the shared intro, mandatory rules milestones, tournament deadlines, the World draw after qualification.

A HARD_ANCHOR never teleports or mind-controls the player. It enters naturally at the next safe transition unless it is an emergency.

### SOFT_ANCHOR
A major opportunity that actively seeks the player but can be refused, delayed or missed.

### WORLD_EVENT
Happens on the world clock even when the player is elsewhere.

The player may witness it, hear about it later, arrive too late, or never interact with it.

### CHARACTER_CHAIN
Belongs to a persistent NPC/friend and can advance off-screen.

### COMPETITIVE_GATE
Registration, badge, cup, qualifier, ranking cutoff or tournament event. Actual results decide progression.

### SYSTEM_MILESTONE
A Pokémon 5e class-level milestone.

## Trigger model

Events may depend on:
- Trainer Level;
- party/Pokémon state;
- completed event IDs;
- campaign flags;
- badges;
- circuit/ranking points;
- world day;
- location tags;
- living/dead/injured NPC state;
- friend chain state;
- tournament qualification;
- item/clue possession.

Triggers may use AND and OR groups.

## Lifecycle

`LOCKED → ELIGIBLE → QUEUED → ACTIVE → RESOLVED / FAILED / EXPIRED`

Failure and expiration are valid story states.

## Trigger checks

Evaluate after:
1. long rest / new day;
2. important-location arrival;
3. Trainer Level increase;
4. badge or official competition result;
5. chain completion/failure;
6. major capture/evolution/death/injury;
7. multi-day travel;
8. durable checkpoint.

Do not interrupt every minor scene. Queue anchors for natural transitions unless the event is explicitly urgent.

## Bethesda rule — the world does not wait

WORLD_EVENTs and deadlines progress without the player.

Examples:
- a friend competes while the player is elsewhere;
- registration closes;
- a crisis worsens;
- a route reopens;
- an NPC leaves;
- an antagonist moves resources;
- an NPC legendary trajectory advances off-screen.

The player learns only what they could legitimately know.

## Player agency boundary

Script:
- external events;
- NPC choices;
- deadlines;
- consequences caused by previous state.

Never script:
- player dialogue;
- player emotions;
- tactical choices;
- trust;
- accepting optional quests;
- sacrifice decisions;
- die results.

If a scripted friend beat belongs to the selected protagonist, replace that trainer's scripted response with an open player-action prompt.

## Difficulty

Do not auto-scale every encounter.

The world may contain threats that are too strong, weak opponents, NPCs who outgrow the player, and NPCs who fall behind.

Signal extreme danger when a reasonable trainer would recognize it.

## NPC progression

The four unselected friends progress independently.

Their 2060 Character Bible profiles are long-term personality/trajectory references, not current power.

Off-screen results are honest. Death, injury or campaign divergence may permanently change their expected future.

## Quest markers

Never show internal event IDs or hidden trigger conditions to the player.

Only expose objectives that the character has actually learned about.
