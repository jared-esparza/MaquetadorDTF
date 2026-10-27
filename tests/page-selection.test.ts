import { expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { unzipSync } from 'fflate';
import { exportPageIndices } from '../src/core/print';
import { createPrintPdfBundle } from '../src/core/pdf';
import { DEFAULT_PROFILE } from '../src/core/model';
import { packDesigns } from '../src/core/layout';
import { PNG } from 'pngjs';
import { exportSelectionFilename } from '../src/core/exportNames';

const profile = { ...DEFAULT_PROFILE, widthMm: 60, heightMm: 40 };
const png = new PNG({ width: 600, height: 300 }); png.data.fill(255);
const assets = [{ id: 'a', widthMm: 50, heightMm: 25, copies: 3, png: new Uint8Array(PNG.sync.write(png)) }];
const layout = packDesigns(assets, profile, 7);
const options = { gapMm: 7, mirror: false, organization: 'separate' as const, exportBaseName: 'Trabajo' };

it('selecciona índices originales ordenados sin modificar la petición', () => {
  const indices = [2, 0];
  expect(exportPageIndices(layout, indices)).toEqual([0, 2]);
  expect(indices).toEqual([2, 0]);
  expect(exportPageIndices(layout)).toEqual([0, 1, 2]);
});

it.each([[], [0, 0], [-1], [3], [1.5], [NaN]].map(indices => ({ indices })))('rechaza selección inválida $indices', ({ indices }) => {
  expect(() => exportPageIndices(layout, indices)).toThrow(/pliegos/);
});

it('nombra descargas individuales y el último pendiente sin renumerar', () => {
  expect(exportSelectionFilename('Trabajo', 'png', [1], 3)).toBe('Trabajo-pliego-002.png');
  expect(exportSelectionFilename('Trabajo', 'pdf', [0], 1)).toBe('Trabajo.pdf');
  expect(exportSelectionFilename('Trabajo', 'pdf', [0], 1, true)).toBe('Trabajo-pliego-001.pdf');
  expect(exportSelectionFilename('Trabajo', 'zip', [0, 2], 3)).toBe('Trabajo.zip');
});

it('el ZIP conserva huecos y un único seleccionado genera PDF directo', async () => {
  const result = await createPrintPdfBundle(assets, layout, profile, { ...options, pageIndices: [2, 0] });
  expect(result.type).toBe('zip');
  expect(Object.keys(unzipSync(result.bytes))).toEqual(['Trabajo-pliego-001.pdf', 'Trabajo-pliego-003.pdf']);
  const single = await createPrintPdfBundle(assets, layout, profile, { ...options, pageIndices: [1] });
  expect(single.type).toBe('pdf');
  expect((await PDFDocument.load(single.bytes)).getPageCount()).toBe(1);
  const combined = await createPrintPdfBundle(assets, layout, profile, { ...options, organization: 'combined', pageIndices: [0, 2] });
  expect((await PDFDocument.load(combined.bytes)).getPageCount()).toBe(2);
});

it('valida todas las copias y páginas antes de seleccionar, también las no exportadas', async () => {
  const broken = { ...layout, pages: layout.pages.map((page, index) => index === 1 ? { ...page, placements: [] } : page) };
  await expect(createPrintPdfBundle(assets, broken, profile, { ...options, pageIndices: [0] })).rejects.toThrow(/copias/);
  await expect(createPrintPdfBundle(assets, layout, profile, { ...options, pageIndices: [] })).rejects.toThrow(/pliegos/);
});
