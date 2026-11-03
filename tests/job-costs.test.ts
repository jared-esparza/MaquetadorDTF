import { expect, it } from 'vitest';
import { calculateJobCosts, parseSheetCost } from '../src/core/jobCosts';
import type { LayoutResult, Placement } from '../src/core/model';

const profile = { widthMm: 100, heightMm: 100, margins: { top: 10, right: 10, bottom: 10, left: 10 } };
const piece = (designId: string, widthMm: number, heightMm: number, xMm: number, yMm: number, copyIndex = 0, rotation: Placement['rotation'] = 0): Placement =>
  ({ designId, widthMm, heightMm, xMm, yMm, copyIndex, rotation });
const layout: LayoutResult = {
  pages: [{ placements: [piece('a', 50, 80, 10, 10, 0, 90), piece('b', 25, 40, 65, 10), piece('b', 25, 40, 65, 50, 1)], utilization: 0.9375 }],
  unplacedIds: [],
  pieceCount: 3,
};

it.each([['area', 6.6667, 1.6667], ['copy', 5.3333, 2.3333]] as const)('reparte la merma del film completo por %s', (mode, a, b) => {
  const result = calculateJobCosts(layout, profile, 1000, mode)!;
  expect(result.total).toBe(10);
  expect(result.wasteArea).toBe(4000);
  expect(result.wasteCost).toBe(4);
  expect(result.byDesign.get('a')!.unit).toBeCloseTo(a, 4);
  expect(result.byDesign.get('b')!.unit).toBeCloseTo(b, 4);
  expect(result.byDesign.get('b')!.subtotal).toBeCloseTo(result.byDesign.get('b')!.unit * 2);
  expect([...result.byDesign.values()].reduce((sum, design) => sum + design.subtotal, 0)).toBeCloseTo(result.total);
  expect(6 + result.wasteCost).toBeCloseTo(result.total);
});

it('reparte entre todos los pliegos y admite trabajos sin merma', () => {
  const [a, ...rest] = layout.pages[0].placements;
  const result = calculateJobCosts({ ...layout, pages: [{ placements: [a], utilization: 0.4 }, { placements: rest, utilization: 0.2 }] }, profile, 1000, 'copy')!;
  expect(result.total).toBe(20);
  expect(result.wasteCost).toBe(14);
  expect(result.byDesign.get('b')!.unit).toBeCloseTo(1 + 14 / 3);
  const full = calculateJobCosts({ ...layout, pages: [{ placements: [piece('a', 100, 100, 0, 0)], utilization: 1 }], pieceCount: 1 }, profile, 1000, 'area')!;
  expect(full.wasteCost).toBe(0);
  expect(full.byDesign.get('a')!.unit).toBe(10);
  expect(calculateJobCosts({ ...layout, unplacedIds: ['b'] }, profile, 1000, 'area')).toBeNull();
});

it('lee céntimos con coma o punto y rechaza importes inválidos', () => {
  expect(['0', '10,50', '10.5', '', '-1', '1.234', '1e2'].map(parseSheetCost)).toEqual([0, 1050, 1050, null, null, null, null]);
});
