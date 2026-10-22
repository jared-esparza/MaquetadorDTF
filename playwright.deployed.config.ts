import { defineConfig } from '@playwright/test';
import local from './playwright.config';

const baseURL = process.env.DTF_WEB_URL;
if (!baseURL || new URL(baseURL).protocol !== 'https:') throw new Error('Define DTF_WEB_URL con la URL HTTPS que quieres comprobar.');

export default defineConfig({
  ...local,
  webServer: undefined,
  outputDir: 'test-results-deployed',
  use: { ...local.use, baseURL },
});
