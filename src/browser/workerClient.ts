import type { EraseOptions } from '../core/images';
import type { LayoutResult, PackItem, Raster, SheetProfile } from '../core/model';

function request<T>(worker: Worker, payload: unknown, signal?: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const cleanup = () => { worker.terminate(); signal?.removeEventListener('abort', cancel); };
    const cancel = () => { cleanup(); reject(new DOMException('Operación cancelada', 'AbortError')); };
    if (signal?.aborted) { cancel(); return; }
    signal?.addEventListener('abort', cancel, { once: true });
    worker.onmessage = (event: MessageEvent<{ result?: T; error?: string }>) => {
      cleanup();
      if (event.data.error) reject(new Error(event.data.error)); else resolve(event.data.result!);
    };
    worker.onerror = () => { cleanup(); reject(new Error('No se ha podido completar el cálculo. Reduce el tamaño del trabajo e inténtalo de nuevo.')); };
    worker.postMessage(payload);
  });
}

export const runLayout = (items: PackItem[], profile: SheetProfile, gapMm: number, signal?: AbortSignal) =>
  request<LayoutResult>(new Worker(new URL('../workers/layout.worker.ts', import.meta.url), { type: 'module' }), { items, profile, gapMm }, signal);

export const runImage = (operation: 'crop' | 'erase' | 'refine', raster: Raster, options?: EraseOptions, signal?: AbortSignal) =>
  request<Raster>(new Worker(new URL('../workers/image.worker.ts', import.meta.url), { type: 'module' }), { operation, raster, options }, signal);
