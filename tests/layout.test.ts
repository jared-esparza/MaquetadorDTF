import { describe, expect, it } from 'vitest';
import { packDesigns, validateLayout } from '../src/core/layout';
import { DEFAULT_PROFILE, profileForLayout } from '../src/core/model';

describe('montaje físico', () => {
  it.each([6, 7])('respeta %i mm de separación en un encaje exacto', gap => {
    const profile = { ...DEFAULT_PROFILE, widthMm: 200 + gap, heightMm: 200 + gap };
    const result = packDesigns([{ id: 'a', widthMm: 100, heightMm: 100, copies: 4 }], profile, gap);
    expect(result.pages).toHaveLength(1);
    expect(result.pages[0].placements.map(p => [p.xMm, p.yMm]).sort()).toEqual([[0, 0], [0, 100 + gap], [100 + gap, 0], [100 + gap, 100 + gap]].sort());
    expect(validateLayout(result, profile, gap)).toEqual([]);
  });
  it('coloca cuatro cuadrados de 100 mm en 204 mm con separación de 4 mm y sin margen exterior extra', () => {
    const profile = { ...DEFAULT_PROFILE, widthMm: 204, heightMm: 204 };
    const result = packDesigns([{ id: 'a', widthMm: 100, heightMm: 100, copies: 4 }], profile, 4);
    expect(result.pages).toHaveLength(1);
    expect(result.pages[0].placements).toHaveLength(4);
    expect(result.pages[0].placements.map(p => [p.xMm, p.yMm]).sort()).toEqual([[0, 0], [0, 104], [104, 0], [104, 104]].sort());
    expect(validateLayout(result, profile, 4)).toEqual([]);
  });

  it('gira una pieza que solo cabe en orientación horizontal', () => {
    const profile = { ...DEFAULT_PROFILE, widthMm: 210, heightMm: 110, margins: { top: 5, right: 5, bottom: 5, left: 5 } };
    const result = packDesigns([{ id: 'giro', widthMm: 100, heightMm: 200, copies: 1 }], profile, 4);
    expect(result.pages[0].placements[0]).toMatchObject({ xMm: 5, yMm: 5, widthMm: 200, heightMm: 100, rotation: 90 });
  });

  it('reparte cinco piezas entre dos páginas y conserva cada número de copia', () => {
    const profile = { ...DEFAULT_PROFILE, widthMm: 204, heightMm: 204 };
    const result = packDesigns([{ id: 'a', widthMm: 100, heightMm: 100, copies: 5 }], profile, 4);
    expect(result.pages).toHaveLength(2);
    expect(result.pages.flatMap(p => p.placements).map(p => p.copyIndex).sort()).toEqual([0, 1, 2, 3, 4]);
  });

  it('identifica una pieza imposible sin reducirla ni exportar un montaje parcial', () => {
    const result = packDesigns([{ id: 'grande', widthMm: 600, heightMm: 1100, copies: 1 }], DEFAULT_PROFILE, 4);
    expect(result.unplacedIds).toEqual(['grande']);
    expect(result.pages).toHaveLength(0);
  });

  it('respeta márgenes, no solapa y es determinista con tamaños y cantidades mezcladas', () => {
    const profile = { ...DEFAULT_PROFILE, margins: { top: 7, right: 11, bottom: 9, left: 5 } };
    const items = Array.from({ length: 12 }, (_, i) => ({ id: String(i), widthMm: 21.3 + i * 9.7, heightMm: 35.8 + i * 11.2, copies: 7 }));
    const first = packDesigns(items, profile, 5);
    expect(first).toEqual(packDesigns(items, profile, 5));
    expect(first.pages.flatMap(p => p.placements)).toHaveLength(84);
    expect(validateLayout(first, profile, 5)).toEqual([]);
    expect(first.unplacedIds).toEqual([]);
  });

  it('rechaza perfil inválido, cantidad fraccionaria y exceso de piezas', () => {
    expect(() => packDesigns([], { ...DEFAULT_PROFILE, widthMm: 0 }, 4)).toThrow();
    expect(() => packDesigns([{ id: 'a', widthMm: 10, heightMm: 10, copies: 1.5 }], DEFAULT_PROFILE, 4)).toThrow();
    expect(() => packDesigns([{ id: 'a', widthMm: 10, heightMm: 10, copies: 3001 }], DEFAULT_PROFILE, 4)).toThrow();
  });

  it('mantiene los márgenes físicos asimétricos cuando el PDF se refleja', () => {
    const profile = { ...DEFAULT_PROFILE, widthMm: 200, heightMm: 100, margins: { top: 5, right: 30, bottom: 5, left: 10 } };
    const result = packDesigns([{ id: 'a', widthMm: 160, heightMm: 90, copies: 1 }], profileForLayout(profile, true), 4);
    const p = result.pages[0].placements[0];
    expect(p.xMm).toBe(30);
    expect(profile.widthMm - p.xMm - p.widthMm).toBe(10);
    expect(p.yMm).toBe(5);
  });

  it('conserva todas las piezas sin solapamientos en 40 trabajos variados', () => {
    let seed = 716;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    for (let i = 0; i < 40; i++) {
      const profile = { ...DEFAULT_PROFILE, widthMm: 250 + random() * 200, heightMm: 400 + random() * 300, margins: { top: 5, right: 7, bottom: 11, left: 13 } };
      const items = Array.from({ length: 8 }, (_, j) => ({ id: String(j), widthMm: 10 + random() * 150, heightMm: 10 + random() * 170, copies: 1 + Math.floor(random() * 8) }));
      const gap = [3, 4, 5][i % 3];
      const result = packDesigns(items, profile, gap);
      expect(result.pages.flatMap(p => p.placements)).toHaveLength(items.reduce((n, item) => n + item.copies, 0));
      expect(validateLayout(result, profile, gap)).toEqual([]);
    }
  });
  it('procesa el límite de 3000 copias sin perder piezas', () => {
    const result = packDesigns([{ id: 'a', widthMm: 5, heightMm: 5, copies: 3000 }], DEFAULT_PROFILE, 3);
    expect(result.pages).toHaveLength(1);
    expect(result.pages[0].placements).toHaveLength(3000);
    expect(validateLayout(result, DEFAULT_PROFILE, 3)).toEqual([]);
  });
});
