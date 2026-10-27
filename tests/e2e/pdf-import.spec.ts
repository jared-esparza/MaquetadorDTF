import { expect, test, type Page } from '@playwright/test';
import { PDFDocument, PDFName, StandardFonts, degrees, rgb } from 'pdf-lib';
import { unzipSync } from 'fflate';
import { PNG } from 'pngjs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

export async function sourcePdf() {
  const pdf = await PDFDocument.create(), font = await pdf.embedFont(StandardFonts.Helvetica);
  const first = pdf.addPage([200,100]);
  first.node.set(PDFName.of('Group'),pdf.context.obj({ S: 'Transparency',I: true,K: false }));
  first.drawRectangle({ x: 30,y: 20,width: 120,height: 60,color: rgb(1,0,0),opacity: .7 });
  first.drawText('DTF',{ x: 40,y: 40,size: 18,font,color: rgb(0,0,1) });
  const second = pdf.addPage([250,150]); second.setCropBox(20,10,200,100); second.setRotation(degrees(90));
  second.drawRectangle({ x: 40,y: 20,width: 100,height: 60,color: rgb(0,1,0) });
  const third = pdf.addPage([120,80]); third.drawRectangle({ x: 0,y: 0,width: 120,height: 80,color: rgb(1,1,1) });
  third.drawCircle({ x: 60,y: 40,size: 20,color: rgb(0,0,1) });
  pdf.addPage([80,60]);
  return Buffer.from(await pdf.save());
}
async function importPdf(page: Page) {
  await page.getByLabel('Subir diseños PNG o PDF').setInputFiles({ name: 'Diseños ñ.pdf',mimeType: 'application/pdf',buffer: await sourcePdf() });
  const dialog = page.getByRole('dialog',{ name: 'Importar páginas PDF' });
  await expect(dialog.getByRole('button',{ name: 'Importar seleccionadas (3)' })).toBeEnabled();
  return dialog;
}
test('selección, recorte transparente, blanco real, rotación, cancelar y deshacer PDF', async ({ page }) => {
  await page.goto('/');
  let dialog = await importPdf(page);
  await expect(dialog.getByText(/Página vacía/)).toBeVisible();
  await expect(dialog.getByLabel('Importar página 4')).toBeDisabled();
  await dialog.getByRole('button',{ name: 'Cancelar importación' }).click();
  await expect(page.getByTestId('design-card')).toHaveCount(0);
  dialog = await importPdf(page);
  await dialog.getByRole('button',{ name: 'Importar seleccionadas (3)' }).click();
  const cards = page.getByTestId('design-card'); await expect(cards).toHaveCount(3);
  await expect(cards.locator('.design-name')).toHaveText(['Diseños ñ.pdf · página 3', 'Diseños ñ.pdf · página 2', 'Diseños ñ.pdf · página 1']);
  expect(Number(await cards.nth(0).getByLabel('Ancho (cm)').inputValue())).toBeCloseTo(4.23,1);
  expect(Number(await cards.nth(1).getByLabel('Ancho (cm)').inputValue())).toBeCloseTo(2.15,1);
  expect(Number(await cards.nth(2).getByLabel('Ancho (cm)').inputValue())).toBeCloseTo(4.27,1);
  await cards.nth(2).getByRole('button',{ name: 'Borrador · fondo y colores' }).click();
  await expect(cards.nth(2).getByRole('button',{ name: 'Aplicar', exact: true })).toBeVisible();
  await cards.nth(2).getByRole('button',{ name: 'Cancelar',exact: true }).click();
});

test('PDF por pliego predeterminado, multipágina opcional y PNG desde vectores a 150/300/600 ppp', async ({ page },testInfo) => {
  await page.goto('/');
  await page.getByRole('button',{ name: 'Configurar formato' }).click();
  await page.getByLabel('Ancho del pliego (mm)').fill('80'); await page.getByLabel('Largo del pliego (mm)').fill('60');
  await page.getByRole('button',{ name: 'Guardar formato',exact: true }).click();
  const dialog = await importPdf(page);
  await dialog.getByLabel('Importar página 2').uncheck(); await dialog.getByLabel('Importar página 3').uncheck();
  await dialog.getByRole('button',{ name: 'Importar seleccionadas (1)' }).click();
  await page.getByLabel('Ancho (cm)',{ exact: true }).fill('3'); await page.getByLabel('Copias',{ exact: true }).fill('7'); await page.getByLabel('Copias',{ exact: true }).blur();
  await expect(page.getByLabel('Organización del PDF')).toHaveValue('separate');
  await expect(page.getByTestId('layout-summary')).toContainText('2 pliegos');
  let download = page.waitForEvent('download'); await page.getByRole('button',{ name: 'Descargar PDF en ZIP',exact: true }).click();
  const zipPath = testInfo.outputPath('pdfs.zip'); await (await download).saveAs(zipPath);
  const base = await page.getByLabel('Nombre del trabajo').inputValue();
  const files = unzipSync(await readFile(zipPath)); expect(Object.keys(files)).toEqual([`${base}-pliego-001.pdf`,`${base}-pliego-002.pdf`]);
  for (const bytes of Object.values(files)) expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
  await page.getByLabel('Organización del PDF').selectOption('combined');
  download = page.waitForEvent('download'); await page.getByRole('button',{ name: 'Descargar PDF',exact: true }).click();
  await mkdir('artifacts/qa',{ recursive: true }); await (await download).saveAs('artifacts/qa/imported-vector.pdf');
  expect((await PDFDocument.load(await readFile('artifacts/qa/imported-vector.pdf'))).getPageCount()).toBe(2);
  await writeFile('artifacts/qa/imported-source.pdf',await sourcePdf());
  await page.getByLabel('Copias',{ exact: true }).fill('1'); await page.getByLabel('Copias',{ exact: true }).blur();
  for (const dpi of [150,300,600]) {
    await page.getByLabel('Resolución PNG').selectOption(String(dpi));
    download = page.waitForEvent('download'); await page.getByRole('button',{ name: 'Descargar PNG',exact: true }).click();
    const filename = `artifacts/qa/imported-${dpi}.png`; await (await download).saveAs(filename);
    const image = PNG.sync.read(await readFile(filename));
    expect(image.width).toBe(Math.round(80 * dpi / 25.4)); expect(image.height).toBe(Math.round(60 * dpi / 25.4));
    expect(image.data.length).toBe(image.width * image.height * 4);
  }
});
