import { Zip, ZipPassThrough } from 'fflate';
import { MAX_EXPORT_BYTES, PngEncoder, pngDimensions } from '../core/png';
import { validatePrint, type PrintAsset } from '../core/print';
import type { LayoutResult, SheetProfile } from '../core/model';

export interface PngRequest { assets: PrintAsset[]; layout: LayoutResult; profile: SheetProfile; gapMm: number; mirror: boolean; dpi: number }
export interface ExportProgress { page: number; pages: number; percent: number }

export async function renderPrintPng(request: PngRequest, progress: (value: ExportProgress) => void): Promise<Blob> {
  const { assets, layout, profile, dpi, mirror } = request;
  validatePrint(assets, layout, profile, request);
  const { width, height } = pngDimensions(profile, dpi), scale = dpi / 25.4;
  const parts: Blob[] = []; let size = 0;
  const collect = (bytes: Uint8Array) => {
    size += bytes.length;
    if (size > MAX_EXPORT_BYTES) throw new Error('El archivo supera 256 MiB. Reduce la resolución o divide el trabajo.');
    parts.push(new Blob([new Uint8Array(bytes)]));
  };
  const multiple = layout.pages.length > 1;
  const zip = multiple ? new Zip((error, bytes) => { if (error) throw error; collect(bytes); }) : null;
  const bitmaps = new Map<string, ImageBitmap>();
  const canvas = new OffscreenCanvas(width, Math.min(128, height));
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('No se puede generar el PNG en este navegador.');
  try {
    for (const asset of assets) bitmaps.set(asset.id, await createImageBitmap(new Blob([new Uint8Array(asset.png)]), { colorSpaceConversion: 'default' }));
    for (let index = 0; index < layout.pages.length; index++) {
      const entry = zip ? new ZipPassThrough(`DTF-${profile.widthMm}x${profile.heightMm}mm-${dpi}ppp${mirror ? '-espejo' : ''}-pliego-${String(index + 1).padStart(3, '0')}.png`) : null;
      if (entry) zip!.add(entry);
      const encoder = new PngEncoder(width, height, dpi, bytes => entry ? entry.push(bytes) : collect(bytes));
      for (let y = 0; y < height; y += 128) {
        const rows = Math.min(128, height - y);
        context.resetTransform(); context.clearRect(0, 0, width, canvas.height);
        context.setTransform(scale, 0, 0, scale, 0, -y);
        if (mirror) { context.translate(profile.widthMm, 0); context.scale(-1, 1); }
        context.imageSmoothingEnabled = true; context.imageSmoothingQuality = 'high';
        for (const placement of layout.pages[index].placements) {
          if ((placement.yMm + placement.heightMm) * scale < y || placement.yMm * scale > y + rows) continue;
          const bitmap = bitmaps.get(placement.designId)!;
          context.save(); context.translate(placement.xMm, placement.yMm);
          if (placement.rotation === 90) { context.translate(placement.widthMm, 0); context.rotate(Math.PI / 2); context.drawImage(bitmap, 0, 0, placement.heightMm, placement.widthMm); }
          else context.drawImage(bitmap, 0, 0, placement.widthMm, placement.heightMm);
          context.restore();
        }
        encoder.push(context.getImageData(0, 0, width, rows).data);
        progress({ page: index + 1, pages: layout.pages.length, percent: Math.floor((index + (y + rows) / height) / layout.pages.length * 100) });
      }
      encoder.finish(); entry?.push(new Uint8Array(), true);
    }
    zip?.end();
    return new Blob(parts, { type: multiple ? 'application/zip' : 'image/png' });
  } finally { bitmaps.forEach(bitmap => bitmap.close()); canvas.width = canvas.height = 0; }
}
