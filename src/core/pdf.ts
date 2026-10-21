import { PDFDocument, concatTransformationMatrix, degrees, popGraphicsState, pushGraphicsState } from 'pdf-lib';
import { validateLayout } from './layout';
import { profileForLayout, validateProfile, type LayoutResult, type SheetProfile } from './model';

export interface PrintAsset { id: string; png: Uint8Array; widthMm: number; heightMm: number; copies: number }
const pt = (mm: number) => mm * 72 / 25.4;

export async function createPrintPdf(assets: PrintAsset[], layout: LayoutResult, profile: SheetProfile, options: { gapMm: number; mirror: boolean }): Promise<Uint8Array> {
  const profileError = validateProfile(profile);
  if (profileError) throw new Error(profileError);
  if (!layout.pages.length) throw new Error('Carga al menos un diseño antes de exportar.');
  const errors = validateLayout(layout, profileForLayout(profile, options.mirror), options.gapMm);
  if (errors.length) throw new Error(errors[0]);
  const assetMap = new Map(assets.map(asset => [asset.id, asset]));
  if (assetMap.size !== assets.length || assets.reduce((sum, a) => sum + a.copies, 0) !== layout.pieceCount) throw new Error('El montaje no coincide con los diseños actuales.');
  const counts = new Map<string, number>();
  for (const page of layout.pages) for (const p of page.placements) {
    const asset = assetMap.get(p.designId);
    if (!asset || p.copyIndex < 0 || !Number.isInteger(p.copyIndex) || p.copyIndex >= asset.copies) throw new Error('Falta un diseño o una copia del montaje.');
    const expectedW = p.rotation ? asset.heightMm : asset.widthMm;
    const expectedH = p.rotation ? asset.widthMm : asset.heightMm;
    if (Math.abs(p.widthMm - expectedW) > .011 || Math.abs(p.heightMm - expectedH) > .011) throw new Error('Las medidas han cambiado. Vuelve a calcular el montaje.');
    counts.set(asset.id, (counts.get(asset.id) ?? 0) + 1);
  }
  if (assets.some(a => counts.get(a.id) !== a.copies)) throw new Error('Faltan copias en el montaje.');
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
