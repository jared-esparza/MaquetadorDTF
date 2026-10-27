import { renderPrintPng, type ExportProgress, type PngRequest } from './printPng';
import { loadPdf, renderPdfRegion } from './pdf';
import { pngDimensions } from '../core/png';

export async function renderMixedPng(request: PngRequest, signal: AbortSignal, progress: (value: ExportProgress) => void) {
  const sources = new Map<string, ReturnType<typeof loadPdf>>();
  const canvas = document.createElement('canvas');
  canvas.width = pngDimensions(request.profile,request.dpi).width; canvas.height = 128;
  const cancel = () => { for (const task of sources.values()) void task.destroy(); };
  signal.addEventListener('abort',cancel,{ once: true });
  try {
    return await renderPrintPng(request,progress,async (asset,placement,y) => {
      signal.throwIfAborted();
      const source = asset.pdf!;
      if (!sources.has(source.document.id)) sources.set(source.document.id,loadPdf(source.document.bytes));
      const doc = await sources.get(source.document.id)!.promise;
      canvas.getContext('2d')!.clearRect(0,0,canvas.width,canvas.height);
      const scale = request.dpi / 25.4;
      let matrix = new DOMMatrix().translate(0,-y).scale(scale);
      if (request.mirror) matrix = matrix.translate(request.profile.widthMm,0).scale(-1,1);
      matrix = matrix.translate(placement.xMm,placement.yMm);
      if (placement.rotation) matrix = matrix.translate(placement.widthMm,0).rotate(90);
      matrix = matrix.scale((placement.rotation ? placement.heightMm : placement.widthMm) / source.widthPt,(placement.rotation ? placement.widthMm : placement.heightMm) / source.heightPt);
      await renderPdfRegion(doc,source,canvas,matrix,signal);
      return canvas;
    },signal);
  } finally { signal.removeEventListener('abort',cancel); for (const task of sources.values()) await task.destroy(); canvas.width = canvas.height = 0; }
}
