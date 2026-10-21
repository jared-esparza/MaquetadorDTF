import { useState } from 'react';
import { designMetrics, formatMm, type Design, type Raster } from '../core/model';
import { NumberField } from './NumberField';
import { ImageEditor } from './ImageEditor';

interface Props {
  design: Design; busy: boolean; editing: boolean;
  onChange: (patch: Partial<Pick<Design, 'widthMm' | 'copies'>>) => void;
  onRemove: () => void; onEdit: () => void; onCancel: () => void;
  onApply: (raster: Raster) => Promise<void>; onUndo: () => void; onRefine: () => void;
  onValidity: (field: string, valid: boolean) => void;
}

export function DesignCard({ design, busy, editing, onChange, onRemove, onEdit, onCancel, onApply, onUndo, onRefine, onValidity }: Props) {
  const [expanded, setExpanded] = useState(true);
  const { heightMm, dpi, quality, recommendedWidthMm } = designMetrics(design.raster, design.widthMm);
  const opaque = design.opaque;
  return <article className="design-card" data-testid="design-card">
    <div className="design-card-top">
      <img className="design-thumb checker" src={design.url} alt="" />
      <span className="design-name" title={design.name}>{design.name}</span>
      <button className="icon-button" aria-label={`Quitar ${design.name}`} title="Quitar diseño" disabled={busy || editing} onClick={onRemove}>×</button>
    </div>
    <div className="design-inputs">
      <NumberField label="Ancho (cm)" value={design.widthMm / 10} onValue={n => onChange({ widthMm: Math.round(n * 1000) / 100 })} onValidity={valid => onValidity('width', valid)} disabled={busy || editing} />
      <div className="copies-field">
        <NumberField label="Copias" value={design.copies} integer max={3000} onValue={copies => onChange({ copies })} onValidity={valid => onValidity('copies', valid)} disabled={busy || editing} />
        <div className="copy-buttons">
          <button aria-label="Menos copias" disabled={busy || editing || design.copies <= 1} onClick={() => onChange({ copies: design.copies - 1 })}>−</button>
          <button aria-label="Más copias" disabled={busy || editing || design.copies >= 3000} onClick={() => onChange({ copies: design.copies + 1 })}>+</button>
        </div>
      </div>
      <button className="icon-button disclosure" aria-label="Ver u ocultar los ajustes de este diseño" aria-expanded={expanded} onClick={() => setExpanded(!expanded)} disabled={editing}>{expanded ? '▴' : '▾'}</button>
    </div>
    {expanded && <div className="design-details">
      <p>Medida final <strong>{formatMm(design.widthMm / 10)} × {formatMm(heightMm / 10)} cm</strong></p>
      <p className={`quality ${quality}`}>{quality === 'good' ? 'Buena calidad' : quality === 'fair' ? 'Calidad justa' : 'Resolución baja: puede verse pixelado'} · {Math.round(dpi)} ppp</p>
      {quality !== 'good' && <button className="small-button" disabled={busy || editing} onClick={() => onChange({ widthMm: recommendedWidthMm })}>Ajustar a {formatMm(recommendedWidthMm / 10)} cm</button>}
      {opaque && <p className="opaque-warning">El fondo también se imprime.</p>}
      {design.note && <p className="success-note">{design.note}</p>}
      {design.raster.sourceScale > 1 && <p className="muted">Ampliar no añade detalle. Los ppp se calculan desde los píxeles originales.</p>}
      {design.undo && design.note.includes('Bordes') && <div className="comparison"><figure><figcaption>Antes</figcaption><img className="checker" src={design.undo.url} alt="Diseño antes de afinar" /></figure><figure><figcaption>Ahora</figcaption><img className="checker" src={design.url} alt="Diseño con bordes afinados" /></figure></div>}
      <div className="design-actions">
        {!editing && <button className="small-button" disabled={busy} onClick={onEdit}>Borrador · fondo y colores</button>}
        {!editing && design.raster.sourceScale === 1 && <button className="small-button" disabled={busy} onClick={onRefine}>Afinar los bordes</button>}
        {design.undo && !editing && <button className="small-button" disabled={busy} onClick={onUndo}>Deshacer</button>}
      </div>
    </div>}
    {editing && <ImageEditor design={design} onApply={onApply} onCancel={onCancel} />}
  </article>;
}
