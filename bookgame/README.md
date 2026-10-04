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
