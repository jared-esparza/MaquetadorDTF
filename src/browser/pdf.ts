import { getDocument, GlobalWorkerOptions, AnnotationMode, type PDFDocumentProxy, type PDFPageProxy } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { inspectPdf, type PdfSource } from '../core/pdfSource';
import { MAX_IMAGE_PIXELS, type Raster } from '../core/model';

GlobalWorkerOptions.workerSrc = workerUrl;
export function loadPdf(bytes: Uint8Array) {
  const base = new URL(`${import.meta.env.BASE_URL}pdfjs/`, window.location.href).href;
  // Do not execute document JavaScript while producing thumbnails or exports.
  return getDocument({ data: bytes.slice(), useSystemFonts: false, cMapUrl: `${base}cmaps/`, cMapPacked: true, standardFontDataUrl: `${base}standard_fonts/`, wasmUrl: `${base}wasm/`, stopAtErrors: true, disableJavaScript: true } as Parameters<typeof getDocument>[0]);
}
const yieldUi = () => new Promise<void>(resolve => setTimeout(resolve, 0));
function checkSize(width: number, height: number) {
  if (width <= 0 || height <= 0 || width > 32767 || height > 32767 || width * height > MAX_IMAGE_PIXELS) throw new Error('La página supera 25 megapíxeles a esta resolución. Prepara una página más pequeña o elige 300 ppp para convertirla.');
}
async function render(page: PDFPageProxy, canvas: HTMLCanvasElement, viewport: ReturnType<PDFPageProxy['getViewport']>, signal: AbortSignal, transform?: number[]) {
  signal.throwIfAborted();
  // PDF.js creates an opaque context when passed a canvas directly. DTF requires alpha.
  const task = page.render({ canvas: null, canvasContext: canvas.getContext('2d', { alpha: true, willReadFrequently: true })!, viewport, transform, background: 'rgba(0,0,0,0)', annotationMode: AnnotationMode.DISABLE, intent: 'print' });
  const cancel = () => task.cancel(); signal.addEventListener('abort', cancel, { once: true });
  try { await task.promise; signal.throwIfAborted(); } finally { signal.removeEventListener('abort', cancel); }
}
export interface PdfCandidate { name: string; pageNumber: number; pdf?: PdfSource; raster?: Raster; error?: string }

export async function analyzePdf(file: File, signal: AbortSignal, onPage: (page: PdfCandidate, total: number) => void) {
  if (file.size > 50 * 1024 * 1024) throw new Error('El PDF supera 50 MiB. Divide el documento.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  await inspectPdf(bytes); signal.throwIfAborted();
  const sourceDocument = { id: crypto.randomUUID(), bytes };
  const loading = loadPdf(bytes);
  const cancel = () => { void loading.destroy(); }; signal.addEventListener('abort', cancel, { once: true });
  try {
    const doc = await loading.promise;
    for (let i = 1; i <= doc.numPages; i++) {
      signal.throwIfAborted();
      const page = await doc.getPage(i), viewport = page.getViewport({ scale: 300 / 72 });
      const canvas = document.createElement('canvas');
      try {
        checkSize(Math.ceil(viewport.width), Math.ceil(viewport.height));
        canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
        await render(page, canvas, viewport, signal);
        const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
        let left = canvas.width, top = canvas.height, right = -1, bottom = -1;
        for (let y = 0; y < canvas.height; y += 128) {
          signal.throwIfAborted();
          const rows = Math.min(128, canvas.height - y), data = ctx.getImageData(0, y, canvas.width, rows).data;
          for (let row = 0; row < rows; row++) for (let x = 0; x < canvas.width; x++) if (data[(row * canvas.width + x) * 4 + 3]) {
            left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y + row); bottom = Math.max(bottom, y + row);
          }
          await yieldUi();
        }
        if (right < 0) throw new Error('Página vacía: no contiene un diseño visible.');
        left = Math.max(0, left - 2); top = Math.max(0, top - 2);
        const cropRight = Math.min(viewport.width, right + 3), cropBottom = Math.min(viewport.height, bottom + 3);
        const width = cropRight - left, height = cropBottom - top;
        const points = [viewport.convertToPdfPoint(left, top), viewport.convertToPdfPoint(cropRight, cropBottom)];
        const [a,b,c,d,e,f] = page.getViewport({ scale: 1 }).transform;
        const ratio = 72 / 300, widthPt = width * ratio, heightPt = height * ratio;
        const pdf: PdfSource = { document: sourceDocument, pageIndex: i - 1, widthPt, heightPt,
          box: { left: Math.min(points[0][0],points[1][0]), right: Math.max(points[0][0],points[1][0]), bottom: Math.min(points[0][1],points[1][1]), top: Math.max(points[0][1],points[1][1]) },
          matrix: [a,-b,c,-d,e - left * ratio,(top + height) * ratio - f] };
        const thumb = document.createElement('canvas'), scale = Math.min(1, 400 / Math.max(width,height));
        thumb.width = Math.max(1, Math.round(width * scale)); thumb.height = Math.max(1, Math.round(height * scale));
        const thumbCtx = thumb.getContext('2d')!;
        thumbCtx.drawImage(canvas,left,top,width,height,0,0,thumb.width,thumb.height);
        const raster = { width: thumb.width, height: thumb.height, data: thumbCtx.getImageData(0,0,thumb.width,thumb.height).data, sourceScale: 1 };
        thumb.width = thumb.height = 0;
        onPage({ name: `${file.name} · página ${i}`, pageNumber: i, pdf, raster }, doc.numPages);
      } catch (error) {
        if (signal.aborted) throw error;
        onPage({ name: `${file.name} · página ${i}`, pageNumber: i, error: error instanceof Error ? error.message : 'No se puede leer esta página.' }, doc.numPages);
      } finally { canvas.width = canvas.height = 0; page.cleanup(); }
    }
  } finally { signal.removeEventListener('abort',cancel); await loading.destroy(); }
}

/** PDF.js viewport -> cropped upright points, then caller's pixel transform. */
export async function renderPdfRegion(doc: PDFDocumentProxy, source: PdfSource, canvas: HTMLCanvasElement, transform: DOMMatrix, signal: AbortSignal) {
  const page = await doc.getPage(source.pageIndex + 1), viewport = page.getViewport({ scale: 1 });
  const upright = new DOMMatrix([1,0,0,-1,0,source.heightPt]).multiply(new DOMMatrix(source.matrix));
  const matrix = transform.multiply(upright).multiply(new DOMMatrix(viewport.transform).inverse());
  const ctx = canvas.getContext('2d')!;
  ctx.save(); ctx.setTransform(transform); ctx.beginPath(); ctx.rect(0,0,source.widthPt,source.heightPt); ctx.clip(); ctx.resetTransform();
  try { await render(page,canvas,viewport,signal,[matrix.a,matrix.b,matrix.c,matrix.d,matrix.e,matrix.f]); }
  finally { ctx.restore(); }
}

export async function rasterizePdf(source: PdfSource, widthMm: number, dpi: number, signal: AbortSignal): Promise<Raster> {
  const width = Math.round(widthMm * dpi / 25.4), height = Math.round(width * source.heightPt / source.widthPt);
  checkSize(width,height);
  const loading = loadPdf(source.document.bytes), canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const cancel = () => { void loading.destroy(); }; signal.addEventListener('abort',cancel,{ once: true });
  try {
    const doc = await loading.promise;
    await renderPdfRegion(doc,source,canvas,new DOMMatrix().scale(width / source.widthPt,height / source.heightPt),signal);
    return { width,height,sourceScale: 1,data: canvas.getContext('2d')!.getImageData(0,0,width,height).data };
  } finally { canvas.width = canvas.height = 0; signal.removeEventListener('abort',cancel); await loading.destroy(); }
}
