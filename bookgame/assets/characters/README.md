# Offline sprites for named Trainers / characters — audit gate

This is separate from the Pokémon bundle of 619 species. Character IDs come from the locked `content/npcs/NPC_CHARACTER_LIBRARY_V1.json`, not an invented or duplicated cast list: 5 Five, 11 non-null module Anchors M01–M11, and 3 verified additional named characters = **19**. M12 has no new Anchor. Functional unnamed NPCs are not implicitly promoted.

Expected approved portrait layout:
```
bookgame/assets/characters/files/<canonicalCharacterId>/portrait.png
```

An **approved** `bookgame/assets/characters/sha256.json` must pin all 19 exact relative paths using the format:
```json
{ "schemaVersion": 1, "files": { "Luke/portrait.png": "<real SHA-256 hex>", "...": "..." } }
```
The above is a schema example, not approved checksums. Do not invent checksums or substitute Pokémon images, temporary placeholders, unrelated artwork or remote URLs.

To check physical assets (from the repo root):
```sh
node bookgame/scripts/verify-offline-character-sprites.mjs --dir /path/to/characters/files --checksums /path/to/approved/sha256.json
```
The audit exits nonzero on missing/corrupt PNGs, unapproved/mismatching SHA-256, unsafe IDs or unexpected pinned paths. It is offline-only and does not modify the canonical character registry.

**Current release status: BLOCKED.** This repository contains neither approved 19-character PNGs nor their authorized checksum inventory. The current local web UI displays Pokémon images, **not character portraits**. Passing the unit tests proves the gate logic works with disposable fixtures, **not** that character sprites are shipped. Before claiming Step 4 PASS: supply approved physical artwork and checksum pins, verify the installed release payload, wire only real available portraits into the relevant UI, run HTTP/offline and full gameplay regressions, and merge a follow-up PR with green checks. Do not mark the full sprite package as complete on the strength of Pokémon-only PRs #94/#98.
