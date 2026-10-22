import { useEffect, useMemo, useRef, useState } from 'react';
import { decodePng, rasterPng, rasterUrl } from './browser/images';
import { runImage, runLayout, runPngExport } from './browser/workerClient';
import { pngDimensions } from './core/png';
import type { ExportProgress } from './browser/printPng';
import { DEFAULT_PROFILE, MAX_TOTAL_PIXELS, designMetrics, formatMm, pixelsAfterEdit, profileForLayout, retainedPixelCount, validateProfile, type Design, type LayoutResult, type Raster, type SheetProfile } from './core/model';
import { hasOpaqueBackground } from './core/images';
import { DesignCard } from './components/DesignCard';
import { ProfileEditor } from './components/ProfileEditor';
import { SheetPreview } from './components/SheetPreview';
import { Welcome } from './components/Welcome';
import { WindowsDownloads } from './components/WindowsDownloads';
import { Updates } from './components/Updates';
import { desktop } from './platform/desktop';

const STORAGE_KEY = 'pkprint-dtf-profiles-v1';
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
  const [gapMm, setGapMm] = useState(7);
  const [mirror, setMirror] = useState(false);
  const [pngDpi, setPngDpi] = useState(300);
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
  const items = useMemo(() => designs.map(d => ({ id: d.id, widthMm: d.widthMm, heightMm: designMetrics(d.raster, d.widthMm).heightMm, copies: d.copies })), [designs]);
  const packingProfile = profileForLayout(profile, mirror);
  const layoutKey = JSON.stringify({ items, profile: packingProfile, gapMm });
  const pending = layoutState.key !== layoutKey;
  const layout = pending ? null : layoutState.result;
  const blocked = !!busy || editingId !== null || !preferencesReady || showWelcome || updateInstalling;
  const lowDpi = designs.some(d => designMetrics(d.raster, d.widthMm).quality === 'low');
  const canExport = !blocked && !formatOpen && !pending && invalidFields.size === 0 && !!layout?.pages.length && layout.unplacedIds.length === 0 && (!lowDpi || acceptedLowDpi);
  let pngSize = '', pngError = '';
  try { const size = pngDimensions(profile, pngDpi); pngSize = `${size.width} × ${size.height} píxeles por pliego`; }
  catch (error) { pngError = errorText(error); }

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
      setShowWelcome(!preferences.hideWelcome); setDesktopVersion(preferences.version); setPreferencesReady(true);
    }).catch(() => { if (active) { setErrors(['No se han podido leer las preferencias. Se usarán los formatos iniciales.']); setShowWelcome(true); setPreferencesReady(true); } });
    const unsubscribe = desktop.onHelp(topic => { if (topic === 'welcome') setShowWelcome(true); });
    return () => { active = false; unsubscribe(); };
  }, []);
  useEffect(() => { setDirty(designs.length > 0); }, [designs, profile, gapMm, mirror]);
  useEffect(() => {
    const state = { dirty: dirty || editingId !== null || formatOpen, busy: !!busy || pending };
    documentState.current = state; desktop?.setDocumentState(state);
  }, [dirty, editingId, formatOpen, busy, pending]);
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
          const decoded = await decodePng(file);
          if (totalPixels + decoded.width * decoded.height > MAX_TOTAL_PIXELS) throw new Error('El trabajo supera 60 megapíxeles, incluidas las versiones de edición. Divide los diseños en varios trabajos.');
          const raster = await runImage('crop', decoded);
          const url = await rememberUrl(raster);
          totalPixels += raster.width * raster.height;
          const widthMm = Math.max(.01, Math.floor(raster.width * 25.4 / 300 * 100) / 100);
          added.push({ id: crypto.randomUUID(), name: file.name, original: raster, raster, widthMm, copies: 1, url, note: '', opaque: hasOpaqueBackground(decoded) });
        } catch (e) { problems.push(`${file.name}: ${errorText(e)}`); }
      }
      setDesigns(current => [...current, ...added]); setErrors(problems);
    } finally { setBusy(''); }
  };
  const applyRaster = async (design: Design, raster: Raster, note: string, opaque = hasOpaqueBackground(raster)) => {
    const cropped = await runImage('crop', raster);
    if (pixelsAfterEdit(designs, design.id, cropped.width, cropped.height) > MAX_TOTAL_PIXELS) throw new Error('La edición supera el máximo de 60 megapíxeles del trabajo. Quita algún diseño o divide el trabajo.');
    const url = await rememberUrl(cropped);
    if (design.undo) release(design.undo.url);
    setDesigns(current => current.map(d => d.id === design.id ? { ...d, raster: cropped, url, note, opaque, undo: { raster: d.raster, url: d.url, note: d.note, opaque: d.opaque } } : d));
    setExported('');
  };
  const refine = async (design: Design) => {
    setBusy('Afinando los bordes…'); setErrors([]);
    try {
      if (pixelsAfterEdit(designs, design.id, design.raster.width * 2, design.raster.height * 2) > MAX_TOTAL_PIXELS) throw new Error('Afinar supera el máximo de 60 megapíxeles del trabajo, incluidas las versiones de edición. Divide el trabajo antes de ampliar.');
      const raster = await runImage('refine', design.raster); await applyRaster(design, raster, 'Bordes afinados.', design.opaque);
    }
    catch (e) { setErrors([errorText(e)]); }
    finally { setBusy(''); }
  };
  const exportPdf = async () => {
    if (!canExport || !layout) return;
    setBusy('Generando PDF…'); setErrors([]); setExported('');
    try {
      const assets = [];
      for (const design of designs) assets.push({ id: design.id, png: new Uint8Array(await (await rasterPng(design.raster)).arrayBuffer()), widthMm: design.widthMm, heightMm: designMetrics(design.raster, design.widthMm).heightMm, copies: design.copies });
      const { createPrintPdf } = await import('./core/pdf');
      const bytes = await createPrintPdf(assets, layout, profile, { gapMm, mirror });
      const filename = `DTF-${profile.widthMm}x${profile.heightMm}mm-${layout.pages.length}pliegos${mirror ? '-espejo' : ''}.pdf`;
      if (desktop) {
        const result = await desktop.savePdf({ filename, bytes });
        if (result.status === 'cancelled') { setExported('Guardado cancelado. El montaje sigue disponible.'); return; }
        setDirty(false);
        setExported(`PDF guardado: ${result.filename}. Imprime al 100 % o «Tamaño real».`);
        if (result.warning) setErrors([result.warning]);
        return;
      }
      const blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
      downloadBlob(blob, filename);
      setExported('PDF generado. Imprime al 100 % o «Tamaño real», sin ajustar a página.');
      setDirty(false);
    } catch (e) { setErrors([errorText(e)]); }
    finally { setBusy(''); }
  };

  const exportPng = async () => {
    if (!canExport || !layout || pngError) return;
    const controller = new AbortController(); exportController.current = controller;
    setBusy('Generando PNG…'); setErrors([]); setExported('');
    setExportProgress({ page: 1, pages: layout.pages.length, percent: 0 });
    try {
      const assets = [];
      for (const design of designs) {
        controller.signal.throwIfAborted();
        const png = new Uint8Array(await (await rasterPng(design.raster)).arrayBuffer());
        assets.push({ id: design.id, png, widthMm: design.widthMm, heightMm: designMetrics(design.raster, design.widthMm).heightMm, copies: design.copies });
      }
      const blob = await runPngExport({ assets, layout, profile, dpi: pngDpi, gapMm, mirror }, controller.signal, setExportProgress);
      controller.signal.throwIfAborted();
      const type = layout.pages.length > 1 ? 'zip' : 'png';
      const filename = `DTF-${profile.widthMm}x${profile.heightMm}mm-${pngDpi}ppp${mirror ? '-espejo' : ''}-${type === 'png' ? 'pliego-001' : `${layout.pages.length}pliegos`}.${type}`;
      if (desktop) {
        const result = await desktop.saveRaster({ filename, type, bytes: new Uint8Array(await blob.arrayBuffer()) });
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
          <input ref={inputRef} className="file-input" type="file" accept="image/png,.png" multiple aria-label="Subir diseños PNG" disabled={blocked} onChange={e => { const files = [...(e.target.files ?? [])]; e.target.value = ''; void importFiles(files); }} />
          <button className="upload-button" disabled={blocked} onClick={() => inputRef.current?.click()}><span className="upload-plus">+</span><strong>Sube tus diseños en PNG</strong><span>Arrastra aquí o toca para elegir.</span><small>Máximo 20 MB por archivo · 25 MP</small></button>
        </div>
        {!designs.length && <p className="empty-instruction">Indica el ancho y las copias de cada diseño. El pliego se monta automáticamente.</p>}
        {busy && <p className="working" role="status"><span className="spinner" />{busy}</p>}
        <div className="design-list">{designs.map(design => <DesignCard key={design.id} design={design} busy={blocked && editingId !== design.id} editing={editingId === design.id}
          onChange={patch => changeDesign(design.id, patch)}
          onValidity={(field, valid) => validity(`${design.id}:${field}`, valid)}
          onRemove={() => { release(design.url); if (design.undo) release(design.undo.url); setDesigns(current => current.filter(d => d.id !== design.id)); clearDesignValidity(design.id); }}
          onEdit={() => setEditingId(design.id)} onCancel={() => setEditingId(null)}
          onApply={async raster => { setBusy('Aplicando fondo…'); try { await applyRaster(design, raster, 'Fondo quitado.'); setEditingId(null); } finally { setBusy(''); } }}
          onRefine={() => void refine(design)}
          onUndo={() => { if (!design.undo) return; release(design.url); const undo = design.undo; setDesigns(current => current.map(d => d.id === design.id ? { ...d, raster: undo.raster, url: undo.url, note: undo.note, opaque: undo.opaque, undo: undefined } : d)); setExported(''); }} />)}</div>
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
        <div className="print-note"><strong>Preparado para tu RIP</strong><p>PDF RGB con transparencia. Tu RIP genera la base blanca y gestiona el color.</p><p>Imprime al 100 %, sin ajustar a página.</p></div>
        <div className="export-bottom">
          {lowDpi && <label className="checkbox-label low-dpi"><input type="checkbox" checked={acceptedLowDpi} disabled={blocked || pending} onChange={e => setAcceptedLowDpi(e.target.checked)} /><span>Acepto que los diseños de baja resolución pueden verse pixelados.</span></label>}
          {editingId && <p className="muted">Aplica o cancela el borrador antes de exportar.</p>}
          {formatOpen && <p className="muted">Guarda o cierra el formato antes de exportar.</p>}
          {invalidFields.size > 0 && <p className="error" role="alert">Corrige las medidas o cantidades marcadas.</p>}
          {errors.length > 0 && <div className="error-box" role="alert">{errors.map((error, i) => <p key={i}>{error}</p>)}<button className="text-button" onClick={() => setErrors([])}>Cerrar aviso</button></div>}
          <button className="download-button" disabled={!canExport} onClick={() => void exportPdf()}>{busy === 'Generando PDF…' ? 'Generando PDF…' : 'Descargar PDF'}<span aria-hidden="true">↓</span></button>
          <div className="png-export">
            <label>Resolución PNG<select aria-label="Resolución PNG" value={pngDpi} disabled={blocked || formatOpen} onChange={event => setPngDpi(Number(event.target.value))}>{[150, 300, 600].map(dpi => <option key={dpi} value={dpi}>{dpi} ppp</option>)}</select></label>
            <p className="muted">{pngSize || pngError}</p>
            <p className="muted">Más ppp no recuperan detalle ausente en el original. Se conserva la transparencia y se aplica el mismo espejo que al PDF.</p>
            <button className="download-button" disabled={!canExport || !!pngError} onClick={() => void exportPng()}>{layout && layout.pages.length > 1 ? 'Descargar PNG en ZIP' : 'Descargar PNG'}<span aria-hidden="true">↓</span></button>
            {exportProgress && <div role="status"><p>Pliego {exportProgress.page} de {exportProgress.pages} · {exportProgress.percent} %</p><progress aria-label="Progreso de exportación PNG" max="100" value={exportProgress.percent} /><button type="button" onClick={() => exportController.current?.abort()}>Cancelar exportación</button></div>}
          </div>
          {exported && <p className="success-note" role="status">{exported}</p>}
          {desktop && /^(PDF|PNG|ZIP) guardado:/.test(exported) && <button className="text-button" onClick={() => void desktop?.showExportFolder()}>Abrir carpeta</button>}
          <p className="export-caption">PDF con todos los pliegos o un PNG por pliego. Varios PNG se entregan en ZIP, sin marcas ni guías.</p>
        </div>
      </section>
    </main>
    {!desktop && <WindowsDownloads />}
    <footer className="app-footer">Maquetador DTF{desktopVersion ? ` ${desktopVersion}` : ''} · PKprint<span>Los archivos se procesan localmente y no se suben a Internet.</span></footer>
    {desktop && showWelcome && <Welcome onStart={async hide => { await desktop?.updatePreferences({ hideWelcome: hide }); setShowWelcome(false); }} />}
  </div>;
}
