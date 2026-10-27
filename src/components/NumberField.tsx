import { useEffect, useState } from 'react';
import { parsePositiveNumber } from '../core/model';

interface Props {
  label: string; value: number; onValue: (value: number) => void;
  integer?: boolean; max?: number; disabled?: boolean; precision?: number;
  onValidity: (valid: boolean) => void;
}

export function NumberField({ label, value, onValue, integer = false, max = Infinity, disabled, onValidity, precision }: Props) {
  const display = (n: number) => String(precision === undefined ? n : Number(n.toFixed(precision)));
  const [text, setText] = useState(display(value));
  const [invalid, setInvalid] = useState(false);
  useEffect(() => {
    setText(current => parsePositiveNumber(current) === value ? current : display(value));
    setInvalid(false); onValidity(true);
  }, [value]);
  const error = integer ? `Introduce un número entero entre 1 y ${max}.` : 'Introduce una medida mayor que cero.';
  return <label className="number-field">
    <span>{label}</span>
    <input aria-label={label} inputMode={integer ? 'numeric' : 'decimal'} value={text} disabled={disabled} aria-invalid={invalid}
      onChange={e => {
        const next = e.target.value; setText(next);
        const n = parsePositiveNumber(next);
        const valid = n !== null && n <= max && (!integer || Number.isInteger(n));
        setInvalid(!valid); onValidity(valid);
        if (valid) onValue(n);
      }}
      onBlur={() => { const n = parsePositiveNumber(text); if (n !== null && !invalid) setText(display(n)); }} />
    {invalid && <small className="field-error">{error}</small>}
  </label>;
}
