import { expect, test } from '@playwright/test';
import { PNG } from 'pngjs';
import { unzipSync } from 'fflate';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

test('PNG físico a tres resoluciones y ZIP multipágina sin cambiar el montaje', async ({ page }, info) => {
  await page.goto('/');
  await expect(page.getByLabel('Resolución PNG')).toHaveValue('300');
  await page.getByRole('button', { name: 'Configurar formato' }).click();
  await page.getByLabel('Ancho del pliego (mm)').fill('60');
  await page.getByLabel('Largo del pliego (mm)').fill('50');
  await page.getByLabel('Margen izquierdo (mm)').fill('3');
  await page.getByLabel('Margen superior (mm)').fill('2');
  await page.getByRole('button', { name: 'Guardar formato', exact: true }).click();
  const image = new PNG({ width: 240, height: 240 });
  for (let y = 0; y < 240; y++) for (let x = 0; x < 240; x++) if (x < 80 || y < 70 || x > 190) image.data.set(x < 80 ? [255, 0, 0, 255] : [0, 0, 255, 255], (y * 240 + x) * 4);
  await page.getByLabel('Subir diseños PNG').setInputFiles({ name: 'color.png', mimeType: 'image/png', buffer: PNG.sync.write(image) });
  await page.getByLabel('Ancho (cm)', { exact: true }).fill('2');
  await page.getByLabel('Ancho (cm)', { exact: true }).blur();
  await expect(page.getByTestId('layout-summary')).toContainText('1 pieza');
  await mkdir('artifacts/qa', { recursive: true });
  for (const dpi of [150, 300, 600]) {
    await page.getByLabel('Resolución PNG').selectOption(String(dpi));
    const promise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Descargar PNG', exact: true }).click();
    const download = await promise, destination = info.outputPath(`print-${dpi}.png`);
    await download.saveAs(destination);
    const bytes = await readFile(destination), png = PNG.sync.read(bytes);
    expect(png.width).toBe(Math.round(60 * dpi / 25.4));
    expect(png.height).toBe(Math.round(50 * dpi / 25.4));
    expect(png.data[3]).toBe(0);
    const density = bytes.indexOf(Buffer.from('pHYs'));
    expect(bytes.readUInt32BE(density + 4)).toBe(Math.round(dpi / .0254));
    await writeFile(`artifacts/qa/print-${dpi}.png`, bytes);
  }
  await page.getByLabel('Copias', { exact: true }).fill('8');
  await page.getByLabel('Copias', { exact: true }).blur();
  await expect(page.getByTestId('layout-summary')).toContainText('2 pliegos');
  const promise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Descargar PNG en ZIP', exact: true }).click();
  const download = await promise, destination = info.outputPath('pliegos.zip');
  await download.saveAs(destination);
  const files = unzipSync(await readFile(destination));
  expect(Object.keys(files)).toHaveLength(2);
  expect(Object.keys(files)[0]).toContain('pliego-001.png');
  expect(Object.keys(files)[1]).toContain('pliego-002.png');
  for (const bytes of Object.values(files)) expect(PNG.sync.read(Buffer.from(bytes)).width).toBe(1417);
  await writeFile('artifacts/qa/pliegos.zip', await readFile(destination));
});

test('exportación grande se puede cancelar y conserva diseños', async ({ page }) => {
  await page.goto('/');
  const image = new PNG({ width: 20, height: 20 }); image.data.fill(255);
  await page.getByLabel('Subir diseños PNG').setInputFiles({ name: 'grande.png', mimeType: 'image/png', buffer: PNG.sync.write(image) });
  await page.getByLabel('Resolución PNG').selectOption('600');
  await expect(page.getByRole('button', { name: 'Descargar PNG', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Descargar PNG', exact: true }).click();
  await page.getByRole('button', { name: 'Cancelar exportación' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Exportación cancelada' })).toBeVisible();
  await expect(page.getByTestId('design-card')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Descargar PDF', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Descargar este pliego en PNG', exact: true }).click();
  await page.getByRole('button', { name: 'Cancelar exportación' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Exportación cancelada' })).toBeVisible();
  await expect(page.locator('.sheet-frame')).toHaveAttribute('data-excluded', 'false');
  await expect(page.getByTestId('remaining-sheets')).toContainText('1 de 1');
});

test('rotación y espejo conservan márgenes físicos y coinciden con PDF', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Configurar formato' }).click();
  for (const [label, value] of [['Ancho del pliego (mm)', '40'], ['Largo del pliego (mm)', '65'], ['Margen izquierdo (mm)', '3'], ['Margen derecho (mm)', '7'], ['Margen superior (mm)', '2'], ['Margen inferior (mm)', '8']]) await page.getByLabel(label).fill(value);
  await page.getByRole('button', { name: 'Guardar formato', exact: true }).click();
  const image = new PNG({ width: 500, height: 200 });
  for (let y = 0; y < 200; y++) for (let x = 0; x < 500; x++) image.data.set(x < 160 ? [255, 0, 0, 255] : [0, 0, 255, 255], (y * 500 + x) * 4);
  await page.getByLabel('Subir diseños PNG').setInputFiles({ name: 'rotación.png', mimeType: 'image/png', buffer: PNG.sync.write(image) });
  await page.getByLabel('Ancho (cm)', { exact: true }).fill('5');
  await page.getByLabel('Ancho (cm)', { exact: true }).blur();
  await page.getByLabel('Aplicar espejo en el PDF').check();
  await expect(page.getByRole('button', { name: 'Descargar PNG', exact: true })).toBeEnabled();
  for (const format of ['PNG', 'PDF']) {
    const promise = page.waitForEvent('download');
    await page.getByRole('button', { name: `Descargar ${format}`, exact: true }).click();
    const download = await promise;
    await download.saveAs(`artifacts/qa/rotacion-espejo.${format.toLowerCase()}`);
  }
  const png = PNG.sync.read(await readFile('artifacts/qa/rotacion-espejo.png'));
  const pixel = (x: number, y: number) => [...png.data.subarray((Math.round(y * 300 / 25.4) * png.width + Math.round(x * 300 / 25.4)) * 4, (Math.round(y * 300 / 25.4) * png.width + Math.round(x * 300 / 25.4)) * 4 + 4)];
  expect(pixel(15, 7)).toEqual([255, 0, 0, 255]);
  expect(pixel(15, 42)).toEqual([0, 0, 255, 255]);
  expect(pixel(1, 7)[3]).toBe(0); expect(pixel(35, 7)[3]).toBe(0);
});

test('completa el film de 55 por 100 cm a 600 ppp por franjas', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto('/');
  const image = new PNG({ width: 20, height: 20 }); image.data.fill(255);
  await page.getByLabel('Subir diseños PNG').setInputFiles({ name: 'film.png', mimeType: 'image/png', buffer: PNG.sync.write(image) });
  await page.getByLabel('Resolución PNG').selectOption('600');
  const promise = page.waitForEvent('download', { timeout: 100000 });
  await expect(page.getByRole('button', { name: 'Descargar PNG', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Descargar PNG', exact: true }).click();
  await expect(page.getByRole('progressbar', { name: 'Progreso de exportación' })).toBeVisible();
  const download = await promise;
  await download.saveAs('artifacts/qa/film-600.png');
  const bytes = await readFile('artifacts/qa/film-600.png');
  expect(bytes.readUInt32BE(16)).toBe(12992); expect(bytes.readUInt32BE(20)).toBe(23622);
  await expect(page.getByRole('button', { name: 'Cancelar exportación' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Descargar PDF', exact: true })).toBeEnabled();
});
