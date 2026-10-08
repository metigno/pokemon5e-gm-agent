import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
import zipfile

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "import-audio-package.py"
SPEC = importlib.util.spec_from_file_location("p5e_audio_importer", SCRIPT)
MOD = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MOD)


def sample_pack(path, corrupt=False, traverse=False):
    music = {}
    files = {}
    for cue in sorted(MOD.REQUIRED):
        file = "audio/" + cue + ".ogg"
        data = b"OggS" + cue.encode()
        files[file] = data
        music[cue] = {"file": file, "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}
    wav = b"RIFF" + (4).to_bytes(4, "little") + b"WAVE"
    files["audio/cries/growlithe.wav"] = wav
    cries = {"growlithe": {
        "file": "audio/cries/growlithe.wav",
        "bytes": len(wav), "sha256": hashlib.sha256(wav).hexdigest()
    }}
    manifest = {"format": MOD.FORMAT, "music": music, "effects": {}, "cries": cries}
    if traverse:
        manifest["cries"]["growlithe"]["file"] = "audio/../private.wav"
    with zipfile.ZipFile(path, "w") as archive:
        archive.writestr("audio/manifest.json", json.dumps(manifest))
        for name, data in files.items():
            archive.writestr(name, b"invalid" if corrupt and name == "audio/m01.ogg" else data)


class AudioPackageTests(unittest.TestCase):
    def test_atomic_import_and_integrity_verification(self):
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp)
            pack, target = base / "pack.zip", base / "audio"
            sample_pack(pack)
            n = MOD.install(pack, target)
            self.assertEqual(MOD.verify(target), n)
            self.assertTrue((target / "m12.ogg").exists())

    def test_invalid_checksum_never_replaces_existing_pack(self):
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp)
            pack, bad, target = base / "good.zip", base / "bad.zip", base / "audio"
            sample_pack(pack)
            MOD.install(pack, target)
            sample_pack(bad, corrupt=True)
            with self.assertRaises(MOD.PackError):
                MOD.install(bad, target)
            self.assertGreater(MOD.verify(target), 10)

    def test_directory_traversal_is_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp)
            pack = base / "escape.zip"
            sample_pack(pack, traverse=True)
            with self.assertRaises(MOD.PackError):
                MOD.install(pack, base / "audio")
            self.assertFalse((base / "private.wav").exists())


if __name__ == "__main__":
    unittest.main()
