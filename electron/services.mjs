import path from 'node:path';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

const queues = new Map();
const defaults = () => ({ version: 1, hideWelcome: false, updateMode: 'notify' });

export function resolveResource(url, root) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'app:' || parsed.hostname !== 'maquetador' || parsed.username || parsed.password || parsed.port) throw new Error('Origen no permitido.');
  const pathname = decodeURIComponent(parsed.pathname);
  if (pathname.includes('\0') || pathname.includes(':') || pathname.includes('\\')) throw new Error('Recurso no permitido.');
  const absoluteRoot = path.resolve(root);
  const target = path.resolve(absoluteRoot, '.' + (pathname === '/' ? '/index.html' : pathname));
  const relative = path.relative(absoluteRoot, target);
  if (!relative || relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) throw new Error('Recurso no permitido.');
  return target;
}

/** @param {{appData: string, portableDir?: string}} options */
export function dataDirectory({ appData, portableDir }) {
  return portableDir ? path.join(portableDir, 'MaquetadorDTF-datos') : path.join(appData, 'PKprint', 'MaquetadorDTF');
}

function validateProfileState(state) {
  if (!state || !Array.isArray(state.profiles) || !state.profiles.length || state.profiles.length > 100 || typeof state.selected !== 'string') throw new Error('Los formatos guardados no son válidos.');
  const ids = new Set();
  for (const p of state.profiles) {
    if (!p || typeof p.id !== 'string' || p.id.length > 100 || ids.has(p.id) || typeof p.name !== 'string' || !p.name.trim() || p.name.length > 80 || ![p.widthMm, p.heightMm].every(n => Number.isFinite(n) && n >= 10 && n <= 5000)) throw new Error('Formato no válido.');
    ids.add(p.id);
    if (!p.margins || !['top', 'right', 'bottom', 'left'].every(k => Number.isFinite(p.margins[k]) && p.margins[k] >= 0) || p.margins.left + p.margins.right >= p.widthMm || p.margins.top + p.margins.bottom >= p.heightMm) throw new Error('Márgenes no válidos.');
  }
  if (!ids.has(state.selected)) throw new Error('El formato seleccionado no existe.');
  return { profiles: state.profiles.map(p => ({ id: p.id, name: p.name, widthMm: p.widthMm, heightMm: p.heightMm, margins: { top: p.margins.top, right: p.margins.right, bottom: p.margins.bottom, left: p.margins.left } })), selected: state.selected };
}

/** @returns {Promise<any>} */
export async function readPreferences(directory) {
  try {
    const stored = JSON.parse(await readFile(path.join(directory, 'preferences.json'), 'utf8'));
    const result = defaults();
    if (typeof stored.hideWelcome === 'boolean') result.hideWelcome = stored.hideWelcome;
    if (['manual', 'notify', 'auto'].includes(stored.updateMode)) result.updateMode = stored.updateMode;
    if (stored.profileState) result.profileState = validateProfileState(stored.profileState);
    if (typeof stored.lastExportDirectory === 'string' && path.isAbsolute(stored.lastExportDirectory)) result.lastExportDirectory = stored.lastExportDirectory;
    return result;
  } catch { return defaults(); }
}

async function atomicWrite(filename, bytes) {
  const temporary = path.join(path.dirname(filename), '.' + path.basename(filename) + '.' + randomUUID() + '.tmp');
  try { await writeFile(temporary, bytes, { flag: 'wx' }); await rename(temporary, filename); }
  finally { await rm(temporary, { force: true }).catch(() => {}); }
}

function commitPreferences(directory, patch) {
  const previous = queues.get(directory) ?? Promise.resolve();
  const next = previous.catch(() => {}).then(async () => {
    const stored = await readPreferences(directory);
    const result = { ...stored, ...patch, version: 1 };
    await mkdir(directory, { recursive: true });
    await atomicWrite(path.join(directory, 'preferences.json'), JSON.stringify(result, null, 2));
    return result;
  });
  queues.set(directory, next);
  next.finally(() => { if (queues.get(directory) === next) queues.delete(directory); }).catch(() => {});
  return next;
}

export async function updatePreferences(directory, patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch) || Object.keys(patch).some(key => !['hideWelcome', 'profileState', 'updateMode'].includes(key))) throw new Error('Preferencia no permitida.');
  const valid = {};
  if ('hideWelcome' in patch) { if (typeof patch.hideWelcome !== 'boolean') throw new Error('Preferencia no válida.'); valid.hideWelcome = patch.hideWelcome; }
  if ('profileState' in patch) valid.profileState = validateProfileState(patch.profileState);
  if ('updateMode' in patch) { if (!['manual', 'notify', 'auto'].includes(patch.updateMode)) throw new Error('Modo de actualización no válido.'); valid.updateMode = patch.updateMode; }
  return commitPreferences(directory, valid);
}

export async function flushPreferences(directory) {
  while (queues.has(directory)) await queues.get(directory);
}

export function validatePdfRequest(request) {
  if (!request || typeof request.filename !== 'string' || !/^[^<>:"/\\|?*\x00-\x1f]{1,180}\.pdf$/i.test(request.filename) || request.filename.includes('..')) throw new Error('Nombre de PDF no válido.');
  const bytes = request.bytes;
  if (!(bytes instanceof Uint8Array) || bytes.byteLength < 10 || bytes.byteLength > 256 * 1024 * 1024 || String.fromCharCode(...bytes.subarray(0, 5)) !== '%PDF-') throw new Error('Contenido PDF no válido o demasiado grande.');
}

export async function savePdf({ directory, request, choosePath }) {
  validatePdfRequest(request);
  return saveValidated({ directory, request, choosePath, extension: 'pdf' });
}

export function validateRasterRequest(request) {
  if (!request || !['png', 'zip'].includes(request.type) || typeof request.filename !== 'string' || request.filename.includes('..') || !/^[^<>:"/\\|?*\x00-\x1f]{1,180}\.(png|zip)$/i.test(request.filename) || path.extname(request.filename).toLowerCase() !== '.' + request.type) throw new Error('Nombre o tipo de exportación no válido.');
  const bytes = request.bytes;
  const signature = request.type === 'png' ? [137, 80, 78, 71, 13, 10, 26, 10] : [80, 75, 3, 4];
  if (!(bytes instanceof Uint8Array) || bytes.byteLength < (request.type === 'png' ? 33 : 30) || bytes.byteLength > 256 * 1024 * 1024 || signature.some((value, index) => bytes[index] !== value)) throw new Error('Contenido PNG/ZIP no válido o demasiado grande.');
}
export async function saveRaster({ directory, request, choosePath }) {
  validateRasterRequest(request);
  return saveValidated({ directory, request, choosePath, extension: request.type });
}
async function saveValidated({ directory, request, choosePath, extension }) {
  const preferences = await readPreferences(directory);
  const result = await choosePath({ defaultPath: preferences.lastExportDirectory ? path.join(preferences.lastExportDirectory, request.filename) : request.filename });
  if (result.canceled || !result.filePath) return { status: 'cancelled' };
  if (!path.isAbsolute(result.filePath) || path.extname(result.filePath).toLowerCase() !== '.' + extension) throw new Error(`Elige un archivo con extensión .${extension}.`);
  await atomicWrite(result.filePath, request.bytes);
  let warning;
  try { await commitPreferences(directory, { lastExportDirectory: path.dirname(result.filePath) }); }
  catch { warning = 'El archivo se guardó, pero no se pudo recordar la carpeta.'; }
  return { status: 'saved', filename: path.basename(result.filePath), filePath: result.filePath, ...(warning ? { warning } : {}) };
}
