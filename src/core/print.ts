import { validateLayout } from './layout';
import { profileForLayout, validateProfile, type LayoutResult, type SheetProfile } from './model';
import type { PdfSource } from './pdfSource';

export type PrintAsset = { id: string; widthMm: number; heightMm: number; copies: number } & ({ png: Uint8Array; pdf?: never } | { pdf: PdfSource; png?: never });
export function validatePrint(assets: PrintAsset[], layout: LayoutResult, profile: SheetProfile, options: { gapMm: number; mirror: boolean }) {
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
}
