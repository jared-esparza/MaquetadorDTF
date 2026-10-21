import { test, expect, _electron, type ElectronApplication, type Page } from '@playwright/test';
import { createRequire } from 'node:module';
import { copyFile, mkdtemp, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { PNG } from 'pngjs';
import { PDFDocument } from 'pdf-lib';

const require = createRequire(import.meta.url);
let application: ElectronApplication;
let page: Page;
let directory: string;

function png() {
  const png = new PNG({ width: 600, height: 300 });
  for (let y = 30; y < 270; y++) for (let x = 50; x < 550; x++) {
    if (x < 170 || y < 75 || x > 470) png.data.set(x < 170 ? [255, 0, 0, 255] : [0, 0, 255, 255], (y * 600 + x) * 4);
  }
  return PNG.sync.write(png);
}

test.beforeEach(async () => {
  directory = await mkdtemp(path.join(os.tmpdir(), 'DTF escritorio ñ '));
  const env: Record<string, string> = Object.fromEntries(Object.entries({ ...process.env, DTF_TEST_DATA_DIR: directory }).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
  delete env.ELECTRON_RUN_AS_NODE;
  if (process.env.DTF_ELECTRON_EXE) env.PORTABLE_EXECUTABLE_DIR = directory;
  application = await _electron.launch({ executablePath: process.env.DTF_ELECTRON_EXE ?? require('electron'), args: process.env.DTF_ELECTRON_EXE ? [] : ['electron/main.mjs'], env });
  page = await application.firstWindow();
  await expect(page.getByRole('heading', { name: 'Maquetador DTF', exact: true })).toBeVisible();
});
test.afterEach(async () => {
  if (application) { await application.evaluate(({ app }) => app.exit(0)).catch(() => {}); await application.close().catch(() => {}); }
  if (directory) await rm(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
});

async function closeWelcome() {
  await page.getByRole('button', { name: 'Empezar a maquetar', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Bienvenido a Maquetador DTF' })).toHaveCount(0);
  await expect(page.getByLabel('Subir diseños PNG')).toBeEnabled();
}
async function importDesign() { await page.getByLabel('Subir diseños PNG').setInputFiles({ name: 'diseño ñ.png', mimeType: 'image/png', buffer: png() }); await expect(page.getByTestId('design-card')).toHaveCount(1); }

test('abre bienvenida y workers locales con renderer aislado y sin Node', async () => {
  await expect(page.getByRole('dialog', { name: 'Bienvenido a Maquetador DTF' })).toBeVisible();
  expect(await page.evaluate(() => ({ protocol: location.protocol, node: typeof (window as unknown as { require?: unknown }).require, process: typeof (window as unknown as { process?: unknown }).process }))).toEqual({ protocol: 'app:', node: 'undefined', process: 'undefined' });
  await closeWelcome();
  await importDesign();
  await expect(page.getByTestId('layout-summary')).toContainText('1 pieza');
  await expect(page.getByLabel('Distancia entre diseños')).toHaveValue('7');
});

test('guarda PDF multipágina con diálogo nativo, alfa y tamaño real', async () => {
  await closeWelcome(); await importDesign();
  const card = page.getByTestId('design-card');
  await card.getByLabel('Ancho (cm)').fill('20');
  await card.getByLabel('Copias', { exact: true }).fill('60');
  await expect(page.getByTestId('layout-summary')).toContainText('3 pliegos');
  await page.getByLabel('Acepto que los diseños de baja resolución pueden verse pixelados.').check();
  const target = path.join(directory, 'impresión ñ.pdf');
  await application.evaluate(({ dialog }, filePath) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath }); }, target);
  await page.getByRole('button', { name: 'Descargar PDF', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'PDF guardado' })).toBeVisible();
  const pdf = await PDFDocument.load(await readFile(target));
  expect(pdf.getPageCount()).toBe(3);
  expect(pdf.getPage(0).getWidth()).toBeCloseTo(1559.055118, 5);
  expect(pdf.getPage(0).getHeight()).toBeCloseTo(2834.645669, 5);
  await expect(page.getByRole('button', { name: 'Abrir carpeta' })).toBeVisible();
  await application.evaluate(({ ipcMain }) => { ipcMain.on('desktop:document:state', (_event, state) => { (globalThis as unknown as { lastDocumentState: unknown }).lastDocumentState = state; }); });
  await page.getByLabel('Aplicar espejo en el PDF').check();
  await expect.poll(() => application.evaluate(() => (globalThis as unknown as { lastDocumentState: { dirty: boolean } }).lastDocumentState?.dirty)).toBe(true);
  await page.getByLabel('Acepto que los diseños de baja resolución pueden verse pixelados.').check();
  await page.getByRole('button', { name: 'Descargar PDF', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'PDF guardado' })).toBeVisible();
  await expect.poll(() => application.evaluate(() => (globalThis as unknown as { lastDocumentState: { dirty: boolean } }).lastDocumentState?.dirty)).toBe(false);
  await copyFile(target, path.resolve('artifacts/qa/desktop-export.pdf'));
  await page.screenshot({ path: path.resolve('artifacts/qa/escritorio.png'), fullPage: true });
});

test('un error de escritura conserva el montaje y permite exportarlo después', async () => {
  await closeWelcome(); await importDesign();
  await application.evaluate(({ dialog }, filePath) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath }); }, path.join(directory, 'inexistente', 'fallo.pdf'));
  await page.getByRole('button', { name: 'Descargar PDF', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByTestId('design-card')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Descargar PDF', exact: true })).toBeEnabled();
  const target = path.join(directory, 'recuperado.pdf');
  await application.evaluate(({ dialog }, filePath) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath }); }, target);
  await page.getByRole('button', { name: 'Descargar PDF', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'PDF guardado' })).toBeVisible();
  expect((await PDFDocument.load(await readFile(target))).getPageCount()).toBe(1);
});

test('borrador, deshacer y ayuda funcionan dentro de Electron', async () => {
  await closeWelcome(); await importDesign();
  const card = page.getByTestId('design-card');
  await card.getByRole('button', { name: 'Borrador · fondo y colores' }).click();
  await expect(page.getByRole('button', { name: 'Aplicar', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Aplicar', exact: true }).click();
  await expect(card.getByText('Fondo quitado.')).toBeVisible();
  await card.getByRole('button', { name: 'Deshacer', exact: true }).click();
  await expect(card.getByText('Fondo quitado.')).toHaveCount(0);
  const helpPromise = application.waitForEvent('window');
  await page.getByRole('button', { name: 'Ayuda', exact: true }).click();
  const help = await helpPromise;
  await expect(help.locator('h1')).toContainText('Maquetador DTF');
});

test('cancelar guardado conserva cambios pendientes y el cierre permite seguir trabajando', async () => {
  await closeWelcome(); await importDesign();
  await expect(page.getByRole('button', { name: 'Descargar PDF', exact: true })).toBeEnabled();
  await application.evaluate(({ dialog }) => { dialog.showSaveDialog = async () => ({ canceled: true, filePath: '' }); });
  await page.getByRole('button', { name: 'Descargar PDF', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Guardado cancelado' })).toBeVisible();
  await application.evaluate(({ BrowserWindow, dialog }) => {
    (globalThis as unknown as { closeAsked: number }).closeAsked = 0;
    dialog.showMessageBox = async () => { (globalThis as unknown as { closeAsked: number }).closeAsked++; return { response: 0, checkboxChecked: false }; };
    BrowserWindow.getAllWindows()[0].close();
  });
  expect(await application.evaluate(() => (globalThis as unknown as { closeAsked: number }).closeAsked)).toBe(1);
  await expect(page.getByRole('heading', { name: 'Maquetador DTF', exact: true })).toBeVisible();
});

test('recuerda bienvenida y formatos en el almacén de la aplicación', async () => {
  await page.getByLabel('No volver a mostrar').check();
  await closeWelcome();
  await page.getByRole('button', { name: 'Configurar formato' }).click();
  await page.getByLabel('Ancho del pliego (mm)').fill('600');
  await page.getByRole('button', { name: 'Guardar formato' }).click();
  const userData = await application.evaluate(({ app }) => app.getPath('userData'));
  await expect.poll(async () => {
    const prefs = JSON.parse(await readFile(path.join(userData, 'preferences.json'), 'utf8'));
    return { hideWelcome: prefs.hideWelcome, width: prefs.profileState?.profiles[0].widthMm };
  }).toEqual({ hideWelcome: true, width: 600 });
  await page.reload();
  await expect(page.getByRole('dialog', { name: 'Bienvenido a Maquetador DTF' })).toHaveCount(0);
  await expect(page.getByTestId('profile-dimensions')).toContainText('600 × 1000 mm');
});
