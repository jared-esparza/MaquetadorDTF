export const RELEASES_URL = 'https://github.com/jared-esparza/MaquetadorDTF/releases';
const API = 'https://api.github.com/repos/jared-esparza/MaquetadorDTF/releases';
export interface WindowsRelease { version: string; prerelease: boolean; installer: string; portable: string }

function downloadUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return url.origin === 'https://github.com' && !url.username && !url.password && url.pathname.startsWith('/jared-esparza/MaquetadorDTF/releases/download/') ? url.href : null;
  } catch { return null; }
}

export function selectWindowsRelease(data: unknown): WindowsRelease | null {
  if (!Array.isArray(data)) throw new Error('Respuesta de GitHub no válida.');
  let latest: WindowsRelease | null = null;
  let latestDate = -Infinity;
  for (const release of data) {
    if (!release || release.draft !== false || typeof release.tag_name !== 'string' || typeof release.published_at !== 'string' || !Array.isArray(release.assets)) continue;
    const date = Date.parse(release.published_at);
    if (!Number.isFinite(date) || date <= latestDate) continue;
    const version = release.tag_name.replace(/^v/, '');
    const assetUrl = (name: string) => downloadUrl(release.assets.find((asset: { name?: unknown } | null) => asset?.name === name)?.browser_download_url);
    const installer = assetUrl(`MaquetadorDTF-Setup-${version}-x64.exe`);
    const portable = assetUrl(`MaquetadorDTF-Portable-${version}-x64.exe`);
    if (installer && portable) {
      latest = { version: release.tag_name, prerelease: release.prerelease === true, installer, portable };
      latestDate = date;
    }
  }
  return latest;
}

export async function fetchWindowsRelease(signal?: AbortSignal, fetcher: typeof fetch = fetch): Promise<WindowsRelease> {
  const deadline = AbortSignal.timeout(15000);
  const requestSignal = signal ? AbortSignal.any([signal, deadline]) : deadline;
  const releases: unknown[] = [];
  for (let page = 1; ; page++) {
    const response = await fetcher(`${API}?per_page=100&page=${page}`, { signal: requestSignal, cache: 'no-store', headers: { Accept: 'application/vnd.github+json' } });
    if (!response.ok) throw new Error(`GitHub: HTTP ${response.status}`);
    const data: unknown = await response.json();
    if (!Array.isArray(data)) throw new Error('Respuesta de GitHub no válida.');
    releases.push(...data);
    if (!response.headers.get('Link')?.includes('rel="next"')) break;
  }
  const latest = selectWindowsRelease(releases);
  if (!latest) throw new Error('No hay una publicación con ambos ejecutables de Windows.');
  return latest;
}
