import { expect, test } from '@playwright/test';
import { PNG } from 'pngjs';
import { PDFDocument } from 'pdf-lib';
import { readFile } from 'node:fs/promises';

function samplePng(opaque = false) {
  const png = new PNG({ width: 600, height: 300 });
  for (let y = 0; y < 300; y++) for (let x = 0; x < 600; x++) {
    const i = (y * 600 + x) * 4;
    const mark = x >= 50 && x < 550 && y >= 30 && y < 270;
    png.data.set(mark ? (x < 200 ? [255, 0, 0, 255] : [0, 0, 255, 255]) : opaque ? [255, 255, 255, 255] : [0, 0, 0, 0], i);
  }
  return PNG.sync.write(png);
}

test('carga, recorta transparencia, monta múltiples páginas y descarga PDF físico', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Maquetador DTF' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Actualizaciones', exact: true })).toHaveCount(0);
  await expect(page.getByLabel('Distancia entre diseños')).toHaveValue('7');
  await page.getByLabel('Distancia entre diseños').selectOption('6');
  await expect(page.getByLabel('Distancia entre diseños')).toHaveValue('6');
  await page.getByLabel('Distancia entre diseños').selectOption('7');
  await page.getByLabel('Subir diseños PNG').setInputFiles({ name: 'prueba-transparente.png', mimeType: 'image/png', buffer: samplePng() });
  const card = page.getByTestId('design-card');
  await expect(card).toHaveCount(1);
  await card.getByLabel('Ancho (cm)').fill('20');
  await card.getByLabel('Ancho (cm)').blur();
  await card.getByLabel('Copias', { exact: true }).fill('60');
  await card.getByLabel('Copias', { exact: true }).blur();
  await expect(page.getByTestId('layout-summary')).toContainText('60 piezas');
  await expect(page.getByTestId('layout-summary')).toContainText('3 pliegos');
  const sheetBounds = await page.getByRole('img', { name: 'Vista previa del pliego', exact: true }).boundingBox();
  expect(sheetBounds!.width / sheetBounds!.height).toBeCloseTo(.55, 2);
  await page.getByLabel('Organización del PDF').selectOption('combined');
  await expect(page.getByRole('button', { name: 'Descargar PDF', exact: true })).toBeDisabled();
  await page.getByLabel('Acepto que los diseños de baja resolución pueden verse pixelados.').check();
  await expect(page.getByRole('button', { name: 'Descargar PDF', exact: true })).toBeEnabled();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Descargar PDF', exact: true }).click();
  const download = await downloadPromise;
  const destination = testInfo.outputPath('montaje-60-copias.pdf');
  await download.saveAs(destination);
  const pdf = await PDFDocument.load(await readFile(destination));
  expect(pdf.getPageCount()).toBe(3);
  expect(pdf.getPage(0).getWidth()).toBeCloseTo(1559.055118, 5);
  expect(pdf.getPage(0).getHeight()).toBeCloseTo(2834.645669, 5);
  await page.screenshot({ path: testInfo.outputPath('editor.png'), fullPage: true });
  expect(errors).toEqual([]);
});

test('elimina fondo, permite cancelar y deshacer, y rechaza una pieza demasiado grande', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Subir diseños PNG').setInputFiles({ name: 'con-fondo.png', mimeType: 'image/png', buffer: samplePng(true) });
  const card = page.getByTestId('design-card');
  await expect(card.getByText('El fondo también se imprime.')).toBeVisible();
  await card.getByRole('button', { name: 'Borrador · fondo y colores' }).click();
  await expect(page.getByRole('button', { name: 'Aplicar', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(card.getByText('El fondo también se imprime.')).toBeVisible();
  await card.getByRole('button', { name: 'Borrador · fondo y colores' }).click();
  await page.getByRole('button', { name: 'Aplicar', exact: true }).click();
  await expect(card.getByText('Fondo quitado.')).toBeVisible();
  await expect(card.getByText('El fondo también se imprime.')).toHaveCount(0);
  await card.getByRole('button', { name: 'Deshacer', exact: true }).click();
  await expect(card.getByText('El fondo también se imprime.')).toBeVisible();
  await card.getByLabel('Ancho (cm)').fill('120');
  await card.getByLabel('Ancho (cm)').blur();
  await expect(page.getByRole('alert').filter({ hasText: 'no cabe' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Descargar PDF', exact: true })).toBeDisabled();
});

test('configura y conserva el perfil, muestra espejo y valida cantidades y archivos', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Configurar formato' }).click();
  await page.getByLabel('Ancho del pliego (mm)').fill('300');
  await page.getByLabel('Ancho del pliego (mm)').blur();
  await page.getByLabel('Largo del pliego (mm)').fill('450');
  await page.getByLabel('Largo del pliego (mm)').blur();
  await page.getByRole('button', { name: 'Guardar formato' }).click();
  await page.reload();
  await expect(page.getByTestId('profile-dimensions')).toContainText('300 × 450 mm');
  await page.getByLabel('Subir diseños PNG').setInputFiles({ name: 'falso.png', mimeType: 'image/png', buffer: Buffer.from('no soy un PNG') });
  await expect(page.getByRole('alert').filter({ hasText: 'La imagen está dañada o no se puede leer.' })).toBeVisible();
  await expect(page.getByTestId('design-card')).toHaveCount(0);
  await page.getByLabel('Subir diseños PNG').setInputFiles({ name: 'bueno.png', mimeType: 'image/png', buffer: samplePng() });
  const card = page.getByTestId('design-card');
  await expect(card).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Descargar PDF', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Configurar formato' }).click();
  await expect(page.getByRole('button', { name: 'Descargar PDF', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Cerrar formato' }).click();
  await card.getByLabel('Copias', { exact: true }).fill('1.5');
  await card.getByLabel('Copias', { exact: true }).blur();
  await expect(card.getByText('Introduce un número entero entre 1 y 3000.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Descargar PDF', exact: true })).toBeDisabled();
  await card.getByLabel('Copias', { exact: true }).fill('2');
  await card.getByLabel('Copias', { exact: true }).blur();
  await page.getByLabel('Aplicar espejo en el PDF').check();
  await expect(page.getByText('Vista previa en espejo')).toBeVisible();
  await expect(page.getByTestId('layout-summary')).toContainText('2 piezas');
  await page.getByLabel('Subir diseños PNG').setInputFiles([
    { name: 'segundo.png', mimeType: 'image/png', buffer: samplePng() },
    { name: 'tercero.png', mimeType: 'image/png', buffer: samplePng() },
  ]);
  const cards = page.getByTestId('design-card');
  await expect(cards.locator('.design-name')).toHaveText(['tercero.png', 'segundo.png', 'bueno.png']);
  await expect(cards.last().getByLabel('Copias', { exact: true })).toHaveValue('2');
  await cards.first().getByLabel('Ancho (cm)').fill('3');
  await cards.first().getByLabel('Ancho (cm)').blur();
  await expect(cards.first().getByText('Medida final')).toContainText('3 × 1,44 cm');
  await expect(page.getByTestId('layout-summary')).toContainText('4 piezas');
  await cards.first().getByRole('button', { name: 'Quitar tercero.png', exact: true }).click();
  await expect(cards.locator('.design-name')).toHaveText(['segundo.png', 'bueno.png']);
  await page.getByLabel('Subir diseños PNG').setInputFiles({ name: 'ultimo.png', mimeType: 'image/png', buffer: samplePng() });
  await expect(cards.locator('.design-name')).toHaveText(['ultimo.png', 'segundo.png', 'bueno.png']);
});

test('en pantalla estrecha conserva los controles accesibles y no desborda horizontalmente', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByLabel('Subir diseños PNG').setInputFiles({ name: 'movil.png', mimeType: 'image/png', buffer: samplePng() });
  await expect(page.getByTestId('layout-summary')).toContainText('1 pieza');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Descargar PDF', exact: true }).scrollIntoViewIfNeeded();
  await expect(page.getByRole('button', { name: 'Descargar PDF', exact: true })).toBeEnabled();
  await page.screenshot({ path: testInfo.outputPath('movil.png'), fullPage: true });
});

test('rechaza PNG vacío y exceso de tamaño sin dejar diseños parciales', async ({ page }) => {
  await page.goto('/');
  const png = new PNG({ width: 8, height: 8 });
  await page.getByLabel('Subir diseños PNG').setInputFiles({ name: 'vacio.png', mimeType: 'image/png', buffer: PNG.sync.write(png) });
  await expect(page.getByRole('alert').filter({ hasText: 'contenido visible' })).toBeVisible();
  await expect(page.getByTestId('design-card')).toHaveCount(0);
  await page.getByLabel('Subir diseños PNG').setInputFiles({ name: 'grande.png', mimeType: 'image/png', buffer: Buffer.alloc(20 * 1024 * 1024 + 1) });
  await expect(page.getByRole('alert').filter({ hasText: '20 MB' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Descargar PDF', exact: true })).toBeDisabled();
});
