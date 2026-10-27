import { describe, expect, it } from 'vitest';
import { packDesigns, spreadPage, validateLayout } from '../src/core/layout';
import { DEFAULT_PROFILE, profileForLayout, type LayoutResult, type Placement } from '../src/core/model';

const profile = { ...DEFAULT_PROFILE, widthMm: 1000, heightMm: 1000 };
const pageOf = (placements: Placement[]) => ({ placements, utilization: .72 });
const piece = (copyIndex: number, xMm: number, yMm: number, widthMm = 200, heightMm = 180): Placement =>
  ({ designId: 'a', copyIndex, xMm, yMm, widthMm, heightMm, rotation: 0 });
const layoutOf = (page: LayoutResult['pages'][number]): LayoutResult => ({ pages: [page], pieceCount: page.placements.length, unplacedIds: [] });

describe('repartir espacios sin volver a montar', () => {
  it('reparte 4 columnas y 5 filas hasta los extremos útiles sin mutar piezas ni aprovechamiento', () => {
    const compact = pageOf(Array.from({ length: 20 }, (_, i) => piece(i, i % 4 * 207, Math.floor(i / 4) * 187)));
    const before = structuredClone(compact);
    const result = spreadPage(compact, profile);
    expect(compact).toEqual(before);
    expect(result).not.toBe(compact);
    expect(result.utilization).toBe(compact.utilization);
    expect(result.placements).toHaveLength(20);
    result.placements.forEach((p, i) => {
      expect(p).toMatchObject({ ...compact.placements[i], xMm: p.xMm, yMm: p.yMm });
      expect(p.xMm).toBeCloseTo(i % 4 * (200 + 200 / 3), 9);
      expect(p.yMm).toBeCloseTo(Math.floor(i / 4) * 205, 9);
    });
    expect(validateLayout(layoutOf(result), profile, 7)).toEqual([]);
    expect(spreadPage(compact, profile)).toEqual(result);
  });

  it.each(['row', 'column'] as const)('solo expande el eje disponible: %s', direction => {
    const compact = pageOf([piece(0, 0, 0), piece(1, direction === 'row' ? 207 : 0, direction === 'column' ? 187 : 0)]);
    const result = spreadPage(compact, profile);
    expect(result.placements[0]).toEqual(compact.placements[0]);
    expect(result.placements[1].xMm).toBe(direction === 'row' ? 800 : 0);
    expect(result.placements[1].yMm).toBe(direction === 'column' ? 820 : 0);
    expect(validateLayout(layoutOf(result), profile, 7)).toEqual([]);
  });

  it('no mueve una pieza sola, posiciones coincidentes, una página vacía ni un encaje exacto', () => {
    for (const placements of [[], [piece(0, 12, 15)], [piece(0, 12, 15), piece(1, 12, 15)]]) {
      const page = pageOf(placements);
      expect(spreadPage(page, profile)).toEqual(page);
    }
    const exact = { ...profile, widthMm: 407, heightMm: 367 };
    const page = pageOf([piece(0, 0, 0), piece(1, 207, 0), piece(2, 0, 187), piece(3, 207, 187)]);
    expect(spreadPage(page, exact)).toEqual(page);
  });

  it.each([false, true])('respeta márgenes asimétricos, giros y mezcla con espejo=%s', mirror => {
    const physical = { ...profile, widthMm: 420, heightMm: 360, margins: { left: 11, right: 29, top: 13, bottom: 31 } };
    const adjusted = profileForLayout(physical, mirror);
    const compact = packDesigns([
      { id: 'a', widthMm: 120, heightMm: 75, copies: 7 },
      { id: 'b', widthMm: 55, heightMm: 90, copies: 8 },
      { id: 'c', widthMm: 240, heightMm: 50, copies: 3 },
    ], adjusted, 7);
    const before = structuredClone(compact);
    const result = { ...compact, pages: compact.pages.map(page => spreadPage(page, adjusted)) };
    expect(validateLayout(result, adjusted, 7)).toEqual([]);
    expect(compact).toEqual(before);
    result.pages.forEach((page, index) => {
      expect(page.utilization).toBe(compact.pages[index].utilization);
      page.placements.forEach((p, i) => {
        const original = compact.pages[index].placements[i];
        expect(p).toMatchObject({ ...original, xMm: p.xMm, yMm: p.yMm });
        for (let j = 0; j < i; j++) {
          const a = compact.pages[index].placements[j], b = page.placements[j];
          expect(Math.sign(p.xMm - b.xMm)).toBe(Math.sign(original.xMm - a.xMm));
          expect(Math.sign(p.yMm - b.yMm)).toBe(Math.sign(original.yMm - a.yMm));
        }
      });
    });
    const turned = pageOf([{ ...piece(0, adjusted.margins.left, 13, 180, 200), rotation: 90 },
      { ...piece(1, adjusted.margins.left + 187, 13, 180, 200), rotation: 90 }]);
    const spread = spreadPage(turned, adjusted);
    expect(spread.placements[1].xMm + 180).toBeCloseTo(adjusted.widthMm - adjusted.margins.right);
    expect(spread.placements.every(p => p.rotation === 90)).toBe(true);
    expect(validateLayout(layoutOf(spread), adjusted, 7)).toEqual([]);
  });

  it.each([false, true])('no amplifica la cuantización de márgenes de más de dos decimales; espejo=%s', mirror => {
    const physical = { ...profile, margins: { left: 3.004, right: 5.006, top: 2.004, bottom: 4.006 } };
    const adjusted = profileForLayout(physical, mirror);
    const left = Math.round(adjusted.margins.left * 100) / 100;
    const top = Math.round(adjusted.margins.top * 100) / 100;
    const compact = pageOf([piece(0, left, top, 20, 20), piece(1, left + 27, top, 20, 20),
      piece(2, left, top + 27, 20, 20), piece(3, left + 27, top + 27, 20, 20)]);
    expect(validateLayout(layoutOf(compact), adjusted, 7)).toEqual([]);
    const result = spreadPage(compact, adjusted);
    expect(validateLayout(layoutOf(result), adjusted, 7)).toEqual([]);
    expect(result.placements[0]).toEqual(compact.placements[0]);
    expect(result.placements[3].xMm + 20).toBeCloseTo(adjusted.widthMm - adjusted.margins.right);
    expect(result.placements[3].yMm + 20).toBeCloseTo(adjusted.heightMm - adjusted.margins.bottom);
  });

  it('conserva hasta 3000 copias y el resultado sigue siendo válido', () => {
    const compact = packDesigns([{ id: 'a', widthMm: 5, heightMm: 5, copies: 3000 }], DEFAULT_PROFILE, 3);
    const result = { ...compact, pages: compact.pages.map(page => spreadPage(page, DEFAULT_PROFILE)) };
    expect(result.pages.flatMap(page => page.placements)).toHaveLength(3000);
    expect(validateLayout(result, DEFAULT_PROFILE, 3)).toEqual([]);
  });
});
