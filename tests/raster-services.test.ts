import { expect, it } from 'vitest';
import { PNG } from 'pngjs';
import { zipSync } from 'fflate';
import { validateRasterRequest } from '../electron/services.mjs';

it('solo permite PNG y ZIP con extensión, firma y tamaño coherentes', () => {
  const png = new PNG({ width: 1, height: 1 });
  const bytes = new Uint8Array(PNG.sync.write(png));
  expect(() => validateRasterRequest({ filename: 'impresión ñ.png', type: 'png', bytes })).not.toThrow();
  expect(() => validateRasterRequest({ filename: 'pliegos.zip', type: 'zip', bytes: zipSync({ 'pliego-001.png': bytes }) })).not.toThrow();
  for (const request of [
    { filename: '../fuera.png', type: 'png', bytes },
    { filename: 'otro.pdf', type: 'png', bytes },
    { filename: 'otro.zip', type: 'zip', bytes },
    { filename: 'otro.png', type: 'png', bytes: new Uint8Array(100) },
    { filename: 'otro.exe', type: 'exe', bytes },
  ]) expect(() => validateRasterRequest(request)).toThrow();
});
