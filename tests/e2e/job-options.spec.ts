import { expect, test, type Page } from '@playwright/test';
import { PNG } from 'pngjs';
import { PDFDocument } from 'pdf-lib';
import { unzipSync } from 'fflate';
import { mkdir, readFile } from 'node:fs/promises';

function image(width = 200, height = 100) {
  const png = new PNG({ width, height });
  png.data.fill(255);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    png.data.set(x >= width * .4 && x < width * .6 && y >= height * .3 && y < height * .7 ? [0, 0, 0, 0] : x < width / 4 ? [0, 0, 255, 255] : [255, 0, 0, 255], (y * width + x) * 4);
  }
  return { name: 'diseño.png', mimeType: 'image/png', buffer: PNG.sync.write(png) };
}

async function smallProfile(page: Page) {
  await page.getByRole('button', { name: 'Configurar formato' }).click();
  await page.getByLabel('Ancho del pliego (mm)').fill('60');
  await page.getByLabel('Largo del pliego (mm)').fill('30');
  await page.getByLabel('Margen izquierdo (mm)').fill('3');
  await page.getByLabel('Margen superior (mm)').fill('2');
  await page.getByRole('button', { name: 'Guardar formato', exact: true }).click();
}

test('medidas enlazadas, validación, nombres y contenido de todos los formatos', async ({ page }, info) => {
  await page.goto('/');
  await smallProfile(page);
  await page.getByLabel('Subir diseños PNG').setInputFiles(image());
  const width = page.getByLabel('Ancho (cm)', { exact: true });
  const height = page.getByLabel('Alto (cm)', { exact: true });
  await height.fill('2'); await height.blur();
  await expect(width).toHaveValue('4');
  await width.fill('3'); await width.blur();
  await expect(height).toHaveValue('1.5');
  await height.fill('2,0'); await height.blur();
  await expect(width).toHaveValue('4');
  await height.fill('');
  await expect(height).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByRole('button', { name: 'Descargar PNG', exact: true })).toBeDisabled();
  await expect(width).toHaveValue('4');
  await height.fill('0'); await expect(height).toHaveAttribute('aria-invalid', 'true');
  await height.fill('2'); await height.blur();
  const name = page.getByLabel('Nombre del trabajo');
  await expect(name).toHaveValue(/^DTF-\d{4}-\d{2}-\d{2}-\d{4}$/);
  await name.fill('../fuera');
  await expect(page.getByRole('button', { name: 'Descargar PDF', exact: true })).toBeDisabled();
  await name.fill('Impresión ñ.PDF'); await name.blur();
  await expect(name).toHaveValue('Impresión ñ');
  await expect(page.getByRole('button', { name: 'Descargar PNG', exact: true })).toBeEnabled();
  await mkdir('artifacts/qa', { recursive: true });
  for (const type of ['PNG', 'PDF'] as const) {
    const pending = page.waitForEvent('download');
    await page.getByRole('button', { name: `Descargar ${type}`, exact: true }).click();
    const download = await pending;
    expect(download.suggestedFilename()).toBe(`Impresión ñ.${type.toLowerCase()}`);
    await download.saveAs(`artifacts/qa/job-named.${type.toLowerCase()}`);
  }
  const png = PNG.sync.read(await readFile('artifacts/qa/job-named.png'));
  const pixel = (x: number, y: number) => [...png.data.subarray((Math.round(y * 300 / 25.4) * png.width + Math.round(x * 300 / 25.4)) * 4)].slice(0, 4);
  expect(pixel(8, 6)).toEqual([0, 0, 255, 255]);
  expect(pixel(33, 6)).toEqual([255, 0, 0, 255]);
  expect(pixel(23, 12)[3]).toBe(0);
  const pdf = await PDFDocument.load(await readFile('artifacts/qa/job-named.pdf'));
  expect(pdf.getPage(0).getWidth() * 25.4 / 72).toBeCloseTo(60, 4);
  expect(pdf.getPage(0).getHeight() * 25.4 / 72).toBeCloseTo(30, 4);
  await page.getByLabel('Copias', { exact: true }).fill('2');
  await page.getByLabel('Copias', { exact: true }).blur();
  await expect(page.getByTestId('layout-summary')).toContainText('2 pliegos');
  for (const type of ['PNG', 'PDF'] as const) {
    const pending = page.waitForEvent('download');
    await page.getByRole('button', { name: `Descargar ${type} en ZIP`, exact: true }).click();
    const download = await pending, target = info.outputPath(`${type}.zip`);
    expect(download.suggestedFilename()).toBe('Impresión ñ.zip');
    await download.saveAs(target);
    expect(Object.keys(unzipSync(await readFile(target)))).toEqual([1, 2].map(n => `Impresión ñ-pliego-00${n}.${type.toLowerCase()}`));
  }
  await page.getByLabel('Organización del PDF').selectOption('combined');
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Descargar PDF', exact: true }).click();
  const download = await pending, target = info.outputPath('combined.pdf');
  expect(download.suggestedFilename()).toBe('Impresión ñ.pdf'); await download.saveAs(target);
  expect((await PDFDocument.load(await readFile(target))).getPageCount()).toBe(2);
  await page.getByRole('button', { name: 'Quitar diseño.png', exact: true }).click();
  await expect(name).toHaveValue('');
  await page.getByLabel('Subir diseños PNG').setInputFiles(image());
  await expect(name).toHaveValue(/^DTF-\d{4}-\d{2}-\d{2}-\d{4}$/);
});

test('presupuesto persiste, protege ediciones y permite ampliar sin perder diseños', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto('/');
  const budget = page.getByLabel('Presupuesto de imágenes');
  await expect(budget).toHaveValue('60');
  await budget.selectOption('240');
  await page.reload(); await expect(budget).toHaveValue('240');
  await budget.selectOption('60');
  const source = image(3000, 2000);
  await page.getByLabel('Subir diseños PNG').setInputFiles(Array.from({ length: 7 }, (_, i) => ({ ...source, name: `diseño-${i}.png` })));
  const cards = page.getByTestId('design-card');
  await expect(cards).toHaveCount(7, { timeout: 60000 });
  await expect(page.getByTestId('image-budget-usage')).toHaveText('42 / 60 MP');
  const first = cards.first();
  await first.getByLabel('Copias', { exact: true }).fill('2');
  await expect(page.getByTestId('image-budget-usage')).toHaveText('42 / 60 MP');
  await first.getByRole('button', { name: 'Afinar los bordes' }).click();
  await expect(page.getByRole('alert')).toContainText('60 megapíxeles');
  await expect(cards).toHaveCount(7);
  await expect(first.getByRole('button', { name: 'Deshacer', exact: true })).toHaveCount(0);
  await budget.selectOption('120');
  await first.getByRole('button', { name: 'Afinar los bordes' }).click();
  await expect(first.getByRole('button', { name: 'Deshacer', exact: true })).toBeVisible({ timeout: 60000 });
  await expect(page.getByTestId('image-budget-usage')).toHaveText('66 / 120 MP');
  await budget.selectOption('60');
  await expect(budget).toHaveValue('120');
  await expect(page.getByRole('alert')).toContainText('Quita diseños');
  await first.getByRole('button', { name: 'Deshacer', exact: true }).click();
  await expect(page.getByTestId('image-budget-usage')).toHaveText('42 / 120 MP');
  await budget.selectOption('60'); await expect(budget).toHaveValue('60');
  await page.getByLabel('Subir diseños PNG').setInputFiles(Array.from({ length: 4 }, (_, i) => ({ ...source, name: `extra-${i}.png` })));
  await expect(cards).toHaveCount(10, { timeout: 60000 });
  await expect(page.getByTestId('image-budget-usage')).toHaveText('60 / 60 MP');
  await expect(page.getByRole('alert')).toContainText('60 megapíxeles');
  await budget.selectOption('120');
  await page.getByLabel('Subir diseños PNG').setInputFiles(source);
  await expect(cards).toHaveCount(11, { timeout: 60000 });
  await expect(page.getByTestId('image-budget-usage')).toHaveText('66 / 120 MP');
});

test('preferencias inválidas y fallo de guardado no impiden trabajar', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('pkprint-dtf-image-budget-v1', '"120"');
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (key === 'pkprint-dtf-image-budget-v1') throw new Error('sin espacio');
      return original.call(this, key, value);
    };
  });
  await page.goto('/');
  await expect(page.getByLabel('Presupuesto de imágenes')).toHaveValue('60');
  await page.getByLabel('Subir diseños PNG').setInputFiles(image());
  await page.getByLabel('Presupuesto de imágenes').selectOption('120');
  await expect(page.getByRole('alert')).toContainText('No se ha podido guardar el presupuesto');
  await expect(page.getByTestId('design-card')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Descargar PNG', exact: true })).toBeEnabled();
});
