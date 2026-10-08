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

**Historical audit status before the final 19-person overlay:** The code repository did not contain character PNG binaries; they remain distributed as a separate approved overlay (below). The client now supports character portraits when approved PNGs are locally installed. Passing the unit tests proves the gate logic works with disposable fixtures, **not** that character sprites are shipped. Before claiming Step 4 PASS: supply approved physical artwork and checksum pins, verify the installed release payload, wire only real available portraits into the relevant UI, run HTTP/offline and full gameplay regressions, and merge a follow-up PR with green checks. Do not mark the full sprite package as complete on the strength of Pokémon-only PRs #94/#98.


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

## Step 4 final Trainer native asset overlay (2026-10-08)

Provided by the user: `PSC_Sprite_32_Battle_Overworld_Nativi (1).zip`, the earlier approved 14-portrait overlay, and `pokeemerald-expansion-expansion-1.15.3-2.zip`. The first archive contains 30 identity-matched 64×64 battle PNGs and 29 matching nine-frame overworld strips; Lucinda and Kaia generic art is expressly quarantined, and Lance's native overworld has only three frames.

The **Librogame** uses only the 19 names from the locked NPC registry (not the whole unrelated PSC roster). The complete portable release overlay is distributed separately:

- `P5E_19_Character_Sprites_Offline_Complete.zip`
- SHA-256: `6269a74a9381c03941322dd8b8f16b3950ab199c62e488a7d5ed0324368754d9`
- 19 actual approved portraits, 19 64×64 battle front sprites, 19 overworld strips.
- **16** from specific matching source art: Five, Blue, N, Steven, Archie, Lance, Red, Cynthia, Astrid, Silas, Rei, Maxie.
- **3 clearly tagged neutral archetypes**: Kaia (generic competent female Trainer: FRLG Cool Trainer female battle / cooltrainer female overworld), Ranger Elio (Pokémon Ranger male battle, outdoorsman camper overworld), Sera Noll (Lady FRLG battle, woman_2 overworld). They are valid narrative stand-ins, not claims of canon-exact likeness; no sport-themed oddities, swimmers or tennis players.
- Overworld frames: 17 × 9, Kaia × 10, Lance × 3 stationary. **Do not animate Lance as walking**. No duplicated or fabricated frames.
- Explicit `native-sprites.json` with SHA-256 for every battle/overworld, plus `sha256.json` for 19 portraits. All PNGs decoded and all physical SHA hashes matched during archive preparation.

The repository intentionally keeps executable code and manifests in Git; this archive contains the **actual PNG binaries**, and must be extracted into the deployed application root:

```sh
# Run at Git checkout root; never extract into bookgame/ directly
unzip -q /path/to/P5E_19_Character_Sprites_Offline_Complete.zip -d .
npm --prefix bookgame run sprites:verify:characters
P5E_REQUIRE_OFFLINE_CHARACTERS=1 npm --prefix bookgame run ui
```

Run the original 619-Pokémon sprite gate as well when building the full offline release:
```sh
npm --prefix bookgame run sprites:verify
P5E_REQUIRE_OFFLINE_CHARACTERS=1 P5E_REQUIRE_OFFLINE_SPRITES=1 npm --prefix bookgame run ui
```

The verified local server accepts only `/characters/:id/portrait`, `/characters/:id/battleFront` and `/characters/:id/overworld` for approved mapped IDs; any absent/corrupt/unapproved physical sprite returns 404. The user interface shows known-character portraits and first overworld frame on the people panel, and the native Trainer battle sprite only if that Trainer is present in the current fight. No network fallback, random placeholder, or spoiler for unmet characters.

The **optional** `PSC_32_Trainer_Sprites_Reference_Complete.zip` (SHA-256 `c183fa904a736d6d9a6e8075652e96de3a1935bdf10153c4b836c7a1e5d971d5`) preserves the 32-person reference catalog but is **not** the 19-character canonical Librogame runtime map. Its Kaia/Lucinda entries are explicitly generic stand-ins.

**Release caveat:** these separately distributed binary PNGs do *not* automatically appear in the Git checkout, CI runner or a native mobile APK/IPA. Install and verify the actual packaged binary before claiming mobile release PASS. Packaging the whole offline gameplay app remains a separate release task.
