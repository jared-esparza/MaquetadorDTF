import { expect, it } from 'vitest';
import { PNG } from 'pngjs';
import { PngEncoder, pngDimensions } from '../src/core/png';
import { DEFAULT_PROFILE } from '../src/core/model';

it('calcula resoluciones y admite el film completo a 600 ppp sin reservar su raster', () => {
  expect(pngDimensions(DEFAULT_PROFILE, 600)).toEqual({ width: 12992, height: 23622 });
  expect(() => pngDimensions({ ...DEFAULT_PROFILE, widthMm: 5000 }, 600)).toThrow(/resolución|formato/);
  expect(() => pngDimensions(DEFAULT_PROFILE, 72)).toThrow();
});
it.each([150, 300, 600])('codifica RGBA por franjas, con resolución física %i', dpi => {
  const chunks: Uint8Array[] = [];
  const encoder = new PngEncoder(2, 260, dpi, chunk => chunks.push(chunk));
  const pixels = new Uint8Array(2 * 260 * 4);
  for (let y = 0; y < 260; y++) pixels.set([255, 0, 0, 255, 0, 0, 0, 0], y * 8);
  encoder.push(pixels.subarray(0, 128 * 8));
  encoder.push(pixels.subarray(128 * 8, 256 * 8));
  encoder.push(pixels.subarray(256 * 8)); encoder.finish();
  const bytes = Buffer.concat(chunks.map(c => Buffer.from(c)));
  expect(PNG.sync.read(bytes).data).toEqual(Buffer.from(pixels));
  const physical = bytes.indexOf(Buffer.from('pHYs'));
  expect(bytes.readUInt32BE(physical + 4)).toBe(Math.round(dpi / .0254));
  expect(bytes[physical + 12]).toBe(1);
});
it('rechaza filas incompletas y finalización prematura', () => {
  const encoder = new PngEncoder(3, 2, 300, () => {});
  expect(() => encoder.push(new Uint8Array(5))).toThrow();
  expect(() => encoder.finish()).toThrow();
});
