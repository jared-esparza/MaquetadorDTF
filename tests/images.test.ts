import { describe, expect, it } from 'vitest';
import { cropRaster, eraseBackground, refineRaster } from '../src/core/images';
import { designMetrics, parsePositiveNumber, pixelsAfterEdit, retainedPixelCount } from '../src/core/model';
import type { Raster } from '../src/core/model';

function raster(rows: string[]): Raster {
  const colors: Record<string, number[]> = { '.': [0, 0, 0, 0], w: [255, 255, 255, 255], r: [255, 0, 0, 255], g: [230, 230, 230, 255] };
  return { width: rows[0].length, height: rows.length, sourceScale: 1, data: new Uint8ClampedArray(rows.flatMap(row => [...row].flatMap(c => colors[c]))) };
}

describe('imágenes de impresión', () => {
  it('recorta únicamente bordes transparentes y conserva los píxeles originales', () => {
    const result = cropRaster(raster(['.....', '.rrr.', '.rrr.', '.....']));
    expect([result.width, result.height]).toEqual([3, 2]);
    expect([...result.data.slice(0, 4)]).toEqual([255, 0, 0, 255]);
  });
  it('rechaza una imagen sin contenido visible', () => {
    expect(() => cropRaster(raster(['..', '..']))).toThrow(/visible/);
  });
  it('conserva el blanco encerrado al borrar desde los bordes y no modifica el original', () => {
    const input = raster(['wwwww', 'wrrrw', 'wrwrw', 'wrrrw', 'wwwww']);
    const output = eraseBackground(input, { tolerance: 35, mode: 'connected' });
    expect(output.data[3]).toBe(0);
    expect(output.data[(2 * 5 + 2) * 4 + 3]).toBe(255);
    expect(input.data[3]).toBe(255);
  });
  it('elimina también el mismo color interior en modo global', () => {
    const output = eraseBackground(raster(['wwwww', 'wrrrw', 'wrwrw', 'wrrrw', 'wwwww']), { tolerance: 35, mode: 'global' });
    expect(output.data[(2 * 5 + 2) * 4 + 3]).toBe(0);
    expect(output.data[(1 * 5 + 1) * 4 + 3]).toBe(255);
  });
  it('respeta la tolerancia y permite elegir otro color con la varita', () => {
    const input = raster(['wgr']);
    expect(eraseBackground(input, { tolerance: 20, mode: 'global' }).data[7]).toBe(255);
    expect(eraseBackground(input, { tolerance: 35, mode: 'global' }).data[7]).toBe(0);
    const wand = eraseBackground(input, { tolerance: 0, mode: 'connected', seed: { x: 2, y: 0 } });
    expect(wand.data[11]).toBe(0);
    expect(wand.data[3]).toBe(255);
  });
  it('afina sin inflar los ppp y sin introducir halo blanco en la transparencia', () => {
    const input = raster(['.r', '.r']);
    const output = refineRaster(input);
    expect([output.width, output.height, output.sourceScale]).toEqual([4, 4, 2]);
    expect(designMetrics(output, 25.4).dpi).toBeCloseTo(2, 4);
    const visible = Array.from({ length: output.width * output.height }, (_, i) => i).filter(i => output.data[i * 4 + 3] > 0);
    expect(visible.every(i => output.data[i * 4] === 255 && output.data[i * 4 + 1] === 0)).toBe(true);
  });
  it('calcula medidas sin deformar y admite coma decimal', () => {
    const metrics = designMetrics({ ...raster(['rr', 'rr']), width: 600, height: 300 }, 50.8);
    expect(metrics.heightMm).toBe(25.4);
    expect(metrics.dpi).toBe(300);
    expect(parsePositiveNumber('12,5')).toBe(12.5);
    expect(parsePositiveNumber('')).toBeNull();
    expect(parsePositiveNumber('-3')).toBeNull();
    expect(parsePositiveNumber('3abc')).toBeNull();
  });
  it('no califica como buena una imagen inferior a 300 ppp ni como justa una inferior a 150', () => {
    const input = { ...raster(['r']), width: 299, height: 299 };
    expect(designMetrics(input, 25.4).quality).toBe('fair');
    expect(designMetrics({ ...input, width: 149 }, 25.4).quality).toBe('low');
  });
  it('cuenta originales y versiones únicas y anticipa la memoria al afinar', () => {
    const original = { width: 3000, height: 2000 };
    const designs = Array.from({ length: 10 }, (_, i) => ({ id: String(i), original: { ...original }, raster: { ...original }, undo: undefined }));
    designs.forEach(d => { d.raster = d.original; });
    expect(retainedPixelCount(designs)).toBe(60_000_000);
    expect(pixelsAfterEdit(designs, '0', 6000, 4000)).toBe(84_000_000);
    const edited = { id: 'x', original, raster: { width: 6000, height: 4000 }, undo: { raster: original } };
    expect(retainedPixelCount([edited])).toBe(30_000_000);
  });
});
