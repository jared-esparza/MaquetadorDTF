import { cropRaster, eraseBackground, refineRaster, type EraseOptions } from '../core/images';
import type { Raster } from '../core/model';

self.onmessage = (event: MessageEvent<{ operation: 'crop' | 'erase' | 'refine'; raster: Raster; options?: EraseOptions }>) => {
  try {
    const { operation, raster, options } = event.data;
    const result = operation === 'crop' ? cropRaster(raster) : operation === 'refine' ? refineRaster(raster) : eraseBackground(raster, options!);
    self.postMessage({ result });
  } catch (error) { self.postMessage({ error: error instanceof Error ? error.message : 'No se ha podido procesar la imagen.' }); }
};
