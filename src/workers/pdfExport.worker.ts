import { createPrintPdfBundle } from '../core/pdf';
import type { PdfRequest } from '../browser/workerClient';
self.onmessage = async (event: MessageEvent<PdfRequest>) => {
  try {
    const { assets,layout,profile,...options } = event.data;
    const result = await createPrintPdfBundle(assets,layout,profile,options,progress => self.postMessage({ progress }));
    self.postMessage({ result });
  } catch (error) { self.postMessage({ error: error instanceof Error ? error.message : 'No se ha podido exportar el PDF.' }); }
};
