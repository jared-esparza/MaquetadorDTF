import { afterEach, expect, it } from 'vitest';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { prepareWeb } from '../scripts/prepare-web.mjs';

const directories: string[] = [];
afterEach(async () => { await Promise.all(directories.splice(0).map(dir => rm(dir, { recursive: true, force: true }))); });

it('prepara solo recursos web y registra la versión y el commit desplegados', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'dtf-web-')); directories.push(root);
  const source = path.join(root, 'dist'), output = path.join(root, 'output');
  await mkdir(path.join(source, 'assets'), { recursive: true });
  await writeFile(path.join(source, 'index.html'), '<html>Editor</html>');
  await writeFile(path.join(source, 'help.html'), '<html>Ayuda</html>');
  await writeFile(path.join(source, 'assets', 'worker.js'), 'self.onmessage = () => {};');
  await writeFile(path.join(source, 'no-publicar.env'), 'PASSWORD=test');
  const headers = path.join(root, 'headers'); await writeFile(headers, 'DirectoryIndex index.html');
  await prepareWeb({ source, output, headers, version: '1.1.1', commit: 'a'.repeat(40) });
  expect((await readdir(output)).sort()).toEqual(['.htaccess', 'assets', 'deployment.json', 'help.html', 'index.html']);
  expect(JSON.parse(await readFile(path.join(output, 'deployment.json'), 'utf8'))).toEqual({ version: '1.1.1', commit: 'a'.repeat(40) });
  expect(await readFile(path.join(output, '.htaccess'), 'utf8')).toContain('DirectoryIndex');
  expect(await readFile(path.join(output, 'assets', 'worker.js'), 'utf8')).toContain('onmessage');
});

it('rechaza un paquete incompleto o un commit inválido antes de escribir', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'dtf-web-')); directories.push(root);
  const options = { source: path.join(root, 'missing'), output: path.join(root, 'output'), headers: '', version: '1.1.1', commit: 'a'.repeat(40) };
  await expect(prepareWeb(options)).rejects.toThrow();
  await expect(prepareWeb({ ...options, commit: 'invalido' })).rejects.toThrow('Commit');
  await expect(readdir(options.output)).rejects.toThrow();
});
