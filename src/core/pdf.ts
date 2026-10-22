import { PDFDocument, concatTransformationMatrix, degrees, popGraphicsState, pushGraphicsState } from 'pdf-lib';
import { validatePrint, type PrintAsset } from './print';
export type { PrintAsset } from './print';
import type { LayoutResult, SheetProfile } from './model';

const pt = (mm: number) => mm * 72 / 25.4;

export async function createPrintPdf(assets: PrintAsset[], layout: LayoutResult, profile: SheetProfile, options: { gapMm: number; mirror: boolean }): Promise<Uint8Array> {
  validatePrint(assets, layout, profile, options);
  const doc = await PDFDocument.create();
  doc.setTitle('Montaje DTF · PKprint');
  doc.setCreator('Maquetador DTF local · PKprint');
  doc.setSubject(`Tamaño real · ${profile.widthMm} × ${profile.heightMm} mm · espejo ${options.mirror ? 'activado' : 'desactivado'}`);
  const images = new Map<string, Awaited<ReturnType<typeof doc.embedPng>>>();
  for (const asset of assets) images.set(asset.id, await doc.embedPng(asset.png));
  for (const sheet of layout.pages) {
    const page = doc.addPage([pt(profile.widthMm), pt(profile.heightMm)]);
    if (options.mirror) page.pushOperators(pushGraphicsState(), concatTransformationMatrix(-1, 0, 0, 1, pt(profile.widthMm), 0));
    for (const p of sheet.placements) {
      const image = images.get(p.designId)!;
      if (p.rotation === 0) {
        page.drawImage(image, { x: pt(p.xMm), y: pt(profile.heightMm - p.yMm - p.heightMm), width: pt(p.widthMm), height: pt(p.heightMm) });
      } else {
        page.drawImage(image, { x: pt(p.xMm), y: pt(profile.heightMm - p.yMm), width: pt(p.heightMm), height: pt(p.widthMm), rotate: degrees(-90) });
      }
    }
    if (options.mirror) page.pushOperators(popGraphicsState());
  }
  return doc.save();
}
