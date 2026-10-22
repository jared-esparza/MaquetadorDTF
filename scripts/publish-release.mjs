import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { github } from './release-policy.mjs';
import { load } from 'js-yaml';

export function validateUpdateMetadata(version, installer, bytes) {
  const metadata = load(bytes.toString('utf8'));
  const digest = createHash('sha512').update(installer.bytes).digest('base64');
  if (!metadata || metadata.version !== version || !Array.isArray(metadata.files) || metadata.files.length !== 1 || metadata.files[0].url !== installer.name || metadata.files[0].sha512 !== digest || metadata.files[0].size !== installer.bytes.length || metadata.packages || (metadata.path && metadata.path !== installer.name) || (metadata.sha512 && metadata.sha512 !== digest)) throw new Error('Los metadatos de actualización no corresponden al instalador comprobado.');
}

export async function publishRelease({ repository, sha, version, directory, notes, api = github }) {
  const root = `/repos/${repository}`, tag = `v${version}`;
  const names = [`MaquetadorDTF-Setup-${version}-x64.exe`, `MaquetadorDTF-Portable-${version}-x64.exe`, 'SHA256SUMS.txt', 'USO-WINDOWS.md', 'THIRD_PARTY_NOTICES.txt', 'latest.yml', `MaquetadorDTF-Setup-${version}-x64.exe.blockmap`];
  const paths = [];
  async function walk(folder) {
    for (const entry of await readdir(folder, { withFileTypes: true })) {
      const file = path.join(folder, entry.name);
      if (entry.isDirectory()) await walk(file); else if (entry.isFile()) paths.push(file);
    }
  }
  await walk(directory);
  const files = await Promise.all(names.map(async name => {
    const matches = paths.filter(file => path.basename(file) === name);
    if (matches.length !== 1) throw new Error(`Falta un archivo único de distribución: ${name}`);
    const bytes = await readFile(matches[0]); return { name, bytes, digest: `sha256:${createHash('sha256').update(bytes).digest('hex')}` };
  }));
  const sums = files[2].bytes.toString('utf8');
  for (const file of [files[0], files[1], files[5], files[6]]) if (!sums.split(/\r?\n/).includes(`${file.digest.slice(7)}  ${file.name}`)) throw new Error('Las sumas SHA-256 no coinciden con los archivos de distribución.');
  validateUpdateMetadata(version, files[0], files[5].bytes);
  const existingTag = await api(`${root}/git/ref/tags/${tag}`);
  if (existingTag) {
    const commit = await api(`${root}/commits/${tag}`);
    if (commit?.sha !== sha) throw new Error('La etiqueta pertenece a otro commit.');
  } else await api(`${root}/git/refs`, { method: 'POST', data: { ref: `refs/tags/${tag}`, sha } });
  let release = await api(`${root}/releases/tags/${tag}`);
  if (!release) release = await api(`${root}/releases`, { method: 'POST', data: { tag_name: tag, target_commitish: sha, name: `Maquetador DTF ${version} · preliminar sin firma`, body: notes, draft: true, prerelease: true } });
  if (release.tag_name !== tag || !release.prerelease) throw new Error('La Release existente no corresponde a la entrega preliminar.');
  for (const file of files) {
    let asset = release.assets.find(asset => asset.name === file.name);
    if (release.draft && asset?.state === 'starter' && asset.size === 0) {
      await api(`${root}/releases/assets/${asset.id}`, { method: 'DELETE' });
      asset = undefined;
    }
    if (asset) {
      if (asset.digest !== file.digest) throw new Error(`No se sustituye un archivo diferente: ${file.name}`);
    } else {
      if (!release.draft) throw new Error('La Release publicada está incompleta; no se modifica.');
      const upload = new URL(release.upload_url.split('{')[0]); upload.searchParams.set('name', file.name);
      const uploaded = await api(upload.href, { method: 'POST', raw: file.bytes });
      if (uploaded.digest !== file.digest) throw new Error(`Hash remoto incorrecto: ${file.name}`);
    }
  }
  if (release.draft) await api(`${root}/releases/${release.id}`, { method: 'PATCH', data: { body: notes, draft: false, prerelease: true, make_latest: 'false' } });
  console.log(`Release ${tag} publicada o verificada sin sobrescribir archivos.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const directory = process.argv[2] ?? 'distribution';
  const version = process.env.RELEASE_VERSION;
  const notes = await readFile('docs/RELEASE.md', 'utf8');
  await publishRelease({ repository: process.env.GITHUB_REPOSITORY, sha: process.env.GITHUB_SHA, version, directory, notes: notes + `\n\nCommit: ${process.env.GITHUB_SHA}. [Pruebas y compilación](https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}).\n` });
}
