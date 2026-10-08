# Pokémon 5e Digital Bookgame

This directory is the separate **Digital Bookgame** project line.

The existing Pokémon 5e GM Agent remains unchanged on `main`.

Read first:

- [Engine Source of Truth](docs/P5E_LIBROGAME_ENGINE_SOURCE_OF_TRUTH.md)
- [12-module campaign plan](docs/P5E_LIBROGAME_12_MODULES_MASTER.md)
- [Node Spec v1](docs/NODE_SPEC_V1.md)

## Core promise

Start a new game and play a complete authored digital gamebook offline.

The local engine owns rules, rolls, combat, world state, branching and saves. AI support is optional and must never be required for the game to function.

## Offline story pipeline

Authored JSON scenes are validated and compiled locally:

    content/scenes/*.json
            ↓
    npm run validate:story
            ↓
    npm run compile:story
            ↓
    build/story.bundle.json

The compiler rejects broken node links and malformed choices/checks/combat handoffs before they can become release content.

Useful commands:

    npm --prefix bookgame run validate:story
    npm --prefix bookgame run compile:story
    npm --prefix bookgame test

A Story Builder Agent may assist content production later, but the compiler and tests remain the gatekeepers. The shipped runtime does not need the agent, an LLM, an API key, or an internet connection.

## Offline sprite assets

Before releasing the offline UI, install the [approved sprite package](assets/pokemon/SPRITE_BUNDLE.md), extract the self-contained overlay at the project root, and run `npm --prefix bookgame run sprites:verify`. The release server must use `P5E_REQUIRE_OFFLINE_SPRITES=1` to reject incomplete assets at startup. This does not create a native Android/iOS app.

## Offline soundtrack and sound effects

The client ships an **opt-in audio director** for intro, M01–M12, wild/trainer/boss/legendary/world-final battles, evolution, Pokémon cries, danger, success, and UI interaction. No copyrighted music or cries are checked into the repository. Without the optional audio pack it uses quiet, generated Web Audio cues; gameplay is unaffected when audio is off.

Install the *separately supplied* `P5E_AudioPack_Mobile_MP3.zip` on your own computer (do not publish it to GitHub):

```sh
npm --prefix bookgame run audio:import -- /path/to/P5E_AudioPack_Mobile_MP3.zip
npm --prefix bookgame run audio:verify
npm --prefix bookgame run ui
```

The installer validates every file against the pack's SHA-256 manifest, rejects unsafe ZIP members, and replaces the existing pack atomically. For an offline release requiring the full installed sound library, start with `P5E_REQUIRE_OFFLINE_AUDIO=1` (and your existing sprite asset gates). Smartphone playback requires a gesture; use **Attiva audio**, then control volume in **Menu → Impostazioni**. Music and effects remain muted until enabled and can be disabled at any time. 

For the widest compatibility with older iOS Safari versions use the MP3 pack. The previous OGG pack remains supported on browsers that can decode OGG Vorbis.

Source: supplied Pokémon World Tournament unofficial port OGG tracks and converted Pokéemerald MIDI/WAV samples. Converted MIDI instruments are approximations. Audio is for private use unless appropriate rights to distribute the recordings and derived assets have been confirmed.

### Built-in offline Pokémon sprite files

The canonical branch now carries **2,461 real Pokémon PNGs** from the pinned public source (619 species, 604 overworld). These are committed under `assets/pokemon/files/` and are copied into the Android embedded-runtime assets by `mobile/build.mjs`; no archive install and no online download are necessary for the mapped sprites. The user-approved verified overlay ZIP remains available only to reproduce the differing artwork of the 11 later supplemental species. See [provenance and population](assets/pokemon/EMBEDDED_SPRITES.md). An APK still needs the offline Trainer art, map and audio assets, plus a device test.
