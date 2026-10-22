import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import path from 'node:path';

await mkdir('build', { recursive: true });
await access('artifacts/calibracion-100mm.pdf').catch(() => { throw new Error('Falta el PDF de calibración. Ejecuta npm test antes de empaquetar.'); });
const names = ['fflate', 'react', 'react-dom', 'scheduler', 'pdf-lib', '@pdf-lib/standard-fonts', '@pdf-lib/upng', 'pako', 'tslib'];
let notices = 'Maquetador DTF · PKprint\nCódigo propio: licencia de reutilización pendiente.\n\nComponentes de terceros incluidos en la interfaz compilada:\n';
for (const name of names) {
  const directory = path.join('node_modules', name);
  const info = JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8'));
  let license;
  for (const file of ['LICENSE', 'LICENSE.txt', 'LICENSE.md', 'LICENSE-MIT', 'LICENSE-MIT.txt']) {
    try { license = await readFile(path.join(directory, file), 'utf8'); break; } catch { /* Try package-specific names. */ }
  }
  if (!license) throw new Error(`No se encontró el aviso de licencia de ${name}.`);
  notices += `\n\n${'='.repeat(60)}\n${name} ${info.version} · ${info.license}\n${'='.repeat(60)}\n${license}\n`;
}
notices += '\nElectron/Chromium: consultar LICENSE.electron.txt y LICENSES.chromium.html incluidos con la aplicación.\n';
await writeFile('build/THIRD_PARTY_NOTICES.txt', notices);
console.log('Recursos y avisos de terceros preparados.');
