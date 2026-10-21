import http from 'node:http';
import { createReadStream, existsSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const root = path.resolve(fileURLToPath(new URL('../dist/', import.meta.url)));
if (!existsSync(path.join(root, 'index.html'))) {
  console.error('Primero ejecuta npm run build (o abre Iniciar Maquetador.cmd).'); process.exit(1);
}
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
const server = http.createServer(async (req, res) => {
  if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return; }
  try {
    const name = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
    const target = path.resolve(root, '.' + (name === '/' ? '/index.html' : name));
    if (!target.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
    const info = await stat(target);
    if (!info.isFile()) throw new Error('not a file');
    res.writeHead(200, { 'Content-Type': types[path.extname(target)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
    if (req.method === 'HEAD') res.end(); else createReadStream(target).on('error', () => res.destroy()).pipe(res);
  } catch { res.writeHead(404); res.end('Archivo no encontrado.'); }
});
server.on('error', error => { console.error('No se puede iniciar el maquetador:', error.message); process.exitCode = 1; });
server.listen(Number(process.env.PORT ?? 47831), '127.0.0.1', () => {
  const url = `http://127.0.0.1:${server.address().port}`;
  console.log(`Maquetador DTF: ${url}\nMantén esta ventana abierta. Pulsa Ctrl+C para cerrar.`);
  if (!process.argv.includes('--no-open') && process.platform === 'win32') {
    const browser = spawn('cmd.exe', ['/d', '/c', 'start', '', url], { windowsHide: true, stdio: 'ignore' });
    browser.on('error', () => console.log('Abre la dirección anterior en tu navegador.'));
  }
});
