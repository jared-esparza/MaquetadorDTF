import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import type { Design, Raster } from '../core/model';
import { rasterUrl } from '../browser/images';
import { SheetBackground } from './SheetBackground';
import { runImage } from '../browser/workerClient';

export type EditTool = 'erase' | 'refine';
type View = 'compare' | 'before' | 'after';
const views = { compare: 'Comparar', before: 'Antes', after: 'Después' } as const;
const center = { x: .5, y: .5 };
const clamp = (value: number) => Math.max(0, Math.min(1, value));

export function ImageEditor({ design, tool, color, onColorChange, preflightError, onApply, onCancel }: {
  design: Design; tool: EditTool; color: string | null; preflightError: string;
  onColorChange: (color: string | null) => void;
  onApply: (raster: Raster) => Promise<void>; onCancel: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [view, setView] = useState<View>(() => matchMedia('(max-width: 640px)').matches ? 'after' : 'compare');
  const [zoom, setZoom] = useState(1);
  const [point, setPoint] = useState(center);
  const [useColor, setUseColor] = useState(false);
  const drag = useRef<{ id: number; x: number; y: number; moved: boolean; point: typeof center } | null>(null);
  useEffect(() => {
    const element = dialog.current!;
    element.showModal();
    return () => element.close();
  }, []);
  const [base, setBase] = useState(design.raster);
  const [preview, setPreview] = useState<Raster | null>(null);
  const [url, setUrl] = useState('');
  const [tolerance, setTolerance] = useState(35);
  const [mode, setMode] = useState<'connected' | 'global'>('connected');
  const [seed, setSeed] = useState<{ x: number; y: number }>();
  const [wand, setWand] = useState(false);
  const [processing, setProcessing] = useState(!preflightError);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState(preflightError);
  useEffect(() => {
    if (preflightError) return;
    const controller = new AbortController();
    let objectUrl = '';
    setProcessing(true); setError(''); setPreview(null); setUrl('');
    const timer = setTimeout(async () => {
      try {
        const result = await runImage(tool, base, tool === 'erase' ? { tolerance, mode, seed } : undefined, controller.signal);
        objectUrl = await rasterUrl(result);
        if (controller.signal.aborted) { URL.revokeObjectURL(objectUrl); return; }
        setPreview(result); setUrl(objectUrl); setProcessing(false);
      } catch (e) {
        if (controller.signal.aborted) return;
        setError(e instanceof Error ? e.message : 'No se ha podido preparar la vista previa.'); setProcessing(false); setPreview(null);
      }
    }, 120);
    return () => { clearTimeout(timer); controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [tool, base, tolerance, mode, seed, preflightError]);
  function finishPointer(event: PointerEvent<HTMLImageElement>, after: boolean) {
    const gesture = drag.current;
    if (gesture?.id !== event.pointerId) return;
    drag.current = null;
    if (gesture.moved || Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) >= 5 || !after || !wand || !preview || processing || applying) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX >= rect.right || event.clientY < rect.top || event.clientY >= rect.bottom) return;
    const x = Math.floor((event.clientX - rect.left) * preview.width / rect.width);
    const y = Math.floor((event.clientY - rect.top) * preview.height / rect.height);
    if (preview.data[(y * preview.width + x) * 4 + 3] === 0) { setError('Selecciona un color visible para la varita.'); return; }
    setBase(preview); setSeed({ x, y }); setWand(false);
  }

  function pane(side: 'before' | 'after', source: string) {
    return <figure className="editor-pane">
      <figcaption>{views[side]}</figcaption>
      <div className="editor-stage checker" style={useColor && color ? { background: color } : undefined}>
        {source ? <img src={source} alt={side === 'before' ? 'Diseño antes de editar' : 'Diseño después de editar'} draggable={false}
          className={side === 'after' && wand ? 'wand-cursor' : undefined}
          style={{ '--ratio': design.raster.width / design.raster.height, '--zoom': zoom, '--x': point.x, '--y': point.y } as CSSProperties}
          onPointerDown={event => {
            if (!event.isPrimary || event.button !== 0) return;
            event.currentTarget.setPointerCapture(event.pointerId);
            drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false, point };
          }}
          onPointerMove={event => {
            const gesture = drag.current;
            if (gesture?.id !== event.pointerId) return;
            const dx = event.clientX - gesture.x, dy = event.clientY - gesture.y;
            if (!gesture.moved && Math.hypot(dx, dy) < 5) return;
            gesture.moved = true;
            if (zoom === 1) return;
            const rect = event.currentTarget.getBoundingClientRect();
            setPoint({ x: clamp(gesture.point.x - dx / rect.width), y: clamp(gesture.point.y - dy / rect.height) });
          }}
          onLostPointerCapture={() => { drag.current = null; }}
          onPointerUp={event => finishPointer(event, side === 'after')} /> : <span>{error ? 'Vista previa no disponible' : 'Preparando…'}</span>}
      </div>
    </figure>;
  }

  const title = tool === 'erase' ? 'Borrador · fondo y colores' : 'Afinar los bordes';
  return <dialog ref={dialog} className="image-editor" aria-labelledby="image-editor-title" onCancel={event => {
    event.preventDefault();
    if (!applying) onCancel();
  }}>
    <header className="editor-heading"><h2 id="image-editor-title">{title}</h2><span title={design.name}>{design.name}</span></header>
    <div className="editor-toolbar">
      <div role="group" aria-label="Vista">{(Object.keys(views) as View[]).map(option =>
        <button key={option} aria-pressed={view === option} onClick={() => { drag.current = null; setView(option); }}>{views[option]}</button>
      )}</div>
      <div role="group" aria-label="Zoom">
        <button aria-label="Alejar" disabled={zoom === 1} onClick={() => { if (zoom <= 1.5) setPoint(center); setZoom(Math.max(1, zoom / 1.5)); }}>−</button>
        <button onClick={() => { setZoom(1); setPoint(center); }}>Ajustar</button>
        <button aria-label="Acercar" disabled={zoom === 12} onClick={() => setZoom(Math.min(12, zoom * 1.5))}>+</button>
      </div>
      <SheetBackground color={color} disabled={applying} onChange={onColorChange} />
      <button type="button" aria-pressed={useColor && color !== null} disabled={!color} onClick={() => setUseColor(!useColor)}>
        Color del pliego
      </button>
    </div>
    <div className={`editor-views ${view === 'compare' ? 'editor-compare' : ''}`}>
      {view !== 'after' && pane('before', design.url)}
      {view !== 'before' && pane('after', url)}
    </div>
    {tool === 'erase' && <div className="editor-tools">
      <label className="tolerance-label">Tolerancia <output>{tolerance}</output>
        <input aria-label="Tolerancia" type="range" min="0" max="255" value={tolerance} disabled={applying} onChange={e => setTolerance(Number(e.target.value))} />
      </label>
      <label className="radio-label"><input type="radio" name="erase-mode" checked={mode === 'connected'} disabled={applying} onChange={() => setMode('connected')} />Solo el fondo (desde los bordes)</label>
      <label className="radio-label"><input type="radio" name="erase-mode" checked={mode === 'global'} disabled={applying} onChange={() => setMode('global')} />Todo ese color</label>
      <button aria-pressed={wand} disabled={processing || applying} onClick={() => {
        if (!wand && view === 'before') setView('after');
        setWand(!wand);
      }}>Varita: quitar otro color</button>
      {wand && <span className="muted">Toca el color que quieres quitar en «Después».</span>}
    </div>}
    {processing && <p role="status">Preparando vista previa…</p>}
    {error && <p className="error" role="alert">{error}</p>}
    <div className="editor-actions">
      <button className="primary-button" disabled={processing || applying || !preview} onClick={async () => {
        if (!preview) return; setApplying(true); setError('');
        try { await onApply(preview); } catch (e) { setError(e instanceof Error ? e.message : 'No se ha podido aplicar el cambio.'); setApplying(false); }
      }}>{applying ? 'Aplicando…' : 'Aplicar'}</button>
      <button disabled={applying} onClick={onCancel}>Cancelar</button>
      {tool === 'erase' && <button className="text-button" disabled={applying} onClick={() => { setBase(design.raster); setSeed(undefined); setTolerance(35); setWand(false); }}>Restablecer borrador</button>}
    </div>
  </dialog>;
}
