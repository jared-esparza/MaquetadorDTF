import { expect, type Page } from '@playwright/test';
import { PNG } from 'pngjs';

export async function prepareSpread(page: Page) {
  await page.getByRole('button', { name: 'Configurar formato' }).click();
  for (const [label, value] of [['Ancho del pliego (mm)', '100'], ['Largo del pliego (mm)', '100'],
    ['Margen izquierdo (mm)', '3'], ['Margen derecho (mm)', '5'], ['Margen superior (mm)', '2'], ['Margen inferior (mm)', '4']]) {
    await page.getByLabel(label).fill(value);
  }
  await page.getByRole('button', { name: 'Guardar formato', exact: true }).click();
  const image = new PNG({ width: 600, height: 600 });
  for (let y = 0; y < 600; y++) for (let x = 0; x < 600; x++) {
    const color = x >= 240 && x < 360 && y >= 240 && y < 360 ? [0, 0, 0, 0] : x < 150 ? [255, 0, 0, 255] : [0, 0, 255, 255];
    image.data.set(color, (y * 600 + x) * 4);
  }
  const buffer = PNG.sync.write(image);
  await page.getByLabel('Subir diseños PNG').setInputFiles({ name: 'reparto.png', mimeType: 'image/png', buffer });
  await page.getByLabel('Ancho (cm)', { exact: true }).fill('2');
  await page.getByLabel('Copias', { exact: true }).fill('20');
  await page.getByLabel('Copias', { exact: true }).blur();
  await page.getByLabel('Nombre del trabajo').fill('Reparto'); await page.getByLabel('Nombre del trabajo').blur();
  await expect(page.getByTestId('layout-summary')).toContainText('3 pliegos');
  await expect(page.getByRole('button', { name: 'Repartir espacios', exact: true })).toBeEnabled();
  return buffer;
}

export const sheetPositions = (page: Page, selector = '.sheet-frame') => page.locator(`${selector} image`).evaluateAll(images =>
  images.map(image => ['x', 'y', 'width', 'height', 'transform'].map(name => image.getAttribute(name))));

export async function expectSpreadGrid(page: Page, mirror = false) {
  const positions = await sheetPositions(page);
  expect(positions).toHaveLength(9);
  expect([...new Set(positions.map(p => Number(p[0])))].sort((a, b) => a - b)).toEqual(mirror ? [5, 41, 77] : [3, 39, 75]);
  expect([...new Set(positions.map(p => Number(p[1])))].sort((a, b) => a - b)).toEqual([2, 39, 76]);
  expect(positions.every(p => p[2] === '20' && p[3] === '20' && p[4] === null)).toBe(true);
}
