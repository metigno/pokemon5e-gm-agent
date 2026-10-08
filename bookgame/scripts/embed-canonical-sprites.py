#!/usr/bin/env python3
"""Materialize runtime sprites from the pinned public Emerald Expansion fork.

This is a one-time repository population tool. Runtime never fetches sprites.
The canonical mapping, not guessed Pokémon names, determines what is copied.
"""
import argparse
import json
from pathlib import Path
import shutil
import struct

ROLES = ("battleFront", "battleBack", "icon", "overworld")
SIG = b"\x89PNG\r\n\x1a\n"
EXPECTED_COUNTS = {"battleFront": 619, "battleBack": 619, "icon": 619, "overworld": 604}
SOURCE_COMMIT = "bc906dcc68ca722cd1769ead0f6d3030b1b1ceee"
ROOT = Path(__file__).resolve().parent.parent

# Subdirectory aliases taken from the verified 619-species source manifest.
# Directories are relative to graphics/pokemon at the pinned public revision.
SOURCE_ALIASES = {
    "alolan-diglett": "diglett/alola",
    "alolan-dugtrio": "dugtrio/alola",
    "alolan-exeggutor": "exeggutor/alola",
    "alolan-geodude": "geodude/alola",
    "alolan-golem": "golem/alola",
    "alolan-graveler": "graveler/alola",
    "alolan-grimer": "grimer/alola",
    "alolan-raichu": "raichu/alola",
    "alolan-raticate": "raticate/alola",
    "alolan-rattata": "rattata/alola",
    "arcanine-hisui": "arcanine/hisui",
    "basculegion-m": "basculegion",
    "calyrex-shadow": "calyrex/shadow",
    "decidueye-hisui": "decidueye/hisui",
    "deoxys-speed": "deoxys/speed",
    "electrode-hisui": "electrode/hisui",
    "flutter-mane": "flutter_mane",
    "galarian-farfetchd": "farfetchd/galar",
    "galarian-mr-mime": "mr_mime/galar",
    "galarian-ponyta": "ponyta/galar",
    "galarian-rapidash": "rapidash/galar",
    "galarian-slowpoke": "slowpoke/galar",
    "galarian-weezing": "weezing/galar",
    "galarian-yamask": "yamask/galar",
    "galarian-zigzagoon": "zigzagoon/galar",
    "gimmighoul-roaming": "gimmighoul/roaming",
    "giratina-origin": "giratina/origin",
    "great-tusk": "great_tusk",
    "growlithe-hisui": "growlithe/hisui",
    "indeedee-m": "indeedee",
    "kyurem-black": "kyurem/black",
    "mega-blastoise": "blastoise/mega",
    "mega-excadrill": "excadrill/mega",
    "mega-gengar": "gengar/mega",
    "mega-houndoom": "houndoom/mega",
    "mega-lucario": "lucario/mega",
    "mega-mawile": "mawile/mega",
    "mega-metagross": "metagross/mega",
    "mega-salamence": "salamence/mega",
    "mega-scizor": "scizor/mega",
    "mega-sharpedo": "sharpedo/mega",
    "meowstic-f": "meowstic/f",
    "meowstic-m": "meowstic",
    "mime-jr": "mime_jr",
    "minior-meteor-form": "minior",
    "mr-mime": "mr_mime",
    "nidoran-f": "nidoran_f",
    "nidoran-m": "nidoran_m",
    "oinkologne-female": "oinkologne/f",
    "oinkologne-male": "oinkologne",
    "oricorio-baile-style": "oricorio",
    "oricorio-pau-style": "oricorio/pau",
    "oricorio-sensu-style": "oricorio/sensu",
    "palkia-origin": "palkia/origin",
    "qwilfish-hisui": "qwilfish/hisui",
    "rainy-castform": "castform/rainy",
    "rotom-fan": "rotom/fan",
    "rotom-mow": "rotom/mow",
    "rotom-wash": "rotom/wash",
    "samurott-hisui": "samurott/hisui",
    "snowy-castform": "castform/snowy",
    "toxtricity-amped": "toxtricity",
    "toxtricity-low-key": "toxtricity/low_key",
    "typhlosion-hisui": "typhlosion/hisui",
    "voltorb-hisui": "voltorb/hisui",
    "walking-wake": "walking_wake",
    "wishiwashi-school-form": "wishiwashi/school",
    "wishiwashi-solo-form": "wishiwashi",
    "wooper-paldea": "wooper/paldea",
    "zacian-crowned": "zacian/crowned_sword",
    "zoroark-hisui": "zoroark/hisui",
}
EXPECTED_SPECIES = 619



def embed(source: Path, destination: Path, mapping: dict):
    src = source.resolve()
    dest = destination.resolve()
    assert src.is_dir(), f"Missing pinned source tree: {src}"
    sprites = mapping["sprites"]
    assert len(sprites) == EXPECTED_SPECIES, "Unexpected sprite catalogue size"
    counts = dict.fromkeys(ROLES, 0)
    missing = []
    copying = []
    for species, roles in sorted(sprites.items()):
        if not species or not all(c.islower() or c.isdigit() or c in "_-" for c in species):
            raise ValueError(f"Unsafe species identifier: {species!r}")
        if "gmax" in species or "gigantamax" in species:
            raise ValueError(f"Disallowed Gigantamax: {species}")
        for role in ROLES:
            filename = roles.get(role)
            if filename is None:
                if role != "overworld":
                    missing.append(f"{species} missing required {role} mapping")
                continue
            if Path(filename).name != filename or filename in ("", ".", "..") or not filename.endswith(".png"):
                raise ValueError(f"Unsafe mapped path: {species}/{filename}")
            counts[role] += 1
            from_path = src / SOURCE_ALIASES.get(species, species) / filename
            to_path = dest / species / filename
            if not from_path.is_file():
                missing.append(f"{species}/{filename}")
            else:
                with from_path.open("rb") as fp:
                    if fp.read(8) != SIG:
                        raise ValueError(f"Invalid PNG signature: {from_path}")
                copying.append((from_path, to_path))
    if counts != EXPECTED_COUNTS:
        raise ValueError(f"Unexpected canonical role counts: {counts!r}")
    if missing:
        raise FileNotFoundError(f"Cannot embed sprites; {len(missing)} absent:\n" + "\n".join(missing[:35]))
    for origin, target in copying:
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(origin, target)
    print(json.dumps({
        "sourceCommit": SOURCE_COMMIT,
        "species": len(sprites),
        "roles": counts,
        "copied": len(copying),
        "missing": len(missing),
        "offline": True
    }, indent=2))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("upstream_graphics_pokemon", type=Path)
    parser.add_argument("--destination", type=Path, default=ROOT / "assets/pokemon/files")
    args = parser.parse_args()
    mapping = json.loads((ROOT / "assets/pokemon/sprite-runtime-map.json").read_text(encoding="utf8"))
    embed(args.upstream_graphics_pokemon, args.destination, mapping)


if __name__ == "__main__":
    main()
