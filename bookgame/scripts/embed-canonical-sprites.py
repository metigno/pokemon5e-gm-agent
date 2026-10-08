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


def embed(source: Path, destination: Path, mapping: dict):
    src = source.resolve()
    dest = destination.resolve()
    assert src.is_dir(), f"Missing pinned source tree: {src}"
    sprites = mapping["sprites"]
    assert len(sprites) == 619, "Unexpected sprite catalogue size"
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
            from_path = src / species / filename
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
