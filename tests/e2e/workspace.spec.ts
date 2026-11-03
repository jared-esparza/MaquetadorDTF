import { expect, test } from '@playwright/test';
import { PNG } from 'pngjs';

for (const [width, height] of [[1366, 768], [1280, 720], [390, 844]]) {
  test(`espacio de trabajo usable a ${width} × ${height}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    const add = page.getByRole('button', { name: /Añadir diseños/ });
    await page.keyboard.press('Tab');
    await expect(page.locator(':focus-visible')).toHaveCount(1);
    for (let i = 0; i < 12 && !(await add.evaluate(el => el === document.activeElement)); i++) {
      await page.keyboard.press('Tab');
    }
    await expect(add).toBeFocused();
    const image = new PNG({ width: 600, height: 600 });
    for (let i = 0; i < image.data.length; i += 4) image.data.set([15, 120, 200, i ? 255 : 0], i);
    const buffer = PNG.sync.write(image);
    await page.getByLabel('Subir diseños PNG').setInputFiles(
      Array.from({ length: 16 }, (_, i) => ({ name: `diseño-${i + 1}.png`, mimeType: 'image/png', buffer })),
    );
    await expect(page.getByTestId('design-card')).toHaveCount(16);
    await expect(page.getByTestId('design-card').first()).toContainText('diseño-16.png');
    await expect(add).toBeFocused();
    await page.getByLabel('Perfil de formato').selectOption('a4');
    await page.getByLabel('Copias', { exact: true }).first().fill('250');
    await page.getByLabel('Copias', { exact: true }).first().blur();
    const preview = page.getByRole('img', { name: 'Vista previa del pliego', exact: true });
    const next = page.getByRole('button', { name: 'Pliego siguiente', exact: true });
    const pdf = page.getByRole('button', { name: 'Descargar PDF en ZIP', exact: true });
    const png = page.getByRole('button', { name: 'Descargar PNG en ZIP', exact: true });
    await expect(next).toBeEnabled();
    await expect(pdf).toBeEnabled();
    await expect(png).toBeEnabled();
    await page.screenshot({ path: info.outputPath('espacio-de-trabajo.png') });
    if (width >= 1100) {
      const settings = page.getByRole('region', { name: 'Configuración', exact: true });
      const designs = page.getByRole('region', { name: 'Diseños', exact: true });
      const sheet = page.getByRole('region', { name: 'Pliego', exact: true });
      const boxes = await Promise.all([designs, sheet, settings].map(region => region.boundingBox()));
      expect(boxes[0]!.x + boxes[0]!.width).toBeLessThan(boxes[1]!.x);
      expect(boxes[1]!.x + boxes[1]!.width).toBeLessThan(boxes[2]!.x);
      for (const target of [preview, next, pdf, png, page.getByLabel('Perfil de formato'),
        page.getByLabel('Distancia entre diseños'), page.getByRole('button', { name: 'Cambiar fondo de vista previa' }),
        page.getByRole('button', { name: 'Repartir espacios', exact: true }),
        page.getByTestId('design-card').first().getByRole('button', { name: 'Borrador · fondo y colores' }),
        page.getByTestId('design-card').first().getByRole('button', { name: 'Afinar los bordes' })]) await expect(target).toBeInViewport({ ratio: 1 });
      await page.getByTestId('design-card').last().scrollIntoViewIfNeeded();
      await expect(preview).toBeInViewport({ ratio: 1 });
      await expect(pdf).toBeInViewport({ ratio: 1 });
      await expect(add).toBeInViewport({ ratio: 1 });
      await page.getByLabel('Subir diseños PNG').setInputFiles({ name: 'nuevo.png', mimeType: 'image/png', buffer });
      const recent = page.getByTestId('design-card').first();
      await expect(recent).toContainText('nuevo.png');
      await expect(recent).toBeInViewport({ ratio: 1 });
      await page.locator('summary').filter({ hasText: 'Opciones de exportación' }).click();
      await page.getByLabel('Resolución PNG').scrollIntoViewIfNeeded();
      await expect(preview).toBeInViewport({ ratio: 1 });
      await page.getByLabel('Resolución PNG').selectOption('150');
    } else {
      const navigation = page.getByRole('navigation', { name: 'Espacio de trabajo' });
      await navigation.getByRole('link', { name: 'Exportación' }).click();
      await expect(pdf).toBeInViewport();
      await page.screenshot({ path: info.outputPath('exportacion.png') });
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
      await page.setViewportSize({ width: 500, height });
      await page.locator('summary').filter({ hasText: 'Ajustes' }).click();
      await expect(page.getByLabel('Presupuesto de imágenes')).toBeInViewport({ ratio: 1 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(500);
    }
  });
}
