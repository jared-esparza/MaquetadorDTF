import { it, expect } from 'vitest';
import { mkdir, writeFile } from 'node:fs/promises';
import { PNG } from 'pngjs';
import { createPrintPdf } from '../src/core/pdf';
import { DEFAULT_PROFILE, profileForLayout, type LayoutResult } from '../src/core/model';
import { packDesigns } from '../src/core/layout';

it('genera muestras de giros, espejo, alfa y calibración para verificación con un lector independiente', async () => {
  const png = new PNG({ width: 100, height: 60 });
  for (let y = 0; y < 60; y++) for (let x = 0; x < 100; x++) {
    const color = x < 20 || y < 10 ? [255, 0, 0, 255] : x >= 80 && y >= 40 ? [0, 0, 255, 255] : [0, 0, 0, 0];
    png.data.set(color, (y * 100 + x) * 4);
  }
  const assets = [{ id: 'marca', widthMm: 80, heightMm: 48, copies: 2, png: new Uint8Array(PNG.sync.write(png)) }];
  const profile = { ...DEFAULT_PROFILE, widthMm: 220, heightMm: 180, margins: { top: 10, right: 10, bottom: 10, left: 10 } };
  const layout: LayoutResult = { pieceCount: 2, unplacedIds: [], pages: [{ utilization: 0.24, placements: [
    { designId: 'marca', copyIndex: 0, xMm: 10, yMm: 10, widthMm: 80, heightMm: 48, rotation: 0 },
    { designId: 'marca', copyIndex: 1, xMm: 120, yMm: 20, widthMm: 48, heightMm: 80, rotation: 90 },
  ] }] };
  await mkdir('artifacts/qa', { recursive: true });
  for (const mirror of [false, true]) {
    const pdf = await createPrintPdf(assets, layout, profile, { gapMm: 4, mirror });
    expect(pdf.byteLength).toBeGreaterThan(500);
    await writeFile(`artifacts/qa/${mirror ? 'espejo' : 'normal'}.pdf`, pdf);
  }
  const square = new PNG({ width: 1200, height: 1200 });
  for (let y = 0; y < 1200; y++) for (let x = 0; x < 1200; x++) {
    if (x < 12 || y < 12 || x >= 1188 || y >= 1188 || (x < 240 && y < 240)) square.data.set([0, 0, 0, 255], (y * 1200 + x) * 4);
  }
  const calibration = [{ id: 'cuadrado', widthMm: 100, heightMm: 100, copies: 1, png: new Uint8Array(PNG.sync.write(square)) }];
  const calibrationLayout: LayoutResult = { pieceCount: 1, unplacedIds: [], pages: [{ utilization: .25, placements: [{ designId: 'cuadrado', copyIndex: 0, xMm: 10, yMm: 10, widthMm: 100, heightMm: 100, rotation: 0 }] }] };
  await writeFile('artifacts/calibracion-100mm.pdf', await createPrintPdf(calibration, calibrationLayout, { ...profile, widthMm: 210, heightMm: 297 }, { gapMm: 4, mirror: false }));

  const asymProfile = { ...profile, widthMm: 200, heightMm: 100, margins: { top: 5, right: 30, bottom: 5, left: 10 } };
  const solid = new PNG({ width: 160, height: 90 }); solid.data.fill(255);
  const asymAssets = [{ id: 'solid', widthMm: 160, heightMm: 90, copies: 1, png: new Uint8Array(PNG.sync.write(solid)) }];
  const asymLayout = packDesigns(asymAssets, profileForLayout(asymProfile, true), 4);
  await writeFile('artifacts/qa/margenes-espejo.pdf', await createPrintPdf(asymAssets, asymLayout, asymProfile, { gapMm: 4, mirror: true }));
});
