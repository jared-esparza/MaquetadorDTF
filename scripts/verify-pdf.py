"""Independent PDF QA. Run with Python providing pypdf, pypdfium2 and Pillow."""
from pathlib import Path
import json
from pypdf import PdfReader
import pypdfium2 as pdfium

ROOT = Path(__file__).resolve().parent.parent
reports = []

for name in ("normal", "espejo"):
    path = ROOT / "artifacts" / "qa" / f"{name}.pdf"
    reader = PdfReader(path)
    assert len(reader.pages) == 1
    box = reader.pages[0].mediabox
    assert abs(float(box.width) * 25.4 / 72 - 220) < .0001
    assert abs(float(box.height) * 25.4 / 72 - 180) < .0001
    doc = pdfium.PdfDocument(str(path))
    page = doc[0]
    bitmap = page.render(scale=25.4 / 72, fill_color=(0, 0, 0, 0))
    image = bitmap.to_pil().convert("RGBA")
    # PDFium rounds bitmap dimensions upwards; PDF float precision may add one edge pixel.
    assert 220 <= image.width <= 221 and 180 <= image.height <= 181, image.size
    # Hand-derived physical positions in mm, independent of the JS transform.
    checks = [(15, 45, (255, 0, 0, 255)), (82, 50, (0, 0, 255, 255)),
              (50, 40, (0, 0, 0, 0)), (150, 26, (255, 0, 0, 255)),
              (128, 92, (0, 0, 255, 255)), (140, 60, (0, 0, 0, 0)),
              (5, 5, (0, 0, 0, 0))]
    for x, y, expected in checks:
        if name == "espejo":
            x = 219 - x
        actual = image.getpixel((x, y))
        if expected[3] == 0:
            assert actual[3] == 0, (name, x, y, actual, expected)
        else:
            assert actual == expected, (name, x, y, actual, expected)
    image.save(ROOT / "artifacts" / "qa" / f"{name}.png")
    reports.append({"file": path.name, "size_mm": [220, 180], "pixel_checks": len(checks), "result": "PASS"})
    bitmap.close(); page.close(); doc.close()

calibration = PdfReader(ROOT / "artifacts" / "calibracion-100mm.pdf")
assert abs(float(calibration.pages[0].mediabox.width) * 25.4 / 72 - 210) < .0001
doc = pdfium.PdfDocument(str(ROOT / "artifacts" / "calibracion-100mm.pdf"))
page = doc[0]
bitmap = page.render(scale=300 / 72, fill_color=(0, 0, 0, 0))
image = bitmap.to_pil().convert("RGBA")
box = image.getbbox()
width_mm = (box[2] - box[0]) * 25.4 / 300
height_mm = (box[3] - box[1]) * 25.4 / 300
assert abs(width_mm - 100) < .1 and abs(height_mm - 100) < .1, (box, width_mm, height_mm)
image.save(ROOT / "artifacts" / "qa" / "calibracion.png")
reports.append({"file": "calibracion-100mm.pdf", "rendered_size_mm": [round(width_mm, 3), round(height_mm, 3)], "raster_tolerance_mm": .1, "result": "PASS"})
bitmap.close(); page.close(); doc.close()

doc = pdfium.PdfDocument(str(ROOT / "artifacts" / "qa" / "margenes-espejo.pdf"))
page = doc[0]
bitmap = page.render(scale=300 / 72, fill_color=(0, 0, 0, 0))
image = bitmap.to_pil().convert("RGBA")
box = image.getbbox()
physical_bounds = [value * 25.4 / 300 for value in box]
for actual, expected in zip(physical_bounds, [10, 5, 170, 95]):
    assert abs(actual - expected) < .1, (physical_bounds, box)
reports.append({"file": "margenes-espejo.pdf", "visible_bounds_mm": [round(n, 3) for n in physical_bounds], "result": "PASS"})
bitmap.close(); page.close(); doc.close()
(ROOT / "artifacts" / "qa" / "verification.json").write_text(json.dumps(reports, indent=2), encoding="utf-8")
print(json.dumps(reports, indent=2))
