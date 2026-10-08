"""Isolated offline 84-PNG secondary NPC package tests. Never generates game placeholders."""
import hashlib
import importlib.util
import json
import struct
import tempfile
import unittest
import zipfile
import zlib
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "scripts/install-secondary-npc-overlay.py"
spec = importlib.util.spec_from_file_location("secondary_npc_installer", SCRIPT)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


def sha(b):
    return hashlib.sha256(b).hexdigest()


def chunk(tag, data):
    return struct.pack(">I",len(data)) + tag + data + struct.pack(">I",zlib.crc32(tag+data)&0xffffffff)


def png(w,h):
    head = struct.pack(">IIBBBBB", w,h,8,6,0,0,0)
    lines = b"".join(b"\0"+b"\0\0\0\xff"*w for _ in range(h))
    return mod.SIGNATURE + chunk(b"IHDR",head) + chunk(b"IDAT",zlib.compress(lines)) + chunk(b"IEND",b"")


class SecondaryNpcInstallTests(unittest.TestCase):
    def setUp(self):
        tmp=tempfile.TemporaryDirectory(prefix="secondary-npc-import-")
        self.addCleanup(tmp.cleanup)
        root=Path(tmp.name)
        self.archive=root/"approved.zip"
        self.destination=root/"bookgame/assets/npc-sprites"
        self.data={}
        self.catalog={"schemaVersion":1,"worldEntrants":{},"roles":{},"sceneRoles":{}}
        for group,total in (("world",18),("role",24)):
            for index in range(total):
                id=f"{group}_{index}"
                front,over=png(64,64),png(9*16,32)
                self.data[f"files/{group}/{id}/battleFront.png"]=front
                self.data[f"files/{group}/{id}/overworld.png"]=over
                self.catalog["worldEntrants" if group=="world" else "roles"][id]={
                    "battleFront":"battleFront.png","overworld":"overworld.png",
                    "frames":9,"frameWidth":16,"frameHeight":32,
                    "battleFrontSha256":sha(front),"overworldSha256":sha(over)
                }
        self.catalog_bytes=json.dumps(self.catalog).encode()
        self.catalog_sha=sha(self.catalog_bytes)
        self.write_zip()

    def write_zip(self,remove=None,change=None,extra=None):
        with zipfile.ZipFile(self.archive,"w",zipfile.ZIP_DEFLATED) as z:
            z.writestr(mod.ROOT_PREFIX+"catalog.json",self.catalog_bytes)
            z.writestr("NPC_SECONDARY_PACKAGE_AUDIT.json",b"{}")
            for name,blob in self.data.items():
                if name==remove:
                    continue
                if name==change:
                    blob=blob+b"corrupt"
                z.writestr(mod.ROOT_PREFIX+name,blob)
            for key,blob in (extra or {}).items():
                z.writestr(key,blob)

    def run_import(self):
        return mod.install(self.archive,self.destination,archive_hash=sha(self.archive.read_bytes()),
            catalog_hash=self.catalog_sha)

    def test_complete_84_asset_bundle_and_idempotent_reinstall(self):
        self.assertEqual(self.run_import(),{"status":"installed","images":84})
        self.assertEqual(self.run_import(),{"status":"already-installed","images":84})
        self.assertEqual(len(list(self.destination.rglob("*.png"))),84)

    def test_release_pin_rejects_unapproved_archive(self):
        with self.assertRaisesRegex(ValueError,"ZIP SHA-256 mismatch"):
            mod.install(self.archive,self.destination)
        self.assertFalse(self.destination.exists())

    def test_missing_or_corrupt_files_block_atomic_install(self):
        name="files/world/world_3/battleFront.png"
        self.write_zip(remove=name)
        with self.assertRaisesRegex(ValueError,"Unexpected, missing"):
            self.run_import()
        self.assertFalse(self.destination.exists())
        self.write_zip(change=name)
        with self.assertRaisesRegex(ValueError,"Invalid approved NPC image"):
            self.run_import()
        self.assertFalse(self.destination.exists())

    def test_traversal_and_unapproved_assets_are_rejected(self):
        for key in ("../../hijack.txt","bookgame/assets/npc-sprites/files/role/swimmer/battleFront.png"):
            with self.subTest(key=key):
                self.write_zip(extra={key:b"forbidden"})
                with self.assertRaisesRegex(ValueError,"Unexpected, missing"):
                    self.run_import()
                self.assertFalse(self.destination.exists())

    def test_existing_nonmatching_art_must_never_be_overwritten(self):
        target=self.destination/"files/world/world_0"
        target.mkdir(parents=True)
        original=target/"overworld.png"
        original.write_bytes(b"unapproved user custom artwork")
        with self.assertRaisesRegex(ValueError,"Existing NPC artwork differs"):
            self.run_import()
        self.assertEqual(original.read_bytes(),b"unapproved user custom artwork")


if __name__=="__main__":
    unittest.main()
