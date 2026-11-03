import { expect, test, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { expectSpreadGrid, prepareSpread, sheetPositions } from '../helpers/spread';

async function download(page: Page, button: string, target?: string) {
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: button, exact: true }).click();
  const file = await pending;
  if (target) await file.saveAs(target);
  return file;
}

test('reparte solo el pliego visible, conserva las otras marcas y restaura exactamente', async ({ page }) => {
  await page.goto('/'); await prepareSpread(page);
  const compact = await sheetPositions(page);
  const summary = await page.getByTestId('layout-summary').textContent();
  for (const index of [1, 2, 3]) {
    await page.getByRole('button', { name: `Ver pliego ${index}`, exact: true }).click();
    await download(page, 'Descargar este pliego en PDF');
    await expect(page.locator('.sheet-frame')).toHaveAttribute('data-excluded', 'true');
  }
  await page.getByRole('button', { name: 'Ver pliego 2', exact: true }).click();
  await page.getByRole('button', { name: 'Repartir espacios', exact: true }).click();
  await expectSpreadGrid(page);
  await expect(page.getByTestId('layout-summary')).toHaveText(summary!);
  await expect(page.getByTestId('remaining-sheets')).toContainText('1 de 3');
  await expect(page.getByRole('status').filter({ hasText: 'El pliego 2 ha cambiado' })).toBeVisible();
  for (const index of [1, 3]) await expect(page.getByRole('button', { name: `Ver pliego ${index}`, exact: true })).toHaveAttribute('data-excluded', 'true');
  expect(await sheetPositions(page, '.page-thumbnail.active')).toEqual(await sheetPositions(page));
  await page.getByRole('button', { name: 'Ver pliego 1', exact: true }).click();
  expect(await sheetPositions(page)).toEqual(compact);
  await page.getByRole('button', { name: 'Repartir espacios', exact: true }).click();
  await expectSpreadGrid(page);
  await expect(page.getByTestId('remaining-sheets')).toContainText('2 de 3');
  await page.getByRole('button', { name: 'Ver pliego 2', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Restaurar compacto', exact: true })).toBeEnabled();
  await download(page, 'Descargar este pliego en PNG');
  await expect(page.locator('.sheet-frame')).toHaveAttribute('data-excluded', 'true');
  await page.getByRole('button', { name: 'Restaurar compacto', exact: true }).click();
  expect(await sheetPositions(page)).toEqual(compact);
  await expect(page.locator('.sheet-frame')).toHaveAttribute('data-excluded', 'false');
  await expect(page.getByRole('status').filter({ hasText: 'montaje compacto restaurado' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ver pliego 3', exact: true })).toHaveAttribute('data-excluded', 'true');
  await page.getByRole('button', { name: 'Ver pliego 1', exact: true }).click();
  await expectSpreadGrid(page);
});

test('bloqueos, cambios geométricos y de contenido reinician el reparto; opciones de salida lo conservan', async ({ page }) => {
  await page.goto('/'); const buffer = await prepareSpread(page);
  const spread = () => page.getByRole('button', { name: 'Repartir espacios', exact: true });
  const restore = () => page.getByRole('button', { name: 'Restaurar compacto', exact: true });
  await spread().click();
  await page.getByLabel('Nombre del trabajo').fill('Otro'); await page.getByLabel('Nombre del trabajo').blur();
  await page.getByLabel('Resolución PNG').selectOption('150');
  await page.getByLabel('Organización del PDF').selectOption('combined');
  await expectSpreadGrid(page);
  await page.getByLabel('Ancho (cm)', { exact: true }).fill('');
  await expect(restore()).toBeDisabled();
  await page.getByLabel('Ancho (cm)', { exact: true }).fill('2'); await page.getByLabel('Ancho (cm)', { exact: true }).blur();
  await expect(restore()).toBeEnabled();
  await page.getByRole('button', { name: 'Configurar formato' }).click();
  await expect(restore()).toBeDisabled();
  await page.getByRole('button', { name: 'Guardar formato', exact: true }).click();
  await expect(restore()).toBeEnabled();
  await page.getByRole('button', { name: 'Borrador · fondo y colores', exact: true }).click();
  await expect(restore()).toBeDisabled();
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(restore()).toBeEnabled();
  const mutations: (() => Promise<unknown>)[] = [
    () => page.getByLabel('Distancia entre diseños').selectOption('8'),
    () => page.getByLabel('Aplicar espejo en el PDF').check(),
    async () => { await page.getByLabel('Ancho (cm)', { exact: true }).fill('2.1'); await page.getByLabel('Ancho (cm)', { exact: true }).blur(); },
    async () => { await page.getByLabel('Copias', { exact: true }).fill('21'); await page.getByLabel('Copias', { exact: true }).blur(); },
    async () => {
      await page.getByRole('button', { name: 'Configurar formato' }).click();
      await page.getByLabel('Margen izquierdo (mm)').fill('4');
      await page.getByRole('button', { name: 'Guardar formato', exact: true }).click();
    },
    async () => {
      // Aplicar sin borrar conserva medidas y píxeles, pero cambia la versión del raster.
      await page.getByRole('button', { name: 'Borrador · fondo y colores', exact: true }).click();
      await page.getByRole('button', { name: 'Aplicar', exact: true }).click();
    },
    () => page.getByRole('button', { name: 'Deshacer', exact: true }).click(),
    async () => {
      await page.getByLabel('Subir diseños PNG').setInputFiles({ name: 'extra.png', mimeType: 'image/png', buffer });
      await page.getByLabel('Ancho (cm)', { exact: true }).first().fill('2.1');
      await page.getByLabel('Ancho (cm)', { exact: true }).first().blur();
    },
    () => page.getByRole('button', { name: 'Quitar extra.png', exact: true }).click(),
  ];
  for (const mutate of mutations) {
    if (await spread().count()) await spread().click();
    await mutate();
    await expect(spread()).toBeVisible();
    await expect(restore()).toHaveCount(0);
  }
  await page.getByLabel('Copias', { exact: true }).fill('1'); await page.getByLabel('Copias', { exact: true }).blur();
  await expect(spread()).toBeDisabled();
  await expect(page.getByText('No hay espacio que repartir', { exact: true })).toBeVisible();
});

for (const mirror of [false, true]) test(`exporta posiciones repartidas en PNG/PDF individuales, ZIP y multipágina; espejo=${mirror}`, async ({ page }) => {
  await page.goto('/'); await prepareSpread(page);
  if (mirror) await page.getByLabel('Aplicar espejo en el PDF').check();
  await page.getByRole('button', { name: 'Ver pliego 2', exact: true }).click();
  await page.getByRole('button', { name: 'Repartir espacios', exact: true }).click();
  await expectSpreadGrid(page, mirror);
  await mkdir('artifacts/qa', { recursive: true });
  const prefix = `artifacts/qa/spread-${mirror ? 'mirror' : 'normal'}`;
  for (const type of ['png', 'pdf']) {
    const file = await download(page, `Descargar este pliego en ${type.toUpperCase()}`, `${prefix}.${type}`);
    expect(file.suggestedFilename()).toBe(`Reparto-pliego-002.${type}`);
    await expect(page.locator('.sheet-frame')).toHaveAttribute('data-excluded', 'true');
  }
  await page.getByRole('button', { name: 'Volver a incluir', exact: true }).click();
  await download(page, 'Descargar PNG en ZIP', `${prefix}-png.zip`);
  await download(page, 'Descargar PDF en ZIP', `${prefix}-pdf.zip`);
  await page.getByLabel('Organización del PDF').selectOption('combined');
  await download(page, 'Descargar PDF', `${prefix}-combined.pdf`);
  await expectSpreadGrid(page, mirror);
  await expect(page.getByTestId('remaining-sheets')).toContainText('3 de 3');
});

test('cancelar una exportación conserva reparto y marcas y bloquea restaurar mientras trabaja', async ({ page }) => {
  await page.goto('/'); await prepareSpread(page);
  await page.getByRole('button', { name: 'Repartir espacios', exact: true }).click();
  await download(page, 'Descargar este pliego en PDF');
  await expect(page.locator('.sheet-frame')).toHaveAttribute('data-excluded', 'true');
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/export.worker-*.js', async route => { await gate; await route.continue().catch(() => {}); });
  try {
    await page.getByRole('button', { name: 'Descargar este pliego en PNG', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Restaurar compacto', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: 'Cancelar exportación', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Exportación cancelada' })).toBeVisible();
  } finally { release(); await page.unroute('**/export.worker-*.js'); }
  await expectSpreadGrid(page);
  await expect(page.locator('.sheet-frame')).toHaveAttribute('data-excluded', 'true');
});
