"""Trainer offline release overlay: isolated pixel fixtures, never shipping placeholders."""
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
import zipfile
import zlib
import struct

MODULE = Path(__file__).resolve().parents[1] / 'scripts/install-trainer-overlay.py'
spec = importlib.util.spec_from_file_location('trainer_overlay_installer', MODULE)
loader = importlib.util.module_from_spec(spec)
spec.loader.exec_module(loader)


def chunk(tag, data):
    return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff)


def png(w, h):
    ihdr = struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0)
    raw = b''.join(b'\0' + (b'\0\0\0\xff' * w) for _ in range(h))
    return loader.PNG_SIG + chunk(b'IHDR', ihdr) + chunk(b'IDAT', zlib.compress(raw)) + chunk(b'IEND', b'')


class InstallerTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='trainer-overlay-test-')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name) / 'bookgame'
        self.target = self.root / 'assets/characters/files'
        (self.root / 'assets/characters').mkdir(parents=True)
        (self.root / 'content/npcs').mkdir(parents=True)
        self.ids = ['Luke', 'Blue']
        self.data, self.portraits, self.native = {}, {}, {}
        for id in self.ids:
            self.data[id + '/portrait.png'] = png(24, 36)
            self.data[id + '/battleFront.png'] = png(64, 64)
            self.data[id + '/overworld.png'] = png(16 * 9, 32)
            self.portraits[id + '/portrait.png'] = hashlib.sha256(self.data[id + '/portrait.png']).hexdigest()
            self.native[id] = dict(
                battleFront='battleFront.png', overworld='overworld.png', frames=9, frameWidth=16, frameHeight=32,
                battleFrontSha256=hashlib.sha256(self.data[id + '/battleFront.png']).hexdigest(),
                overworldSha256=hashlib.sha256(self.data[id + '/overworld.png']).hexdigest())
        (self.root / 'assets/characters/sha256.json').write_text(json.dumps({'schemaVersion': 1, 'files': self.portraits}))
        (self.root / 'assets/characters/native-sprites.json').write_text(json.dumps({'schemaVersion': 1, 'entries': self.native}))
        (self.root / 'content/npcs/NPC_CHARACTER_LIBRARY_V1.json').write_text(json.dumps({
            'five': [{'id': 'Luke'}], 'moduleAnchors': [{'id': 'Blue'}], 'verifiedAdditionalCharacters': []
        }))
        self.path = Path(self.temp.name) / 'overlay.zip'
        self.create_zip()

    def create_zip(self, extra=None, remove=None, mutate=None):
        with zipfile.ZipFile(self.path, 'w') as z:
            for key, data in self.data.items():
                if key == remove:
                    continue
                if key == mutate:
                    data = data[:-7] + b'INVALID'
                z.writestr('bookgame/assets/characters/files/' + key, data)
            for key, data in (extra or {}).items():
                z.writestr(key, data)

    def run_installer(self):
        return loader.install(self.path, self.root, self.target,
                              approved_zip_hash=hashlib.sha256(self.path.read_bytes()).hexdigest())

    def test_installation_and_repeated_build_are_idempotent(self):
        self.assertEqual(self.run_installer(), {'status': 'installed', 'images': 6})
        self.assertEqual(self.run_installer(), {'status': 'already-installed', 'images': 6})
        for key, data in self.data.items():
            self.assertEqual((self.target / key).read_bytes(), data)

    def test_build_requires_real_pinned_whole_zip(self):
        with self.assertRaisesRegex(ValueError, 'ZIP SHA-256 mismatch'):
            loader.install(self.path, self.root, self.target)
        self.assertFalse(self.target.exists())

    def test_incomplete_bundle_cannot_install_partially(self):
        self.create_zip(remove='Blue/overworld.png')
        with self.assertRaisesRegex(ValueError, 'incomplete'):
            self.run_installer()
        self.assertFalse(self.target.exists())

    def test_corruption_blocks_entire_bundle(self):
        self.create_zip(mutate='Blue/battleFront.png')
        with self.assertRaisesRegex(ValueError, 'Unverified Trainer PNG'):
            self.run_installer()
        self.assertFalse(self.target.exists())

    def test_path_traversal_and_unknown_avatars_are_rejected(self):
        for evil in ['bookgame/assets/characters/files/../../hijack.png',
                     'bookgame/assets/characters/files/Unregistered/portrait.png']:
            with self.subTest(path=evil):
                self.create_zip(extra={evil: b'x'})
                with self.assertRaisesRegex(ValueError, 'unsafe ZIP|Unmapped'):
                    self.run_installer()
                self.assertFalse(self.target.exists())

    def test_existing_different_art_is_never_overwritten(self):
        (self.target / 'Luke').mkdir(parents=True)
        existing = self.target / 'Luke/portrait.png'
        existing.write_bytes(b'custom user art')
        with self.assertRaisesRegex(ValueError, 'differs'):
            self.run_installer()
        self.assertEqual(existing.read_bytes(), b'custom user art')
        self.assertFalse((self.target / 'Blue').exists())

    def test_valid_partial_previous_overlay_can_be_completed(self):
        (self.target / 'Luke').mkdir(parents=True)
        (self.target / 'Luke/portrait.png').write_bytes(self.data['Luke/portrait.png'])
        self.assertEqual(self.run_installer()['status'], 'installed')
        self.assertEqual(len(list(self.target.glob('**/*.png'))), 6)

    def test_untrusted_zip_manifest_cannot_override_canonical_pins(self):
        self.create_zip(extra={'bookgame/assets/characters/sha256.json': b'{"hijacked": true}'})
        self.assertEqual(self.run_installer()['status'], 'installed')
        actual = json.loads((self.root / 'assets/characters/sha256.json').read_text())
        self.assertEqual(actual['files'], self.portraits)


if __name__ == '__main__':
    unittest.main()
