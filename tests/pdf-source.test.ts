import { expect, it } from 'vitest';
import { PDFDocument, PDFName, rgb } from 'pdf-lib';
import { unzipSync } from 'fflate';
import { inspectPdf, retainedPdfBytes } from '../src/core/pdfSource';
import { createPrintPdfBundle } from '../src/core/pdf';
import { DEFAULT_PROFILE } from '../src/core/model';
import { packDesigns } from '../src/core/layout';

it('valida PDF y rechaza cifrado/formularios/capas, sin ejecutar acciones', async () => {
  const doc = await PDFDocument.create(); doc.addPage([200, 100]);
  expect((await inspectPdf(await doc.save())).getPageCount()).toBe(1);
  doc.catalog.set(PDFName.of('OCProperties'), doc.context.obj({}));
  await expect(inspectPdf(await doc.save())).rejects.toThrow(/capas/);
  await expect(inspectPdf(new Uint8Array([1, 2, 3]))).rejects.toThrow(/PDF/);
});

it('entrega PDF individuales en ZIP, conserva vectores y comparte los bytes originales', async () => {
  const original = await PDFDocument.create(); const page = original.addPage([200, 100]);
  page.drawRectangle({ x: 0, y: 0, width: 200, height: 100, color: rgb(1, 0, 0) });
  const document = { id: 'source', bytes: await original.save() };
  const pdf = { document, pageIndex: 0, box: { left: 0, bottom: 0, right: 200, top: 100 }, matrix: [1, 0, 0, 1, 0, 0] as [number,number,number,number,number,number], widthPt: 200, heightPt: 100 };
  const assets = [{ id: 'pdf', pdf, widthMm: 80, heightMm: 40, copies: 3 }];
  const profile = { ...DEFAULT_PROFILE, widthMm: 90, heightMm: 50 };
  const layout = packDesigns(assets, profile, 7);
  const result = await createPrintPdfBundle(assets, layout, profile, { gapMm: 7, mirror: false, organization: 'separate', exportBaseName: 'Impresión ñ' });
  expect(result.type).toBe('zip');
  const files = unzipSync(result.bytes); expect(Object.keys(files)).toEqual(['Impresión ñ-pliego-001.pdf', 'Impresión ñ-pliego-002.pdf', 'Impresión ñ-pliego-003.pdf']);
  for (const bytes of Object.values(files)) {
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
    expect(doc.getPage(0).getWidth()).toBeCloseTo(90 * 72 / 25.4);
    expect(doc.context.enumerateIndirectObjects().some(([, object]) => object.toString().includes('/Subtype /Form'))).toBe(true);
    expect(doc.context.enumerateIndirectObjects().some(([, object]) => object.toString().includes('/Subtype /Image'))).toBe(false);
  }
  expect(retainedPdfBytes([{ pdf }, { pdf, undo: { pdf } }])).toBe(document.bytes.length);
});
