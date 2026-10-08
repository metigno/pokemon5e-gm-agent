# Embedded sprite materialization for a private offline game

Source of the PNGs: \`worpbane/pokeemerald-worped-ex\`, revision
\`bc906dcc68ca722cd1769ead0f6d3030b1b1ceee\` (public Pokémon Emerald Expansion fork).

The \`bookgame/assets/pokemon/sprite-runtime-map.json\` canonical manifest
selects **619** Pokémon with **619 battle fronts, 619 backs, 619 icons, 604 overworld sprites**.
The 15 species without an overworld entry in that map do not require a fabricated image.

The \`bookgame-sprites-materialized\` branch has a one-shot GitHub workflow
that sparse-checkouts the *pinned* source code repository, copies all **2,461**
mapped runtime PNGs into \`bookgame/assets/pokemon/files/\`, checks physical
offline completeness and commits the binary files into the branch.

Once the PR with binaries merges into \`bookgame-canonical\`, the game
uses only local sprite paths. The released bundle must include
\`bookgame/assets/pokemon/files/\` and be tested on the actual mobile build.

**Artwork provenance:** the 608 approved original species are derived from
this exact fork revision. The 11 extra species in the separately verified ZIP
were supplied later and have differences from some sprites at this revision.
If exact appearance of those 11 supplement images is required, use the user's
verified overlay ZIP (SHA-256 \`118d9692c7593318e998de4a06a839e15ac98b754f708aad1f7fa5076de2ef1a\`)
when packaging the final build; it replaces those differences with the user's
approved image bytes. Do not describe the upstream variants as byte-identical
to the verified overlay.
