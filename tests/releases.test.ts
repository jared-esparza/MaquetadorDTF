import { expect, it, vi } from 'vitest';
import { fetchWindowsRelease, selectWindowsRelease } from '../src/browser/releases';

function release(version: string, published: string, extra = {}) {
  return { tag_name: `v${version}`, published_at: published, draft: false, prerelease: false, assets: ['Setup', 'Portable'].map(kind => ({ name: `MaquetadorDTF-${kind}-${version}-x64.exe`, browser_download_url: `https://github.com/jared-esparza/MaquetadorDTF/releases/download/v${version}/MaquetadorDTF-${kind}-${version}-x64.exe` })), ...extra };
}

it('elige la publicación completa más reciente por fecha, incluidas preliminares', () => {
  const old = release('1.0.0', '2026-01-01T00:00:00Z');
  const current = release('1.1.1', '2026-02-01T00:00:00Z', { prerelease: true });
  const draft = release('1.2.0', '2026-03-01T00:00:00Z', { draft: true });
  const incomplete = release('1.3.0', '2026-04-01T00:00:00Z'); incomplete.assets.pop();
  expect(selectWindowsRelease([draft, incomplete, current, old])).toMatchObject({ version: 'v1.1.1', prerelease: true, installer: current.assets[0].browser_download_url, portable: current.assets[1].browser_download_url });
});

it('rechaza respuestas inválidas y URLs ajenas a los archivos del repositorio', () => {
  const bad = release('1.0.0', '2026-01-01T00:00:00Z'); bad.assets[0].browser_download_url = 'https://example.com/otro.exe';
  expect(selectWindowsRelease([bad, null, {}, release('x', 'sin-fecha')])).toBeNull();
  expect(() => selectWindowsRelease({})).toThrow();
});

it('recorre la paginación y vuelve a consultar sin fijar la versión', async () => {
  const old = release('1.0.0', '2026-01-01T00:00:00Z'), recent = release('1.1.1', '2026-02-01T00:00:00Z');
  const fetcher = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify([old]), { headers: { Link: '<next>; rel="next"' } })).mockResolvedValueOnce(new Response(JSON.stringify([recent]))).mockResolvedValueOnce(new Response(JSON.stringify([release('1.2.0', '2026-03-01T00:00:00Z')])));
  expect((await fetchWindowsRelease(undefined, fetcher)).version).toBe('v1.1.1');
  expect((await fetchWindowsRelease(undefined, fetcher)).version).toBe('v1.2.0');
  expect(fetcher.mock.calls[1][0]).toContain('page=2');
});

it('informa de límites, errores de red y ausencia de ejecutables completos', async () => {
  await expect(fetchWindowsRelease(undefined, vi.fn().mockResolvedValue(new Response('', { status: 403 })))).rejects.toThrow();
  await expect(fetchWindowsRelease(undefined, vi.fn().mockRejectedValue(new Error('Sin red')))).rejects.toThrow();
  await expect(fetchWindowsRelease(undefined, vi.fn().mockResolvedValue(new Response('[]')))).rejects.toThrow();
});
