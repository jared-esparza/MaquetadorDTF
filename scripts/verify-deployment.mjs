import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const base = new URL(process.env.WEB_URL);
if (base.protocol !== 'https:' || base.username || base.password || base.pathname !== '/') throw new Error('WEB_URL debe ser la raíz HTTPS del subdominio.');
const directory = process.argv[2] || 'web-dist';
const expected = JSON.parse(await readFile(path.join(directory, 'deployment.json'), 'utf8'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

async function verifyFile(relative) {
  const url = new URL(relative, base); url.searchParams.set('deploy', expected.commit);
  const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`${relative}: HTTP ${response.status}`);
  const local = await readFile(path.join(directory, relative));
  if (hash(local) !== hash(new Uint8Array(await response.arrayBuffer()))) throw new Error(`${relative}: el contenido no coincide con el commit publicado.`);
}

let lastError;
for (let attempt = 1; attempt <= 12; attempt++) {
  try {
    for (const file of ['deployment.json', 'index.html', 'help.html']) await verifyFile(file);
    for (const file of await readdir(path.join(directory, 'assets'))) await verifyFile('assets/' + file);
    console.log(`Despliegue verificado: ${base.origin} · ${expected.version} · ${expected.commit}`);
    process.exit(0);
  } catch (error) {
    lastError = error;
    console.log(`Comprobación ${attempt}/12: ${error.message}`);
    if (attempt < 12) await new Promise(resolve => setTimeout(resolve, 5000));
  }
}
throw lastError;
