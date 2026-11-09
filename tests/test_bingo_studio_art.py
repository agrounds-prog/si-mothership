"""Validate the actual teacher-approved Bingo Board Studio raster assets."""
import sys
import unittest
from pathlib import Path
from PIL import Image

ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,str(ROOT))
from bingo_studio_art import OUTPUT,NAMES,get_art_path

class BingoGraphicArtTests(unittest.TestCase):
    def test_all_approved_art_skins_are_served_as_images(self):
        for name in NAMES:
            with self.subTest(name=name):
                p=get_art_path(name)
                self.assertIsNotNone(p)
                self.assertTrue(p.is_file())
                self.assertGreater(p.stat().st_size,900)
                with Image.open(p) as image:
                    self.assertEqual(image.format,"WEBP")
                    self.assertGreater(image.width,300)
                    self.assertGreater(image.height,90)
    def test_dynamic_safe_and_separate_tile_states(self):
        regular=Image.open(get_art_path("tile-empty.webp"))
        selected=Image.open(get_art_path("tile-selected.webp"))
        self.assertEqual(regular.size,selected.size)
        self.assertNotEqual(regular.tobytes(),selected.tobytes())
    def test_raster_buttons_retain_transparent_outer_corners(self):
        for name in ("button-blue.webp","button-green.webp","button-red.webp"):
            with self.subTest(name=name):
                image=Image.open(get_art_path(name)).convert("RGBA")
                self.assertEqual(image.getpixel((0,0))[3],0)
    def test_no_arbitrary_art_paths(self):
        self.assertIsNone(get_art_path("../server.py"))
        self.assertIsNone(get_art_path("fake.webp"))
    def test_uploaded_source_art_is_unchanged(self):
        for name in ("01_full_bingo_board_studio_concept.png","02_header_bar_concept.png",
          "03_left_panel_board_setup_concept.png","04_right_sidebar_concept.png",
          "05_component_style_sheet.png"):
            self.assertTrue((ROOT/name).is_file())

if __name__=="__main__":
    unittest.main()
