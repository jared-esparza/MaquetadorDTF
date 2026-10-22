import { execFileSync } from 'node:child_process';
import { appendFile, readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export function deliveryPolicy(previous, version, files) {
  const parse = value => {
    if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value)) throw new Error('La versión debe ser X.Y.Z.');
    return value.split('.').map(Number);
  };
  const before = parse(previous), after = parse(version);
  const functional = files.some(file => /^(src\/|electron\/|public\/|build\/|web\/|scripts\/|\.github\/workflows\/|package(?:-lock)?\.json$|electron-builder)/.test(file));
  if (!functional) return false;
  const different = after.findIndex((n, i) => n !== before[i]);
  if (different < 0 || after[different] <= before[different]) throw new Error('Los cambios funcionales requieren incrementar la versión de package.json y package-lock.json.');
  return true;
}

export async function github(route, { token = process.env.GH_TOKEN, method = 'GET', data, raw, fetcher = fetch } = {}) {
  const response = await fetcher(route.startsWith('https:') ? route : `https://api.github.com${route}`, {
    method, headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28', ...(raw ? { 'Content-Type': 'application/octet-stream' } : data !== undefined ? { 'Content-Type': 'application/json' } : {}) },
    body: raw ?? (data === undefined ? undefined : JSON.stringify(data)),
  });
  if (response.status === 404 && method === 'GET') return null;
  if (!response.ok) throw new Error(`GitHub ${method}: HTTP ${response.status}`);
  return response.status === 204 ? null : response.json();
}

async function main() {
  const event = JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH, 'utf8'));
  const previous = event.pull_request?.base.sha ?? event.before ?? execFileSync('git', ['rev-parse', 'HEAD^'], { encoding: 'utf8' }).trim();
  if (!/^[a-f0-9]{40}$/.test(previous) || /^0+$/.test(previous)) throw new Error('No se puede determinar el commit anterior.');
  const git = args => execFileSync('git', args, { encoding: 'utf8' }).trim();
  const baseline = JSON.parse(git(['show', `${previous}:package.json`]));
  const { version } = JSON.parse(await readFile('package.json', 'utf8'));
  const lock = JSON.parse(await readFile('package-lock.json', 'utf8'));
  if (lock.version !== version || lock.packages[''].version !== version) throw new Error('Las versiones del archivo bloqueado no coinciden.');
  const files = git(['diff', '--name-only', previous, 'HEAD']).split('\n');
  let required = deliveryPolicy(baseline.version, version, files);
  if (required) {
    const changes = await readFile('CHANGELOG.md', 'utf8');
    if (!changes.includes(`## ${version}\n`) && !changes.includes(`## ${version}\r\n`)) throw new Error('Falta el historial de cambios de esta versión.');
    const notes = await readFile('docs/RELEASE.md', 'utf8');
    if (!notes.includes(`Maquetador DTF ${version} `)) throw new Error('Las notas de Release no corresponden a esta versión.');
    const root = `/repos/${process.env.GITHUB_REPOSITORY}`;
    const tag = await github(`${root}/git/ref/tags/v${version}`);
    const release = await github(`${root}/releases/tags/v${version}`);
    if (event.pull_request && (tag || release)) throw new Error('La versión ya está etiquetada o publicada.');
    if (tag || release) {
      const commit = await github(`${root}/commits/v${version}`);
      if (commit?.sha !== process.env.GITHUB_SHA) throw new Error('Esta versión pertenece a otro commit.');
      if (process.env.GITHUB_EVENT_NAME === 'workflow_dispatch' && release && !release.draft) required = false;
    }
  }
  await appendFile(process.env.GITHUB_OUTPUT, `release_required=${required}\nversion=${version}\n`);
  console.log(required ? `Entrega coordinada ${version}` : 'Sin cambios funcionales: no se crea Release.');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
