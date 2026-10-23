import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import path from 'node:path';

await mkdir('build', { recursive: true });
await access('artifacts/calibracion-100mm.pdf').catch(() => { throw new Error('Falta el PDF de calibración. Ejecuta npm test antes de empaquetar.'); });
const lock = JSON.parse(await readFile('package-lock.json', 'utf8'));
const names = Object.entries(lock.packages).filter(([name, info]) => name.startsWith('node_modules/') && !info.dev).map(([name]) => name).sort();
let notices = 'Maquetador DTF · PKprint\nCódigo propio: licencia de reutilización pendiente.\n\nComponentes de terceros incluidos en la aplicación y la interfaz compilada:\n';
for (const name of names) {
  const directory = name;
  const info = JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8'));
  let license;
  for (const file of ['LICENSE', 'LICENSE.txt', 'LICENSE.md', 'LICENSE-MIT', 'LICENSE-MIT.txt']) {
    try { license = await readFile(path.join(directory, file), 'utf8'); break; } catch { /* Try package-specific names. */ }
  }
  if (!license && info.name === 'lazy-val' && info.license === 'MIT') {
    // This package declares MIT/author in package.json but ships no LICENSE file, including upstream.
    const mit = await readFile('node_modules/electron-updater/LICENSE', 'utf8');
    license = `Licencia MIT declarada en lazy-val/package.json. Autor: ${info.author}.\nRepositorio: https://github.com/develar/lazy-val\nEl paquete no distribuye un archivo LICENSE; se incluye el texto estándar MIT:\n\n${mit.slice(mit.indexOf('Permission is hereby granted'))}`;
  }
  if (!license) throw new Error(`No se encontró el aviso de licencia de ${name}.`);
  notices += `\n\n${'='.repeat(60)}\n${info.name} ${info.version} · ${info.license}\n${'='.repeat(60)}\n${license}\n`;
}
notices += '\nElectron/Chromium: consultar LICENSE.electron.txt y LICENSES.chromium.html incluidos con la aplicación.\n';
await writeFile('build/THIRD_PARTY_NOTICES.txt', notices);
console.log('Recursos y avisos de terceros preparados.');
