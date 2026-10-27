"""Independent PNG/ZIP QA using Pillow, zlib and PDFium, without a full-film raster."""
from pathlib import Path
from io import BytesIO
import json, struct, zipfile, zlib
from PIL import Image
import pypdfium2 as pdfium

root = Path(__file__).resolve().parent.parent / 'artifacts' / 'qa'
reports = []

# Hand-derived 3 x 3 grid on 100 mm sheets: 20 mm pieces, asymmetric margins.
# Compact starts: x=3,30,57; y=2,29,56. Spread: x=3,39,75; y=2,39,76.
def check_spread(image, spread=True, mirror=False):
    assert image.mode == 'RGBA'
    assert abs(image.width * 25.4 / 300 - 100) < .15
    assert abs(image.height * 25.4 / 300 - 100) < .15
    xs = [3, 39, 75] if spread else [3, 30, 57]
    ys = [2, 39, 76] if spread else [2, 29, 56]
    # The mirrored packing swaps the horizontal margins before reflecting.
    if mirror and not spread:
        xs = [21, 48, 75]
    for x in xs:
        for y in ys:
            colors = [(2, 3, (255, 0, 0, 255)), (16, 3, (0, 0, 255, 255)), (10, 10, (0, 0, 0, 0))]
            for dx, dy, expected in colors:
                if mirror:
                    dx = 20 - dx
                actual = image.getpixel((round((x + dx) * 300 / 25.4), round((y + dy) * 300 / 25.4)))
                assert actual == expected, (spread, mirror, x, y, dx, dy, actual, expected)
    # Count and measure opaque spans through the first row/column, independently of JS.
    def spans(values):
        edges = [i for i in range(len(values)) if values[i] != (values[i-1] if i else False)]
        if values[-1]: edges.append(len(values))
        return list(zip(edges[::2], edges[1::2]))
    horizontal = spans([image.getpixel((x, round(5 * 300 / 25.4)))[3] > 128 for x in range(image.width)])
    vertical = spans([image.getpixel((round((xs[0] + 2) * 300 / 25.4), y))[3] > 128 for y in range(image.height)])
    for actual, expected in [(horizontal, xs), (vertical, ys)]:
        assert len(actual) == 3, actual
        for (start, end), position in zip(actual, expected):
            assert abs(start * 25.4 / 300 - position) < .2, (actual, expected)
            assert abs((end - start) * 25.4 / 300 - 20) < .2, (actual, expected)
    assert image.getpixel((0, 0))[3] == 0

def check_spread_pdf(data, mirror=False, combined=False):
    doc = pdfium.PdfDocument(data)
    assert len(doc) == (3 if combined else 1)
    for index in ([0, 1] if combined else [0]):
        page = doc[index]
        bitmap = page.render(scale=300 / 72, fill_color=(0, 0, 0, 0))
        check_spread(bitmap.to_pil().convert('RGBA'), spread=not combined or index == 1, mirror=mirror)
        bitmap.close(); page.close()
    doc.close()

for mirror in (False, True):
    prefix = root / ('spread-mirror' if mirror else 'spread-normal')
    with Image.open(prefix.with_suffix('.png')) as image:
        image.load(); check_spread(image, mirror=mirror)
    check_spread_pdf(prefix.with_suffix('.pdf').read_bytes(), mirror)
    check_spread_pdf(Path(str(prefix) + '-combined.pdf').read_bytes(), mirror, combined=True)
    for extension in ('png', 'pdf'):
        with zipfile.ZipFile(Path(str(prefix) + f'-{extension}.zip')) as archive:
            assert archive.namelist() == [f'Reparto-pliego-{i:03}.{extension}' for i in (1, 2, 3)]
            for index in (1, 2):
                data = archive.read(f'Reparto-pliego-{index:03}.{extension}')
                if extension == 'png':
                    with Image.open(BytesIO(data)) as image:
                        image.load(); check_spread(image, spread=index == 2, mirror=mirror)
                elif index == 2:
                    check_spread_pdf(data, mirror)
    reports.append({'spread_mirror': mirror, 'individual_zip_combined_size_positions_colors_alpha': 'PASS'})

if (root / 'desktop-spread.png').exists():
    with Image.open(root / 'desktop-spread.png') as image:
        image.load(); check_spread(image)
    check_spread_pdf((root / 'desktop-spread.pdf').read_bytes())
    reports.append({'desktop_spread_size_positions_colors_alpha': 'PASS'})

# Selected pages use original numbering and full opacity, independently of the UI.
def check_selected(image):
    assert image.mode == 'RGBA'
    assert abs(image.width * 25.4 / 300 - 60) < .15
    assert abs(image.height * 25.4 / 300 - 40) < .15
    for x, y, expected in [(50, 8, (255, 0, 0, 255)), (15, 8, (0, 0, 255, 255)),
                           (35, 14, (0, 0, 0, 0)), (1, 1, (0, 0, 0, 0))]:
        actual = image.getpixel((round(x * 300 / 25.4), round(y * 300 / 25.4)))
        if expected[3] == 0:
            assert actual[3] == 0, (x, y, actual, expected)
        else:
            assert actual == expected, (x, y, actual, expected)
    box = image.getbbox()
    assert abs((box[2] - box[0]) * 25.4 / 300 - 50) < .2
    assert abs((box[3] - box[1]) * 25.4 / 300 - 25) < .2

with Image.open(root / 'selected-sheet.png') as image:
    image.load(); check_selected(image)
pdf_paths = [root / 'selected-sheet.pdf']
with zipfile.ZipFile(root / 'selected-sheets.zip') as archive:
    assert archive.namelist() == ['Pliegos-pliego-001.png', 'Pliegos-pliego-003.png']
    for name in archive.namelist():
        with Image.open(BytesIO(archive.read(name))) as image:
            image.load(); check_selected(image)
with zipfile.ZipFile(root / 'selected-pdfs.zip') as archive:
    assert archive.namelist() == ['Pliegos-pliego-001.pdf', 'Pliegos-pliego-003.pdf']
    for index, name in enumerate(archive.namelist()):
        path = root / f'selected-check-{index}.pdf'
        path.write_bytes(archive.read(name)); pdf_paths.append(path)
for path in pdf_paths:
    doc = pdfium.PdfDocument(str(path)); assert len(doc) == 1
    page = doc[0]; bitmap = page.render(scale=300 / 72, fill_color=(0, 0, 0, 0))
    check_selected(bitmap.to_pil().convert('RGBA'))
    bitmap.close(); page.close(); doc.close()
reports.append({'selected_pages_original_numbers': [1, 3], 'individual_page': 2, 'size_alpha_colors_mirror': 'PASS'})

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
