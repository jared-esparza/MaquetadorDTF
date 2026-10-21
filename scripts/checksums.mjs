import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
const { version } = JSON.parse(await readFile('package.json', 'utf8'));
const files = ['Portable', 'Setup'].map(target => `MaquetadorDTF-${target}-${version}-x64.exe`);
const lines = [];
for (const file of files) lines.push(`${createHash('sha256').update(await readFile('release/' + file)).digest('hex')}  ${file}`);
await writeFile('release/SHA256SUMS.txt', lines.join('\n') + '\n');
console.log(lines.join('\n'));
