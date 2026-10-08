#!/usr/bin/env python3
"""Install the approved Pokémon 5e sprite ZIP using the canonical Node importer."""
import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import subprocess
import tempfile
import zipfile

APPROVED_SHA256 = {
    "61d97f4109cc976930c26a72c19aa15ebf5b8e0cb687297838d8d3af1223e3b8",  # original 608
    "282212aef3a5eda96dcc6bd32e93583aae477689ed7402fd0f6fa646767330e0",  # completed 619
}
PACKAGE_ROOT = "P5E_M01-M12_EmeraldExpansion_Sprites"

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", type=Path, help="Path to approved sprite ZIP")
    parser.add_argument("--strict", action="store_true", help="Require all mapped sprites")
    args = parser.parse_args()
    archive = args.archive.resolve()
    digest = hashlib.sha256(archive.read_bytes()).hexdigest()
    if digest not in APPROVED_SHA256:
        parser.error(f"Unapproved archive (SHA-256 {digest}); no files installed")
    importer = Path(__file__).resolve().with_name("import-sprite-package.mjs")
    with tempfile.TemporaryDirectory(prefix="p5e-sprites-") as tmp:
        root = Path(tmp)
        with zipfile.ZipFile(archive) as z:
            entries = z.infolist()
            for entry in entries:
                name = entry.filename
                path = PurePosixPath(name)
                mode = entry.external_attr >> 16
                if (not name or path.is_absolute() or ".." in path.parts or
                        "\\" in name or ":" in path.parts[0] or
                        (mode & 0o170000) == 0o120000):
                    parser.error(f"Unsafe ZIP entry: {name!r}")
                if path.parts[0] != PACKAGE_ROOT:
                    parser.error(f"Unexpected ZIP root: {name!r}")
            if args.strict:
                mapping_path = importer.parent.parent / "assets/pokemon/sprite-runtime-map.json"
                mapping = json.loads(mapping_path.read_text(encoding="utf-8"))
                names = {entry.filename for entry in entries if not entry.is_dir()}
                missing = [
                    f"{sprite_id}/{asset}"
                    for sprite_id, roles in mapping["sprites"].items()
                    for role in ("battleFront", "battleBack", "icon")
                    if (asset := roles.get(role))
                    and f"{PACKAGE_ROOT}/{sprite_id}/{asset}" not in names
                ]
                if missing:
                    parser.error(
                        f"Missing {len(missing)} required mapped sprite files; "
                        f"nothing extracted or installed. Examples: {missing[:12]}"
                    )
            z.extractall(root)
        cmd = ["node", str(importer), str(root / PACKAGE_ROOT)]
        if args.strict:
            cmd.append("--strict")
        raise SystemExit(subprocess.call(cmd))

if __name__ == "__main__":
    main()
