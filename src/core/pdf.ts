import { PDFDocument, PDFName, PDFRawStream, concatTransformationMatrix, degrees, popGraphicsState, pushGraphicsState } from 'pdf-lib';
import { Zip, ZipPassThrough } from 'fflate';
import { validatePrint, type PrintAsset } from './print';
import { MAX_EXPORT_BYTES } from './png';
export type { PrintAsset } from './print';
import type { LayoutResult, SheetProfile } from './model';

const pt = (mm: number) => mm * 72 / 25.4;
type Options = { gapMm: number; mirror: boolean };
type Progress = (value: { page: number; pages: number; percent: number }) => void;

async function buildPdf(assets: PrintAsset[], sheets: LayoutResult['pages'], profile: SheetProfile, options: Options, progress?: (page: number) => void) {
  const doc = await PDFDocument.create();
  doc.setTitle('Montaje DTF · PKprint'); doc.setCreator('Maquetador DTF local · PKprint');
  doc.setSubject(`Tamaño real · ${profile.widthMm} × ${profile.heightMm} mm · espejo ${options.mirror ? 'activado' : 'desactivado'}`);
  const sources = new Map<string, PDFDocument>();
  const needed = new Set(sheets.flatMap(sheet => sheet.placements.map(p => p.designId)));
  const embedded = new Map<string, (page: ReturnType<PDFDocument['addPage']>, placement: LayoutResult['pages'][number]['placements'][number]) => void>();
  for (const asset of assets.filter(asset => needed.has(asset.id))) {
    if (asset.pdf) {
      const source = asset.pdf;
      if (!sources.has(source.document.id)) sources.set(source.document.id, await PDFDocument.load(source.document.bytes));
      // Copy the page first so resources and its transparency group use this document's context.
      const [copy] = await doc.copyPages(sources.get(source.document.id)!, [source.pageIndex]);
      const form = await doc.embedPage(copy, source.box, source.matrix);
      await form.embed();
      const group = copy.node.get(PDFName.of('Group'));
      const stream = doc.context.lookup(form.ref);
      if (group && stream instanceof PDFRawStream) stream.dict.set(PDFName.of('Group'), group);
      embedded.set(asset.id, (page, p) => page.drawPage(form, {
        x: pt(p.xMm), y: pt(profile.heightMm - p.yMm - (p.rotation ? 0 : p.heightMm)),
        xScale: pt(p.rotation ? p.heightMm : p.widthMm) / source.widthPt,
        yScale: pt(p.rotation ? p.widthMm : p.heightMm) / source.heightPt,
        rotate: degrees(p.rotation ? -90 : 0),
      }));
    } else {
      const image = await doc.embedPng(asset.png);
      embedded.set(asset.id, (page, p) => page.drawImage(image, {
        x: pt(p.xMm), y: pt(profile.heightMm - p.yMm - (p.rotation ? 0 : p.heightMm)),
        width: pt(p.rotation ? p.heightMm : p.widthMm), height: pt(p.rotation ? p.widthMm : p.heightMm), rotate: degrees(p.rotation ? -90 : 0),
      }));
    }
  }
  for (let i = 0; i < sheets.length; i++) {
    const page = doc.addPage([pt(profile.widthMm), pt(profile.heightMm)]);
    if (options.mirror) page.pushOperators(pushGraphicsState(), concatTransformationMatrix(-1, 0, 0, 1, pt(profile.widthMm), 0));
    for (const p of sheets[i].placements) embedded.get(p.designId)!(page, p);
    if (options.mirror) page.pushOperators(popGraphicsState());
    progress?.(i + 1);
  }
  const bytes = await doc.save();
  if (bytes.length > MAX_EXPORT_BYTES) throw new Error('El PDF supera 256 MiB. Divide el trabajo.');
  return bytes;
}

export async function createPrintPdf(assets: PrintAsset[], layout: LayoutResult, profile: SheetProfile, options: Options): Promise<Uint8Array> {
  validatePrint(assets, layout, profile, options);
  return buildPdf(assets, layout.pages, profile, options);
}

export async function createPrintPdfBundle(assets: PrintAsset[], layout: LayoutResult, profile: SheetProfile, options: Options & { organization: 'separate' | 'combined' }, progress?: Progress): Promise<{ bytes: Uint8Array; type: 'pdf' | 'zip' }> {
  validatePrint(assets, layout, profile, options);
  const pages = layout.pages.length;
  const report = (page: number) => progress?.({ page, pages, percent: Math.floor(page / pages * 100) });
  if (options.organization === 'combined' || pages === 1) return { type: 'pdf', bytes: await buildPdf(assets, layout.pages, profile, options, report) };
  const chunks: Uint8Array[] = []; let size = 0;
  const zip = new Zip((error, data) => {
    if (error) throw error;
    size += data.length;
    if (size > MAX_EXPORT_BYTES) throw new Error('El ZIP supera 256 MiB. Divide el trabajo.');
    chunks.push(data);
  });
  for (let i = 0; i < pages; i++) {
    const bytes = await buildPdf(assets, [layout.pages[i]], profile, options);
    const entry = new ZipPassThrough(`pliego-${String(i + 1).padStart(3, '0')}.pdf`);
    zip.add(entry); entry.push(bytes, true); report(i + 1);
  }
  zip.end();
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return { type: 'zip', bytes };
}
