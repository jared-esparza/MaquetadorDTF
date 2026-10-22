import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { resolveResource, dataDirectory, readPreferences, updatePreferences, flushPreferences, savePdf, validatePdfRequest } from '../electron/services.mjs';

const dirs: string[] = [];
async function temporary() { const dir = await mkdtemp(path.join(os.tmpdir(), 'dtf-prueba-')); dirs.push(dir); return dir; }
afterEach(async () => { await Promise.all(dirs.splice(0).map(dir => rm(dir, { recursive: true, force: true }))); });

describe('servicios locales de escritorio', () => {
  it('inicia avisando antes de descargar y conserva formatos al cambiar el modo', async () => {
    const dir = await temporary();
    expect((await readPreferences(dir)).updateMode).toBe('notify');
    await updatePreferences(dir, { hideWelcome: true, updateMode: 'manual' });
    await expect(updatePreferences(dir, { updateMode: 'otro' })).rejects.toThrow();
    expect(await readPreferences(dir)).toMatchObject({ updateMode: 'manual', hideWelcome: true });
    await updatePreferences(dir, { updateMode: 'auto' });
    expect((await readPreferences(dir)).updateMode).toBe('auto');
  });
  it('limita el protocolo a los recursos empaquetados y al origen de la app', () => {
    const root = path.resolve('dist');
    expect(resolveResource('app://maquetador/', root)).toBe(path.join(root, 'index.html'));
    expect(resolveResource('app://maquetador/assets/test.js', root)).toBe(path.join(root, 'assets', 'test.js'));
    expect(() => resolveResource('app://otro/assets/test.js', root)).toThrow();
    expect(() => resolveResource('app://maquetador/%2e%2e%2fpackage.json', root)).toThrow();
    expect(() => resolveResource('file:///C:/Windows/system.ini', root)).toThrow();
  });
  it('separa datos instalados y portátiles y guarda estos últimos junto al exe', () => {
    expect(dataDirectory({ appData: 'C:/Users/u/AppData/Roaming', portableDir: 'D:/USB' })).toBe(path.join('D:/USB', 'MaquetadorDTF-datos'));
    expect(dataDirectory({ appData: 'C:/Users/u/AppData/Roaming' })).toBe(path.join('C:/Users/u/AppData/Roaming', 'PKprint', 'MaquetadorDTF'));
  });
  it('persiste preferencias validadas y conserva campos no modificados', async () => {
    const dir = await temporary();
    await updatePreferences(dir, { hideWelcome: true });
    await updatePreferences(dir, { profileState: { profiles: [{ id: 'x', name: 'Mi film', widthMm: 600, heightMm: 1000, margins: { top: 0, right: 3, bottom: 4, left: 0 } }], selected: 'x' } });
    const settings = await readPreferences(dir);
    expect(settings.hideWelcome).toBe(true);
    expect(settings.profileState.profiles[0].widthMm).toBe(600);
    await expect(updatePreferences(dir, { lastExportDirectory: 'C:/no-permitido' })).rejects.toThrow();
    await expect(updatePreferences(dir, { profileState: { profiles: [], selected: 'x' } })).rejects.toThrow();
  });
  it('recupera valores seguros ante un fichero de preferencias dañado', async () => {
    const dir = await temporary();
    await writeFile(path.join(dir, 'preferences.json'), '{invalido');
    expect((await readPreferences(dir)).hideWelcome).toBe(false);
  });
  it('espera toda la cola de preferencias antes de permitir el cierre', async () => {
    const dir = await temporary();
    const first = updatePreferences(dir, { hideWelcome: true });
    const second = updatePreferences(dir, { profileState: { profiles: [{ id: 'x', name: 'Film', widthMm: 600, heightMm: 1000, margins: { top: 0, right: 3, bottom: 4, left: 0 } }], selected: 'x' } });
    await flushPreferences(dir);
    const stored = JSON.parse(await readFile(path.join(dir, 'preferences.json'), 'utf8'));
    expect(stored).toMatchObject({ hideWelcome: true, profileState: { selected: 'x' } });
    await Promise.all([first, second]);
  });
  it('cancelar el diálogo no escribe archivos ni recuerda una carpeta nueva', async () => {
    const dir = await temporary();
    const result = await savePdf({ directory: dir, request: { filename: 'prueba.pdf', bytes: new TextEncoder().encode('%PDF-1.7\n%%EOF') }, choosePath: async () => ({ canceled: true }) });
    expect(result).toEqual({ status: 'cancelled' });
    expect((await readPreferences(dir)).lastExportDirectory).toBeUndefined();
  });
  it('solo escribe en la ruta elegida por el diálogo y recuerda la carpeta tras guardar', async () => {
    const dir = await temporary(), destination = path.join(dir, 'PDF con ñ'); await mkdir(destination);
    const file = path.join(destination, 'impresión.pdf');
    const bytes = new TextEncoder().encode('%PDF-1.7\n%%EOF');
    const result = await savePdf({ directory: dir, request: { filename: 'prueba.pdf', bytes }, choosePath: async () => ({ canceled: false, filePath: file }) });
    expect(result).toMatchObject({ status: 'saved', filename: 'impresión.pdf' });
    expect(new Uint8Array(await readFile(file))).toEqual(bytes);
    expect((await readPreferences(dir)).lastExportDirectory).toBe(destination);
  });
  it('un error de escritura no marca el PDF como guardado ni cambia la última carpeta', async () => {
    const dir = await temporary();
    await expect(savePdf({ directory: dir, request: { filename: 'p.pdf', bytes: new TextEncoder().encode('%PDF-1.7\n%%EOF') }, choosePath: async () => ({ canceled: false, filePath: path.join(dir, 'no-existe', 'p.pdf') }) })).rejects.toThrow();
    expect((await readPreferences(dir)).lastExportDirectory).toBeUndefined();
  });
  it('rechaza rutas o contenido arbitrario enviado por la interfaz', () => {
    expect(() => validatePdfRequest({ filename: '../../escape.pdf', bytes: new TextEncoder().encode('%PDF-1.7\n%%EOF') })).toThrow();
    expect(() => validatePdfRequest({ filename: 'p.pdf', bytes: new TextEncoder().encode('no soy PDF') })).toThrow();
  });
});
