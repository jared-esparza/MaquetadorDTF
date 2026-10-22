import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => vi.unstubAllEnvs());

it('comprueba la web pública sin arrancar el servidor local heredado', async () => {
  vi.stubEnv('DTF_WEB_URL', 'https://dtf.example.test');
  const { default: config } = await import('../playwright.deployed.config');
  expect(config.webServer).toBeUndefined();
  expect(config.use?.baseURL).toBe('https://dtf.example.test');
});
