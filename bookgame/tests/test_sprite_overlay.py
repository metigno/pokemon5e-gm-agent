"""Offline deployment tests (stdlib only; run from GitHub Actions)."""
import importlib.util
from pathlib import Path
import tempfile
import unittest
import zipfile

MODULE_FILE = Path(__file__).resolve().parents[1] / "scripts/package-offline-sprites.py"
spec = importlib.util.spec_from_file_location("sprite_overlay", MODULE_FILE)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
MAGIC = b"\x89PNG\r\n\x1a\n" + b"fixture"


class SpriteOverlayTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.directory = Path(self.tmp.name)
        self.archive = self.directory / "bundle.zip"
        self.overlay = self.directory / "overlay.zip"
        self.mapping = {"sprites": {
            "pikachu": {"battleFront": "front.png", "battleBack": "back.png", "icon": "icon.png", "overworld": "overworld.png"},
            "eevee": {"battleFront": "front.png", "battleBack": "back.png", "icon": "icon.png", "overworld": None},
        }}

    def create_zip(self, *, omit=(), extra=None, corrupt=None):
        with zipfile.ZipFile(self.archive, "w") as archive:
            for species, roles in self.mapping["sprites"].items():
                for asset in roles.values():
                    if asset is None or f"{species}/{asset}" in omit:
                        continue
                    key = f"{module.ARCHIVE_ROOT}/{species}/{asset}"
                    archive.writestr(key, b"invalid" if corrupt == f"{species}/{asset}" else MAGIC)
            if extra:
                archive.writestr(f"{module.ARCHIVE_ROOT}/{extra}", MAGIC)

    def test_complete_archive_packs_only_local_runtime_paths(self):
        self.create_zip()
        report = module.package_offline_sprites(self.archive, self.overlay, self.mapping)
        self.assertEqual(report["mappedSpecies"], 2)
        self.assertEqual(report["requiredPaths"], 7)
        with zipfile.ZipFile(self.overlay) as output:
            self.assertEqual(len(output.namelist()), 7)
            self.assertEqual(output.read("bookgame/assets/pokemon/files/pikachu/front.png"), MAGIC)
            self.assertTrue(all(name.startswith("bookgame/assets/pokemon/files/") for name in output.namelist()))

    def test_missing_required_asset_rejects_without_output(self):
        self.create_zip(omit={"eevee/back.png"})
        with self.assertRaisesRegex(ValueError, "Missing 1 mapped sprites"):
            module.package_offline_sprites(self.archive, self.overlay, self.mapping)
        self.assertFalse(self.overlay.exists())

    def test_rejects_unmapped_assets_and_gigantamax(self):
        self.create_zip(extra="gmax-charizard/front.png")
        with self.assertRaisesRegex(ValueError, "Unmapped or forbidden"):
            module.package_offline_sprites(self.archive, self.overlay, self.mapping)
        self.assertFalse(self.overlay.exists())

    def test_invalid_png_does_not_publish_partial_bundle(self):
        self.create_zip(corrupt="pikachu/front.png")
        with self.assertRaisesRegex(ValueError, "Invalid PNG"):
            module.package_offline_sprites(self.archive, self.overlay, self.mapping)
        self.assertFalse(self.overlay.exists())


if __name__ == "__main__":
    unittest.main()
