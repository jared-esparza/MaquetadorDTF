import { useState } from 'react';

export function Welcome({ onStart }: { onStart: (hide: boolean) => Promise<void> }) {
  const [hide, setHide] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return <div className="welcome-backdrop"><section className="welcome-dialog" role="dialog" aria-modal="true" aria-label="Bienvenido a Maquetador DTF">
    <div className="brand">PK<span>print</span></div>
    <h2>Tu film DTF, en tres pasos</h2>
    <ol><li><strong>Sube tus diseños.</strong> Elige el ancho y cuántas copias necesitas.</li><li><strong>Revisa el pliego.</strong> Ajusta el film, los márgenes y la separación. El montaje se hace solo. Puedes repartir los espacios del pliego visible para facilitar el corte y restaurar el montaje compacto.</li><li><strong>Guarda tu PDF.</strong> Imprime desde tu RIP al 100 %, sin ajustar a página.</li></ol>
    <p>Todo se procesa en tu equipo. Tu RIP genera el blanco y gestiona el color.</p>
    <label className="checkbox-label"><input type="checkbox" checked={hide} onChange={e => setHide(e.target.checked)} disabled={busy} />No volver a mostrar</label>
    {error && <p role="alert" className="error">{error}</p>}
    <button className="primary-button" autoFocus disabled={busy} onClick={async () => { setBusy(true); setError(''); try { await onStart(hide); } catch { setError('No se pudo guardar la preferencia. Comprueba los permisos de la carpeta de datos.'); setBusy(false); } }}>Empezar a maquetar</button>
  </section></div>;
}
