import { useState } from 'react';

export function normalizeSheetColor(value: unknown) {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value.toUpperCase() : null;
}

export function SheetBackground({ color, onChange, disabled }: {
  color: string | null; onChange: (color: string | null) => void; disabled: boolean;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);
  function commit() {
    if (draft === null) return;
    const normalized = normalizeSheetColor(draft.trim());
    setInvalid(!normalized);
    if (normalized) { onChange(normalized); setDraft(null); }
  }

  return <>
    <button type="button" className="sheet-background-trigger" popoverTarget="sheet-background-options"
      aria-label="Cambiar fondo de vista previa" title="Cambiar fondo de vista previa" disabled={disabled}>
      <span aria-hidden="true" className="checker" style={color ? { background: color } : undefined} />
    </button>
    <div id="sheet-background-options" className="sheet-background-popover" popover="auto">
      <fieldset className="sheet-background" disabled={disabled}>
        <legend>Fondo de vista previa</legend>
        <input type="color" aria-label="Elegir color del pliego" value={color ?? '#ffffff'} onChange={event => {
          setDraft(null); setInvalid(false); onChange(normalizeSheetColor(event.target.value));
        }} />
        <input type="text" aria-label="Color hexadecimal del pliego" aria-invalid={invalid} placeholder="#RRGGBB" maxLength={7}
          value={draft ?? color ?? ''} onChange={event => { setDraft(event.target.value); setInvalid(false); }}
          onBlur={commit} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); } }} />
        <button onClick={() => { setDraft(null); setInvalid(false); onChange(null); }}>Restaurar damero</button>
        <small>{invalid ? 'Introduce un color en formato #RRGGBB.' : 'Solo en pantalla.'}</small>
      </fieldset>
    </div>
  </>;
}
