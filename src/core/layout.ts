import { MAX_PIECES, validateProfile, type LayoutResult, type PackItem, type Placement, type SheetProfile } from './model';

interface Rect { x: number; y: number; w: number; h: number }
interface Piece { id: string; copyIndex: number; w: number; h: number }
const q = (n: number) => Math.round(n * 100);
const mm = (n: number) => n / 100;

function intersects(a: Rect, b: Rect) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }
function contains(a: Rect, b: Rect) { return b.x >= a.x && b.y >= a.y && b.x + b.w <= a.x + a.w && b.y + b.h <= a.y + a.h; }

function splitFree(free: Rect[], used: Rect): Rect[] {
  const split: Rect[] = [];
  for (const r of free) {
    if (!intersects(r, used)) { split.push(r); continue; }
    if (used.x > r.x) split.push({ ...r, w: used.x - r.x });
    if (used.x + used.w < r.x + r.w) split.push({ ...r, x: used.x + used.w, w: r.x + r.w - used.x - used.w });
    if (used.y > r.y) split.push({ ...r, h: used.y - r.y });
    if (used.y + used.h < r.y + r.h) split.push({ ...r, y: used.y + used.h, h: r.y + r.h - used.y - used.h });
  }
  return split.filter((r, i) => !split.some((s, j) => j !== i && contains(s, r) && (s.w !== r.w || s.h !== r.h || j < i)));
}

function bestFit(free: Rect[], piece: Piece, gap: number, strategy: 'short' | 'area') {
  let best: { rect: Rect; rotation: 0 | 90; scores: number[] } | null = null;
  for (const r of free) for (const rotation of [0, 90] as const) {
    const w = (rotation ? piece.h : piece.w) + gap, h = (rotation ? piece.w : piece.h) + gap;
    if (w > r.w || h > r.h) continue;
    const short = Math.min(r.w - w, r.h - h), long = Math.max(r.w - w, r.h - h);
    const area = r.w * r.h - w * h;
    const scores = strategy === 'short' ? [short, long, r.y, r.x, rotation] : [area, short, r.y, r.x, rotation];
    const isBetter = !best || scores.some((v, i) => v < best!.scores[i] && scores.slice(0, i).every((n, j) => n === best!.scores[j]));
    if (isBetter) best = { rect: { x: r.x, y: r.y, w, h }, rotation, scores };
  }
  return best;
}

export function packDesigns(items: PackItem[], profile: SheetProfile, gapMm: number): LayoutResult {
  const error = validateProfile(profile);
  if (error) throw new Error(error);
  if (![3, 4, 5, 6, 7].includes(gapMm)) throw new Error('La separación debe ser 3, 4, 5, 6 o 7 mm.');
  if (items.some(i => !Number.isFinite(i.widthMm) || !Number.isFinite(i.heightMm) || q(i.widthMm) <= 0 || q(i.heightMm) <= 0 || !Number.isInteger(i.copies) || i.copies < 1)) throw new Error('Revisa las medidas y las copias de los diseños.');
  if (new Set(items.map(i => i.id)).size !== items.length) throw new Error('Los diseños deben tener identificadores únicos.');
  const pieceCount = items.reduce((n, i) => n + i.copies, 0);
  if (pieceCount > MAX_PIECES) throw new Error(`El máximo es ${MAX_PIECES} piezas por trabajo. Divide el trabajo en varios PDF.`);
  const usableW = q(profile.widthMm - profile.margins.left - profile.margins.right);
  const usableH = q(profile.heightMm - profile.margins.top - profile.margins.bottom);
  const gap = q(gapMm);
  const unplacedIds = items.filter(i => !(q(i.widthMm) <= usableW && q(i.heightMm) <= usableH) && !(q(i.heightMm) <= usableW && q(i.widthMm) <= usableH)).map(i => i.id);
  if (unplacedIds.length) return { pages: [], unplacedIds, pieceCount };
  const pieces: Piece[] = items.flatMap(i => Array.from({ length: i.copies }, (_, copyIndex) => ({ id: i.id, copyIndex, w: q(i.widthMm), h: q(i.heightMm) })));
  if (!pieces.length) return { pages: [], unplacedIds: [], pieceCount: 0 };
  const orderings = [
    (a: Piece) => a.w * a.h,
    (a: Piece) => Math.max(a.w, a.h),
    (a: Piece) => a.w + a.h,
  ];
  let best: LayoutResult | null = null, bestHeight = Infinity;
  for (const ordering of orderings) for (const strategy of ['short', 'area'] as const) {
    const bins: { free: Rect[]; placements: Placement[] }[] = [];
    const sorted = [...pieces].sort((a, b) => ordering(b) - ordering(a) || a.id.localeCompare(b.id) || a.copyIndex - b.copyIndex);
    for (const piece of sorted) {
      let fit: ReturnType<typeof bestFit> = null, bin: typeof bins[number] | undefined;
      for (const candidate of bins) {
        fit = bestFit(candidate.free, piece, gap, strategy);
        if (fit) { bin = candidate; break; }
      }
      if (!bin) {
        bin = { free: [{ x: q(profile.margins.left), y: q(profile.margins.top), w: usableW + gap, h: usableH + gap }], placements: [] };
        bins.push(bin); fit = bestFit(bin.free, piece, gap, strategy);
      }
      if (!fit) throw new Error('No se ha podido colocar una pieza. Revisa el formato.');
      bin.free = splitFree(bin.free, fit.rect);
      bin.placements.push({ designId: piece.id, copyIndex: piece.copyIndex, xMm: mm(fit.rect.x), yMm: mm(fit.rect.y), widthMm: mm(fit.rect.w - gap), heightMm: mm(fit.rect.h - gap), rotation: fit.rotation });
    }
    const pages = bins.map(bin => ({ placements: bin.placements, utilization: bin.placements.reduce((sum, p) => sum + p.widthMm * p.heightMm, 0) / (mm(usableW) * mm(usableH)) }));
    const lastHeight = Math.max(...pages[pages.length - 1].placements.map(p => p.yMm + p.heightMm));
    if (!best || pages.length < best.pages.length || (pages.length === best.pages.length && lastHeight < bestHeight)) {
      best = { pages, unplacedIds: [], pieceCount }; bestHeight = lastHeight;
    }
  }
  return best!;
}

/** Independent export guard as well as a test oracle for geometry. */
export function validateLayout(layout: LayoutResult, profile: SheetProfile, gapMm: number): string[] {
  const errors: string[] = [], seen = new Set<string>(), eps = 0.011;
  for (const page of layout.pages) for (let i = 0; i < page.placements.length; i++) {
    const p = page.placements[i], key = `${p.designId}:${p.copyIndex}`;
    if (seen.has(key)) errors.push('Copia duplicada.'); seen.add(key);
    if (![p.xMm, p.yMm, p.widthMm, p.heightMm].every(Number.isFinite) || p.widthMm <= 0 || p.heightMm <= 0 || ![0, 90].includes(p.rotation)) errors.push('Geometría inválida.');
    if (p.xMm < profile.margins.left - eps || p.yMm < profile.margins.top - eps || p.xMm + p.widthMm > profile.widthMm - profile.margins.right + eps || p.yMm + p.heightMm > profile.heightMm - profile.margins.bottom + eps) errors.push('Pieza fuera del área imprimible.');
    for (let j = i + 1; j < page.placements.length; j++) {
      const b = page.placements[j];
      if (!(p.xMm + p.widthMm + gapMm <= b.xMm + eps || b.xMm + b.widthMm + gapMm <= p.xMm + eps || p.yMm + p.heightMm + gapMm <= b.yMm + eps || b.yMm + b.heightMm + gapMm <= p.yMm + eps)) errors.push('Solapamiento o separación insuficiente.');
    }
  }
  if (seen.size !== layout.pieceCount) errors.push('El número de copias no coincide con el trabajo.');
  if (layout.unplacedIds.length) errors.push('Hay diseños que no caben.');
  return errors;
}
