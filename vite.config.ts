import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { readdir, readFile } from 'node:fs/promises';

export default defineConfig({
  plugins: [react(), {
    name: 'local-pdf-resources',
    async generateBundle() {
      for (const folder of ['cmaps', 'standard_fonts', 'wasm']) {
        for (const name of await readdir(`node_modules/pdfjs-dist/${folder}`)) {
          this.emitFile({ type: 'asset', fileName: `pdfjs/${folder}/${name}`, source: await readFile(`node_modules/pdfjs-dist/${folder}/${name}`) });
        }
      }
    },
    configureServer(server) {
      server.middlewares.use('/pdfjs', async (request, response, next) => {
        const name = request.url?.split('?')[0];
        if (!name || !/^\/(cmaps|standard_fonts|wasm)\/[\w.-]+$/.test(name)) return next();
        try { response.end(await readFile(`node_modules/pdfjs-dist${name}`)); } catch { next(); }
      });
    },
  }],
  test: { include: ['tests/**/*.test.ts'] },
  server: { host: '127.0.0.1' },
});
