# Step 4 — Secondary World entrants and functional NPC sprite coverage

**Branch target:** `bookgame-canonical`. Do not modify the locked 19-person NPC Character Library V1 or the 2060 World roster.

## Authoritative coverage

- 19 canonical named NPC assets are preserved under `assets/characters/files`.
- The **35** named competitors in `src/rules/world-roster-2060.mjs` include **17** of those 19; the supplementary catalog therefore covers the **18 remaining** World competitors.
- The supplementary catalog also defines **24** visually neutral, scene-scoped functional archetypes, with battle/front 64×64 and authentic 16×32 overworld frames. Different frame counts are stored per source, not fabricated.
- **36 scene+node-specific placements in 15 independently verified existing scene files**, across M01–M11. M12 reuses prior cast; no new named persistent NPCs are created.
- This does **not** assert that every incidental, unnamed person mentioned in all authored prose now has a separate displayed portrait. Those are intentionally *not* registered as new persistent NPCs or assigned art by guessing at text.

**Actual physical offline asset archive:** `P5E_NPC_Secondary_Functional_Offline.zip`, SHA-256
`f87e063447d9e79d5f1ba55ba1d1233250bcf7e4d2adb96aecb191dae0d9488a`.

The archive contains 84 PNG files, `bookgame/assets/npc-sprites/catalog.json` (SHA-256
`07c8339f149556e5b82dce2b68efa79688fe96f07ba6a8bf3db73bc4d29cbab3`),
and detailed physical asset audit information.

## World entrants added (18)

Campione di Borrius, Alder, Kael, Darian, Ferred, Ren, Ethan, Brendan,
Lucinda, Giovanni, Dandel / Leon, Rurik Dune, Ayame Hoshino, Orion Vale,
Nyx Vesper, Lucas, Ronan Ward, Soren Veyr.

- **Original Emerald identities where actually present:** Brendan and Giovanni.
- **Previously supplied name-labelled PSC sprites:** Campione di Borrius,
  Alder, Kael, Darian, Ferred, Ren, Ethan, Dandel / Leon, Rurik Dune,
  Ayame Hoshino, Orion Vale, Nyx Vesper.
- **Explicitly neutral, not canon-specific:** Lucinda, Lucas, Ronan Ward and Soren Veyr.
  Here the battle preview is extracted from the *same* overworld class when
  no convincing battle/overworld match exists. Those assignments do not claim
  official character likenesses.

## Approved functional role set (24)

`nurse`, `doctor`, `mart_clerk`, `receptionist`, `registrar`,
`ranger_m`, `ranger_f`, `worker_m`, `worker_f`, `technician`,
`security`, `referee`, `reporter_m`, `reporter_f`,
`trainer_m`, `trainer_f`, `rookie`, `guide`,
`harbor_official`, `researcher`, `field_staff`, `organizer`,
`vendor`, `trainer_staff`.

Some roles deliberately share a general Emerald archetype (e.g., clerks and
vendors); this avoids any need to invent unrelated NPC personalities. No
swimmer, triathlete, tennis/sports specialist, ninja, biker, cue ball,
aroma lady or other conspicuously off-theme trainer artwork is reused.

## Source-audit conclusions

- `pokeemerald-worped-ex-bc906dcc68ca722cd1769ead0f6d3030b1b1ceee.zip`:
  used for authentic Emerald battle fronts and overworld sprites. Indexed
  palette background color 0 is made transparent; pixel positions are
  preserved and scaling uses nearest-neighbour only.
- `PSC_32_Trainer_Sprites_Reference_Complete.zip`: reused where its
  labels identify World competitors from the canonical roster; existing
  19 NPCs remain untouched.
- `Pokemon World Tournament (Unofficial v21.1 Port).zip`: **no Trainer
  sprite files**, only PWT graphics, audio, scripted/plugin content.
  No false claim that PWT contains NPC battle or overworld portraits.

## Narrative safety

For real World battles the server resolves `opponentTrainerId` (e.g. a `c2060_XX_slug` ID) through `state.competition.world.field`; it does not assume the runtime ID equals the competitor name. This preserves correct identity for both the existing 19 named sprites and the 18 supplemental entries.

Only explicitly matched existing scene+node slots display functional
overworld sprites (at most two). No keyword-driven guessed actor assignment,
new location, new persistent NPC, changed dialogue, event, level, encounter or
competition rule. World sprites appear in battles only for a matched known
World opponent, and in the people panel only after the person is known in
the read-only game state. Missing or bad assets must return 404, not substitutes
or remote URLs.

## Offline installation and testing

Place the approved ZIP locally (no network runtime fetch). From the checkout root:

```sh
python3 bookgame/scripts/install-secondary-npc-overlay.py --zip /absolute/path/to/P5E_NPC_Secondary_Functional_Offline.zip
npm --prefix bookgame run sprites:verify:npc-secondary
```

For an Android debug build, install the separate 619-Pokémon pack first,
then pass `P5E_TRAINER_OVERLAY_ZIP` and `P5E_NPC_SECONDARY_OVERLAY_ZIP`
to `npm run android:debug` in `bookgame/mobile/`.
The copied offline app payload is re-verified before publishing dist.
The ZIP is not committed to source Git. A shell-only APK/CI passing
does not itself prove a complete playable airplane-mode release.
