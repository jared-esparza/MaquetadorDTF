import { expect, it } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { publishRelease } from '../scripts/publish-release.mjs';

it('etiqueta el commit, publica solo tras adjuntar ambos binarios y reintenta sin sobrescribir', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'dtf-release-'));
  try {
    const names = ['MaquetadorDTF-Setup-1.2.0-x64.exe', 'MaquetadorDTF-Portable-1.2.0-x64.exe', 'SHA256SUMS.txt', 'USO-WINDOWS.md', 'THIRD_PARTY_NOTICES.txt'];
    const bytes = Buffer.from('fixture');
    const hash = createHash('sha256').update(bytes).digest('hex');
    for (const name of names) {
      const folder = name === 'USO-WINDOWS.md' ? 'docs' : name === 'THIRD_PARTY_NOTICES.txt' ? 'build' : 'release';
      await mkdir(path.join(directory, folder), { recursive: true });
      await writeFile(path.join(directory, folder, name), name === 'SHA256SUMS.txt' ? names.slice(0, 2).map(n => `${hash}  ${n}`).join('\n') + '\n' : bytes);
    }
    let tagged = false;
    const assets: { name: string; digest?: string; id?: number; state?: string; size?: number }[] = [];
    let failedOnce = false;
    let release: { id: number; draft: boolean; prerelease: boolean; tag_name: string; upload_url: string; assets: typeof assets } | null = null;
    const calls: string[] = [];
    const api = async (route: string, options: { method?: string; data?: Record<string, unknown>; raw?: Uint8Array } = {}) => {
      calls.push(`${options.method ?? 'GET'} ${route}`);
      if (route.includes('/git/ref/tags/')) return tagged ? { object: { sha: 'commit-a' } } : null;
      if (route.endsWith('/git/refs')) { expect(options.data?.sha).toBe('commit-a'); tagged = true; return {}; }
      if (route.includes('/commits/')) return { sha: 'commit-a' };
      if (route.includes('/releases/tags/')) return release;
      if (route.endsWith('/releases')) { expect(options.data?.draft).toBe(true); release = { id: 1, draft: true, prerelease: true, tag_name: 'v1.2.0', upload_url: 'https://uploads.github.com/assets{?name}', assets }; return release; }
      if (options.method === 'DELETE') { assets.splice(assets.findIndex(asset => asset.id === 99), 1); return null; }
      if (route.startsWith('https://uploads.github.com/')) {
        if (!failedOnce) { failedOnce = true; assets.push({ id: 99, name: new URL(route).searchParams.get('name')!, state: 'starter', size: 0 }); throw new Error('502 starter'); }
        const asset = { name: new URL(route).searchParams.get('name')!, digest: `sha256:${createHash('sha256').update(options.raw!).digest('hex')}` }; assets.push(asset); return asset;
      }
      if (route.endsWith('/releases/1')) { expect(assets).toHaveLength(5); release!.draft = false; return release; }
      throw new Error('Ruta inesperada');
    };
    const options = { repository: 'owner/repo', sha: 'commit-a', version: '1.2.0', directory, notes: 'Notas', api };
    await expect(publishRelease(options)).rejects.toThrow('502 starter');
    await publishRelease(options);
    expect(assets).toHaveLength(5);
    calls.length = 0; await publishRelease(options);
    expect(calls.every(call => call.startsWith('GET '))).toBe(true);
    await expect(publishRelease({ ...options, sha: 'otro-commit' })).rejects.toThrow(/otro commit/);
    await writeFile(path.join(directory, 'docs', 'USO-WINDOWS.md'), 'diferente');
    await expect(publishRelease(options)).rejects.toThrow(/No se sustituye/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
