"""Independent PNG/ZIP QA using Pillow, zlib and PDFium, without a full-film raster."""
from pathlib import Path
from io import BytesIO
import json, struct, zipfile, zlib
from PIL import Image
import pypdfium2 as pdfium

root = Path(__file__).resolve().parent.parent / 'artifacts' / 'qa'
reports = []

# Height-driven geometry and edited filename, independently decoded with Pillow/PDFium.
with Image.open(root / 'job-named.png') as image:
    image.load()
    assert image.size == (round(60 * 300 / 25.4), round(30 * 300 / 25.4))
    doc = pdfium.PdfDocument(str(root / 'job-named.pdf'))
    page = doc[0]
    bitmap = page.render(scale=300 / 72, fill_color=(0, 0, 0, 0))
    pdf = bitmap.to_pil().convert('RGBA')
    for x, y, expected in [(8, 6, (0, 0, 255, 255)), (33, 6, (255, 0, 0, 255)),
                           (23, 12, (0, 0, 0, 0)), (1, 1, (0, 0, 0, 0))]:
        position = (round(x * 300 / 25.4), round(y * 300 / 25.4))
        actual_png, actual_pdf = image.getpixel(position), pdf.getpixel(position)
        if expected[3] == 0:
            assert actual_png[3] == actual_pdf[3] == 0, (x, y, actual_png, actual_pdf)
        else:
            assert actual_png == actual_pdf == expected, (x, y, actual_png, actual_pdf)
    bounds = image.getbbox()
    assert abs((bounds[2] - bounds[0]) * 25.4 / 300 - 40) < .2
    assert abs((bounds[3] - bounds[1]) * 25.4 / 300 - 20) < .2
    bitmap.close(); page.close(); doc.close()
    reports.append({'height_edit_named_export': 'PASS', 'visible_size_mm': [40, 20], 'alpha_colors': 'PASS'})

for dpi in (150, 300, 600):
    with Image.open(root / f'print-{dpi}.png') as image:
        image.load()
        assert image.mode == 'RGBA'
        assert image.size == (round(60 * dpi / 25.4), round(50 * dpi / 25.4))
        assert abs(image.info['dpi'][0] - dpi) < .02
        def pixel(x, y): return image.getpixel((round(x * dpi / 25.4), round(y * dpi / 25.4)))
        assert pixel(0, 0)[3] == 0
        assert pixel(5, 5) == (255, 0, 0, 255)
        assert pixel(18, 5) == (0, 0, 255, 255)
        assert pixel(15, 17)[3] == 0
        for seam in range(128, image.height, 128):
            for y in (seam - 1, seam, seam + 1):
                if 3 < y * 25.4 / dpi < 21:
                    assert image.getpixel((round(5 * dpi / 25.4), y)) == (255, 0, 0, 255)
        reports.append({'png_ppp': dpi, 'size': image.size, 'alpha_colors_seams': 'PASS'})

with zipfile.ZipFile(root / 'pliegos.zip') as archive:
    assert len(archive.namelist()) == 2
    assert archive.testzip() is None
    for index, name in enumerate(archive.namelist(), 1):
        assert name.endswith(f'pliego-{index:03}.png')
        with Image.open(BytesIO(archive.read(name))) as image:
            image.load(); assert image.size == (1417, 1181)
    reports.append({'zip_pages': 2, 'result': 'PASS'})

with Image.open(root / 'rotacion-espejo.png') as image:
    doc = pdfium.PdfDocument(str(root / 'rotacion-espejo.pdf'))
    page = doc[0]; bitmap = page.render(scale=300/72, fill_color=(0, 0, 0, 0))
    pdf = bitmap.to_pil().convert('RGBA')
    for x, y, expected in [(15, 7, (255, 0, 0, 255)), (15, 42, (0, 0, 255, 255)), (1, 7, (0, 0, 0, 0)), (35, 7, (0, 0, 0, 0))]:
        position = (round(x * 300 / 25.4), round(y * 300 / 25.4))
        assert image.getpixel(position) == pdf.getpixel(position) == expected
    bitmap.close(); page.close(); doc.close()
    reports.append({'rotation_mirror_asymmetric_margins_pdf': 'PASS'})

data = (root / 'film-600.png').read_bytes()
assert struct.unpack('>II', data[16:24]) == (12992, 23622)
decoder = zlib.decompressobj(); total = 0; offset = 8; ended = False
while offset < len(data):
    length = struct.unpack('>I', data[offset:offset+4])[0]
    kind = data[offset+4:offset+8]; body = data[offset+8:offset+8+length]
    assert zlib.crc32(kind + body) & 0xffffffff == struct.unpack('>I', data[offset+8+length:offset+12+length])[0]
    if kind == b'IDAT':
        pending = body
        while pending:
            total += len(decoder.decompress(pending, 1024 * 1024)); pending = decoder.unconsumed_tail
    if kind == b'IEND': ended = True
    offset += length + 12
assert decoder.eof and ended and offset == len(data)
assert total == (12992 * 4 + 1) * 23622
reports.append({'full_film_600ppp': [12992, 23622], 'crc_inflate_stream': 'PASS'})

for name in ('desktop.png', 'desktop.zip'):
    file = root / name
    if file.exists():
        if file.suffix == '.png':
            with Image.open(file) as image: image.load(); assert image.mode == 'RGBA'
        else:
            with zipfile.ZipFile(file) as archive: assert archive.testzip() is None and len(archive.namelist()) == 2
        reports.append({'desktop_export': name, 'result': 'PASS'})
(root / 'png-verification.json').write_text(json.dumps(reports, indent=2), encoding='utf-8')
print(json.dumps(reports, indent=2))
