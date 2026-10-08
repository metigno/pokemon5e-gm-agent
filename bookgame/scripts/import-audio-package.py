#!/usr/bin/env python3
"""Install/verify the privately supplied Pokémon 5e offline audio pack.

No network access and no audio redistribution. The pack is an external artifact.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import stat
import tempfile
import zipfile

AUDIO_DIR = Path(__file__).resolve().parents[1] / "ui" / "public" / "audio"
FORMAT = "p5e-offline-audio-v1"
MAX_ENTRIES = 2500
MAX_TOTAL_BYTES = 120 * 1024 * 1024
MAX_ASSET_BYTES = 12 * 1024 * 1024
AUDIO_NAME = re.compile(r"audio/(?:[a-z0-9_]+\.ogg|cries/[a-z0-9_]+\.wav)\Z")
REQUIRED = {f"m{i:02}" for i in range(1, 13)} | {
    "intro", "calm", "danger", "mystery", "evolution", "victory", "defeat",
    "battle_wild", "battle_trainer", "battle_boss", "battle_legendary", "pwt_final",
    "pwt_win", "pwt_victor"
}


class PackError(ValueError):
    pass


def _entries(manifest):
    if not isinstance(manifest, dict) or manifest.get("format") != FORMAT:
        raise PackError("Unsupported audio pack manifest")
    if not REQUIRED.issubset(set(manifest.get("music", {}))):
        raise PackError("Audio pack is missing a required scene or battle cue")
    items = []
    for section in ("music", "effects", "cries"):
        group = manifest.get(section)
        if not isinstance(group, dict):
            raise PackError("Invalid manifest section: " + section)
        for name, entry in group.items():
            if not re.fullmatch(r"[a-z0-9_]+", name) or not isinstance(entry, dict):
                raise PackError("Invalid audio cue")
            relative = entry.get("file")
            expected = "audio/cries/" + name + ".wav" if section == "cries" else "audio/" + name + ".ogg"
            if relative != expected or not AUDIO_NAME.fullmatch(relative):
                raise PackError("Unsafe or mismatched audio path")
            digest = entry.get("sha256")
            size = entry.get("bytes")
            if not isinstance(digest, str) or not re.fullmatch("[0-9a-f]{64}", digest):
                raise PackError("Missing SHA-256 for " + name)
            if type(size) is not int or not 0 < size <= MAX_ASSET_BYTES:
                raise PackError("Invalid size for " + name)
            items.append((relative, digest, size))
    if len(items) != len({item[0] for item in items}) or len(items) > MAX_ENTRIES:
        raise PackError("Duplicate or oversized audio catalog")
    if sum(item[2] for item in items) > MAX_TOTAL_BYTES:
        raise PackError("Audio pack unreasonably large")
    return items


def _check_audio(data, path):
    if path.endswith(".ogg") and not data.startswith(b"OggS"):
        raise PackError("Not an OGG file: " + path)
    if path.endswith(".wav") and not (data.startswith(b"RIFF") and data[8:12] == b"WAVE"):
        raise PackError("Not a WAV file: " + path)


def _manifest_from_zip(archive):
    try:
        raw = archive.read("audio/manifest.json")
        if len(raw) > 1024 * 1024:
            raise PackError("Audio manifest too large")
        return json.loads(raw)
    except (KeyError, json.JSONDecodeError) as exc:
        raise PackError("Audio manifest missing or invalid") from exc


def install(package_path, destination=AUDIO_DIR):
    package_path = Path(package_path)
    destination = Path(destination)
    destination.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(package_path) as archive:
        manifest = _manifest_from_zip(archive)
        items = _entries(manifest)
        expected_names = {"audio/manifest.json"} | {item[0] for item in items}
        actual = archive.namelist()
        present = [x for x in actual if not x.endswith("/")]
        if len(present) != len(set(present)) or set(present) != expected_names:
            raise PackError("Unexpected, duplicate or missing ZIP members")
        for info in archive.infolist():
            if stat.S_ISLNK(info.external_attr >> 16):
                raise PackError("Symlinks forbidden in audio pack")
        stage = Path(tempfile.mkdtemp(prefix=".p5e-audio-stage-", dir=destination.parent))
        backup = None
        try:
            for filename, digest, size in items:
                payload = archive.read(filename)
                if len(payload) != size or hashlib.sha256(payload).hexdigest() != digest:
                    raise PackError("Audio asset checksum failed: " + filename)
                _check_audio(payload, filename)
                output = stage / filename.removeprefix("audio/")
                output.parent.mkdir(parents=True, exist_ok=True)
                output.write_bytes(payload)
            (stage / "manifest.json").write_text(
                json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf8"
            )
            if destination.exists() and (destination / "README.md").is_file():
                shutil.copyfile(destination / "README.md", stage / "README.md")
            if destination.exists():
                backup = Path(tempfile.mkdtemp(prefix=".p5e-audio-backup-", dir=destination.parent))
                backup.rmdir()
                destination.rename(backup)
            try:
                stage.rename(destination)
            except Exception:
                if backup is not None:
                    backup.rename(destination)
                raise
        finally:
            if stage.exists():
                shutil.rmtree(stage)
            if backup is not None and backup.exists():
                shutil.rmtree(backup)
    return len(items)


def verify(destination=AUDIO_DIR):
    destination = Path(destination)
    try:
        manifest = json.loads((destination / "manifest.json").read_text(encoding="utf8"))
        entries = _entries(manifest)
        for path, digest, size in entries:
            f = destination / path.removeprefix("audio/")
            if f.is_symlink() or not f.is_file() or f.stat().st_size != size:
                raise PackError("Missing or invalid audio asset: " + path)
            with f.open("rb") as reader:
                payload = reader.read(MAX_ASSET_BYTES + 1)
            if hashlib.sha256(payload).hexdigest() != digest:
                raise PackError("Audio asset checksum mismatch: " + path)
            _check_audio(payload, path)
        return len(entries)
    except (OSError, ValueError, KeyError, TypeError) as exc:
        raise PackError("Audio not ready: " + str(exc)) from exc


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("pack", nargs="?", help="Local P5E_AudioPack_M01-M12.zip")
    parser.add_argument("--verify", action="store_true", help="Check an already installed pack")
    args = parser.parse_args()
    try:
        if args.verify:
            print("PASS: offline audio verified:", verify(), "audio files")
        elif args.pack:
            print("PASS: installed", install(args.pack), "audio files")
            print("PASS: offline audio verified:", verify(), "audio files")
        else:
            parser.error("Please provide the local ZIP path, or use --verify")
    except (PackError, OSError, zipfile.BadZipFile) as exc:
        parser.exit(1, "FAIL: " + str(exc) + "\n")


if __name__ == "__main__":
    main()
