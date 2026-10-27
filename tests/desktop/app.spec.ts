import { test, expect, _electron, type ElectronApplication, type Page } from '@playwright/test';
import { createRequire } from 'node:module';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import { PNG } from 'pngjs';
import { PDFDocument } from 'pdf-lib';
import { unzipSync } from 'fflate';
import { expectSpreadGrid, prepareSpread, sheetPositions } from '../helpers/spread';

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
  if (application) {
    // Let Playwright finish tracing before Electron exits, including the updater's separate net session.
    await application.evaluate(({ BrowserWindow }) => { for (const window of BrowserWindow.getAllWindows()) window.removeAllListeners('close'); }).catch(() => {});
    await application.close().catch(() => {});
  }
  if (directory) await rm(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
});

async function closeWelcome() {
  await page.getByRole('button', { name: 'Empezar a maquetar', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Bienvenido a Maquetador DTF' })).toHaveCount(0);
  await expect(page.getByLabel('Subir diseños PNG')).toBeEnabled();
}
async function importDesign() { await page.getByLabel('Subir diseños PNG').setInputFiles({ name: 'diseño ñ.png', mimeType: 'image/png', buffer: png() }); await expect(page.getByTestId('design-card')).toHaveCount(1); }

test('reparto compartido: guardar, cancelar, fallar y restaurar solo afectan al pliego modificado', async () => {
  await closeWelcome(); await prepareSpread(page);
  await application.evaluate(({ ipcMain }) => {
    ipcMain.on('desktop:document:state', (_event, state) => { (globalThis as unknown as { spreadDocumentState: { dirty: boolean } }).spreadDocumentState = state; });
  });
  const dirty = () => application.evaluate(() => (globalThis as unknown as { spreadDocumentState: { dirty: boolean } }).spreadDocumentState?.dirty);
  const saveTo = (filename: string) => application.evaluate(({ dialog }, filePath) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath }); }, path.join(directory, filename));
  const compact = await sheetPositions(page);
  for (const index of [1, 2, 3]) {
    await page.getByRole('button', { name: `Ver pliego ${index}`, exact: true }).click();
    await saveTo(`compact-${index}.pdf`);
    await page.getByRole('button', { name: 'Descargar este pliego en PDF', exact: true }).click();
    await expect(page.locator('.sheet-frame')).toHaveAttribute('data-excluded', 'true');
  }
  await expect.poll(dirty).toBe(false);
  await page.getByRole('button', { name: 'Ver pliego 2', exact: true }).click();
  await page.getByRole('button', { name: 'Repartir espacios', exact: true }).click();
  await expectSpreadGrid(page);
  await expect.poll(dirty).toBe(true);
  await expect(page.getByTestId('remaining-sheets')).toContainText('1 de 3');
  for (const type of ['PNG', 'PDF']) {
    await application.evaluate(({ dialog }) => { dialog.showSaveDialog = async () => ({ canceled: true, filePath: '' }); });
    await page.getByRole('button', { name: `Descargar este pliego en ${type}`, exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Guardado cancelado' })).toBeVisible();
    await expectSpreadGrid(page);
    await expect(page.getByTestId('remaining-sheets')).toContainText('1 de 3');
    await expect.poll(dirty).toBe(true);
    await saveTo(`missing/fallo.${type.toLowerCase()}`);
    await page.getByRole('button', { name: `Descargar este pliego en ${type}`, exact: true }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await expectSpreadGrid(page);
    await expect(page.locator('.sheet-frame')).toHaveAttribute('data-excluded', 'false');
    await expect.poll(dirty).toBe(true);
  }
  await mkdir('artifacts/qa', { recursive: true });
  for (const type of ['PNG', 'PDF']) {
    const filename = `spread.${type.toLowerCase()}`;
    await saveTo(filename);
    await page.getByRole('button', { name: `Descargar este pliego en ${type}`, exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: `${type} guardado` })).toBeVisible();
    await expect(page.locator('.sheet-frame')).toHaveAttribute('data-excluded', 'true');
    await copyFile(path.join(directory, filename), path.resolve(`artifacts/qa/desktop-${filename}`));
    await expect.poll(dirty).toBe(false);
  }
  await page.getByRole('button', { name: 'Restaurar compacto', exact: true }).click();
  expect(await sheetPositions(page)).toEqual(compact);
  await expect.poll(dirty).toBe(true);
  await expect(page.getByTestId('remaining-sheets')).toContainText('1 de 3');
  for (const index of [1, 3]) await expect(page.getByRole('button', { name: `Ver pliego ${index}`, exact: true })).toHaveAttribute('data-excluded', 'true');
});

test('descarga individual solo se aparta al guardar y conserva el aviso de trabajo parcial', async () => {
  await closeWelcome();
  await application.evaluate(({ ipcMain }) => {
    ipcMain.on('desktop:document:state', (_event, state) => { (globalThis as unknown as { sheetDocumentState: { dirty: boolean } }).sheetDocumentState = state; });
  });
  const dirty = () => application.evaluate(() => (globalThis as unknown as { sheetDocumentState: { dirty: boolean } }).sheetDocumentState?.dirty);
  await page.getByRole('button', { name: 'Configurar formato' }).click();
  await page.getByLabel('Ancho del pliego (mm)').fill('60'); await page.getByLabel('Largo del pliego (mm)').fill('40');
  await page.getByRole('button', { name: 'Guardar formato', exact: true }).click();
  await importDesign();
  await page.getByLabel('Ancho (cm)', { exact: true }).fill('5');
  await page.getByLabel('Copias', { exact: true }).fill('3'); await page.getByLabel('Copias', { exact: true }).blur();
  await page.getByLabel('Nombre del trabajo').fill('Pedido'); await page.getByLabel('Nombre del trabajo').blur();
  await expect(page.getByTestId('layout-summary')).toContainText('3 pliegos');
  await page.getByRole('button', { name: 'Ver pliego 2', exact: true }).click();
  await application.evaluate(({ dialog }) => { dialog.showSaveDialog = async () => ({ canceled: true, filePath: '' }); });
  await page.getByRole('button', { name: 'Descargar este pliego en PDF', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Guardado cancelado' })).toBeVisible();
  await expect(page.getByTestId('remaining-sheets')).toContainText('3 de 3');
  await expect(page.locator('.sheet-frame')).toHaveAttribute('data-excluded', 'false');
  await application.evaluate(({ dialog }, filePath) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath }); }, path.join(directory, 'no-existe', 'fallo.pdf'));
  await page.getByRole('button', { name: 'Descargar este pliego en PDF', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByTestId('remaining-sheets')).toContainText('3 de 3');
  await application.evaluate(({ dialog }, filePath) => {
    dialog.showSaveDialog = async (...args: unknown[]) => {
      (globalThis as unknown as { sheetSaveName: string }).sheetSaveName = ((args[1] ?? args[0]) as { defaultPath: string }).defaultPath;
      return { canceled: false, filePath };
    };
  }, path.join(directory, 'individual.pdf'));
  await page.getByRole('button', { name: 'Descargar este pliego en PDF', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'PDF guardado' })).toBeVisible();
  expect(await application.evaluate(() => (globalThis as unknown as { sheetSaveName: string }).sheetSaveName)).toBe('Pedido-pliego-002.pdf');
  expect((await PDFDocument.load(await readFile(path.join(directory, 'individual.pdf')))).getPageCount()).toBe(1);
  await expect(page.getByTestId('remaining-sheets')).toContainText('2 de 3');
  await expect.poll(dirty).toBe(true);
  await page.getByRole('button', { name: 'Ver pliego 3', exact: true }).click();
  await application.evaluate(({ dialog }, filePath) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath }); }, path.join(directory, 'no-existe', 'fallo.png'));
  await page.getByRole('button', { name: 'Descargar este pliego en PNG', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByTestId('remaining-sheets')).toContainText('2 de 3');
  await expect(page.getByRole('button', { name: 'Ver pliego 2', exact: true })).toHaveAttribute('data-excluded', 'true');
  await expect(page.locator('.sheet-frame')).toHaveAttribute('data-excluded', 'false');
  await page.getByRole('button', { name: 'Ver pliego 2', exact: true }).click();
  await application.evaluate(({ BrowserWindow, dialog }) => {
    (globalThis as unknown as { sheetCloseAsked: number }).sheetCloseAsked = 0;
    dialog.showMessageBox = async () => { (globalThis as unknown as { sheetCloseAsked: number }).sheetCloseAsked++; return { response: 0, checkboxChecked: false }; };
    BrowserWindow.getAllWindows()[0].close();
  });
  expect(await application.evaluate(() => (globalThis as unknown as { sheetCloseAsked: number }).sheetCloseAsked)).toBe(1);
  await application.evaluate(({ dialog }, filePath) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath }); }, path.join(directory, 'restantes.zip'));
  await page.getByRole('button', { name: 'Descargar PNG en ZIP', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'ZIP guardado' })).toBeVisible();
  expect(Object.keys(unzipSync(await readFile(path.join(directory, 'restantes.zip'))))).toEqual(['Pedido-pliego-001.png', 'Pedido-pliego-003.png']);
  await expect.poll(dirty).toBe(false);
  await page.getByRole('button', { name: 'Volver a incluir', exact: true }).click();
  await expect.poll(dirty).toBe(true);
  for (const index of [1, 2, 3]) {
    await page.getByRole('button', { name: `Ver pliego ${index}`, exact: true }).click();
    await application.evaluate(({ dialog }, filePath) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath }); }, path.join(directory, `individual-${index}.png`));
    await page.getByRole('button', { name: 'Descargar este pliego en PNG', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'PNG guardado' })).toBeVisible();
    await expect.poll(dirty).toBe(index !== 3);
  }
  await expect(page.getByTestId('remaining-sheets')).toContainText('0 de 3');
});

test('recuerda presupuesto y sugiere el nombre elegido sin perderlo al cancelar', async () => {
  await page.getByLabel('No volver a mostrar').check();
  await closeWelcome();
  await page.getByLabel('Presupuesto de imágenes').selectOption('120');
  const userData = await application.evaluate(({ app }) => app.getPath('userData'));
  await expect.poll(async () => JSON.parse(await readFile(path.join(userData, 'preferences.json'), 'utf8')).imageBudgetMp).toBe(120);
  await page.reload();
  await expect(page.getByLabel('Presupuesto de imágenes')).toHaveValue('120');
  await importDesign();
  await page.getByLabel('Alto (cm)', { exact: true }).fill('2');
  await page.getByLabel('Alto (cm)', { exact: true }).blur();
  await expect(page.getByLabel('Ancho (cm)', { exact: true })).toHaveValue('4.17');
  await page.getByLabel('Nombre del trabajo').fill('Pedido ñ.pdf');
  await page.getByLabel('Nombre del trabajo').blur();
  await application.evaluate(({ dialog }) => {
    dialog.showSaveDialog = async (...args: unknown[]) => {
      const options = (args[1] ?? args[0]) as { defaultPath: string };
      (globalThis as unknown as { suggestedName: string }).suggestedName = options.defaultPath;
      return { canceled: true, filePath: '' };
    };
  });
  for (const type of ['PDF', 'PNG']) {
    await page.getByRole('button', { name: `Descargar ${type}`, exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Guardado cancelado' })).toBeVisible();
    expect(await application.evaluate(() => (globalThis as unknown as { suggestedName: string }).suggestedName)).toBe(`Pedido ñ.${type.toLowerCase()}`);
    await expect(page.getByLabel('Nombre del trabajo')).toHaveValue('Pedido ñ');
    await expect(page.getByTestId('design-card')).toHaveCount(1);
  }
});

test('abre bienvenida y workers locales con renderer aislado y sin Node', async () => {
  await expect(page.getByRole('region', { name: 'Versión para Windows' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Restaurar formatos predeterminados' })).toHaveCount(0);
  await expect(page.getByText('Los cambios se guardan solo en este navegador')).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: 'Bienvenido a Maquetador DTF' })).toBeVisible();
  expect(await page.evaluate(() => ({ protocol: location.protocol, node: typeof (window as unknown as { require?: unknown }).require, process: typeof (window as unknown as { process?: unknown }).process }))).toEqual({ protocol: 'app:', node: 'undefined', process: 'undefined' });
  await closeWelcome();
  await importDesign();
  await expect(page.getByTestId('layout-summary')).toContainText('1 pieza');
  await expect(page.getByLabel('Distancia entre diseños')).toHaveValue('7');
});

test('actualizaciones avisa por defecto y conserva la configuración manual', async () => {
  await page.getByLabel('No volver a mostrar').check();
  await closeWelcome();
  await page.getByRole('button', { name: 'Actualizaciones', exact: true }).click();
  const panel = page.getByRole('dialog', { name: 'Actualizaciones', exact: true });
  await expect(panel.getByLabel('Modo de actualización')).toHaveValue('notify');
  await expect(panel).toContainText('Se incluyen las versiones preliminares');
  const portable = !!process.env.DTF_ELECTRON_EXE;
  await expect(panel.getByLabel('Modo de actualización').locator('option')).toHaveCount(portable ? 2 : 3);
  if (portable) await expect(panel).toContainText('MaquetadorDTF-datos');
  await page.screenshot({ path: path.resolve(`artifacts/qa/updates-${portable ? 'portable' : 'installed'}.png`), fullPage: true });
  await panel.getByLabel('Modo de actualización').selectOption('manual');
  await expect(panel.getByLabel('Modo de actualización')).toHaveValue('manual');
  const userData = await application.evaluate(({ app }) => app.getPath('userData'));
  await expect.poll(async () => JSON.parse(await readFile(path.join(userData, 'preferences.json'), 'utf8')).updateMode).toBe('manual');
  await panel.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Actualizaciones', exact: true }).click();
  await expect(page.getByLabel('Modo de actualización')).toHaveValue('manual');
});

test('NSIS descarga desde metadatos y rechaza instaladores con checksum incorrecto', async () => {
  await closeWelcome();
  const payload = Buffer.from('MZ instalador de prueba que nunca se ejecuta');
  let corrupt = false;
  const current = await application.evaluate(({ app }) => app.getVersion());
  const nextVersion = `${Number(current.split('.')[0]) + 1}.0.0`;
  const server = createServer((request, response) => {
    if (request.url?.split('?')[0] === '/latest.yml') {
      const metadata = JSON.stringify({ version: nextVersion, files: [{ url: 'update.exe', size: payload.length, sha512: corrupt ? Buffer.alloc(64).toString('base64') : createHash('sha512').update(payload).digest('base64') }] });
      response.writeHead(200, { 'Content-Type': 'text/yaml', 'Content-Length': Buffer.byteLength(metadata) }); response.end(metadata);
    } else { response.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Length': payload.length }); response.end(payload); }
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const address = server.address() as { port: number };
    for (const invalid of [false, true]) {
      corrupt = invalid;
      const config = path.join(directory, invalid ? 'bad-update.json' : 'good-update.json');
      await writeFile(config, JSON.stringify({ provider: 'generic', url: `http://127.0.0.1:${address.port}/`, updaterCacheDirName: invalid ? 'cache-bad' : 'cache-good' }));
      const result = await application.evaluate(async ({ app }, options) => {
        const require = process.getBuiltinModule('node:module').createRequire(app.getAppPath() + '/package.json');
        const { NsisUpdater } = require('electron-updater');
        const updater = new NsisUpdater({ provider: 'generic', url: options.url });
        updater.forceDevUpdateConfig = true; updater.updateConfigPath = options.config;
        Object.defineProperty(updater.app, 'baseCachePath', { value: options.directory });
        updater.autoDownload = false; updater.autoInstallOnAppQuit = false; updater.disableDifferentialDownload = true;
        updater.logger = null; updater.on('error', () => {});
        await updater.checkForUpdates();
        try { const files = await updater.downloadUpdate(); return { downloaded: true, file: files[0] }; }
        catch { return { downloaded: false, file: '' }; }
      }, { url: `http://127.0.0.1:${address.port}/`, config, directory });
      expect(result.downloaded).toBe(!invalid);
      if (!invalid) expect(await readFile(result.file)).toEqual(payload);
    }
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
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
  await page.getByLabel('Organización del PDF').selectOption('combined');
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

test('guarda PNG y ZIP con diálogo restringido, cancelación, errores y carpeta recordada', async () => {
  await closeWelcome();
  await page.getByRole('button', { name: 'Configurar formato' }).click();
  await page.getByLabel('Ancho del pliego (mm)').fill('60');
  await page.getByLabel('Largo del pliego (mm)').fill('50');
  await page.getByRole('button', { name: 'Guardar formato', exact: true }).click();
  await importDesign();
  await page.getByLabel('Ancho (cm)', { exact: true }).fill('2');
  await page.getByLabel('Ancho (cm)', { exact: true }).blur();
  await expect(page.getByRole('button', { name: 'Descargar PNG', exact: true })).toBeEnabled();
  await application.evaluate(({ dialog }) => { dialog.showSaveDialog = async () => ({ canceled: true, filePath: '' }); });
  await page.getByRole('button', { name: 'Descargar PNG', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Guardado cancelado' })).toBeVisible();
  const pngTarget = path.join(directory, 'impresión ñ.png');
  await application.evaluate(({ dialog }, filePath) => {
    dialog.showSaveDialog = async (...args: unknown[]) => { const options = args[1] ?? args[0];
      (globalThis as unknown as { saveOptions: unknown }).saveOptions = options;
      return { canceled: false, filePath };
    };
  }, path.join(directory, 'inexistente', 'error.png'));
  await page.getByRole('button', { name: 'Descargar PNG', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByTestId('design-card')).toHaveCount(1);
  await application.evaluate(({ dialog }, filePath) => { dialog.showSaveDialog = async (...args: unknown[]) => { const options = args[1] ?? args[0]; (globalThis as unknown as { saveOptions: unknown }).saveOptions = options; return { canceled: false, filePath }; }; }, pngTarget);
  await page.getByRole('button', { name: 'Descargar PNG', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'PNG guardado' })).toBeVisible();
  expect(PNG.sync.read(await readFile(pngTarget)).width).toBe(709);
  const options = await application.evaluate(() => (globalThis as unknown as { saveOptions: { title: string; properties: string[]; filters: { extensions: string[] }[] } }).saveOptions);
  expect(options.title).toBe('Guardar PNG como…');
  expect(options.properties).toContain('showOverwriteConfirmation');
  expect(options.filters[0].extensions).toEqual(['png']);
  await copyFile(pngTarget, path.resolve('artifacts/qa/desktop.png'));
  await page.getByLabel('Copias', { exact: true }).fill('8');
  await page.getByLabel('Copias', { exact: true }).blur();
  await expect(page.getByTestId('layout-summary')).toContainText('2 pliegos');
  const zipTarget = path.join(directory, 'pliegos.zip');
  await application.evaluate(({ dialog }, filePath) => { dialog.showSaveDialog = async (...args: unknown[]) => { const options = args[1] ?? args[0]; (globalThis as unknown as { saveOptions: unknown }).saveOptions = options; return { canceled: false, filePath }; }; }, zipTarget);
  await page.getByRole('button', { name: 'Descargar PNG en ZIP', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'ZIP guardado' })).toBeVisible();
  expect(Object.keys(unzipSync(await readFile(zipTarget)))).toHaveLength(2);
  await copyFile(zipTarget, path.resolve('artifacts/qa/desktop.zip'));
  await expect(page.getByRole('button', { name: 'Abrir carpeta' })).toBeVisible();
  const userData = await application.evaluate(({ app }) => app.getPath('userData'));
  expect(JSON.parse(await readFile(path.join(userData, 'preferences.json'), 'utf8')).lastExportDirectory).toBe(directory);
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
