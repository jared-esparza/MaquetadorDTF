import { expect, test, type Download, type Page, type TestInfo } from '@playwright/test';
import { PNG } from 'pngjs';
import { PDFDocument } from 'pdf-lib';
import { unzipSync } from 'fflate';
import { mkdir, readFile } from 'node:fs/promises';

async function prepare(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Configurar formato' }).click();
  for (const [label, value] of [['Ancho del pliego (mm)', '60'], ['Largo del pliego (mm)', '40'], ['Margen izquierdo (mm)', '3'], ['Margen superior (mm)', '2']]) await page.getByLabel(label).fill(value);
  await page.getByRole('button', { name: 'Guardar formato', exact: true }).click();
  const png = new PNG({ width: 600, height: 300 });
  for (let y = 0; y < 300; y++) for (let x = 0; x < 600; x++) {
    const color = x >= 240 && x < 360 && y >= 90 && y < 210 ? [0, 0, 0, 0] : x < 150 || x === 599 && (y === 0 || y === 299) ? [255, 0, 0, 255] : [0, 0, 255, 255];
    png.data.set(color, (y * 600 + x) * 4);
  }
  const buffer = PNG.sync.write(png);
  await page.getByLabel('Subir diseños PNG').setInputFiles({ name: 'pliegos.png', mimeType: 'image/png', buffer });
  await page.getByLabel('Ancho (cm)', { exact: true }).fill('5');
  await page.getByLabel('Copias', { exact: true }).fill('3');
  await page.getByLabel('Copias', { exact: true }).blur();
  await page.getByLabel('Nombre del trabajo').fill('Pliegos'); await page.getByLabel('Nombre del trabajo').blur();
  await expect(page.getByTestId('layout-summary')).toContainText('3 pliegos');
  return buffer;
}

async function download(page: Page, button: string) {
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: button, exact: true }).click();
  return pending;
}

async function bundle(page: Page, info: TestInfo, type: 'PDF' | 'PNG', suffix: string) {
  const file = await download(page, `Descargar ${type} en ZIP`);
  expect(file.suggestedFilename()).toBe('Pliegos.zip');
  const target = info.outputPath(`${suffix}.zip`); await file.saveAs(target);
  const files = unzipSync(await readFile(target));
  expect(Object.keys(files)).toEqual([1, 3].map(n => `Pliegos-pliego-00${n}.${type.toLowerCase()}`));
  return file;
}

test('descargas individuales, ZIP con huecos, PDF único y reinclusión entre formatos', async ({ page }, info) => {
  await prepare(page);
  await page.getByLabel('Aplicar espejo en el PDF').check();
  await page.getByRole('button', { name: 'Ver pliego 2', exact: true }).click();
  await mkdir('artifacts/qa', { recursive: true });
  for (const type of ['PNG', 'PDF']) {
    let file: Download;
    if (type === 'PNG') {
      let releaseWorker!: () => void;
      const gate = new Promise<void>(resolve => { releaseWorker = resolve; });
      await page.route('**/export.worker-*.js', async route => { await gate; await route.continue(); });
      const pending = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Descargar este pliego en PNG', exact: true }).click();
      await page.getByRole('button', { name: 'Ver pliego 3', exact: true }).click();
      releaseWorker(); file = await pending;
      await page.unroute('**/export.worker-*.js');
      await expect(page.locator('.sheet-frame')).toHaveAttribute('data-excluded', 'false');
      await page.getByRole('button', { name: 'Ver pliego 2', exact: true }).click();
    } else file = await download(page, 'Descargar este pliego en PDF');
    expect(file.suggestedFilename()).toBe(`Pliegos-pliego-002.${type.toLowerCase()}`);
    await file.saveAs(`artifacts/qa/selected-sheet.${type.toLowerCase()}`);
    await expect(page.locator('.sheet-frame')).toHaveAttribute('data-excluded', 'true');
    await expect(page.getByRole('button', { name: 'Ver pliego 2', exact: true })).toHaveAttribute('data-excluded', 'true');
    await expect(page.getByTestId('remaining-sheets')).toContainText('2 de 3');
  }
  const zip = await bundle(page, info, 'PNG', 'png'); await zip.saveAs('artifacts/qa/selected-sheets.zip');
  await bundle(page, info, 'PNG', 'repeat');
  const pdfZip = await bundle(page, info, 'PDF', 'pdf'); await pdfZip.saveAs('artifacts/qa/selected-pdfs.zip');
  await expect(page.getByTestId('remaining-sheets')).toContainText('2 de 3');
  await page.getByLabel('Organización del PDF').selectOption('combined');
  const combined = await download(page, 'Descargar PDF');
  expect(combined.suggestedFilename()).toBe('Pliegos.pdf');
  const target = info.outputPath('combined.pdf'); await combined.saveAs(target);
  expect((await PDFDocument.load(await readFile(target))).getPageCount()).toBe(2);
  await page.getByLabel('Resolución PNG').selectOption('150');
  await page.getByLabel('Nombre del trabajo').fill('Otro'); await page.getByLabel('Nombre del trabajo').blur();
  await page.getByRole('button', { name: 'Ver pliego 1', exact: true }).click();
  await expect(page.locator('.sheet-frame')).toHaveAttribute('data-excluded', 'false');
  await page.getByRole('button', { name: 'Ver pliego 2', exact: true }).click();
  await expect(page.locator('.sheet-frame')).toHaveAttribute('data-excluded', 'true');
  await page.getByRole('button', { name: 'Volver a incluir', exact: true }).click();
  await expect(page.getByTestId('remaining-sheets')).toContainText('3 de 3');
  await expect(page.locator('.sheet-frame')).toHaveAttribute('data-excluded', 'false');
  await page.getByRole('button', { name: 'Ver pliego 1', exact: true }).click();
  await download(page, 'Descargar este pliego en PDF');
  await page.getByRole('button', { name: 'Ver pliego 3', exact: true }).click();
  await download(page, 'Descargar este pliego en PNG');
  await expect(page.getByTestId('remaining-sheets')).toContainText('1 de 3');
  for (const type of ['PDF', 'PNG']) {
    const file = await download(page, `Descargar ${type}`);
    expect(file.suggestedFilename()).toBe(`Otro-pliego-002.${type.toLowerCase()}`);
    await expect(page.getByTestId('remaining-sheets')).toContainText('1 de 3');
  }
  await page.getByRole('button', { name: 'Ver pliego 2', exact: true }).click();
  await download(page, 'Descargar este pliego en PDF');
  await expect(page.getByTestId('remaining-sheets')).toContainText('0 de 3');
  await expect(page.getByRole('button', { name: 'Descargar PDF', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Descargar PNG', exact: true })).toBeDisabled();
  await download(page, 'Descargar este pliego en PNG');
  await expect(page.getByTestId('remaining-sheets')).toContainText('0 de 3');
  await page.getByRole('button', { name: 'Volver a incluir', exact: true }).click();
  await expect(page.getByTestId('remaining-sheets')).toContainText('1 de 3');
});

test('los cambios reinician marcas, incluidas ediciones del raster con idénticas medidas', async ({ page }) => {
  const buffer = await prepare(page);
  const mutations: (() => Promise<unknown>)[] = [
    ...['8', '9', '10'].map(gap => () => page.getByLabel('Distancia entre diseños').selectOption(gap)),
    () => page.getByLabel('Aplicar espejo en el PDF').check(),
    async () => { await page.getByLabel('Ancho (cm)', { exact: true }).fill('5.1'); await page.getByLabel('Ancho (cm)', { exact: true }).blur(); },
    async () => { await page.getByLabel('Copias', { exact: true }).fill('2'); await page.getByLabel('Copias', { exact: true }).blur(); },
    async () => {
      // The red corner pixels preserve the full bounds when the blue is erased.
      const measure = await page.getByText('Medida final').textContent();
      await page.getByRole('button', { name: 'Borrador · fondo y colores' }).click();
      await page.getByRole('button', { name: 'Aplicar', exact: true }).click();
      await expect(page.getByText('Medida final')).toHaveText(measure!);
    },
    () => page.getByRole('button', { name: 'Deshacer', exact: true }).click(),
    async () => {
      await page.getByRole('button', { name: 'Configurar formato' }).click();
      await page.getByLabel('Margen izquierdo (mm)').fill('4');
      await page.getByRole('button', { name: 'Guardar formato', exact: true }).click();
    },
    () => page.getByLabel('Subir diseños PNG').setInputFiles({ name: 'extra.png', mimeType: 'image/png', buffer }),
    () => page.getByRole('button', { name: 'Quitar extra.png', exact: true }).click(),
  ];
  for (const mutate of mutations) {
    await download(page, 'Descargar este pliego en PDF');
    await expect(page.locator('.sheet-frame')).toHaveAttribute('data-excluded', 'true');
    await mutate();
    await expect(page.locator('.sheet-frame')).toHaveAttribute('data-excluded', 'false');
    await expect(page.getByRole('status').filter({ hasText: 'todos los pliegos vuelven a incluirse' })).toBeVisible();
  }
});
