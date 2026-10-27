import { expect, it } from 'vitest';
import { designHeight, widthFromHeight, imageBudget, checkImageBudget, pixelsAfterEdit, retainedPixelCount } from '../src/core/model';
import { defaultExportBaseName, normalizeExportBaseName, exportNameError, exportFilename } from '../src/core/exportNames';

it('usa hora local y conserva tildes, espacios y extensiones automáticas', () => {
  expect(defaultExportBaseName(new Date(2026, 9, 27, 15, 3))).toBe('DTF-2026-10-27-1503');
  expect(normalizeExportBaseName('  Impresión ñ.PDF  ')).toBe('Impresión ñ');
  expect(exportNameError('Impresión ñ')).toBe('');
  expect(exportFilename('Impresión ñ', 'png')).toBe('Impresión ñ.png');
  expect(exportFilename('Impresión ñ', 'pdf', 2)).toBe('Impresión ñ-pliego-002.pdf');
  expect(exportFilename('Impresión ñ', 'zip')).toBe('Impresión ñ.zip');
  expect(normalizeExportBaseName('Pedido.pdf.png')).toBe('Pedido');
  expect(normalizeExportBaseName(normalizeExportBaseName('Pedido.pdf.png'))).toBe('Pedido');
  expect(normalizeExportBaseName('Pedido.pdf .png')).toBe('Pedido');
  expect(exportNameError(normalizeExportBaseName('.pdf.png'))).not.toBe('');
});

it.each(['', ' ', 'a'.repeat(121), '../fuera', 'a..b', 'a/b', 'a\\b', 'a:b', 'a?', 'a\u0000b', 'final.', 'CON', 'con.txt', 'LPT1', 'COM9', 'NUL', 'AUX', 'PRN'])('rechaza nombre inválido %j', name => {
  expect(exportNameError(name)).not.toBe('');
  expect(() => exportFilename(name, 'pdf')).toThrow();
});

it('recupera 60 MP ante preferencias antiguas o inválidas', () => {
  for (const value of [undefined, null, '120', 0, 61, {}, NaN]) expect(imageBudget(value)).toBe(60);
  for (const value of [60, 120, 240]) expect(imageBudget(value)).toBe(value);
});

it.each([60, 120, 240] as const)('comprueba la frontera de %i MP sin reservar imágenes grandes', budget => {
  expect(() => checkImageBudget(budget * 1_000_000, budget)).not.toThrow();
  expect(() => checkImageBudget(budget * 1_000_000 + 1, budget)).toThrow(String(budget));
});

it('cuenta originales y deshacer únicos, ignora copias y descarta el deshacer sustituido', () => {
  const original = { width: 3000, height: 2000 };
  const raster = { width: 4000, height: 2000 };
  const design = { id: 'a', original, raster, undo: { raster: original }, copies: 3000 };
  expect(retainedPixelCount([design])).toBe(14_000_000);
  expect(pixelsAfterEdit([design], 'a', 4000, 4000)).toBe(30_000_000);
  expect(design.raster).toBe(raster);
});

it.each([[600, 300], [300, 600], [300, 300], [713, 317]])('enlaza ambos ejes sin acumular redondeos: %i × %i', (width, height) => {
  const design = { raster: { width, height, sourceScale: 1, data: new Uint8ClampedArray() }, widthMm: 123.456 };
  for (let i = 0; i < 100; i++) design.widthMm = widthFromHeight(design, designHeight(design));
  expect(design.widthMm).toBeCloseTo(123.456, 9);
  expect(widthFromHeight(design, 50)).toBeCloseTo(50 * width / height, 9);
});
