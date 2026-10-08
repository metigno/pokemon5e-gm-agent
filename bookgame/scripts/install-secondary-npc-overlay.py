#!/usr/bin/env python3
"""Import the user-approved 18 World + 24 functional class NPC sprites offline."""
import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import shutil
import struct
import tempfile
import zipfile
import zlib

APPROVED_ARCHIVE = "f87e063447d9e79d5f1ba55ba1d1233250bcf7e4d2adb96aecb191dae0d9488a"
APPROVED_CATALOG = "07c8339f149556e5b82dce2b68efa79688fe96f07ba6a8bf3db73bc4d29cbab3"
ROOT_PREFIX = "bookgame/assets/npc-sprites/"
SIGNATURE = b"\x89PNG\r\n\x1a\n"


def sha(data):
    return hashlib.sha256(data).hexdigest()


def valid_png(data, dims):
    if len(data) < 57 or len(data) > 2 * 1024 * 1024 or not data.startswith(SIGNATURE):
        return False
    pos = 8
    seen_ihdr = seen_idat = False
    while pos + 12 <= len(data):
        length = struct.unpack_from(">I", data, pos)[0]
        end = pos + 12 + length
        if end > len(data):
            return False
        tag = data[pos+4:pos+8]
        payload = data[pos+8:pos+8+length]
        crc = struct.unpack_from(">I", data, pos+8+length)[0]
        if zlib.crc32(tag + payload) & 0xffffffff != crc:
            return False
        if not seen_ihdr:
            if tag != b"IHDR" or length != 13 or struct.unpack_from(">II", payload) != dims:
                return False
            seen_ihdr = True
        elif tag == b"IHDR":
            return False
        if tag == b"IDAT":
            seen_idat = True
        if tag == b"IEND":
            return length == 0 and seen_ihdr and seen_idat and end == len(data)
        pos = end
    return False


def expected(catalog):
    if catalog.get("schemaVersion") != 1:
        raise ValueError("Unknown secondary NPC catalog schema")
    world, roles = catalog.get("worldEntrants", {}), catalog.get("roles", {})
    if len(world) != 18 or len(roles) != 24:
        raise ValueError("Expected 18 World entrants and 24 functional NPC role groups")
    paths = {}
    for group, records in (("world", world), ("role", roles)):
        for npc_id, entry in records.items():
            if not npc_id.replace("_", "").isalnum() or not npc_id[0].isalpha():
                raise ValueError("Unsafe NPC catalog identity")
            for role in ("battleFront", "overworld"):
                if entry.get(role) != role + ".png":
                    raise ValueError("Bad NPC filename in catalog")
                pin = entry.get(role + "Sha256")
                if not isinstance(pin, str) or len(pin) != 64 or any(ch not in "0123456789abcdef" for ch in pin):
                    raise ValueError("Invalid NPC image pin")
                dim = (64, 64) if role == "battleFront" else (entry["frames"] * 16, 32)
                paths[f"files/{group}/{npc_id}/{role}.png"] = (pin, dim)
    if len(paths) != 84:
        raise ValueError("Secondary NPC package must contain 84 real PNGs")
    return paths


def install(archive, destination, archive_hash=APPROVED_ARCHIVE, catalog_hash=APPROVED_CATALOG):
    archive = Path(archive).resolve(strict=True)
    target = Path(destination)
    if target.is_symlink():
        raise ValueError("Unsafe symlink NPC directory")
    target = target.resolve()
    if sha(archive.read_bytes()) != archive_hash:
        raise ValueError("Approved secondary NPC ZIP SHA-256 mismatch")
    with zipfile.ZipFile(archive) as z:
        members = {i.filename: i for i in z.infolist() if not i.is_dir()}
        if len(members) != len([i for i in z.infolist() if not i.is_dir()]):
            raise ValueError("Duplicate ZIP member names")
        catalog_name = ROOT_PREFIX + "catalog.json"
        if catalog_name not in members or sha(z.read(catalog_name)) != catalog_hash:
            raise ValueError("Unapproved secondary NPC sprite catalog")
        catalog_bytes = z.read(catalog_name)
        paths = expected(json.loads(catalog_bytes))
        permitted = {catalog_name, "NPC_SECONDARY_PACKAGE_AUDIT.json"} | {
            ROOT_PREFIX + path for path in paths
        }
        if set(members) != permitted:
            raise ValueError("Unexpected, missing or dangerous NPC ZIP member")
        for filename, entry in members.items():
            parts = PurePosixPath(filename).parts
            if filename.startswith("/") or "\\" in filename or ".." in parts or (entry.external_attr >> 16) & 0o170000 == 0o120000:
                raise ValueError("Unsafe NPC ZIP path or symlink")
            if entry.file_size > 2 * 1024 * 1024:
                raise ValueError("Excessive NPC asset size")
        data = {"catalog.json": catalog_bytes}
        for name, (pinned, dims) in paths.items():
            raw = z.read(ROOT_PREFIX + name)
            if sha(raw) != pinned or not valid_png(raw, dims):
                raise ValueError("Invalid approved NPC image: " + name)
            data[name] = raw
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.exists():
        if not target.is_dir():
            raise ValueError("NPC destination is not a directory")
        for item in target.rglob("*"):
            if item.is_symlink():
                raise ValueError("Unsafe existing NPC symlink")
            if item.is_file():
                key = item.relative_to(target).as_posix()
                if key not in data or item.read_bytes() != data[key]:
                    raise ValueError("Existing NPC artwork differs from the approved bundle: " + key)
        if all((target / path).is_file() for path in data):
            return {"status": "already-installed", "images": len(paths)}
    stage = Path(tempfile.mkdtemp(prefix=".npc-stage-", dir=target.parent))
    backup = None
    try:
        for name, raw in data.items():
            out = stage / name
            out.parent.mkdir(parents=True, exist_ok=True)
            out.write_bytes(raw)
        if target.exists():
            backup = Path(tempfile.mkdtemp(prefix=".npc-backup-", dir=target.parent))
            backup.rmdir()
            os.replace(target, backup)
        try:
            os.replace(stage, target)
        except BaseException:
            if backup:
                os.replace(backup, target)
                backup = None
            raise
        if backup:
            shutil.rmtree(backup)
        return {"status": "installed", "images": len(paths)}
    finally:
        if stage.exists():
            shutil.rmtree(stage)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--zip", required=True, type=Path)
    parser.add_argument("--dest", type=Path, default=Path(__file__).resolve().parents[1] / "assets/npc-sprites")
    args = parser.parse_args()
    print(json.dumps(install(args.zip, args.dest), sort_keys=True))


if __name__ == "__main__":
    main()
