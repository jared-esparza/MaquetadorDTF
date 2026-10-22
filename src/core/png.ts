import { Zlib } from 'fflate';
import type { SheetProfile } from './model';

export const MAX_EXPORT_BYTES = 256 * 1024 * 1024;
export function pngDimensions(profile: SheetProfile, dpi: number) {
  if (![150, 300, 600].includes(dpi)) throw new Error('Resolución PNG no válida.');
  const width = Math.round(profile.widthMm * dpi / 25.4), height = Math.round(profile.heightMm * dpi / 25.4);
  if (![width, height].every(n => Number.isSafeInteger(n) && n > 0 && n <= 32767) || width * height > 512_000_000) throw new Error('El PNG supera el tamaño permitido. Reduce la resolución o el formato.');
  return { width, height };
}
const crcTable = Uint32Array.from({ length: 256 }, (_, n) => {
  for (let i = 0; i < 8; i++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});
function chunk(type: string, data: Uint8Array) {
  const result = new Uint8Array(data.length + 12), view = new DataView(result.buffer);
  view.setUint32(0, data.length);
  result.set(new TextEncoder().encode(type), 4); result.set(data, 8);
  let crc = 0xffffffff;
  for (let i = 4; i < result.length - 4; i++) crc = crcTable[(crc ^ result[i]) & 255] ^ (crc >>> 8);
  view.setUint32(result.length - 4, (crc ^ 0xffffffff) >>> 0);
  return result;
}

/** RGBA PNG with bounded scanline memory, independent of canvas encoders' fixed 96 dpi. */
export class PngEncoder {
  private rows = 0;
  private finished = false;
  private compressor: Zlib;
  constructor(private width: number, private height: number, dpi: number, emit: (bytes: Uint8Array) => void) {
    emit(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]));
    const header = new Uint8Array(13), view = new DataView(header.buffer);
    view.setUint32(0, width); view.setUint32(4, height); header[8] = 8; header[9] = 6;
    emit(chunk('IHDR', header)); emit(chunk('sRGB', new Uint8Array([0])));
    const density = new Uint8Array(9), physical = new DataView(density.buffer);
    physical.setUint32(0, Math.round(dpi / .0254)); physical.setUint32(4, Math.round(dpi / .0254)); density[8] = 1;
    emit(chunk('pHYs', density));
    this.compressor = new Zlib({ level: 6 }, (bytes, final) => {
      if (bytes.length) emit(chunk('IDAT', bytes));
      if (final) emit(chunk('IEND', new Uint8Array()));
    });
  }
  push(rgba: Uint8Array | Uint8ClampedArray) {
    const stride = this.width * 4, rows = rgba.length / stride;
    if (this.finished || !Number.isInteger(rows) || this.rows + rows > this.height) throw new Error('Filas PNG no válidas.');
    const filtered = new Uint8Array(rgba.length + rows);
    for (let y = 0; y < rows; y++) {
      const start = y * stride, output = y * (stride + 1); filtered[output] = 1;
      for (let x = 0; x < stride; x++) filtered[output + 1 + x] = rgba[start + x] - (x >= 4 ? rgba[start + x - 4] : 0);
    }
    this.rows += rows; this.compressor.push(filtered);
  }
  finish() {
    if (this.finished || this.rows !== this.height) throw new Error('El PNG está incompleto.');
    this.finished = true; this.compressor.push(new Uint8Array(), true);
  }
}
