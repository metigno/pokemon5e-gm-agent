#!/usr/bin/env python3
"""Offline installer for the pinned 19-Trainer PNG bundle (no network or placeholders)."""
from __future__ import annotations
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

BUNDLE_SHA256 = '6269a74a9381c03941322dd8b8f16b3950ab199c62e488a7d5ed0324368754d9'
FILE_PREFIX = ('bookgame', 'assets', 'characters', 'files')
OPTIONAL_METADATA = {
    'BOOKGAME_CHARACTER_SPRITES_README.txt',
    'bookgame/assets/characters/native-sprites.json',
    'bookgame/assets/characters/sha256.json',
    'bookgame/assets/characters/provenance19.json',
}
PNG_SIG = b'\x89PNG\r\n\x1a\n'
MAX_IMAGE_BYTES = 2 * 1024 * 1024


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def expected_files(root: Path):
    portrait = json.loads((root / 'assets/characters/sha256.json').read_text())
    native = json.loads((root / 'assets/characters/native-sprites.json').read_text())
    registry = json.loads((root / 'content/npcs/NPC_CHARACTER_LIBRARY_V1.json').read_text())
    ids = [p['id'] for p in registry['five']]
    ids += [p['id'] for p in registry['moduleAnchors'] if p['id']]
    ids += [p['id'] for p in registry['verifiedAdditionalCharacters']]
    if len(ids) != len(set(ids)) or set(native['entries']) != set(ids):
        raise ValueError('Character mappings do not match the canonical registry')
    if portrait['schemaVersion'] != 1 or native['schemaVersion'] != 1:
        raise ValueError('Unapproved Trainer manifest schema')
    files = {}
    for name in ids:
        if not name.isalnum() or not name[0].isalpha():
            raise ValueError('Unsafe canonical character ID')
        pin = portrait['files'].get(name + '/portrait.png')
        if not isinstance(pin, str) or len(pin) != 64:
            raise ValueError('Missing portrait checksum for ' + name)
        files[name + '/portrait.png'] = (pin, None)
        meta = native['entries'][name]
        for role in ('battleFront', 'overworld'):
            if meta[role] != role + '.png':
                raise ValueError('Unexpected filename for ' + name)
            dim = (64, 64) if role == 'battleFront' else (meta['frames'] * meta['frameWidth'], meta['frameHeight'])
            files[name + '/' + role + '.png'] = (meta[role + 'Sha256'], dim)
    if len(files) != len(ids) * 3 or set(portrait['files']) != {x for x in files if x.endswith('/portrait.png')}:
        raise ValueError('Portrait manifest coverage mismatch')
    for pin, _ in files.values():
        if len(pin) != 64 or any(c not in '0123456789abcdef' for c in pin):
            raise ValueError('Invalid SHA-256 pin')
    return files


def verify_png(data: bytes, expected_size):
    if len(data) < 57 or len(data) > MAX_IMAGE_BYTES or not data.startswith(PNG_SIG):
        return False
    pos = 8
    ihdr = False
    idat = False
    while pos + 12 <= len(data):
        length = struct.unpack_from('>I', data, pos)[0]
        end = pos + 12 + length
        if end > len(data):
            return False
        kind = data[pos + 4:pos + 8]
        chunk = data[pos + 8:pos + 8 + length]
        crc = struct.unpack_from('>I', data, pos + 8 + length)[0]
        if zlib.crc32(kind + chunk) & 0xffffffff != crc:
            return False
        if not ihdr:
            if kind != b'IHDR' or length != 13:
                return False
            width, height = struct.unpack_from('>II', chunk, 0)
            if not width or not height or width > 2048 or height > 2048:
                return False
            if expected_size and (width, height) != expected_size:
                return False
            ihdr = True
        elif kind == b'IHDR':
            return False
        if kind == b'IDAT':
            idat = True
        if kind == b'IEND':
            return length == 0 and ihdr and idat and end == len(data)
        pos = end
    return False


def install(archive_path: Path, root: Path, destination: Path, approved_zip_hash=BUNDLE_SHA256):
    root = root.resolve()
    destination = destination.resolve()
    archive_path = archive_path.resolve(strict=True)
    if not archive_path.is_file():
        raise ValueError('Overlay must be a local regular ZIP file')
    if digest(archive_path.read_bytes()) != approved_zip_hash:
        raise ValueError('Approved Trainer overlay ZIP SHA-256 mismatch')
    required = expected_files(root)
    if destination.exists() and destination.is_symlink():
        raise ValueError('Refusing symlink destination')
    destination.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(archive_path) as bundle:
        observed = set()
        sources = {}
        for member in bundle.infolist():
            raw = member.filename
            if member.is_dir():
                continue
            parts = PurePosixPath(raw).parts
            if raw in OPTIONAL_METADATA:
                continue  # Never replace the trusted Git manifests with ZIP copies.
            if raw.startswith('/') or '\\' in raw or '..' in parts or tuple(parts[:4]) != FILE_PREFIX or len(parts) != 6:
                raise ValueError('Unexpected or unsafe ZIP member: ' + raw)
            key = '/'.join(parts[4:])
            if key not in required or key in observed or (member.external_attr >> 16) & 0o170000 == 0o120000:
                raise ValueError('Unmapped, duplicated or linked Trainer image: ' + key)
            if member.file_size > MAX_IMAGE_BYTES:
                raise ValueError('Oversized Trainer image: ' + key)
            observed.add(key)
            sources[key] = member
        if observed != set(required):
            raise ValueError('Trainer overlay incomplete: ' + ', '.join(sorted(set(required) - observed)[:6]))
        images = {}
        for key, (pinned, size) in required.items():
            data = bundle.read(sources[key])  # Checks ZIP CRC.
            if digest(data) != pinned or not verify_png(data, size):
                raise ValueError('Unverified Trainer PNG: ' + key)
            images[key] = data

    # Never overwrite a different source image. Allow clean upgrades from the older 14/19 overlay.
    if destination.exists():
        if not destination.is_dir():
            raise ValueError('Trainer asset destination is not a directory')
        for old in destination.rglob('*'):
            if old.is_symlink():
                raise ValueError('Symlink in existing Trainer assets')
            if old.is_file():
                key = old.relative_to(destination).as_posix()
                if key not in images or old.read_bytes() != images[key]:
                    raise ValueError('Existing Trainer asset differs from approved overlay: ' + key)
        if all((destination / key).is_file() for key in required):
            return {'status': 'already-installed', 'images': len(required)}

    stage = Path(tempfile.mkdtemp(prefix='.trainer-assets-stage-', dir=destination.parent))
    backup = None
    try:
        for key, payload in images.items():
            target = stage / key
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(payload)
        if destination.exists():
            backup = Path(tempfile.mkdtemp(prefix='.trainer-assets-backup-', dir=destination.parent))
            backup.rmdir()
            os.replace(destination, backup)
        try:
            os.replace(stage, destination)
        except BaseException:
            if backup is not None:
                os.replace(backup, destination)
                backup = None
            raise
        if backup is not None:
            shutil.rmtree(backup)
        return {'status': 'installed', 'images': len(required)}
    finally:
        if stage.exists():
            shutil.rmtree(stage)


def main():
    parser = argparse.ArgumentParser(description='Offline approved Trainer sprite ZIP installer')
    parser.add_argument('--zip', required=True, type=Path, dest='archive')
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument('--dest', type=Path)
    args = parser.parse_args()
    root = args.root.resolve()
    destination = args.dest or root / 'assets/characters/files'
    print(json.dumps(install(args.archive, root, destination), sort_keys=True))


if __name__ == '__main__':
    main()
