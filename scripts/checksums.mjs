import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
const files = (await readdir('release')).filter(name => /^MaquetadorDTF-(Setup|Portable)-.*\.exe$/.test(name)).sort();
if (files.length !== 2) throw new Error('Deben existir exactamente dos ejecutables de esta versión.');
const lines = [];
for (const file of files) lines.push(`${createHash('sha256').update(await readFile('release/' + file)).digest('hex')}  ${file}`);
await writeFile('release/SHA256SUMS.txt', lines.join('\n') + '\n');
console.log(lines.join('\n'));
