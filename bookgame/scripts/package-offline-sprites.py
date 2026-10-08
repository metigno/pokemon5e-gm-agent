#!/usr/bin/env python3
"""Build a self-contained offline sprite overlay for the canonical Bookgame directory."""
import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import tempfile
import zipfile

ARCHIVE_ROOT = "P5E_M01-M12_EmeraldExpansion_Sprites"
DEST_ROOT = "bookgame/assets/pokemon/files"
VERIFIED_SHA256 = "6dbb206fb3deafcd9f4524e27d52f88110623f38f8eb0551bd11d2b1ef69954d"
PNG_MAGIC = b"\x89PNG\r\n\x1a\n"
REQUIRED_ROLES = ("battleFront", "battleBack", "icon", "overworld")


def package_offline_sprites(archive, target, sprite_map):
    """Validate the canonical paths and atomically produce an overlay ZIP."""
    allowed_species = set(sprite_map["sprites"])
    if any("gmax" in name.lower() or "gigantamax" in name.lower() for name in allowed_species):
        raise ValueError("Gigantamax entry in canonical map")

    with zipfile.ZipFile(archive) as source:
        members = {}
        for info in source.infolist():
            if info.is_dir():
                continue
            path = PurePosixPath(info.filename)
            if (path.is_absolute() or ".." in path.parts or "\\" in info.filename or
                    len(path.parts) != 3 or path.parts[0] != ARCHIVE_ROOT):
                if len(path.parts) == 2 and path.parts[0] == ARCHIVE_ROOT and path.name in ("MANIFEST.json", "README.txt"):
                    continue
                raise ValueError(f"Unexpected archive path: {info.filename!r}")
            species, filename = path.parts[1:]
            if species not in allowed_species or not filename.endswith(".png"):
                raise ValueError(f"Unmapped or forbidden asset: {info.filename!r}")
            key = f"{species}/{filename}"
            if key in members:
                raise ValueError(f"Duplicate sprite asset: {key}")
            if (info.external_attr >> 16) & 0o170000 == 0o120000:
                raise ValueError(f"Symlink sprite asset: {key}")
            members[key] = info

        missing = [
            f"{species}/{filename}"
            for species, roles in sprite_map["sprites"].items()
            for role in REQUIRED_ROLES
            if (filename := roles.get(role)) and f"{species}/{filename}" not in members
        ]
        if missing:
            raise ValueError(f"Missing {len(missing)} mapped sprites: {missing[:10]}")
        if not members:
            raise ValueError("Empty sprite archive")

        output = Path(target)
        output.parent.mkdir(parents=True, exist_ok=True)
        temporary = None
        try:
            with tempfile.NamedTemporaryFile(prefix=".sprite-overlay-", suffix=".zip", dir=output.parent, delete=False) as tmp:
                temporary = Path(tmp.name)
            with zipfile.ZipFile(temporary, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as dest:
                for key in sorted(members):
                    data = source.read(members[key])
                    if not data.startswith(PNG_MAGIC):
                        raise ValueError(f"Invalid PNG signature: {key}")
                    item = zipfile.ZipInfo(f"{DEST_ROOT}/{key}", (2020, 1, 1, 0, 0, 0))
                    item.compress_type = zipfile.ZIP_DEFLATED
                    item.external_attr = 0o100644 << 16
                    dest.writestr(item, data, compress_type=zipfile.ZIP_DEFLATED, compresslevel=6)
            os.replace(temporary, output)
        finally:
            if temporary is not None:
                temporary.unlink(missing_ok=True)
    return {"mappedSpecies": len(allowed_species), "bundledPng": len(members), "requiredPaths": sum(bool(roles.get(role)) for roles in sprite_map["sprites"].values() for role in REQUIRED_ROLES)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("approved_zip", type=Path, help="The verified 619-species ZIP")
    parser.add_argument("output_zip", type=Path, help="Portable overlay ZIP for the project root")
    args = parser.parse_args()
    digest = hashlib.sha256(args.approved_zip.read_bytes()).hexdigest()
    if digest != VERIFIED_SHA256:
        parser.error(f"Sprite archive SHA-256 mismatch ({digest}); refusing to package")
    mapping = json.loads((Path(__file__).resolve().parent.parent / "assets/pokemon/sprite-runtime-map.json").read_text(encoding="utf-8"))
    if len(mapping.get("sprites", {})) != 619:
        parser.error("Expected exactly 619 canonical mapped species")
    try:
        report = package_offline_sprites(args.approved_zip, args.output_zip, mapping)
    except (ValueError, zipfile.BadZipFile) as error:
        parser.error(str(error))
    print(json.dumps({**report, "sha256": hashlib.sha256(args.output_zip.read_bytes()).hexdigest(), "output": str(args.output_zip)}, indent=2))


if __name__ == "__main__":
    main()
