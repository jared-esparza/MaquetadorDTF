import { access, cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export async function prepareWeb({ source, output, headers, version, commit }) {
  if (!/^[a-f0-9]{40}$/.test(commit)) throw new Error('Commit de despliegue no válido.');
  for (const file of ['index.html', 'help.html', 'assets', 'pdfjs']) await access(path.join(source, file));
  await access(headers);
  await mkdir(output, { recursive: true });
  for (const file of ['index.html', 'help.html', 'assets', 'pdfjs']) await cp(path.join(source, file), path.join(output, file), { recursive: true });
  await cp(headers, path.join(output, '.htaccess'));
  await writeFile(path.join(output, 'deployment.json'), JSON.stringify({ version, commit }) + '\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { version } = JSON.parse(await readFile('package.json', 'utf8'));
  const commit = process.env.GITHUB_SHA || execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  await prepareWeb({ source: 'dist', output: 'artifacts/web-dist', headers: 'web/.htaccess', version, commit });
  console.log(`Web ${version} preparada: ${commit}`);
}
