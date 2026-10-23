import { app, BrowserWindow, dialog, ipcMain, Menu, protocol, shell, session } from 'electron';
import path from 'node:path';
import { mkdir, access, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dataDirectory, flushPreferences, readPreferences, resolveResource, savePdf, saveRaster, updatePreferences } from './services.mjs';
import electronUpdater from 'electron-updater';
import { createUpdateController, RELEASES_URL } from './updates.mjs';

const base = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(base, '..', 'dist');
const directory = !app.isPackaged && process.env.DTF_TEST_DATA_DIR
  ? path.resolve(process.env.DTF_TEST_DATA_DIR)
  : dataDirectory({ appData: app.getPath('appData'), portableDir: process.env.PORTABLE_EXECUTABLE_DIR });
app.setName('Maquetador DTF');
app.setAppUserModelId('com.pkprint.maquetadordtf');
app.setPath('userData', directory);
app.setPath('sessionData', path.join(directory, 'Chromium'));
protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }]);

let mainWindow;
let helpWindow;
let dirty = false;
let busy = false;
let closing = false;
let closePrompt = false;
let lastSavedFile;
let updates;
let updateClosing = false;

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.show(); mainWindow.focus(); } });
  app.whenReady().then(start).catch(error => { dialog.showErrorBox('No se puede abrir Maquetador DTF', error.message); app.quit(); });
}
app.on('window-all-closed', () => app.quit());
app.on('before-quit', () => updates?.stop());

function trusted(event) {
  if (!mainWindow || event.sender !== mainWindow.webContents || event.senderFrame !== mainWindow.webContents.mainFrame || event.senderFrame.url !== 'app://maquetador/index.html') throw new Error('Solicitud no permitida.');
}

function resourcePath(name) { return app.isPackaged ? path.join(process.resourcesPath, name) : path.join(base, '..', 'artifacts', name); }

async function help(topic) {
  if (topic === 'welcome') { mainWindow.webContents.send('desktop:help:show', 'welcome'); return; }
  if (topic === 'about') {
    await dialog.showMessageBox(mainWindow, { type: 'info', title: 'Acerca de Maquetador DTF', message: `Maquetador DTF ${app.getVersion()}`, detail: `PKprint · ${process.env.PORTABLE_EXECUTABLE_DIR ? 'Versión portátil' : 'Aplicación de escritorio'}\nProcesamiento local. Esta versión no está firmada.\nLicencia de reutilización del código propio pendiente.`, buttons: ['Cerrar'] });
    return;
  }
  if (topic === 'calibration') {
    const error = await shell.openPath(resourcePath('calibracion-100mm.pdf'));
    if (error) throw new Error('No se ha podido abrir la calibración. Asocia un lector PDF en Windows e inténtalo de nuevo.');
    return;
  }
  if (topic !== 'guide') throw new Error('Ayuda no disponible.');
  if (helpWindow && !helpWindow.isDestroyed()) { helpWindow.focus(); return; }
  helpWindow = new BrowserWindow({ width: 820, height: 740, title: 'Ayuda · Maquetador DTF', parent: mainWindow, autoHideMenuBar: true, webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true } });
  helpWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  helpWindow.webContents.on('will-navigate', (event, url) => { if (url !== 'app://maquetador/help.html') event.preventDefault(); });
  await helpWindow.loadURL('app://maquetador/help.html');
}

async function start() {
  try { await mkdir(directory, { recursive: true }); await access(directory, constants.W_OK); }
  catch { throw new Error('No se puede escribir la configuración. Si usas la versión portátil, mueve el ejecutable a una carpeta con permiso de escritura.'); }
  await mkdir(path.join(directory, 'Chromium'), { recursive: true });
  protocol.handle('app', async request => {
    if (!['GET', 'HEAD'].includes(request.method)) return new Response('Método no permitido', { status: 405 });
    try {
      const filename = resolveResource(request.url, root);
      const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };
      return new Response(request.method === 'HEAD' ? null : await readFile(filename), { headers: { 'Content-Type': mime[path.extname(filename)] ?? 'application/octet-stream' } });
    }
    catch { return new Response('Recurso no disponible', { status: 404 }); }
  });
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => callback({ cancel: !['app:', 'blob:', 'data:', 'devtools:'].includes(new URL(details.url).protocol) }));
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => callback({ responseHeaders: { ...details.responseHeaders, 'Content-Security-Policy': ["default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; worker-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-src 'none'"] } }));

  const preferences = await readPreferences(directory);
  const portable = !!process.env.PORTABLE_EXECUTABLE_DIR;
  updates = createUpdateController({
    updater: app.isPackaged && !portable ? electronUpdater.autoUpdater : null,
    version: app.getVersion(), portable, mode: preferences.updateMode,
    saveMode: updateMode => updatePreferences(directory, { updateMode }),
    getDocumentState: () => ({ dirty, busy }), flush: () => flushPreferences(directory),
    onState: state => { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('desktop:updates:state', state); },
    openExternal: url => shell.openExternal(url),
    prepareInstall: () => { updateClosing = true; closing = true; },
    restoreClose: () => { if (updateClosing) { closing = false; updateClosing = false; } },
  });
  ipcMain.handle('desktop:updates:get', event => { trusted(event); return updates.snapshot(); });
  ipcMain.handle('desktop:updates:mode', (event, mode) => { trusted(event); return updates.setMode(mode); });
  ipcMain.handle('desktop:updates:check', event => { trusted(event); return updates.check(); });
  ipcMain.handle('desktop:updates:download', event => { trusted(event); return updates.download(); });
  ipcMain.handle('desktop:updates:install', event => { trusted(event); return updates.install(); });
  ipcMain.handle('desktop:updates:releases', async event => { trusted(event); await shell.openExternal(RELEASES_URL); });

  ipcMain.handle('desktop:preferences:get', async event => { trusted(event); const preferences = await readPreferences(directory); return { profileState: preferences.profileState, hideWelcome: preferences.hideWelcome, version: app.getVersion(), portable: !!process.env.PORTABLE_EXECUTABLE_DIR }; });
  ipcMain.handle('desktop:preferences:update', async (event, patch) => { trusted(event); await updatePreferences(directory, patch); });
  ipcMain.handle('desktop:pdf:save', async (event, request) => {
    trusted(event);
    const saved = await savePdf({ directory, request, choosePath: options => dialog.showSaveDialog(mainWindow, { ...options, title: 'Guardar PDF como…', buttonLabel: 'Guardar PDF', filters: [{ name: 'Documento PDF', extensions: ['pdf'] }], properties: ['showOverwriteConfirmation', 'createDirectory'] }) });
    if (saved.status === 'saved') { lastSavedFile = saved.filePath; return { status: 'saved', filename: saved.filename, warning: saved.warning }; }
    return saved;
  });
  ipcMain.handle('desktop:raster:save', async (event, request) => {
    trusted(event);
    const saved = await saveRaster({ directory, request, choosePath: options => dialog.showSaveDialog(mainWindow, { ...options, title: `Guardar ${request.type.toUpperCase()} como…`, buttonLabel: 'Guardar', filters: [{ name: request.type.toUpperCase(), extensions: [request.type] }], properties: ['showOverwriteConfirmation', 'createDirectory'] }) });
    if (saved.status === 'saved') { lastSavedFile = saved.filePath; return { status: 'saved', filename: saved.filename, warning: saved.warning }; }
    return saved;
  });
  ipcMain.handle('desktop:pdf:folder', event => { trusted(event); if (lastSavedFile) shell.showItemInFolder(lastSavedFile); });
  ipcMain.handle('desktop:help', async (event, topic) => { trusted(event); await help(topic); });
  ipcMain.on('desktop:document:state', (event, state) => { trusted(event); if (state && typeof state.dirty === 'boolean' && typeof state.busy === 'boolean') { dirty = state.dirty; busy = state.busy; updates.documentChanged(); } });

  mainWindow = new BrowserWindow({ width: 1440, height: 980, minWidth: 900, minHeight: 650, show: false, title: 'Maquetador DTF · PKprint', backgroundColor: '#ffffff', icon: path.join(base, '..', 'build', 'icon.ico'), webPreferences: { preload: path.join(base, 'preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false } });
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event, url) => { if (url !== 'app://maquetador/index.html') event.preventDefault(); });
  mainWindow.on('close', event => {
    if (closing) return;
    event.preventDefault();
    if (closePrompt) return;
    closePrompt = true;
    void (async () => {
      try {
        if (dirty || busy) {
          const { response } = await dialog.showMessageBox(mainWindow, { type: 'question', title: 'Cerrar Maquetador DTF', message: busy ? 'Hay una operación en curso.' : 'Tienes cambios sin exportar.', detail: 'Si cierras, perderás el montaje de esta sesión.', buttons: ['Seguir trabajando', 'Cerrar sin exportar'], defaultId: 0, cancelId: 0, noLink: true });
          if (response !== 1) return;
        }
        await flushPreferences(directory);
        closing = true;
        mainWindow.close();
      } catch (error) {
        dialog.showErrorBox('No se puede guardar la configuración', error.message);
      } finally { closePrompt = false; }
    })();
  });
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'Archivo', submenu: [{ label: 'Salir', accelerator: 'Alt+F4', click: () => mainWindow.close() }] },
    { label: 'Edición', submenu: [{ role: 'undo', label: 'Deshacer texto' }, { role: 'redo', label: 'Rehacer texto' }, { type: 'separator' }, { role: 'cut', label: 'Cortar' }, { role: 'copy', label: 'Copiar' }, { role: 'paste', label: 'Pegar' }, { role: 'selectAll', label: 'Seleccionar todo' }] },
    { label: 'Ayuda', submenu: [{ label: 'Cómo usar el maquetador', click: () => void help('guide') }, { label: 'Mostrar bienvenida', click: () => void help('welcome') }, { label: 'PDF de calibración', click: () => void help('calibration').catch(error => dialog.showErrorBox('Calibración', error.message)) }, { type: 'separator' }, { label: 'Acerca de…', click: () => void help('about') }] },
  ]));
  await mainWindow.loadURL('app://maquetador/index.html');
  updates.start();
}
