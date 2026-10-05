# P5E LIBROGAME — NARRATIVE BIBLE V1

**Status:** NARRATIVE PRODUCTION STANDARD  
**Scope:** M01–M12 authored story content  
**Project:** Pokémon 5e Digital Bookgame / Librogame5e  
**Branch family:** `pokemon5e-digital-bookgame`  
**Purpose:** define the player-facing narrative language used by scenes, stitches, dialogue and choices without changing engine authority.

---

# 0. AUTHORITY

This document governs presentation, not rules.

Authority order remains:

1. `P5E_LIBROGAME_ENGINE_SOURCE_OF_TRUTH.md`
2. `P5E_LIBROGAME_12_MODULES_MASTER.md`
3. module design / production mapping
4. `NODE_SPEC_V1.md`
5. `campaign/GM_NARRATION_STYLE.md`
6. this Narrative Bible

If a narrative line conflicts with rules/state, the narrative line is wrong.

The local engine owns truth. Prose renders truth.

---

# 1. CORE NARRATIVE PROMISE

The player should feel that Asteria exists before, during and after their presence.

The game is not a menu wrapped in flavor text and not a novel that occasionally asks for input.

The target experience is:

**WORLD → PLAYER DECISION → HONEST MECHANICS → VISIBLE CONSEQUENCE → WORLD CONTINUES**

Every authored scene should make at least one of these feel real:

- place;
- character;
- ecology;
- time;
- risk;
- relationship;
- competition;
- consequence;
- continuity.

---

# 2. POINT OF VIEW

## 2.1 Default POV

Player-facing narration uses:

- **second person singular**;
- **present tense**;
- external / observable viewpoint;
- no omniscient access to NPC thoughts unless the player has legitimately learned them.

Preferred:

> Il vento spinge polvere chiara oltre il bordo della strada. Più avanti, qualcosa si muove nell'erba alta e si ferma quando il tuo Pokémon alza la testa.

Avoid:

> Sai che quello Shinx è spaventato e vuole soltanto essere lasciato in pace.

Until a check or clear behavior establishes it.

## 2.2 Player interiority

Never dictate:

- thoughts;
- emotions;
- moral judgment;
- attraction;
- fear;
- confidence;
- intent;
- spoken dialogue.

Avoid:

> Ti senti in colpa.

Prefer:

> L'operaio guarda il recinto rotto, poi la Poké Ball alla tua cintura. Non aggiunge altro.

The player decides what that means emotionally.

## 2.3 Player knowledge boundary

Narration may state:

- what is visible;
- what is audible;
- what is physically experienced;
- what the player already knows;
- what a successful check legitimately reveals;
- what an NPC explicitly communicates.

Narration may not reveal:

- hidden flags;
- future events;
- internal selector logic;
- NPC private schedule state;
- encounter rarity labels;
- hidden DC;
- hidden hostility state;
- off-screen results the player has no diegetic way to know.

---

# 3. FICTION → MECHANICS → FICTION

This rule is mandatory.

## 3.1 Checks

Before the roll:

> Dietro il rumore dell'acqua c'è un secondo suono, più secco e irregolare.

Visible mechanical panel:

**d20+7 = 18**

After the roll:

> Lo riconosci quando si ripete: artigli su lamiera, dall'altro lato del magazzino.

Do not write:

> Perception check passed. DC 15. Flag clue_found=true.

## 3.2 Failure

Failure must remain fictionally real.

A failed check can produce:

- incomplete information;
- lost time;
- worse position;
- an NPC becoming less cooperative;
- a missed opportunity;
- attention drawn;
- uncertainty that remains unresolved.

It must not secretly become success because the plot needs the clue.

## 3.3 Combat handoff

Player-facing prose must never say:

- “la scena passa al resolver”;
- “il resolver decide”;
- “la narrazione non determina il risultato”;
- “opponentRegistered=true”;
- “stato persistente del roster”.

The UI may transition to battle, but the scene ends diegetically.

Preferred:

> Blue arretra di due passi e lascia libero il centro del campo. Squirtle si abbassa sulle zampe, già concentrato su di te.

Then battle starts.

After the battle, narration reacts to the actual result.

## 3.4 Mechanical honesty

Narrative flavor may never:

- add damage;
- cancel damage;
- heal;
- move combatants illegally;
- add conditions;
- force captures;
- alter PP;
- change action economy;
- change encounter legality;
- imply a different winner than the engine produced.

---

# 4. NARRATOR VOICE

The narrator is:

- concrete;
- observant;
- restrained;
- vivid when the moment earns it;
- never sarcastic toward the player;
- never a tutorial voice disguised as prose.

The narrator notices physical detail before abstract explanation.

Prefer:

> Il cartello nuovo è stato fissato sopra uno più vecchio. Dietro la rete arancione, il fossato è quasi asciutto e una fila di impronte segue il bordo invece di attraversarlo.

Avoid:

> I recenti lavori hanno modificato il pathfinding della fauna locale.

## 4.1 Sentence rhythm

Default scene rhythm:

- one anchoring image;
- one meaningful action or change;
- one implication / opening for the player.

Routine nodes: usually 1–3 short paragraphs.

Important character beats: 2–5 short paragraphs.

Major climaxes: may expand, but every paragraph must earn its place.

## 4.2 Description density

Do not describe everything.

Choose details that answer at least one question:

- Where am I?
- What changed?
- Who is here?
- What might matter?
- What is dangerous?
- What does this character reveal?
- What can I act on?

---

# 5. DIEGETIC LANGUAGE ONLY

Player-facing text must not expose implementation vocabulary.

## Forbidden in normal narrative

- flag;
- variable;
- state machine;
- state persisted/persistent;
- node;
- stitch;
- branch;
- selector;
- trigger;
- callback;
- resolver;
- registered opponent;
- encounter ID;
- off-screen update;
- schedule as a database term;
- module;
- gate as an internal system term;
- boss fight;
- scripted winner;
- replay/idempotence;
- “world state”.

These concepts can exist in docs/tests, not in the player's prose.

## Translate into world language

Instead of:

> La sua schedule è traveling.

Write:

> Fab è già partito con una squadra di ranger verso l'alto fiume e non rientrerà prima di alcuni giorni.

Instead of:

> Il mondo ha risolto il job off-screen.

Write:

> Quando torni alla bacheca, l'incarico non c'è più. Sera ti dice che una squadra del porto lo ha preso ieri mattina.

Instead of:

> Il risultato resta persistente.

Write:

> La sconfitta resta registrata nel tuo storico del Circuito.

---

# 6. DIALOGUE STANDARD

NPCs speak as people with goals, not as lore dispensers.

Every dialogue line should do at least one of:

- pursue an NPC goal;
- reveal character;
- react to prior player behavior;
- communicate useful information;
- create friction;
- create warmth;
- change the relationship;
- establish a future callback.

Avoid dialogue whose only purpose is to explain game systems.

## 6.1 Exposition

Break information into:

- what this NPC personally knows;
- what they care enough to say now;
- what the player asked;
- what the situation makes relevant.

An NPC should not deliver a wiki paragraph because the author needs the player informed.

## 6.2 Subtext

Important NPCs should not state every motive.

Blue can communicate respect by becoming more precise, not by saying:

> “I respect you now.”

A ranger can distrust the player's handling by asking a sharper follow-up rather than exposing a relationship score.

## 6.3 Dialogue length

Routine NPC: 1–3 lines per exchange.

Important beat: longer exchanges allowed, but player agency should return regularly.

Do not build five-paragraph NPC monologues unless the moment explicitly requires one.

---

# 7. PLAYER CHOICES

Choice labels are part of the writing.

Default:

- first person;
- present tense;
- concrete action or spoken line;
- usually 3–12 words;
- no hidden system language;
- no moral labels.

Preferred:

- “Gli lascio spazio e osservo.”
- “Chiedo chi ha chiuso il passaggio.”
- “Accetto lo sparring.”
- “Per ora me ne vado.”
- “«Vediamo sul campo.»”

Avoid:

- “Paragon option.”
- “Aggressive choice.”
- “Increase relationship.”
- “Continue.”
- “Select investigation branch.”

## 7.1 Spoken choices

If the choice commits the protagonist to exact dialogue, show the exact line in quotation marks.

If the choice only commits to an intent, describe the intent and let the authored response avoid pretending the protagonist said words the player never chose.

## 7.2 Choice quality

A production-quality choice should change at least one:

- route;
- information;
- time;
- risk;
- relationship;
- access;
- encounter;
- quest/world consequence;
- roleplay expression with later callback.

Two choices that produce the same immediate result can both exist only if their experiential or later callback meaning differs.

## 7.3 No “correct personality”

Do not reduce choices to:

- nice;
- neutral;
- mean.

Offer different priorities:

- cautious;
- competitive;
- curious;
- practical;
- protective;
- impatient;
- analytical;
- direct.

No personality should be universally rewarded.

---

# 8. NPC CONTINUITY

NPCs remember what their state says they can remember.

Future dialogue should acknowledge, when relevant:

- first meeting context;
- prior win/loss;
- help refused or accepted;
- unresolved tension;
- prior information shared;
- important Pokémon encounters;
- rank progression;
- injuries/results visible to them.

Do not force callbacks into every conversation.

A callback is strongest when it changes what a character says or does, not when the narrator announces that the flag was remembered.

---

# 9. THE FIVE AS AUTONOMOUS PEOPLE

When one of the Five is the player, the other four are not companions waiting for orders.

Narrative must show them:

- choosing work;
- traveling;
- training;
- losing;
- winning;
- missing opportunities;
- meeting people without the player;
- changing plans.

Do not describe this with system language.

Their independence should be learned through:

- messages;
- physical absence;
- arena boards;
- news;
- direct reunions;
- NPC reports;
- visible team changes.

The game must never imply that the player receives credit for another friend's work.

---

# 10. WILD POKÉMON

Wild Pokémon are fauna first.

Describe:

- posture;
- distance;
- group structure;
- feeding;
- warning behavior;
- escape routes;
- territory;
- young;
- injury;
- curiosity;
- environmental pressure.

Do not expose hidden labels such as:

- hostile;
- Alpha;
- lethal;
- prey;
- rare;
- encounter tier.

unless discovered diegetically.

## 10.1 No forced videogame framing

Do not open with:

> Fight / Capture / Run?

Describe the encounter. Then offer actions appropriate to the fiction.

## 10.2 Capture

A Pokémon being calm, curious or defeated does not equal automatic capture.

Narration must reflect the actual capture mechanic result.

## 10.3 Defeat

Avoid moralizing every wild battle.

Consequences come from context, law, ecology and behavior, not from an authorial “good/bad” meter.

---

# 11. LIVING WORLD PRESENTATION

World progression should be visible through consequences.

Good examples:

- a job disappears from a board;
- construction barriers move;
- a friend is no longer in town;
- an NPC references yesterday's match;
- a shopkeeper mentions a delivery delay;
- ranger presence increases;
- an animal route changes.

Avoid narrator lines like:

> The world progressed while you were away.

The player should see the evidence.

---

# 12. TIME

Time passage is concrete.

Use:

- changing light;
- opening/closing activity;
- traffic;
- meal periods;
- weather;
- exhausted workers;
- arena schedules;
- transit departures.

When exact time matters, UI may show it.

Narration should not repeat clock data unless it affects the scene.

---

# 13. COMPETITION

Competition scenes need identity beyond “battle starts”.

Before a meaningful match establish:

- venue;
- opponent;
- stakes;
- legal format;
- one human detail.

Afterward:

- honor the actual result;
- let NPC reactions fit personality;
- preserve consequences;
- avoid treating a loss as non-canon.

Promotion Trial losses are part of the career.

A retry is not a narrative reset.

---

# 14. LOCATIONS

Each major location needs a narrative fingerprint.

## Campus Licenze
Order, newness, institutional structure, people still moving in groups.

## Via delle Ginestre
Open road, changing edges between managed land and wild routes, first sense of independence.

## Valedarsena
Water, logistics, movement, boards, warehouses, rookie competition, people with places to be.

## Fattoria del Vento
Open exposure, fences, animals, labor, distance from city rhythm.

Later modules must define equivalent fingerprints before screenplay integration.

---

# 15. PACING TIERS

## Tier A — Utility
Travel confirmation, routine service, simple return.
Very concise.

## Tier B — Standard scene
Normal exploration, ordinary NPC, common wild encounter.
1–3 compact paragraphs.

## Tier C — Character / consequence
Friend beat, Blue, meaningful investigation, aftermath.
Richer detail and callbacks.

## Tier D — Major event
Trial, qualification, World stage, major revelation.
Cinematic but still interactive.

Never write Tier D prose for every doorway.

---

# 16. HUMOR

Humor should come from:

- personality;
- timing;
- awkward situations;
- relationships;
- Pokémon behavior.

Avoid:

- meme dialogue;
- constant quipping;
- narrator mockery;
- references that break the world;
- jokes that erase dramatic consequences.

---

# 17. VIOLENCE / DANGER

Describe danger clearly enough for informed choice.

Do not sensationalize ordinary Pokémon combat.

When a situation can seriously injure a human or Pokémon, signal the danger through fiction before commitment when the character could reasonably perceive it.

Do not make wild Pokémon harmless by default. Do not make them monsters by default.

---

# 18. INFORMATION GRADIENT

Separate:

1. **observable fact**
2. **reasonable inference**
3. **verified explanation**

Example M1 ecology:

Observable:
> Fresh tracks avoid the new fencing.

Inference after evidence:
> The animals may be changing routes.

Verified later:
> Multiple maintenance zones have narrowed several habitual passages at once.

Do not reveal step 3 in the opening description.

---

# 19. AUTHORING VARIANTS

Narrative variants are valuable when state changes meaning.

Prioritize variants for:

- NPC relationship;
- prior result;
- prior help/refusal;
- rank;
- known clues;
- relevant Pokémon presence;
- injury/condition visible in scene;
- time of day;
- unresolved world event.

Do not create variants for trivial data that produces no meaningful difference.

---

# 20. M1 SPECIFIC TONE

M1 theme:

**“Adesso nessuno ti dice più cosa devi fare.”**

Therefore M1 prose should emphasize:

- open space;
- multiple plausible priorities;
- ordinary people working;
- rookie uncertainty without incompetence;
- small consequences that matter;
- friends beginning to separate;
- the first evidence that the world will not wait.

M1 must not feel like:

- a chosen-one opening;
- a villain hunt;
- a tutorial checklist;
- a corridor to Blue;
- a corridor to the Trial.

---

# 21. NARRATIVE QA GATE

A scene is not narrative-complete until all answers are YES.

## POV
- Does it stay in second-person present?
- Does it avoid dictating player emotion/thought?
- Does it avoid omniscient NPC knowledge?

## Mechanics
- Does prose respect actual state?
- Are hidden DC/internal flags absent?
- Are checks presented fiction → mechanics → fiction?
- Does combat enter/return without resolver/debug language?

## Dialogue
- Does each important NPC sound distinct?
- Is exposition motivated?
- Does dialogue react correctly to prior state?

## Choices
- Are choices clear and diegetic?
- Are exact spoken lines only used when selected?
- Are there no fake moral labels?
- Does each choice have experiential or state meaning?

## World
- Does the world continue independently?
- Are off-screen changes shown through diegetic evidence?
- Are wild Pokémon treated as living creatures?

## Style
- Is implementation language absent?
- Is prose concise enough for the importance tier?
- Does each stitch earn its place?

---

# 22. PRODUCTION WORKFLOW

For every block:

1. lock gameplay contract;
2. read all reachable state variants;
3. define narrative purpose;
4. define scene beat sheet;
5. rewrite player-facing stitches;
6. rewrite choice labels;
7. add only meaningful narrative variants;
8. preserve all mechanics/effects/gotos;
9. run regression tests;
10. run narrative QA.

Narrative integration must not casually edit:

- conditions;
- effects;
- encounter definitions;
- DC;
- battle roster;
- time costs;
- state ownership;
- module exit contracts.

If prose exposes a mechanical design problem, log the issue separately instead of silently “fixing” logic during the writing pass.

---

# 23. GOLDEN RULE

**The engine may know everything. The player should only experience what their character can actually perceive, learn, choose and cause.**
