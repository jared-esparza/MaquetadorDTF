import { MAX_IMAGE_PIXELS, type Raster } from './model';

export interface EraseOptions { tolerance: number; mode: 'connected' | 'global'; seed?: { x: number; y: number } }

export function cropRaster(input: Raster): Raster {
  let left = input.width, right = -1, top = input.height, bottom = -1;
  for (let y = 0; y < input.height; y++) for (let x = 0; x < input.width; x++) {
    if (input.data[(y * input.width + x) * 4 + 3] > 0) {
      left = Math.min(left, x); right = Math.max(right, x);
      top = Math.min(top, y); bottom = Math.max(bottom, y);
    }
  }
  if (right < left) throw new Error('La imagen no tiene contenido visible.');
  const width = right - left + 1, height = bottom - top + 1;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    const start = ((top + y) * input.width + left) * 4;
    data.set(input.data.subarray(start, start + width * 4), y * width * 4);
  }
  return { width, height, data, sourceScale: input.sourceScale };
}

export function hasOpaqueBackground(input: Raster): boolean {
  for (let i = 3; i < input.data.length; i += 4) if (input.data[i] < 255) return false;
  return true;
}

function borderColor(input: Raster): number[] {
  const counts = new Map<number, { count: number; color: number[] }>();
  const visit = (x: number, y: number) => {
    const p = (y * input.width + x) * 4;
    if (input.data[p + 3] < 128) return;
    const color = [...input.data.subarray(p, p + 3)];
    const key = (color[0] >> 4) * 256 + (color[1] >> 4) * 16 + (color[2] >> 4);
    const entry = counts.get(key);
    if (entry) entry.count++; else counts.set(key, { count: 1, color });
  };
  for (let x = 0; x < input.width; x++) { visit(x, 0); if (input.height > 1) visit(x, input.height - 1); }
  for (let y = 1; y < input.height - 1; y++) { visit(0, y); if (input.width > 1) visit(input.width - 1, y); }
  return [...counts.values()].sort((a, b) => b.count - a.count)[0]?.color ?? [255, 255, 255];
}

export function eraseBackground(input: Raster, options: EraseOptions): Raster {
  const { width, height } = input;
  const data = new Uint8ClampedArray(input.data);
  let color = borderColor(input);
  if (options.seed) {
    const { x, y } = options.seed;
    if (x < 0 || x >= width || y < 0 || y >= height) throw new Error('Selecciona un punto dentro de la imagen.');
    const p = (y * width + x) * 4;
    if (input.data[p + 3] === 0) throw new Error('Selecciona un color visible para la varita.');
    color = [...input.data.subarray(p, p + 3)];
  }
  const matches = (i: number) => input.data[i * 4 + 3] > 0 && Math.max(
    Math.abs(input.data[i * 4] - color[0]), Math.abs(input.data[i * 4 + 1] - color[1]), Math.abs(input.data[i * 4 + 2] - color[2]),
  ) <= options.tolerance;
  const remove = (i: number) => { data.fill(0, i * 4, i * 4 + 4); };
  if (options.mode === 'global') {
    for (let i = 0; i < width * height; i++) if (matches(i)) remove(i);
  } else {
    const visited = new Uint8Array(width * height);
    const queue = new Int32Array(width * height);
    let head = 0, tail = 0;
    const add = (i: number) => {
      if (!visited[i] && matches(i)) { visited[i] = 1; queue[tail++] = i; }
    };
    if (options.seed) add(options.seed.y * width + options.seed.x);
    else {
      for (let x = 0; x < width; x++) { add(x); add((height - 1) * width + x); }
      for (let y = 1; y < height - 1; y++) { add(y * width); add(y * width + width - 1); }
    }
    while (head < tail) {
      const i = queue[head++], x = i % width;
      remove(i);
      if (x > 0) add(i - 1); if (x < width - 1) add(i + 1);
      if (i >= width) add(i - width); if (i < width * (height - 1)) add(i + width);
    }
  }
  return { ...input, data };
}

/** Bilinear interpolation in premultiplied-alpha space prevents pale fringes. */
export function refineRaster(input: Raster): Raster {
  if (input.width * input.height * 4 > MAX_IMAGE_PIXELS) throw new Error('Este diseño es demasiado grande para ampliar sus bordes (máximo 25 MP después de ampliar).');
  const width = input.width * 2, height = input.height * 2;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const sx = Math.max(0, Math.min(input.width - 1, (x + .5) / 2 - .5));
    const sy = Math.max(0, Math.min(input.height - 1, (y + .5) / 2 - .5));
    const x0 = Math.floor(sx), y0 = Math.floor(sy), fx = sx - x0, fy = sy - y0;
    const samples = [
      [x0, y0, (1 - fx) * (1 - fy)], [Math.min(x0 + 1, input.width - 1), y0, fx * (1 - fy)],
      [x0, Math.min(y0 + 1, input.height - 1), (1 - fx) * fy],
      [Math.min(x0 + 1, input.width - 1), Math.min(y0 + 1, input.height - 1), fx * fy],
    ];
    let alpha = 0;
    const rgb = [0, 0, 0];
    for (const [px, py, weight] of samples) {
      const i = (py * input.width + px) * 4, a = input.data[i + 3] * weight;
      alpha += a;
      for (let c = 0; c < 3; c++) rgb[c] += input.data[i + c] * a;
    }
    const out = (y * width + x) * 4;
    data[out + 3] = alpha;
    if (alpha > 0) for (let c = 0; c < 3; c++) data[out + c] = rgb[c] / alpha;
  }
  return { width, height, data, sourceScale: input.sourceScale * 2 };
}
