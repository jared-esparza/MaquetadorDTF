import { useEffect, useMemo, useRef, useState } from 'react';
import { decodeImage, rasterPng, rasterUrl } from './browser/images';
import { runImage, runLayout, runPngExport, runPdfExport } from './browser/workerClient';
import { pngDimensions } from './core/png';
import type { ExportProgress } from './browser/printPng';
import { DEFAULT_PROFILE, IMAGE_BUDGETS, imageBudget, checkImageBudget, designHeight, designMetrics, formatMm, pixelsAfterEdit, profileForLayout, retainedPixelCount, validateProfile, type Design, type LayoutResult, type Raster, type SheetProfile } from './core/model';
import { defaultExportBaseName, normalizeExportBaseName, exportNameError, exportFilename } from './core/exportNames';
import { hasOpaqueBackground } from './core/images';
import { DesignCard } from './components/DesignCard';
import { ProfileEditor } from './components/ProfileEditor';
import { SheetPreview } from './components/SheetPreview';
import { Welcome } from './components/Welcome';
import { WindowsDownloads } from './components/WindowsDownloads';
import { Updates } from './components/Updates';
import { desktop } from './platform/desktop';
import { PdfImport, PdfConversion } from './components/PdfImport';
import { pdfRasterSize, rasterizePdf, type PdfCandidate } from './browser/pdf';
import { MAX_RETAINED_PDF_BYTES, retainedPdfBytes } from './core/pdfSource';
import type { PrintAsset } from './core/print';

const STORAGE_KEY = 'pkprint-dtf-profiles-v1';
const BUDGET_STORAGE_KEY = 'pkprint-dtf-image-budget-v1';
function readImageBudget() {
  if (!desktop) try { return imageBudget(JSON.parse(localStorage.getItem(BUDGET_STORAGE_KEY) ?? 'null')); } catch { /* Use the default for invalid preferences. */ }
  return imageBudget(undefined);
}
const initialProfiles = [DEFAULT_PROFILE, { ...DEFAULT_PROFILE, id: 'a3', name: 'A3', widthMm: 297, heightMm: 420 }, { ...DEFAULT_PROFILE, id: 'a4', name: 'A4', widthMm: 210, heightMm: 297 }];
function readProfiles(): { profiles: SheetProfile[]; selected: string } {
  if (desktop) return { profiles: initialProfiles, selected: DEFAULT_PROFILE.id };
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (stored && Array.isArray(stored.profiles) && stored.profiles.length > 0 && stored.profiles.every((p: SheetProfile) => p && typeof p.id === 'string' && typeof p.name === 'string' && p.margins && !validateProfile(p)) && stored.profiles.some((p: SheetProfile) => p.id === stored.selected)) return stored;
  } catch { /* A missing or invalid saved profile must not prevent launch. */ }
  return { profiles: initialProfiles, selected: DEFAULT_PROFILE.id };
}
const errorText = (e: unknown) => e instanceof Error ? e.message : 'No se ha podido completar la operación.';
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = filename; document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

export default function App() {
  const [stored, setStored] = useState(readProfiles);
  const profile = stored.profiles.find(p => p.id === stored.selected)!;
  const [designs, setDesigns] = useState<Design[]>([]);
  const [imageBudgetMp, setImageBudgetMp] = useState(readImageBudget);
  const [exportBaseName, setExportBaseName] = useState('');
  const [gapMm, setGapMm] = useState(7);
  const [mirror, setMirror] = useState(false);
  const [pngDpi, setPngDpi] = useState(300);
  const [pdfOrganization,setPdfOrganization] = useState<'separate' | 'combined'>('separate');
  const [pdfImport,setPdfImport] = useState<{ file: File; resolve: (pages: PdfCandidate[], dpi: number) => void } | null>(null);
  const [conversion,setConversion] = useState<{ design: Design; action: 'erase' | 'refine' } | null>(null);
  const [editingDesign,setEditingDesign] = useState<Design | null>(null);
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);
  const exportController = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formatOpen, setFormatOpen] = useState(false);
  const [preferencesReady, setPreferencesReady] = useState(!desktop);
  const [showWelcome, setShowWelcome] = useState(false);
  const [desktopVersion, setDesktopVersion] = useState('');
  const [updateInstalling, setUpdateInstalling] = useState(false);
  const [dirty, setDirty] = useState(false);
  const documentState = useRef({ dirty: false, busy: false });
  const [errors, setErrors] = useState<string[]>([]);
  const [invalidFields, setInvalidFields] = useState<Set<string>>(new Set());
  const [acceptedLowDpi, setAcceptedLowDpi] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);
  const [exported, setExported] = useState('');
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const urls = useRef(new Set<string>());
  const mounted = useRef(true);
  const [layoutState, setLayoutState] = useState<{ key: string; result: LayoutResult | null; error: string }>({ key: '', result: null, error: '' });
  const items = useMemo(() => designs.map(d => ({ id: d.id, widthMm: d.widthMm, heightMm: designHeight(d), copies: d.copies })), [designs]);
  const packingProfile = profileForLayout(profile, mirror);
  const layoutKey = JSON.stringify({ items, profile: packingProfile, gapMm });
  const pending = layoutState.key !== layoutKey;
  const layout = pending ? null : layoutState.result;
  const blocked = !!busy || editingId !== null || !preferencesReady || showWelcome || updateInstalling || conversion !== null;
  const lowDpi = designs.some(d => designMetrics(d.raster, d.widthMm).quality === 'low');
  const normalizedName = normalizeExportBaseName(exportBaseName);
  const nameError = exportNameError(normalizedName);
  const totalPixels = retainedPixelCount(designs);
  const canExport = !blocked && !formatOpen && !pending && !nameError && invalidFields.size === 0 && !!layout?.pages.length && layout.unplacedIds.length === 0 && (!lowDpi || acceptedLowDpi);
  let pngSize = '', pngError = '';
  try { const size = pngDimensions(profile, pngDpi); pngSize = `${size.width} × ${size.height} píxeles por pliego`; }
  catch (error) { pngError = errorText(error); }

  useEffect(() => {
    if (!preferencesReady) return;
    const failed = () => setErrors(previous => [...previous.filter(error => !error.startsWith('No se ha podido guardar el presupuesto')), 'No se ha podido guardar el presupuesto de imágenes. Se mantiene durante esta sesión.']);
    if (desktop) { desktop.updatePreferences({ imageBudgetMp }).catch(failed); return; }
    try { localStorage.setItem(BUDGET_STORAGE_KEY, JSON.stringify(imageBudgetMp)); } catch { failed(); }
  }, [imageBudgetMp, preferencesReady]);

  useEffect(() => {
    if (!preferencesReady) return;
    if (desktop) { desktop.updatePreferences({ profileState: stored }).catch(() => setErrors(['No se han podido guardar los formatos. Comprueba los permisos de la carpeta de datos.'])); return; }
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(stored)); }
    catch { setErrors(previous => previous.includes('No se han podido guardar los formatos en este navegador.') ? previous : [...previous, 'No se han podido guardar los formatos en este navegador.']); }
  }, [stored, preferencesReady]);
  useEffect(() => {
    if (!desktop) return;
    let active = true;
    desktop.getPreferences().then(preferences => {
      if (!active) return;
      if (preferences.profileState) setStored(preferences.profileState);
      setImageBudgetMp(imageBudget(preferences.imageBudgetMp));
      setShowWelcome(!preferences.hideWelcome); setDesktopVersion(preferences.version); setPreferencesReady(true);
    }).catch(() => { if (active) { setErrors(['No se han podido leer las preferencias. Se usarán los formatos iniciales.']); setShowWelcome(true); setPreferencesReady(true); } });
    const unsubscribe = desktop.onHelp(topic => { if (topic === 'welcome') setShowWelcome(true); });
    return () => { active = false; unsubscribe(); };
  }, []);
  useEffect(() => { setDirty(designs.length > 0); }, [designs, profile, gapMm, mirror]);
  useEffect(() => {
    const state = { dirty: dirty || editingId !== null || formatOpen, busy: !!busy || pending || conversion !== null };
    documentState.current = state; desktop?.setDocumentState(state);
  }, [dirty, editingId, formatOpen, busy, pending, conversion]);
  useEffect(() => {
    const controller = new AbortController();
    const snapshot = JSON.parse(layoutKey) as { items: typeof items; profile: SheetProfile; gapMm: number };
    setAcceptedLowDpi(false); setExported('');
    const timer = setTimeout(() => {
      if (!snapshot.items.length) { setLayoutState({ key: layoutKey, result: null, error: '' }); return; }
      runLayout(snapshot.items, snapshot.profile, snapshot.gapMm, controller.signal).then(result => {
        if (!controller.signal.aborted) { setLayoutState({ key: layoutKey, result, error: '' }); setPageIndex(index => Math.min(index, Math.max(0, result.pages.length - 1))); }
      }).catch(e => { if (!controller.signal.aborted) setLayoutState({ key: layoutKey, result: null, error: errorText(e) }); });
    }, 180);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [layoutKey]);
  useEffect(() => {
    mounted.current = true;
    const warn = (event: BeforeUnloadEvent) => { if (!desktop && (documentState.current.dirty || documentState.current.busy)) event.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => { mounted.current = false; exportController.current?.abort(); window.removeEventListener('beforeunload', warn); urls.current.forEach(url => URL.revokeObjectURL(url)); urls.current.clear(); };
  }, []);

  const rememberUrl = async (raster: Raster) => {
    const url = await rasterUrl(raster);
    if (!mounted.current) { URL.revokeObjectURL(url); throw new Error('La aplicación se ha cerrado.'); }
    urls.current.add(url); return url;
  };
  const release = (url: string) => { URL.revokeObjectURL(url); urls.current.delete(url); };
  const validity = (key: string, valid: boolean) => setInvalidFields(previous => {
    if (valid === !previous.has(key)) return previous;
    const next = new Set(previous); if (valid) next.delete(key); else next.add(key); return next;
  });
  const clearDesignValidity = (id: string) => setInvalidFields(previous => new Set([...previous].filter(key => !key.startsWith(`${id}:`))));
  const changeDesign = (id: string, patch: Partial<Pick<Design, 'widthMm' | 'copies'>>) => {
    setDesigns(current => current.map(d => d.id === id ? { ...d, ...patch } : d));
  };
  const importFiles = async (files: File[]) => {
    if (blocked || !files.length) return;
    setBusy('Cargando diseños…'); setErrors([]); setExported('');
    const added: Design[] = [], problems: string[] = [];
    let totalPixels = retainedPixelCount(designs);
    try {
      for (const file of files) {
        try {
          if (/\.pdf$/i.test(file.name) || file.type === 'application/pdf') {
            if (retainedPdfBytes([...designs,...added]) + file.size > MAX_RETAINED_PDF_BYTES) throw new Error('Las fuentes PDF del trabajo superan 100 MiB. Divide el trabajo.');
            const imported = await new Promise<{ pages: PdfCandidate[]; dpi: number }>(resolve => setPdfImport({ file,resolve: (pages,dpi) => resolve({ pages, dpi }) }));
            const selected = imported.pages;
            const prepared: Design[] = [];
            try {
              let pixels = totalPixels;
              for (const page of selected) {
                const pdf = page.pdf!;
                const size = pdfRasterSize(pdf, pdf.widthPt * 25.4 / 72, imported.dpi);
                checkImageBudget(pixels + size.width * size.height, imageBudgetMp);
                let raster = await rasterizePdf(pdf, pdf.widthPt * 25.4 / 72, imported.dpi, new AbortController().signal);
                if (!raster.data.some((value, index) => index % 4 === 3 && value > 0)) {
                  const fallback = document.createElement('canvas'); fallback.width = raster.width; fallback.height = raster.height;
                  const ctx = fallback.getContext('2d')!; const thumb = document.createElement('canvas'); thumb.width = page.raster!.width; thumb.height = page.raster!.height;
                  thumb.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(page.raster!.data), thumb.width, thumb.height), 0, 0);
                  ctx.drawImage(thumb, 0, 0, raster.width, raster.height); raster = { ...raster, data: ctx.getImageData(0, 0, raster.width, raster.height).data }; thumb.width = thumb.height = fallback.width = fallback.height = 0;
                }
                pixels += raster.width * raster.height;
                checkImageBudget(pixels, imageBudgetMp);
                const url = await rememberUrl(raster);
                prepared.push({ id: crypto.randomUUID(),name: page.name,original: raster,raster,widthMm: pdf.widthPt * 25.4 / 72,copies: 1,url,note: '',opaque: hasOpaqueBackground(raster) });
              }
              added.push(...prepared); totalPixels = pixels;
            } catch (error) { prepared.forEach(design => release(design.url)); throw error; }
            continue;
          }
          const decoded = await decodeImage(file);
          checkImageBudget(totalPixels + decoded.width * decoded.height, imageBudgetMp);
          const raster = await runImage('crop', decoded);
          const url = await rememberUrl(raster);
          totalPixels += raster.width * raster.height;
          const widthMm = Math.max(.01, Math.floor(raster.width * 25.4 / 300 * 100) / 100);
          added.push({ id: crypto.randomUUID(), name: file.name, original: raster, raster, widthMm, copies: 1, url, note: '', opaque: hasOpaqueBackground(decoded) });
        } catch (e) { problems.push(`${file.name}: ${errorText(e)}`); }
      }
      if (!designs.length && added.length) setExportBaseName(defaultExportBaseName());
      setDesigns(current => [...current, ...added]); setErrors(problems);
    } finally { setBusy(''); }
  };
  const applyRaster = async (design: Design, raster: Raster, note: string, opaque = hasOpaqueBackground(raster)) => {
    const cropped = await runImage('crop', raster);
    checkImageBudget(pixelsAfterEdit(designs, design.id, cropped.width, cropped.height), imageBudgetMp);
    const url = await rememberUrl(cropped);
    if (design.undo) release(design.undo.url);
    setDesigns(current => current.map(d => d.id === design.id ? { ...d, pdf: undefined, raster: cropped, url, note, opaque, undo: { raster: d.raster, url: d.url, note: d.note, opaque: d.opaque, pdf: d.pdf } } : d));
    setExported('');
  };
  const refine = async (design: Design) => {
    setBusy('Afinando los bordes…'); setErrors([]);
    try {
      checkImageBudget(pixelsAfterEdit(designs, design.id, design.raster.width * 2, design.raster.height * 2), imageBudgetMp);
      const raster = await runImage('refine', design.raster); await applyRaster(design, raster, 'Bordes afinados.', design.opaque);
    }
    catch (e) { setErrors([errorText(e)]); }
    finally { setBusy(''); }
  };
  const cancelEdit = () => { if (editingDesign) release(editingDesign.url); setEditingDesign(null); setEditingId(null); };
  const convertPdf = async (dpi: number) => {
    if (!conversion) return;
    const { design,action } = conversion;
    setConversion(null); setBusy('Convirtiendo PDF…'); setErrors([]);
    const controller = new AbortController(); exportController.current = controller;
    try {
      const size = pdfRasterSize(design.pdf!, design.widthMm, dpi);
      checkImageBudget(pixelsAfterEdit(designs, design.id, size.width, size.height), imageBudgetMp);
      if (action === 'refine') checkImageBudget(pixelsAfterEdit(designs, design.id, size.width * 2, size.height * 2), imageBudgetMp);
      const raster = await rasterizePdf(design.pdf!,design.widthMm,dpi,controller.signal);
      checkImageBudget(pixelsAfterEdit(designs,design.id,raster.width,raster.height), imageBudgetMp);
      if (action === 'erase') {
        const url = await rememberUrl(raster); setEditingDesign({ ...design,pdf: undefined,raster,url }); setEditingId(design.id);
      } else {
        checkImageBudget(pixelsAfterEdit(designs,design.id,raster.width * 2,raster.height * 2), imageBudgetMp);
        await applyRaster(design,await runImage('refine',raster,undefined,controller.signal),'Bordes afinados.');
      }
    } catch (error) { if (!controller.signal.aborted) setErrors([errorText(error)]); }
    finally { setBusy(''); exportController.current = null; }
  };
  const printAssets = async (signal: AbortSignal): Promise<PrintAsset[]> => {
    const assets: PrintAsset[] = [];
    for (const design of designs) {
      signal.throwIfAborted();
      const common = { id: design.id,widthMm: design.widthMm,heightMm: designHeight(design),copies: design.copies };
      assets.push({ ...common,png: new Uint8Array(await (await rasterPng(design.raster)).arrayBuffer()) });
    }
    return assets;
  };
  const exportPdf = async () => {
    if (!canExport || !layout) return;
    const controller = new AbortController(); exportController.current = controller;
    setBusy('Generando PDF…'); setErrors([]); setExported('');
    setExportProgress({ page: 1,pages: layout.pages.length,percent: 0 });
    try {
      const assets = await printAssets(controller.signal);
      const { bytes,type } = await runPdfExport({ assets,layout,profile,gapMm,mirror,organization: pdfOrganization,exportBaseName: normalizedName },controller.signal,setExportProgress);
      controller.signal.throwIfAborted();
      const filename = exportFilename(normalizedName, type);
      if (desktop) {
        const result = type === 'pdf' ? await desktop.savePdf({ filename,bytes }) : await desktop.saveArchive({ filename,bytes,type });
        if (result.status === 'cancelled') { setExported('Guardado cancelado. El montaje sigue disponible.'); return; }
        setExported(`${type.toUpperCase()} guardado: ${result.filename}. Imprime al 100 % o «Tamaño real».`);
        if (result.warning) setErrors([result.warning]);
      } else {
        downloadBlob(new Blob([new Uint8Array(bytes)],{ type: type === 'pdf' ? 'application/pdf' : 'application/zip' }),filename);
        setExported(`${type.toUpperCase()} generado. ${type === 'zip' ? 'Extrae los PDF antes de enviarlos al proveedor. ' : ''}Imprime al 100 % o «Tamaño real».`);
      }
      setDirty(false);
    } catch (error) { if (controller.signal.aborted) setExported('Exportación cancelada. El montaje sigue disponible.'); else setErrors([errorText(error)]); }
    finally { setBusy(''); exportController.current = null; setExportProgress(null); }
  };

  const exportPng = async () => {
    if (!canExport || !layout || pngError) return;
    const controller = new AbortController(); exportController.current = controller;
    setBusy('Generando PNG…'); setErrors([]); setExported('');
    setExportProgress({ page: 1, pages: layout.pages.length, percent: 0 });
    try {
      const assets = await printAssets(controller.signal);
      const blob = await runPngExport({ assets, layout, profile, dpi: pngDpi, gapMm, mirror, exportBaseName: normalizedName }, controller.signal, setExportProgress);
      controller.signal.throwIfAborted();
      const type = layout.pages.length > 1 ? 'zip' : 'png';
      const filename = exportFilename(normalizedName, type);
      if (desktop) {
        const result = await desktop.saveArchive({ filename, type, bytes: new Uint8Array(await blob.arrayBuffer()) });
        if (result.status === 'cancelled') { setExported('Guardado cancelado. El montaje sigue disponible.'); return; }
        setExported(`${type.toUpperCase()} guardado: ${result.filename}. Importa al RIP conservando el tamaño real.`);
        if (result.warning) setErrors([result.warning]);
      } else { downloadBlob(blob, filename); setExported(`${type.toUpperCase()} generado. Importa al RIP conservando el tamaño real.`); }
      setDirty(false);
    } catch (error) {
      if (controller.signal.aborted) setExported('Exportación cancelada. El montaje sigue disponible.');
      else setErrors([errorText(error)]);
    } finally { exportController.current = null; setExportProgress(null); setBusy(''); }
  };

  return <div className="app-shell">
    <header className="app-header"><div className="brand">PK<span>print</span></div><h1>Maquetador DTF</h1><p>Prepara tu film. Descarga tu PDF a tamaño real.</p><span className="local-badge"><i />Todo en tu equipo</span>{desktop && <button className="text-button" onClick={() => void desktop?.showHelp('guide')}>Ayuda</button>}{desktop && <Updates onInstalling={setUpdateInstalling} />}</header>
    <main className="workspace">
      <section className="panel designs-panel" aria-labelledby="designs-title">
        <h2 id="designs-title"><span className="step">1</span>Diseños <span className="panel-count">{designs.length > 0 ? designs.length : ''}</span></h2>
        <div className={`upload-area ${dragging ? 'dragging' : ''}`} onDragOver={e => { e.preventDefault(); if (!blocked) setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={e => { e.preventDefault(); setDragging(false); void importFiles([...e.dataTransfer.files]); }}>
          <input ref={inputRef} className="file-input" type="file" accept="image/png,.png,image/jpeg,.jpg,.jpeg,image/webp,.webp,application/pdf,.pdf" multiple aria-label="Subir diseños PNG o PDF" disabled={blocked} onChange={e => { const files = [...(e.target.files ?? [])]; e.target.value = ''; void importFiles(files); }} />
          <button className="upload-button" disabled={blocked} onClick={() => inputRef.current?.click()}><span className="upload-plus">+</span><strong>Sube tus diseños de imagen o PDF</strong><span>Arrastra aquí o toca para elegir.</span><small>PNG, JPG/JPEG y WebP: 20 MB · PDF: 50 MiB</small></button>
        </div>
        <div className="image-budget">
          <label>Presupuesto de imágenes<select value={imageBudgetMp} disabled={blocked} onChange={event => {
            const next = imageBudget(Number(event.target.value));
            if (totalPixels > next * 1_000_000) { setErrors(['Quita diseños antes de reducir el presupuesto por debajo del consumo actual.']); return; }
            setImageBudgetMp(next);
          }}>{IMAGE_BUDGETS.map(budget => <option key={budget} value={budget}>{budget} MP</option>)}</select></label>
          <p className="muted" data-testid="image-budget-usage">{formatMm(totalPixels / 1_000_000)} / {imageBudgetMp} MP</p>
          <p className="muted">Incluye originales y versiones de edición. Las copias del montaje no multiplican este consumo.</p>
          {imageBudgetMp > 60 && <p className="opaque-warning">Este presupuesto permite más imágenes y puede agotar la memoria del equipo. Exporta tu trabajo antes de cerrar.</p>}
        </div>
        {!designs.length && <p className="empty-instruction">Indica el ancho o el alto y las copias de cada diseño. El pliego se monta automáticamente.</p>}
        {busy && <p className="working" role="status"><span className="spinner" />{busy}</p>}
        <div className="design-list">{[...designs].reverse().map(design => <DesignCard key={design.id} design={design} busy={blocked && editingId !== design.id} editing={editingId === design.id}
          onChange={patch => changeDesign(design.id, patch)}
          onValidity={(field, valid) => validity(`${design.id}:${field}`, valid)}
          onRemove={() => { release(design.url); if (design.undo) release(design.undo.url); if (designs.length === 1) setExportBaseName(''); setDesigns(current => current.filter(d => d.id !== design.id)); clearDesignValidity(design.id); }}
          onEdit={() => design.pdf ? setConversion({ design,action: 'erase' }) : setEditingId(design.id)} onCancel={cancelEdit} editingDesign={editingDesign?.id === design.id ? editingDesign : undefined}
          onApply={async raster => { setBusy('Aplicando fondo…'); try { await applyRaster(design, raster, 'Fondo quitado.'); cancelEdit(); } finally { setBusy(''); } }}
          onRefine={() => design.pdf ? setConversion({ design,action: 'refine' }) : void refine(design)}
          onUndo={() => { if (!design.undo) return; release(design.url); const undo = design.undo; setDesigns(current => current.map(d => d.id === design.id ? { ...d, pdf: undo.pdf, raster: undo.raster, url: undo.url, note: undo.note, opaque: undo.opaque, undo: undefined } : d)); setExported(''); }} />)}</div>
        <p className="session-note">Los diseños permanecen en esta sesión. Exporta tu trabajo antes de cerrar.</p>
      </section>

      <section className="panel preview-panel" aria-labelledby="preview-title">
        <div className="panel-heading"><h2 id="preview-title"><span className="step">2</span>Tu pliego</h2><label className="gap-label">Distancia entre diseños<select aria-label="Distancia entre diseños" value={gapMm} disabled={blocked} onChange={e => setGapMm(Number(e.target.value))}><option value="3">3 mm</option><option value="4">4 mm</option><option value="5">5 mm</option><option value="6">6 mm</option><option value="7">7 mm</option></select></label></div>
        {pending && designs.length > 0 && <p className="working" role="status"><span className="spinner" />Buscando el montaje que menos film gasta…</p>}
        {!pending && layoutState.error && <p className="error-box" role="alert">{layoutState.error}</p>}
        {layout?.unplacedIds.map(id => <p key={id} className="error-box" role="alert"><strong>{designs.find(d => d.id === id)?.name}</strong> no cabe en el área imprimible, ni girado. Reduce su ancho o cambia el formato.</p>)}
        {layout && layout.pages.length > 0 ? <SheetPreview layout={layout} profile={packingProfile} designs={designs} mirror={mirror} pageIndex={pageIndex} onPage={setPageIndex} /> : !pending && !layoutState.error && !layout?.unplacedIds.length && <div className="empty-preview"><div className="empty-sheet"><span>+</span></div><p>Tu pliego se monta solo<br />en cuanto subas diseños.</p></div>}
      </section>

      <section className="panel export-panel" aria-labelledby="export-title">
        <h2 id="export-title"><span className="step">3</span>Exportar</h2>
        <ProfileEditor profiles={stored.profiles} profile={profile} disabled={blocked} onOpenChange={setFormatOpen} onSelect={selected => setStored(current => ({ ...current, selected }))} onSave={(updated, asNew) => setStored(current => ({ profiles: asNew ? [...current.profiles, updated] : current.profiles.map(p => p.id === updated.id ? updated : p), selected: updated.id }))}
          resetDisabled={pending} onReset={desktop ? undefined : () => {
            if (window.confirm('Se restaurarán los nombres, medidas y márgenes de Film 55 × 100 cm, A3 y A4. Los formatos creados con «Guardar como nuevo» se conservarán. ¿Continuar?')) {
              setStored(current => ({ ...current, profiles: [...initialProfiles, ...current.profiles.filter(p => !initialProfiles.some(base => base.id === p.id))] }));
            }
          }} />
        {layout && layout.pages.length > 0 ? <div className="layout-summary" data-testid="layout-summary"><strong>{layout.pages.length} {layout.pages.length === 1 ? 'pliego' : 'pliegos'} · {layout.pieceCount} {layout.pieceCount === 1 ? 'pieza' : 'piezas'}</strong><span>{formatMm(profile.widthMm / 10)} × {formatMm(profile.heightMm / 10)} cm por pliego</span><span>Aprovechamiento {Math.round(layout.pages.reduce((sum, p) => sum + p.utilization, 0) / layout.pages.length * 100)} %</span></div> : <p className="muted summary-empty">Sube tus diseños para preparar el PDF.</p>}
        <label className="checkbox-label mirror-control"><input type="checkbox" checked={mirror} disabled={blocked} onChange={e => { setMirror(e.target.checked); setExported(''); }} aria-label="Aplicar espejo en el PDF" /><span>Aplicar espejo en el PDF<small>Desactivado si ya lo aplica tu RIP.</small></span></label>
        <div className="print-note"><strong>Preparado para tu RIP</strong><p>PNG en RGB; el PDF conserva el color de sus fuentes. Tu RIP genera la base blanca y gestiona el color.</p><p>Imprime al 100 %, sin ajustar a página.</p></div>
        <div className="export-bottom">
          <label className="export-name">Nombre del trabajo<input value={exportBaseName} disabled={blocked || !designs.length} aria-invalid={!!designs.length && !!nameError} aria-describedby="export-name-help" onChange={event => { setExportBaseName(event.target.value); setExported(''); }} onBlur={() => setExportBaseName(normalizedName)} /></label>
          <div id="export-name-help">
            {!!designs.length && nameError && <p className="error" role="alert">{nameError}</p>}
            {!nameError && <p className="muted export-name-preview">PDF: {exportFilename(normalizedName, pdfOrganization === 'separate' && (layout?.pages.length ?? 0) > 1 ? 'zip' : 'pdf')}<br />PNG: {exportFilename(normalizedName, (layout?.pages.length ?? 0) > 1 ? 'zip' : 'png')}{(layout?.pages.length ?? 0) > 1 && <><br />Dentro del ZIP: {exportFilename(normalizedName, 'pdf', 1)} / {exportFilename(normalizedName, 'png', 1)}</>}</p>}
            <p className="muted">Sin extensión. Se añade automáticamente al descargar.</p>
          </div>
          {lowDpi && <label className="checkbox-label low-dpi"><input type="checkbox" checked={acceptedLowDpi} disabled={blocked || pending} onChange={e => setAcceptedLowDpi(e.target.checked)} /><span>Acepto que los diseños de baja resolución pueden verse pixelados.</span></label>}
          {editingId && <p className="muted">Aplica o cancela el borrador antes de exportar.</p>}
          {formatOpen && <p className="muted">Guarda o cierra el formato antes de exportar.</p>}
          {invalidFields.size > 0 && <p className="error" role="alert">Corrige las medidas o cantidades marcadas.</p>}
          {errors.length > 0 && <div className="error-box" role="alert">{errors.map((error, i) => <p key={i}>{error}</p>)}<button className="text-button" onClick={() => setErrors([])}>Cerrar aviso</button></div>}
          <label className="pdf-organization">Organización del PDF<select value={pdfOrganization} disabled={blocked || formatOpen} onChange={event => setPdfOrganization(event.target.value as 'separate' | 'combined')}><option value="separate">Un PDF por pliego</option><option value="combined">Un único PDF con todos los pliegos</option></select></label>
          <button className="download-button" disabled={!canExport} onClick={() => void exportPdf()}>{busy === 'Generando PDF…' ? 'Generando PDF…' : pdfOrganization === 'separate' && (layout?.pages.length ?? 0) > 1 ? 'Descargar PDF en ZIP' : 'Descargar PDF'}<span aria-hidden="true">↓</span></button>
          <div className="png-export">
            <label>Resolución PNG<select aria-label="Resolución PNG" value={pngDpi} disabled={blocked || formatOpen} onChange={event => setPngDpi(Number(event.target.value))}>{[150, 300, 600].map(dpi => <option key={dpi} value={dpi}>{dpi} ppp</option>)}</select></label>
            <p className="muted">{pngSize || pngError}</p>
            <p className="muted">Más ppp no recuperan detalle ausente en el original. Se conserva la transparencia y se aplica el mismo espejo que al PDF.</p>
            <button className="download-button" disabled={!canExport || !!pngError} onClick={() => void exportPng()}>{layout && layout.pages.length > 1 ? 'Descargar PNG en ZIP' : 'Descargar PNG'}<span aria-hidden="true">↓</span></button>
            {exportProgress && <div role="status"><p>Pliego {exportProgress.page} de {exportProgress.pages} · {exportProgress.percent} %</p><progress aria-label="Progreso de exportación" max="100" value={exportProgress.percent} /><button type="button" onClick={() => exportController.current?.abort()}>Cancelar exportación</button></div>}
          </div>
          {exported && <p className="success-note" role="status">{exported}</p>}
          {desktop && /^(PDF|PNG|ZIP) guardado:/.test(exported) && <button className="text-button" onClick={() => void desktop?.showExportFolder()}>Abrir carpeta</button>}
          <p className="export-caption">PDF individuales por defecto, o un PDF multipágina. Varios archivos se entregan en ZIP, sin marcas ni guías.</p>
        </div>
      </section>
    </main>
    {pdfImport && <PdfImport file={pdfImport.file} onComplete={(pages,dpi) => { pdfImport.resolve(pages,dpi); setPdfImport(null); }} />}
    {conversion && <PdfConversion name={conversion.design.name} onConfirm={dpi => void convertPdf(dpi)} onCancel={() => setConversion(null)} />}
    {!desktop && <WindowsDownloads />}
    <footer className="app-footer">Maquetador DTF{desktopVersion ? ` ${desktopVersion}` : ''} · PKprint<span>Los archivos se procesan localmente y no se suben a Internet.</span></footer>
    {desktop && showWelcome && <Welcome onStart={async hide => { await desktop?.updatePreferences({ hideWelcome: hide }); setShowWelcome(false); }} />}
  </div>;
}
