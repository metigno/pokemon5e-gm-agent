# Complete offline sprite bundle (619 Pokémon)

The original approved 608-species package has been combined with the two user-supplied missing-species archives (7 + 4 Pokémon, 33 PNG assets). The additional front sprites were renamed from `front.png` to the canonical `anim_front.png` filename.

- Artifact: `P5E_M01-M12_619_Pokemon_Complete_Offline.zip`
- SHA-256: `dcbd074ef6b6512270b64f9a927cc1e8c59128a8ef14bf26997dbba83e1629d4`
- PNG entries: 3,356
- Species directories: 619
- Gigantamax assets: excluded
- ZIP integrity: passed

**Important:** The existing `install-approved-sprite-zip.py` pins the older 608-species archive checksum, so it does not yet accept this combined ZIP. This manifest does not claim that the complete package is committed to GitHub or runtime-installed. The combined ZIP must still be checked against every mapped role/path, then its hash must be explicitly approved for installation. Do not change the canonical sprite map or introduce placeholders to make validation pass.
