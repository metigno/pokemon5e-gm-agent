import importlib.util
from pathlib import Path
import tempfile
import unittest

PATH = Path(__file__).resolve().parents[1] / "scripts/embed-canonical-sprites.py"
spec = importlib.util.spec_from_file_location("embed_sprites", PATH)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
PNG = b"\x89PNG\r\n\x1a\n" + b"fixture"


class EmbeddedSpriteTests(unittest.TestCase):
    def test_local_png_materialization_has_no_network_and_respects_mapping(self):
        with tempfile.TemporaryDirectory() as root:
            base = Path(root)
            source, target = base / "from", base / "to"
            for species in ("abra", "eevee"):
                for name in ("front.png", "back.png", "icon.png"):
                    dest = source / species / name
                    dest.parent.mkdir(parents=True, exist_ok=True)
                    dest.write_bytes(PNG)
            mapping = {"sprites": {
                "abra": {"battleFront": "front.png", "battleBack": "back.png", "icon": "icon.png"},
                "eevee": {"battleFront": "front.png", "battleBack": "back.png", "icon": "icon.png"}
            }}
            original = mod.EXPECTED_COUNTS
            mod.EXPECTED_COUNTS = {"battleFront": 2, "battleBack": 2, "icon": 2, "overworld": 0}
            try:
                mod.embed(source, target, mapping)
                self.assertEqual((target / "abra/front.png").read_bytes(), PNG)
                self.assertEqual(len(list(target.rglob("*.png"))), 6)
            finally:
                mod.EXPECTED_COUNTS = original

    def test_missing_file_preflight_never_leaves_partial_installation(self):
        with tempfile.TemporaryDirectory() as root:
            source, target = Path(root)/"src", Path(root)/"dst"
            (source / "abra").mkdir(parents=True)
            (source / "abra/front.png").write_bytes(PNG)
            mapping = {"sprites": {"abra": {"battleFront": "front.png", "battleBack": "back.png", "icon": "icon.png"}}}
            original = mod.EXPECTED_COUNTS
            mod.EXPECTED_COUNTS = {"battleFront": 1, "battleBack": 1, "icon": 1, "overworld": 0}
            try:
                with self.assertRaises(FileNotFoundError):
                    mod.embed(source, target, mapping)
                self.assertFalse(target.exists())
            finally:
                mod.EXPECTED_COUNTS = original

    def test_rejects_path_traversal_and_gigantamax(self):
        with tempfile.TemporaryDirectory() as root:
            source = Path(root)/"src"
            source.mkdir()
            original = mod.EXPECTED_COUNTS
            mod.EXPECTED_COUNTS = {"battleFront": 1, "battleBack": 1, "icon": 1, "overworld": 0}
            try:
                for species in ("../escape", "gmax-charizard"):
                    with self.assertRaises(ValueError):
                        mod.embed(source, Path(root)/"dest", {"sprites": {species: {
                            "battleFront": "front.png", "battleBack": "back.png", "icon": "icon.png"}}})
            finally:
                mod.EXPECTED_COUNTS = original


if __name__ == "__main__":
    unittest.main()
