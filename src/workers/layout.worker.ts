import { packDesigns } from '../core/layout';
import type { PackItem, SheetProfile } from '../core/model';

self.onmessage = (event: MessageEvent<{ items: PackItem[]; profile: SheetProfile; gapMm: number }>) => {
  try { self.postMessage({ result: packDesigns(event.data.items, event.data.profile, event.data.gapMm) }); }
  catch (error) { self.postMessage({ error: error instanceof Error ? error.message : 'No se ha podido calcular el montaje.' }); }
};
