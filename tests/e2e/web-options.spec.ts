import { expect, test } from '@playwright/test';
import { PNG } from 'pngjs';

function publication(version: string, prerelease = false) {
  return { tag_name: `v${version}`, published_at: '2026-10-22T12:00:00Z', draft: false, prerelease, assets: ['Setup', 'Portable'].map(kind => ({ name: `MaquetadorDTF-${kind}-${version}-x64.exe`, browser_download_url: `https://github.com/jared-esparza/MaquetadorDTF/releases/download/v${version}/MaquetadorDTF-${kind}-${version}-x64.exe` })) };
}
const api = 'https://api.github.com/repos/jared-esparza/MaquetadorDTF/releases?*';

test('muestra la preliminar y descarga la nueva publicación sin recompilar ni recargar', async ({ page }) => {
  let requests = 0;
  await page.route(api, route => route.fulfill({ json: [++requests === 1 ? publication('1.1.1', true) : publication('1.2.0')] }));
  await page.route('https://github.com/jared-esparza/MaquetadorDTF/releases/download/**', route => route.fulfill({ body: 'fixture', headers: { 'content-type': 'application/octet-stream', 'content-disposition': 'attachment' } }));
  await page.goto('/');
  const section = page.getByRole('region', { name: 'Versión para Windows' });
  await expect(section).toContainText('v1.1.1');
  await expect(section).toContainText('Versión preliminar');
  for (const [label, kind] of [['Descargar instalador', 'Setup'], ['Descargar portátil', 'Portable']]) {
    const downloadPromise = page.waitForEvent('download');
    await section.getByRole('link', { name: label, exact: true }).click({ button: kind === 'Portable' ? 'middle' : 'left' });
    const download = await downloadPromise;
    expect(download.url()).toContain(`/v1.2.0/MaquetadorDTF-${kind}-1.2.0-x64.exe`);
    await download.cancel();
  }
  await expect(section).toContainText('v1.2.0');
  await expect(section.getByText('Versión preliminar')).toHaveCount(0);
});

test('un límite de GitHub elimina enlaces desactualizados y ofrece las versiones públicas', async ({ page }) => {
  let requests = 0;
  await page.route(api, route => ++requests === 1 ? route.fulfill({ json: [publication('1.1.1')] }) : route.fulfill({ status: 403, json: { message: 'API rate limit exceeded' } }));
  await page.goto('/');
  const section = page.getByRole('region', { name: 'Versión para Windows' });
  await section.getByRole('link', { name: 'Descargar instalador', exact: true }).click();
  await expect(section).toContainText('No se ha podido consultar la última versión');
  await expect(section.getByRole('link', { name: 'Descargar instalador', exact: true })).toHaveCount(0);
  await expect(section.getByRole('link', { name: 'Ver versiones en GitHub' })).toHaveAttribute('href', 'https://github.com/jared-esparza/MaquetadorDTF/releases');
});

test('los formatos son privados y restaurar conserva personalizados y selección', async ({ page, browser }) => {
  await page.route(api, route => route.fulfill({ json: [] }));
  await page.goto('/');
  const other = await browser.newContext();
  try {
    const otherPage = await other.newPage(); await otherPage.route(api, route => route.fulfill({ json: [] }));
    await otherPage.goto('/');
    await expect(page.getByText('Los cambios se guardan solo en este navegador y no afectan a otras personas')).toBeVisible();
    await page.getByRole('button', { name: 'Configurar formato' }).click();
    await expect(page.getByRole('button', { name: 'Restaurar formatos predeterminados' })).toBeDisabled();
    await page.getByLabel('Nombre del formato').fill('Mi film');
    await page.getByLabel('Ancho del pliego (mm)').fill('600');
    await page.getByLabel('Largo del pliego (mm)').fill('900');
    await page.getByLabel('Margen izquierdo (mm)').fill('12');
    await page.getByRole('button', { name: 'Guardar formato', exact: true }).click();
    await page.reload();
    await expect(page.getByTestId('profile-dimensions')).toContainText('600 × 900 mm');
    await expect(otherPage.getByTestId('profile-dimensions')).toContainText('550 × 1000 mm');
    page.once('dialog', dialog => dialog.dismiss());
    await page.getByRole('button', { name: 'Restaurar formatos predeterminados' }).click();
    await expect(page.getByTestId('profile-dimensions')).toContainText('600 × 900 mm');
    await page.getByRole('button', { name: 'Configurar formato' }).click();
    await page.getByLabel('Nombre del formato').fill('Mi formato personal');
    await page.getByLabel('Ancho del pliego (mm)').fill('330');
    await page.getByRole('button', { name: 'Guardar como nuevo', exact: true }).click();
    const selected = await page.getByLabel('Perfil de formato').inputValue();
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: 'Restaurar formatos predeterminados' }).click();
    await expect(page.getByLabel('Perfil de formato')).toHaveValue(selected);
    await expect(page.getByTestId('profile-dimensions')).toContainText('330 × 900 mm');
    await page.reload();
    await expect(page.getByLabel('Perfil de formato')).toHaveValue(selected);
    await page.getByLabel('Perfil de formato').selectOption('film-55');
    await expect(page.getByTestId('profile-dimensions')).toContainText('550 × 1000 mm');
    await page.getByRole('button', { name: 'Configurar formato' }).click();
    await expect(page.getByLabel('Nombre del formato')).toHaveValue('Film 55 × 100 cm');
    await expect(page.getByLabel('Margen izquierdo (mm)')).toHaveValue('0');
    await page.getByRole('button', { name: 'Cerrar formato' }).click();
    const image = new PNG({ width: 20, height: 20 }); image.data.fill(255);
    await page.getByLabel('Subir diseños PNG').setInputFiles({ name: 'montaje.png', mimeType: 'image/png', buffer: PNG.sync.write(image) });
    await expect(page.getByTestId('layout-summary')).toContainText('55 × 100 cm');
    await page.getByRole('button', { name: 'Configurar formato' }).click();
    await page.getByLabel('Ancho del pliego (mm)').fill('600');
    await page.getByRole('button', { name: 'Guardar formato', exact: true }).click();
    await expect(page.getByTestId('layout-summary')).toContainText('60 × 100 cm');
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: 'Restaurar formatos predeterminados' }).click();
    await expect(page.getByLabel('Perfil de formato')).toHaveValue('film-55');
    await expect(page.getByTestId('layout-summary')).toContainText('55 × 100 cm');
    await expect(page.getByRole('img', { name: 'Vista previa del pliego', exact: true })).toHaveAttribute('viewBox', '0 0 550 1000');
    for (const [id, dimensions] of [['a3', '297 × 420 mm'], ['a4', '210 × 297 mm']]) {
      await page.getByLabel('Perfil de formato').selectOption(id);
      await expect(page.getByTestId('profile-dimensions')).toContainText(dimensions);
    }
    await otherPage.reload();
    await expect(otherPage.getByLabel('Perfil de formato').locator('option')).toHaveCount(3);
  } finally { await other.close(); }
});
