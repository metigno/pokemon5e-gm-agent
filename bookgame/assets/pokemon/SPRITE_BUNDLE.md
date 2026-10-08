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
