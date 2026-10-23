import { expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { createUpdateController, findPortableUpdate } from '../electron/updates.mjs';

class Backend extends EventEmitter {
  autoDownload = true; autoInstallOnAppQuit = true; allowPrerelease = false; allowDowngrade = true;
  downloads = 0; installs = 0; checks = 0;
  async checkForUpdates() { this.checks++; this.emit('update-available', { version: '1.4.0', releaseName: '1.4.0 preliminar' }); }
  async downloadUpdate() { this.downloads++; this.emit('download-progress', { percent: 45 }); this.emit('update-downloaded', { version: '1.4.0' }); return []; }
  quitAndInstall() { this.installs++; }
}
function setup(mode = 'notify', portable = false) {
  const updater = new Backend(); let document = { dirty: false, busy: false };
  const controller = createUpdateController({ updater, version: '1.3.0', portable, mode, saveMode: async () => {}, getDocumentState: () => document, flush: async () => {}, onState: () => {}, openExternal: async () => {}, prepareInstall: () => {}, restoreClose: () => {} });
  return { controller, updater, setDocument: (state: typeof document) => { document = state; } };
}
it('por defecto avisa sin descargar, incluye preliminares y nunca instala al cerrar', async () => {
  const { controller, updater } = setup();
  await controller.check();
  expect(controller.snapshot().status).toBe('available');
  expect(updater.downloads).toBe(0);
  expect(updater.allowPrerelease).toBe(true);
  expect(updater.autoDownload).toBe(false); expect(updater.autoInstallOnAppQuit).toBe(false);
  expect(updater.allowDowngrade).toBe(false);
});
it('automático descarga, pero solo reinicia mediante acción explícita y trabajo limpio', async () => {
  const { controller, updater, setDocument } = setup('auto');
  await controller.check();
  expect(updater.downloads).toBe(1); expect(updater.installs).toBe(0);
  setDocument({ dirty: true, busy: false });
  await expect(controller.install()).rejects.toThrow(/exportar/);
  setDocument({ dirty: false, busy: true });
  await expect(controller.install()).rejects.toThrow(/operación/);
  setDocument({ dirty: false, busy: false });
  await controller.install(); expect(updater.installs).toBe(1);
});
it('vuelve a comprobar el trabajo después de guardar preferencias antes de reiniciar', async () => {
  const updater = new Backend(); let dirty = false;
  const controller = createUpdateController({ updater, version: '1.3.0', portable: false, mode: 'auto', saveMode: async () => {}, getDocumentState: () => ({ dirty, busy: false }), flush: async () => { dirty = true; }, onState: () => {}, openExternal: async () => {}, prepareInstall: () => {}, restoreClose: () => {} });
  await controller.check(); await expect(controller.install()).rejects.toThrow(/exportar/);
  expect(updater.installs).toBe(0);
});
it('rechaza modos inválidos, conserva manual y no permite instalar un portátil', async () => {
  const { controller, updater } = setup('manual');
  await expect(controller.setMode('otro')).rejects.toThrow();
  await controller.setMode('manual'); expect(updater.checks).toBe(0);
  const portable = setup('notify', true).controller;
  await expect(portable.install()).rejects.toThrow();
  await expect(portable.setMode('auto')).rejects.toThrow();
});
it('portátil elige publicación nueva, también preliminar, con URL válida y sin bajar versión', () => {
  const release = (version: string, date: string, draft = false) => ({ tag_name: `v${version}`, published_at: date, draft, prerelease: true, assets: [{ name: `MaquetadorDTF-Portable-${version}-x64.exe`, browser_download_url: `https://github.com/jared-esparza/MaquetadorDTF/releases/download/v${version}/MaquetadorDTF-Portable-${version}-x64.exe` }] });
  expect(findPortableUpdate([release('1.4.0', '2026-10-24'), release('1.5.0', '2026-10-25', true)], '1.3.0')?.version).toBe('1.4.0');
  expect(findPortableUpdate([release('1.2.0', '2026-10-24')], '1.3.0')).toBeNull();
  const foreign = release('1.4.0', '2026-10-24'); foreign.assets[0].browser_download_url = 'https://evil.example/update.exe';
  expect(findPortableUpdate([foreign], '1.3.0')).toBeNull();
});

it('manual no programa consultas; avisar comprueba al iniciar y nunca descarga', async () => {
  vi.useFakeTimers(); const manual = setup('manual'), notify = setup('notify');
  try {
    manual.controller.start(); notify.controller.start();
    await vi.advanceTimersByTimeAsync(31000);
    expect(manual.updater.checks).toBe(0); expect(notify.updater.checks).toBe(1);
    expect(notify.updater.downloads).toBe(0);
    await notify.controller.setMode('manual');
    await vi.advanceTimersByTimeAsync(7 * 60 * 60 * 1000);
    expect(notify.updater.checks).toBe(1);
  } finally { manual.controller.stop(); notify.controller.stop(); vi.useRealTimers(); }
});

it('un error de descarga conserva el trabajo y no habilita la instalación', async () => {
  const { controller, updater } = setup();
  await controller.check();
  updater.downloadUpdate = async () => { updater.emit('error', new Error('sha512 mismatch')); throw new Error('sha512 mismatch'); };
  await controller.download();
  expect(controller.snapshot()).toMatchObject({ status: 'error', canInstall: false });
  await expect(controller.install()).rejects.toThrow(); expect(updater.installs).toBe(0);
});

it('portátil gestiona límites de GitHub sin abrir páginas ni reiniciar', async () => {
  let opened = false;
  const controller = createUpdateController({ updater: null, version: '1.3.0', portable: true, mode: 'notify', saveMode: async () => {}, getDocumentState: () => ({ dirty: true, busy: false }), flush: async () => {}, onState: () => {}, openExternal: async () => { opened = true; }, prepareInstall: () => {}, restoreClose: () => {}, fetcher: async () => new Response('{}', { status: 403 }) });
  await controller.check(); expect(controller.snapshot().status).toBe('error');
  expect(opened).toBe(false);
});
