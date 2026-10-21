import { describe, expect, it } from 'vitest';
import { PDFDict, PDFDocument, PDFName, PDFRawStream } from 'pdf-lib';
import { inflateSync } from 'node:zlib';
import { PNG } from 'pngjs';
import { createPrintPdf } from '../src/core/pdf';
import { DEFAULT_PROFILE, type LayoutResult } from '../src/core/model';
import { packDesigns } from '../src/core/layout';

const profile = { ...DEFAULT_PROFILE, widthMm: 204, heightMm: 204 };
function pngBytes() {
  const png = new PNG({ width: 2, height: 2 });
  png.data.set([255, 0, 0, 255, 0, 0, 0, 0, 255, 0, 0, 255, 255, 0, 0, 255]);
  return new Uint8Array(PNG.sync.write(png));
}
const assets = [{ id: 'a', png: pngBytes(), widthMm: 100, heightMm: 100, copies: 5 }];

describe('PDF de impresión', () => {
  it('exporta dos páginas físicas exactas, comparte la imagen y mantiene máscara alfa', async () => {
    const layout = packDesigns(assets, profile, 4);
    const bytes = await createPrintPdf(assets, layout, profile, { gapMm: 4, mirror: false });
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(2);
    expect(doc.getPage(0).getWidth()).toBeCloseTo(578.2677165354, 7);
    expect(doc.getPage(0).getHeight()).toBeCloseTo(578.2677165354, 7);
    const images = doc.context.enumerateIndirectObjects().map(([, obj]) => obj).filter(obj => obj instanceof PDFRawStream && obj.dict.get(PDFName.of('Subtype')) === PDFName.of('Image')) as PDFRawStream[];
    expect(images.filter(image => image.dict.has(PDFName.of('SMask')))).toHaveLength(1);
    const firstObjects = doc.getPage(0).node.Resources()!.lookup(PDFName.of('XObject'), PDFDict);
    const secondObjects = doc.getPage(1).node.Resources()!.lookup(PDFName.of('XObject'), PDFDict);
    expect(new Set([...firstObjects.values(), ...secondObjects.values()].map(ref => ref.toString())).size).toBe(1);
  });

  it('refleja todo el pliego con una transformación horizontal, sin alterar su tamaño', async () => {
    const layout = packDesigns(assets, profile, 4);
    const bytes = await createPrintPdf(assets, layout, profile, { gapMm: 4, mirror: true });
    const doc = await PDFDocument.load(bytes);
    const contentText = doc.context.enumerateIndirectObjects().map(([, obj]) => obj).filter(obj => obj instanceof PDFRawStream && !obj.dict.has(PDFName.of('Subtype'))).map(obj => inflateSync((obj as PDFRawStream).contents).toString()).join('\n');
    expect(contentText).toContain('-1 0 0 1 578.2677165354331 0 cm');
    expect(doc.getPage(0).getWidth()).toBeCloseTo(578.2677165354, 7);
  });

  it('rechaza montaje incompleto, imágenes ausentes y geometría manipulada', async () => {
    const layout = packDesigns(assets, profile, 4);
    await expect(createPrintPdf([], layout, profile, { gapMm: 4, mirror: false })).rejects.toThrow();
    const missing: LayoutResult = { ...layout, pages: layout.pages.slice(0, 1) };
    await expect(createPrintPdf(assets, missing, profile, { gapMm: 4, mirror: false })).rejects.toThrow();
    const bad = structuredClone(layout);
    bad.pages[0].placements[0].xMm = -2;
    await expect(createPrintPdf(assets, bad, profile, { gapMm: 4, mirror: false })).rejects.toThrow();
  });
});
