import { useEffect, useState } from 'react';
import type { Design, Raster } from '../core/model';
import { rasterUrl } from '../browser/images';
import { runImage } from '../browser/workerClient';

export function ImageEditor({ design, onApply, onCancel }: { design: Design; onApply: (raster: Raster) => Promise<void>; onCancel: () => void }) {
  const [base, setBase] = useState(design.raster);
  const [preview, setPreview] = useState<Raster | null>(null);
  const [url, setUrl] = useState('');
  const [tolerance, setTolerance] = useState(35);
  const [mode, setMode] = useState<'connected' | 'global'>('connected');
  const [seed, setSeed] = useState<{ x: number; y: number }>();
  const [wand, setWand] = useState(false);
  const [processing, setProcessing] = useState(true);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    let objectUrl = '';
    setProcessing(true); setError('');
    const timer = setTimeout(async () => {
      try {
        const result = await runImage('erase', base, { tolerance, mode, seed }, controller.signal);
        objectUrl = await rasterUrl(result);
        if (controller.signal.aborted) { URL.revokeObjectURL(objectUrl); return; }
        setPreview(result); setUrl(objectUrl); setProcessing(false);
      } catch (e) {
        if (controller.signal.aborted) return;
        setError(e instanceof Error ? e.message : 'No se ha podido borrar el fondo.'); setProcessing(false); setPreview(null);
      }
    }, 120);
    return () => { clearTimeout(timer); controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [base, tolerance, mode, seed]);
  return <div className="image-editor" aria-label="Editor de fondo">
    <p><strong>Borrador.</strong> Revisa el resultado antes de aplicar. Sube la tolerancia si queda fondo; bájala si desaparece parte del diseño.</p>
    <label className="tolerance-label">Tolerancia <output>{tolerance}</output>
      <input aria-label="Tolerancia" type="range" min="0" max="255" value={tolerance} disabled={applying} onChange={e => setTolerance(Number(e.target.value))} />
    </label>
    <label className="radio-label"><input type="radio" name={`erase-${design.id}`} checked={mode === 'connected'} disabled={applying} onChange={() => setMode('connected')} />Solo el fondo (desde los bordes)</label>
    <label className="radio-label"><input type="radio" name={`erase-${design.id}`} checked={mode === 'global'} disabled={applying} onChange={() => setMode('global')} />Todo ese color</label>
    <button className={`small-button ${wand ? 'selected' : ''}`} aria-pressed={wand} disabled={processing || applying} onClick={() => setWand(!wand)}>Varita: quitar otro color</button>
    {wand && <p className="muted">Toca el color que quieres quitar en «Ahora».</p>}
    <div className="comparison">
      <figure><figcaption>Antes</figcaption><img className="checker" src={design.url} alt="Diseño antes de borrar el fondo" /></figure>
      <figure><figcaption>Ahora</figcaption>{url ? <img className={`checker ${wand ? 'wand-cursor' : ''}`} src={url} alt="Diseño con el fondo eliminado" onClick={event => {
        if (!wand || !preview || processing || applying) return;
        const rect = event.currentTarget.getBoundingClientRect();
        const x = Math.min(preview.width - 1, Math.max(0, Math.floor((event.clientX - rect.left) * preview.width / rect.width)));
        const y = Math.min(preview.height - 1, Math.max(0, Math.floor((event.clientY - rect.top) * preview.height / rect.height)));
        if (preview.data[(y * preview.width + x) * 4 + 3] === 0) { setError('Selecciona un color visible para la varita.'); return; }
        setBase(preview); setSeed({ x, y }); setWand(false);
      }} /> : <div className="image-placeholder">Preparando…</div>}</figure>
    </div>
    {processing && <p role="status">Preparando vista previa…</p>}
    {error && <p className="error" role="alert">{error}</p>}
    <div className="editor-actions">
      <button className="primary-button" disabled={processing || applying || !preview} onClick={async () => {
        if (!preview) return; setApplying(true); setError('');
        try { await onApply(preview); } catch (e) { setError(e instanceof Error ? e.message : 'No se ha podido aplicar el cambio.'); setApplying(false); }
      }}>{applying ? 'Aplicando…' : 'Aplicar'}</button>
      <button disabled={applying} onClick={onCancel}>Cancelar</button>
      <button className="text-button" disabled={applying} onClick={() => { setBase(design.raster); setSeed(undefined); setTolerance(35); setWand(false); }}>Restablecer vista</button>
    </div>
  </div>;
}
