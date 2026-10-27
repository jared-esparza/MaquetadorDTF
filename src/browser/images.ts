import { MAX_IMAGE_PIXELS, type Raster } from '../core/model';

export async function decodeImage(file: File): Promise<Raster> {
  if (file.size > 20 * 1024 * 1024) throw new Error('El archivo supera el máximo de 20 MB.');
  const header = new Uint8Array(await file.slice(0, 64).arrayBuffer());
  const ascii = new TextDecoder().decode(header);
  if (file.type === 'image/webp' || /\.webp$/i.test(file.name)) {
    if (ascii.startsWith('RIFF') && ascii.includes('WEBP') && ascii.includes('ANIM')) throw new Error('Los WebP animados no están soportados; exporta una imagen estática.');
  }
  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch { throw new Error('La imagen está dañada o no se puede leer. Usa PNG, JPG/JPEG o WebP estático.'); }
  try {
    if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > MAX_IMAGE_PIXELS) throw new Error('La imagen supera el máximo de 25 megapíxeles.');
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width; canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('No se puede procesar la imagen en este navegador.');
    ctx.drawImage(bitmap, 0, 0);
    const result = { width: bitmap.width, height: bitmap.height, sourceScale: 1, data: ctx.getImageData(0, 0, bitmap.width, bitmap.height).data };
    canvas.width = canvas.height = 0;
    return result;
  } finally { bitmap.close(); }
}

export const decodePng = decodeImage;

export async function rasterPng(raster: Raster): Promise<Blob> {
  const canvas = document.createElement('canvas'); canvas.width = raster.width; canvas.height = raster.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No se puede exportar la imagen.');
  ctx.putImageData(new ImageData(new Uint8ClampedArray(raster.data), raster.width, raster.height), 0, 0);
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('No se ha podido convertir el diseño a PNG.')), 'image/png'));
  canvas.width = canvas.height = 0;
  return blob;
}

export async function rasterUrl(raster: Raster) { return URL.createObjectURL(await rasterPng(raster)); }
