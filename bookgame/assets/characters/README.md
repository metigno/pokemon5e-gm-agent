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


To atomically install a supplied *approved* package (the importer preflights **every image** before touching the destination):

```sh
node bookgame/scripts/install-offline-character-sprites.mjs --from /path/to/approved/source --to bookgame/assets/characters/files --checksums /path/to/approved/sha256.json
```

Destination must not exist. An incomplete archive, bad image or missing SHA pin aborts the installation without writing a partial output. No network access or placeholder generation occurs.

## User-supplied art audit — 2026-10-08

Inputs: `spriteroster.zip` (26 composite trainer sprite reference boards) and `roster.zip` (25 illustrated trainer cards). Both archives were read, image-decoded and ZIP-integrity checked.

A separately delivered **partial** offline overlay (`P5E_14_Character_Portraits_Partial_Offline.zip`, SHA-256 `6ff69e39c12733c1a0beb2965f3a93abf1e6446befc28180d456afcc48d0bd9f`) contains 14 approved, individually cropped and optimized portrait PNGs plus this repository's pinned `sha256.json` and detailed provenance metadata.

- Spriteroster-derived portraits: Luke, Edward, Mattew, Daniel, Fab, Cynthia, Archie, N, Rei, AstridVahl, Maxie, SilasCrowe.
- Trainer-card-derived illustrations: KaiaSolari, Lance.
- **Missing from the 19 canonical named characters:** Blue, Steven, Red, ElioMar and SeraNoll. Do not substitute another character or create a placeholder.
- The supplied images are rendered composite previews, not original 64×64 battle sprites or true independent 16×32 overworld frames. Their extracted artwork is available as **portraits only**. Do not claim full walking sprite animation coverage from these files.

Unpack at the repository root in development:

```sh
unzip -q /path/to/P5E_14_Character_Portraits_Partial_Offline.zip -d .
```

The UI serves `/characters/<canonical-id>/portrait` **only** when its locally installed PNG is valid and matches the pinned SHA-256. The discovered-people panel only renders available character art; missing portraits remain text-only without a broken image or network fallback. The original Pokémon sprite route remains unchanged.

To audit this partial install:

```sh
node bookgame/scripts/verify-offline-character-sprites.mjs
```

That command must return **nonzero** until all 19 are actually supplied: currently the expected honest result is **14 verified / 5 missing**, never a false PASS.

For a release candidate, set `P5E_REQUIRE_OFFLINE_CHARACTERS=1` as well as the existing Pokémon sprite release guard, and ensure all 19 are physically supplied with approved matching checksums. A separate ZIP in a conversation is **not** a binary embedded in a Git checkout or a native mobile app. Complete that packaging and verify offline HTTP behavior before declaring Step 4 done.
