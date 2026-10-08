# Approved Pokémon sprite bundle

Bundle: `P5E_M01-M12_EmeraldExpansion_Sprites.zip`

- SHA-256: `61d97f4109cc976930c26a72c19aa15ebf5b8e0cb687297838d8d3af1223e3b8`
- Size: 3,280,439 bytes
- Approved non-Gigantamax sprite directories: 608
- Gigantamax content: excluded from Pokémon 5e runtime
- Runtime mapping authority: `bookgame/assets/pokemon/sprite-runtime-map.json`
- Installer: `npm run sprites:import -- <extracted-package-dir>`

The bundle is intentionally not represented as complete coverage. The approved package does not contain physical sprite directories for:

- Slowpoke
- Mimikyu
- Riolu
- Noctowl
- Crobat
- Scizor
- Starmie
- Donphan
- Snorlax
- Gyarados
- Lucario

Do not substitute placeholder, unrelated, or Gigantamax art for these entries. Add missing assets only from an approved source, then rerun the canonical importer in strict mode.

## Offline installation

With the approved ZIP available locally and Python 3 + Node.js installed, run from the repository root:

```sh
python3 bookgame/scripts/install-approved-sprite-zip.py /path/to/P5E_M01-M12_EmeraldExpansion_Sprites.zip
```

The installer verifies the pinned SHA-256, rejects unsafe ZIP paths, extracts to a temporary directory, and delegates to the existing canonical importer. The archive itself is **not** committed to this repository. The approved archive is incomplete for 11 mapped species, so `--strict` intentionally fails without copying until those assets are supplied.

## Completed 619-species approved bundle

The original archive is retained for provenance. The separately prepared complete archive combines it with the user-provided 11-species/33-sprite supplement without overwriting existing files:

- File: `P5E_M01-M12_619_Pokemon_Complete_Sprites.zip`
- SHA-256: `282212aef3a5eda96dcc6bd32e93583aae477689ed7402fd0f6fa646767330e0`
- Size: 3,202,604 bytes
- Species directories: 619
- PNG entries: 3,356
- Gigantamax: excluded

To install the completed bundle with mandatory asset checks:

```sh
python3 bookgame/scripts/install-approved-sprite-zip.py /path/to/P5E_M01-M12_619_Pokemon_Complete_Sprites.zip --strict
```

The ZIP is distributed separately; it is not embedded in Git. The original 11-species gap documented above applies only to the *original* 608-species archive. The full runtime mapping and strict importer remain authoritative for end-to-end coverage.

## Verified complete offline package (619)

The verified rebuild uses the **original approved 608 non-Gigantamax species** and the two user-supplied 7- and 4-species supplements. It excludes the original `gmax-charizard` directory and renames the supplements' `front.png` entries to the **canonical** `anim_front.png` paths without altering image bytes. No changes to `sprite-runtime-map.json` or gameplay are needed.

- Package: `P5E_M01-M12_619_Pokemon_Complete_Sprites_verified.zip`
- SHA-256: `6dbb206fb3deafcd9f4524e27d52f88110623f38f8eb0551bd11d2b1ef69954d`
- Bytes: 3,202,282; 619 mapped species; 3,356 PNG files
- Required runtime assets: **1,857** battle front/back/icons plus **604** mapped overworld PNGs = **2,461** local image files
- All PNG signatures and image decoding verified during reconstruction; ZIP integrity verified; no Gigantamax sprites or substituted placeholders
- Strict import and physical offline verification passed on the verified package

Install from repository root (ZIP distributed separately):

```sh
python3 bookgame/scripts/install-approved-sprite-zip.py /path/to/P5E_M01-M12_619_Pokemon_Complete_Sprites_verified.zip --strict
npm --prefix bookgame run sprites:verify
```

**Release gate:** the application must ship with the installed `bookgame/assets/pokemon/files/` tree (or set `P5E_SPRITE_DIR` to a bundled offline directory). Run `sprites:verify` in the actual packaged deployment before release; a passing manifest-only test without the physical PNG files does **not** establish offline readiness. The binary ZIP is not stored in Git.

## Self-contained offline release overlay

The verified 619-species ZIP is also available as a **pre-arranged sprite overlay** (`P5E_Bookgame_619_Sprites_Offline_Ready.zip`; SHA-256 `118d9692c7593318e998de4a06a839e15ac98b754f708aad1f7fa5076de2ef1a`). Extract this overlay **at the Git checkout root**, not within `bookgame/`. The archive already contains the exact `bookgame/assets/pokemon/files/<species>/<asset>.png` layout used by the local sprite server. It contains 3,356 PNGs; 2,461 files are directly used by the current runtime mapping.

To reproduce the overlay from the approved verified bundle:

```sh
npm --prefix bookgame run sprites:package -- /path/to/P5E_M01-M12_619_Pokemon_Complete_Sprites_verified.zip /path/to/P5E_Bookgame_619_Sprites_Offline_Ready.zip
unzip -q /path/to/P5E_Bookgame_619_Sprites_Offline_Ready.zip -d .
npm --prefix bookgame run sprites:verify
```

For a local release candidate, enforce physical sprite coverage at startup:

```sh
P5E_REQUIRE_OFFLINE_SPRITES=1 npm --prefix bookgame run ui
```

**Fail closed:** if any mapped battle front/back/icon or mapped overworld asset is missing, the release-mode server refuses to start. No network sprite source or placeholder substitution is involved. The binary overlay is delivered separately from Git; include its contents in the offline package. The project currently has a local Node UI, not a native APK/IPA pipeline.
