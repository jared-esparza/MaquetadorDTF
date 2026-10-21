import { afterEach, expect, it } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';

const children: ChildProcess[] = [];
afterEach(async () => {
  for (const child of children.splice(0)) { const exited = once(child, 'exit'); child.kill(); await exited; }
});
async function startServer(randomPort: boolean) {
  const env = { ...process.env };
  if (randomPort) env.PORT = '0'; else delete env.PORT;
  const child = spawn(process.execPath, ['scripts/serve.mjs', '--no-open'], { env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  children.push(child);
  const url = await new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('El servidor no arrancó.')), 5000);
    child.stdout!.on('data', data => { const match = String(data).match(/http:\/\/127\.0\.0\.1:\d+/); if (match) { clearTimeout(timer); resolve(match[0]); } });
    child.on('error', error => { clearTimeout(timer); reject(error); });
    child.stderr!.on('data', data => { clearTimeout(timer); reject(new Error(String(data))); });
  });
  return { child, url };
}

it('el servidor del lanzador entrega HTML y JavaScript de producción, y rechaza acceso fuera de dist', async () => {
  const { url } = await startServer(true);
  const html = await fetch(url);
  expect(html.status).toBe(200);
  const body = await html.text();
  const script = body.match(/src="([^"]+\.js)"/)![1];
  const js = await fetch(url + script);
  expect(js.status).toBe(200);
  expect(js.headers.get('content-type')).toContain('javascript');
  expect((await fetch(url + '/%2e%2e%2fpackage.json')).status).toBe(403);
  expect((await fetch(url + '/no-existe.png')).status).toBe(404);
});

it('usa un origen estable para conservar los perfiles entre arranques', async () => {
  const first = await startServer(false);
  const exited = once(first.child, 'exit'); first.child.kill(); await exited;
  children.splice(children.indexOf(first.child), 1);
  const second = await startServer(false);
  expect(second.url).toBe(first.url);
});
