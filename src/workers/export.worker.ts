import { renderPrintPng, type PngRequest } from '../browser/printPng';
self.onmessage = async (event: MessageEvent<PngRequest>) => {
  try {
    const result = await renderPrintPng(event.data, progress => self.postMessage({ progress }));
    self.postMessage({ result });
  } catch (error) { self.postMessage({ error: error instanceof Error ? error.message : 'No se ha podido exportar el PNG.' }); }
};
