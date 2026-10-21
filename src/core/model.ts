export interface Raster {
  width: number;
  height: number;
  data: Uint8ClampedArray;
  /** Pixels per original source pixel; interpolation must not inflate reported DPI. */
  sourceScale: number;
}

export interface SheetProfile {
  id: string;
  name: string;
  widthMm: number;
  heightMm: number;
  margins: { top: number; right: number; bottom: number; left: number };
}

export interface DesignVersion { raster: Raster; note: string; url: string; opaque: boolean }
export interface Design {
  id: string;
  name: string;
  original: Raster;
  raster: Raster;
  widthMm: number;
  copies: number;
  url: string;
  note: string;
  opaque: boolean;
  undo?: DesignVersion;
}

export interface PackItem { id: string; widthMm: number; heightMm: number; copies: number }
export interface Placement {
  designId: string;
  copyIndex: number;
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  rotation: 0 | 90;
}
export interface LayoutResult {
  pages: { placements: Placement[]; utilization: number }[];
  unplacedIds: string[];
  pieceCount: number;
}

export const MAX_PIECES = 3000;
export const MAX_IMAGE_PIXELS = 25_000_000;
export const MAX_TOTAL_PIXELS = 60_000_000;
export const DEFAULT_PROFILE: SheetProfile = {
  id: 'film-55', name: 'Film 55 × 100 cm', widthMm: 550, heightMm: 1000,
  margins: { top: 0, right: 0, bottom: 0, left: 0 },
};

export function parsePositiveNumber(value: string): number | null {
  const normalized = value.trim().replace(',', '.');
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized)) return null;
  const n = Number(normalized);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function designMetrics(raster: Raster, widthMm: number) {
  const dpi = (raster.width / raster.sourceScale) * 25.4 / widthMm;
  return {
    heightMm: Math.round(widthMm * raster.height / raster.width * 100) / 100,
    dpi,
    recommendedWidthMm: Math.max(0.01, Math.floor((raster.width / raster.sourceScale) * 25.4 / 300 * 100) / 100),
    quality: dpi >= 300 ? 'good' as const : dpi >= 150 ? 'fair' as const : 'low' as const,
  };
}

export function validateProfile(profile: SheetProfile): string | null {
  if (![profile.widthMm, profile.heightMm].every(n => Number.isFinite(n) && n >= 10 && n <= 5000)) {
    return 'El ancho y el largo deben estar entre 10 y 5000 mm.';
  }
  if (!Object.values(profile.margins).every(n => Number.isFinite(n) && n >= 0)) return 'Los márgenes deben ser números positivos o cero.';
  if (profile.margins.left + profile.margins.right >= profile.widthMm || profile.margins.top + profile.margins.bottom >= profile.heightMm) {
    return 'Los márgenes dejan el pliego sin superficie imprimible.';
  }
  return null;
}

export const formatMm = (n: number) => new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(n);

/** Packing happens before the full-sheet mirror. Swap logical margins so physical margins stay fixed. */
export function profileForLayout(profile: SheetProfile, mirror: boolean): SheetProfile {
  return mirror ? { ...profile, margins: { ...profile.margins, left: profile.margins.right, right: profile.margins.left } } : profile;
}

type RasterSize = Pick<Raster, 'width' | 'height'>;
interface RetainedDesign { id: string; original: RasterSize; raster: RasterSize; undo?: { raster: RasterSize } }
export function retainedPixelCount(designs: RetainedDesign[]): number {
  const rasters = new Set<RasterSize>();
  for (const design of designs) { rasters.add(design.original); rasters.add(design.raster); if (design.undo) rasters.add(design.undo.raster); }
  return [...rasters].reduce((sum, raster) => sum + raster.width * raster.height, 0);
}
export function pixelsAfterEdit(designs: RetainedDesign[], id: string, width: number, height: number): number {
  return retainedPixelCount(designs.map(design => design.id === id ? { ...design, raster: { width, height }, undo: { raster: design.raster } } : design));
}
