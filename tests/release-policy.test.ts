import { expect, it } from 'vitest';
import { deliveryPolicy } from '../scripts/release-policy.mjs';

it('documentación y pruebas no crean entrega; cambios funcionales requieren versión nueva', () => {
  expect(deliveryPolicy('1.1.1', '1.1.1', ['README.md', 'tests/png.test.ts'])).toBe(false);
  expect(deliveryPolicy('1.1.1', '1.2.0', ['src/App.tsx', 'package.json'])).toBe(true);
  expect(() => deliveryPolicy('1.1.1', '1.1.1', ['src/App.tsx'])).toThrow();
  expect(() => deliveryPolicy('1.2.0', '1.1.2', ['electron/main.mjs'])).toThrow();
  expect(() => deliveryPolicy('1.2.0', '1.2.0', ['.github/workflows/windows.yml'])).toThrow();
  expect(() => deliveryPolicy('1.2.0', 'banana', ['src/App.tsx'])).toThrow();
});
