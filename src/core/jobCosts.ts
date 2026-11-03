import type { LayoutResult, SheetProfile } from './model';

export type WasteAllocation = 'area' | 'copy';

export function parseSheetCost(text: string): number | null {
  if (!/^\d+(?:[,.]\d{1,2})?$/.test(text.trim())) return null;
  const [euros, decimals = ''] = text.trim().split(/[,.]/);
  const cents = Number(euros) * 100 + Number(decimals.padEnd(2, '0'));
  return Number.isSafeInteger(cents) ? cents : null;
}

export const formatCost = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format;
export const formatWasteMeasure = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format;

export function calculateJobCosts(layout: LayoutResult, profile: Pick<SheetProfile, 'widthMm' | 'heightMm'>, cents: number, allocation: WasteAllocation) {
  if (!layout.pages.length || layout.unplacedIds.length) return null;
  const totalArea = layout.pages.length * profile.widthMm * profile.heightMm;
  const groups = new Map<string, { area: number; copies: number }>();
  let occupiedArea = 0;
  let copies = 0;
  for (const page of layout.pages) for (const placement of page.placements) {
    const area = placement.widthMm * placement.heightMm;
    const group = groups.get(placement.designId) ?? { area: 0, copies: 0 };
    group.area += area;
    group.copies++;
    groups.set(placement.designId, group);
    occupiedArea += area;
    copies++;
  }
  if (occupiedArea <= 0 || copies !== layout.pieceCount) return null;
  const total = layout.pages.length * cents / 100;
  const wasteArea = Math.max(0, totalArea - occupiedArea);
  const wasteFraction = wasteArea / totalArea;
  const wasteCost = total * wasteFraction;
  const byDesign = new Map<string, { subtotal: number; unit: number }>();
  for (const [id, group] of groups) {
    const areaShare = group.area / occupiedArea;
    const wasteShare = allocation === 'area' ? areaShare : group.copies / copies;
    const subtotal = (total - wasteCost) * areaShare + wasteCost * wasteShare;
    byDesign.set(id, { subtotal, unit: subtotal / group.copies });
  }
  return { total, wasteArea, wasteFraction, wasteCost, byDesign };
}
