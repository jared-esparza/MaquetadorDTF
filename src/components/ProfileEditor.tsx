import { useState } from 'react';
import { formatMm, validateProfile, type SheetProfile } from '../core/model';

export function ProfileEditor({ profiles, profile, disabled, onOpenChange, onSelect, onSave }: { profiles: SheetProfile[]; profile: SheetProfile; disabled: boolean; onOpenChange: (open: boolean) => void; onSelect: (id: string) => void; onSave: (profile: SheetProfile, asNew: boolean) => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const begin = () => {
    setDraft({ name: profile.name, width: String(profile.widthMm), height: String(profile.heightMm), ...Object.fromEntries(Object.entries(profile.margins).map(([key, value]) => [key, String(value)])) });
    setOpen(true); onOpenChange(true); setError('');
  };
  const save = (asNew: boolean) => {
    const n = (key: string) => /^\d+(?:[.,]\d+)?$/.test(draft[key]) ? Number(draft[key].replace(',', '.')) : NaN;
    const updated: SheetProfile = { id: asNew ? crypto.randomUUID() : profile.id, name: draft.name.trim() || 'Formato personalizado', widthMm: n('width'), heightMm: n('height'), margins: { top: n('top'), right: n('right'), bottom: n('bottom'), left: n('left') } };
    const problem = validateProfile(updated);
    if (problem) { setError(problem); return; }
    onSave(updated, asNew); setOpen(false); onOpenChange(false);
  };
  return <div className="profile-block">
    <label className="select-label">Formato del film<select aria-label="Perfil de formato" value={profile.id} disabled={disabled || open} onChange={e => onSelect(e.target.value)}>{profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
    <div className="profile-line"><strong data-testid="profile-dimensions">{formatMm(profile.widthMm)} × {formatMm(profile.heightMm)} mm</strong><button className="text-button" disabled={disabled} onClick={() => { if (open) { setOpen(false); onOpenChange(false); } else begin(); }}>{open ? 'Cerrar formato' : 'Configurar formato'}</button></div>
    {open && <form className="profile-editor" onSubmit={e => { e.preventDefault(); save(false); }}>
      <label>Nombre del formato<input aria-label="Nombre del formato" value={draft.name} maxLength={80} onChange={e => setDraft({ ...draft, name: e.target.value })} /></label>
      <div className="form-grid">{[['width', 'Ancho del pliego (mm)'], ['height', 'Largo del pliego (mm)'], ['top', 'Margen superior (mm)'], ['right', 'Margen derecho (mm)'], ['bottom', 'Margen inferior (mm)'], ['left', 'Margen izquierdo (mm)']].map(([key, label]) => <label key={key}>{label}<input aria-label={label} inputMode="decimal" value={draft[key]} onChange={e => setDraft({ ...draft, [key]: e.target.value })} /></label>)}</div>
      {error && <p role="alert" className="error">{error}</p>}
      <div className="editor-actions"><button className="primary-button" type="submit">Guardar formato</button><button type="button" onClick={() => save(true)}>Guardar como nuevo</button></div>
    </form>}
  </div>;
}
