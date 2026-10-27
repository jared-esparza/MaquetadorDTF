import { PDFArray, PDFDict, PDFDocument, PDFName, PDFNumber } from 'pdf-lib';

export const MAX_PDF_BYTES = 50 * 1024 * 1024;
export const MAX_RETAINED_PDF_BYTES = 100 * 1024 * 1024;
export interface PdfSource {
  document: { id: string; bytes: Uint8Array };
  pageIndex: number;
  box: { left: number; bottom: number; right: number; top: number };
  /** Original PDF coordinates to the cropped, upright page in physical points. */
  matrix: [number, number, number, number, number, number];
  widthPt: number;
  heightPt: number;
}

export async function inspectPdf(bytes: Uint8Array) {
  if (bytes.length > MAX_PDF_BYTES) throw new Error('El PDF supera 50 MiB. Divide el documento.');
  if (String.fromCharCode(...bytes.subarray(0, 5)) !== '%PDF-') throw new Error('Selecciona un archivo PDF válido.');
  let doc: PDFDocument;
  try { doc = await PDFDocument.load(bytes, { updateMetadata: false }); }
  catch { throw new Error('El PDF está cifrado, dañado o no se puede leer. Guarda una copia PDF sin contraseña.'); }
  if (!doc.getPageCount() || doc.getPageCount() > 100) throw new Error('El PDF debe tener entre 1 y 100 páginas.');
  if (doc.catalog.has(PDFName.of('OCProperties'))) throw new Error('Este PDF contiene capas opcionales. Exporta una copia sin capas antes de importarlo.');
  if (doc.catalog.has(PDFName.of('AcroForm'))) throw new Error('Este PDF contiene formularios. Exporta una copia aplanada antes de importarlo.');
  for (const page of doc.getPages()) {
    const annotations = page.node.lookupMaybe(PDFName.of('Annots'), PDFArray);
    if (!annotations) continue;
    for (let i = 0; i < annotations.size(); i++) {
      const annotation = annotations.lookup(i, PDFDict);
      const flags = annotation.lookupMaybe(PDFName.of('F'), PDFNumber)?.asNumber() ?? 0;
      if ((flags & 4) || annotation.get(PDFName.of('Subtype')) === PDFName.of('Widget')) throw new Error('El PDF contiene anotaciones imprimibles. Exporta una copia aplanada antes de importarlo.');
    }
  }
  return doc;
}

export function retainedPdfBytes(designs: { pdf?: PdfSource; undo?: { pdf?: PdfSource } }[]) {
  const documents = new Map<string, Uint8Array>();
  for (const design of designs) for (const pdf of [design.pdf, design.undo?.pdf]) if (pdf) documents.set(pdf.document.id, pdf.document.bytes);
  return [...documents.values()].reduce((sum, bytes) => sum + bytes.byteLength, 0);
}
