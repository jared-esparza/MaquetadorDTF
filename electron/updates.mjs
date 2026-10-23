import semver from 'semver';

export const RELEASES_URL = 'https://github.com/jared-esparza/MaquetadorDTF/releases';
const API = 'https://api.github.com/repos/jared-esparza/MaquetadorDTF/releases';
export const UPDATE_MODES = ['manual', 'notify', 'auto'];

export function findPortableUpdate(releases, currentVersion) {
  if (!Array.isArray(releases)) throw new Error('Respuesta de versiones no válida.');
  let latest = null, published = -Infinity;
  for (const release of releases) {
    const version = semver.valid(release?.tag_name);
    const date = Date.parse(release?.published_at);
    if (!version || release.draft !== false || !semver.gt(version, currentVersion) || !Number.isFinite(date) || date <= published || !Array.isArray(release.assets)) continue;
    const name = `MaquetadorDTF-Portable-${version}-x64.exe`;
    const expected = `${RELEASES_URL}/download/${release.tag_name}/${name}`;
    if (!release.assets.some(asset => asset?.name === name && asset.browser_download_url === expected)) continue;
    latest = { version, prerelease: release.prerelease === true, url: expected }; published = date;
  }
  return latest;
}

async function portableRelease(version, fetcher) {
  const releases = [], signal = AbortSignal.timeout(15000);
  for (let page = 1; ; page++) {
    const response = await fetcher(`${API}?per_page=100&page=${page}`, { signal, headers: { Accept: 'application/vnd.github+json' }, cache: 'no-store' });
    if (!response.ok) throw new Error(`GitHub HTTP ${response.status}`);
    const data = await response.json();
    if (!Array.isArray(data)) throw new Error('Respuesta no válida.');
    releases.push(...data);
    if (!response.headers.get('Link')?.includes('rel="next"')) break;
  }
  return findPortableUpdate(releases, version);
}

/** All network and installer operations stay in main; the renderer never supplies a URL or path. */
export function createUpdateController({ updater, version, portable, mode = 'notify', saveMode, getDocumentState, flush, onState, openExternal, prepareInstall, restoreClose, fetcher = fetch }) {
  let state = { status: 'idle', mode: portable && mode === 'auto' ? 'notify' : mode, currentVersion: version, portable, version: '', progress: 0, message: '' };
  let portableUpdate = null, timer, interval;
  const snapshot = () => ({ ...state, canInstall: !portable && state.status === 'downloaded' && !getDocumentState().dirty && !getDocumentState().busy });
  const publish = patch => { state = { ...state, ...patch }; onState(snapshot()); return snapshot(); };
  const failure = () => { restoreClose(); return publish({ status: 'error', message: 'No se ha podido completar la actualización. Comprueba la conexión y vuelve a intentarlo. Tu montaje sigue disponible.' }); };
  if (updater) {
    updater.autoDownload = false; updater.autoInstallOnAppQuit = false;
    updater.autoRunAppAfterInstall = true; updater.allowPrerelease = true; updater.allowDowngrade = false;
    updater.disableWebInstaller = true;
    updater.on('update-available', info => {
      if (!semver.valid(info.version) || !semver.gt(info.version, version)) { publish({ status: 'current', version: '', message: '' }); return; }
      publish({ status: 'available', version: info.version, message: '' });
    });
    updater.on('update-not-available', () => publish({ status: 'current', version: '', message: '' }));
    updater.on('download-progress', info => publish({ status: 'downloading', progress: Math.max(0, Math.min(100, Math.round(info.percent || 0))) }));
    updater.on('update-downloaded', info => publish({ status: 'downloaded', version: info.version, progress: 100, message: '' }));
    updater.on('error', failure);
  }
  async function check() {
    if (['checking', 'downloading', 'downloaded', 'installing'].includes(state.status)) return snapshot();
    publish({ status: 'checking', message: '' });
    try {
      if (portable) {
        portableUpdate = await portableRelease(version, fetcher);
        publish({ status: portableUpdate ? 'available' : 'current', version: portableUpdate?.version ?? '', message: '' });
      } else if (updater) await updater.checkForUpdates();
      else publish({ status: 'error', message: 'Las actualizaciones se comprueban en la aplicación instalada. En desarrollo no se descargan ni instalan versiones.' });
      if (!portable && state.mode === 'auto' && state.status === 'available') await download();
    } catch { failure(); }
    return snapshot();
  }
  async function download() {
    if (state.status !== 'available') throw new Error('Busca una actualización disponible antes de descargar.');
    if (portable) {
      if (!portableUpdate) throw new Error('No hay una versión portátil disponible.');
      try { await openExternal(portableUpdate.url); } catch { failure(); }
    } else {
      publish({ status: 'downloading', progress: 0, message: '' });
      try { await updater.downloadUpdate(); } catch { failure(); }
    }
    return snapshot();
  }
  function assertSafe() {
    const document = getDocumentState();
    if (document.busy) throw new Error('Hay una operación en curso. Espera a que termine antes de reiniciar.');
    if (document.dirty) throw new Error('Tienes trabajo sin exportar. Exporta el montaje antes de reiniciar.');
  }
  async function install() {
    if (portable || state.status !== 'downloaded') throw new Error('No hay una actualización preparada para instalar.');
    assertSafe(); publish({ status: 'installing', message: '' });
    try {
      await flush(); assertSafe(); prepareInstall(); updater.quitAndInstall(false, true);
    } catch (error) { restoreClose(); publish({ status: 'downloaded', message: error.message }); throw error; }
    return snapshot();
  }
  function stop() { clearTimeout(timer); clearInterval(interval); }
  function start() {
    stop();
    if (state.mode === 'manual') return;
    timer = setTimeout(() => void check(), 30000); timer.unref?.();
    interval = setInterval(() => { if (state.mode !== 'manual') void check(); }, 6 * 60 * 60 * 1000); interval.unref?.();
  }
  async function setMode(value) {
    if (!UPDATE_MODES.includes(value) || (portable && value === 'auto')) throw new Error('Modo de actualización no válido.');
    await saveMode(value); publish({ mode: value }); start();
    if (value === 'auto' && state.status === 'available') await download();
    return snapshot();
  }
  return { snapshot, check, download, install, setMode, start, stop, documentChanged: () => publish({}) };
}
