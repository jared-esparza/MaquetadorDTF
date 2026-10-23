import { useEffect, useRef, useState } from 'react';
import { desktop, type UpdateMode, type UpdateState } from '../platform/desktop';

export function Updates({ onInstalling }: { onInstalling: (value: boolean) => void }) {
  const [state, setState] = useState<UpdateState | null>(null);
  const [open, setOpen] = useState(false), [error, setError] = useState(''), [saving, setSaving] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    let active = true;
    const unsubscribe = desktop!.onUpdateState(value => { if (active) setState(value); });
    desktop!.getUpdateState().then(value => { if (active) setState(value); }).catch(() => { if (active) setError('No se puede leer el estado de actualización.'); });
    return () => { active = false; unsubscribe(); };
  }, []);
  useEffect(() => { onInstalling(state?.status === 'installing'); }, [state?.status, onInstalling]);
  useEffect(() => { if (open && !dialog.current?.open) dialog.current?.showModal(); }, [open]);
  const running = saving || !!state && ['checking', 'downloading', 'installing'].includes(state.status);
  const action = async (operation: () => Promise<UpdateState>) => {
    setError(''); setSaving(true);
    try { setState(await operation()); } catch (error) { setError(error instanceof Error ? error.message : 'No se ha podido completar la operación.'); }
    finally { setSaving(false); }
  };
  const labels = { idle: 'Puedes buscar nuevas versiones.', checking: 'Buscando actualizaciones…', current: 'Tienes la versión más reciente disponible.', available: 'Hay una nueva versión disponible.', downloading: 'Descargando actualización…', downloaded: 'Actualización preparada para instalar.', installing: 'Preparando instalación y reinicio…', error: 'No se ha podido completar la actualización.' };
  return <div className="desktop-updates">
    <button className="text-button" onClick={() => setOpen(true)}>Actualizaciones{state && ['available', 'downloaded'].includes(state.status) ? ` · ${state.version}` : ''}</button>
    {state?.status === 'available' && <span className="update-notice" role="status">Nueva versión disponible</span>}
    {state?.status === 'downloaded' && <span className="update-notice" role="status">Lista para instalar</span>}
    {open && <dialog ref={dialog} className="updates-dialog" aria-labelledby="updates-title" onClose={() => setOpen(false)} onCancel={event => { if (state?.status === 'installing') event.preventDefault(); }}>
      <h2 id="updates-title">Actualizaciones</h2>
      {state && <>
        <p>Versión instalada: <strong>{state.currentVersion}</strong>{state.portable ? ' · Portátil' : ''}</p>
        <label>Modo de actualización<select aria-label="Modo de actualización" value={state.mode} disabled={running} onChange={event => void action(() => desktop!.setUpdateMode(event.target.value as UpdateMode))}>
          <option value="manual">Manual: buscar solo cuando lo solicite</option>
          <option value="notify">Avisarme antes de descargar</option>
          {!state.portable && <option value="auto">Automático: descargar y avisar para reiniciar</option>}
        </select></label>
        <p className="muted">Se incluyen las versiones preliminares. Si la comprobación automática está habilitada, se busca al iniciar y cada 6 horas mientras la aplicación está abierta.</p>
        <p role="status">{labels[state.status]}{state.version && ` Versión ${state.version}.`}</p>
        {state.message && <p className="error" role="alert">{state.message}</p>}
        {state.status === 'downloading' && <><progress aria-label="Progreso de descarga de actualización" max="100" value={state.progress} /><p>{state.progress} %</p></>}
        {state.portable ? <p>La actualización es asistida: descarga el nuevo EXE, cierra esta versión y reemplázalo conservando la carpeta <strong>MaquetadorDTF-datos</strong>. No se instala ni se reemplaza automáticamente.</p>
          : <p>La descarga no reinicia la aplicación. Solo se instalará cuando pulses «Instalar y reiniciar», sin trabajo pendiente ni operaciones en curso. Los formatos y preferencias se conservan.</p>}
        <div className="updates-actions">
          <button disabled={running || state.status === 'downloaded'} onClick={() => void action(() => desktop!.checkUpdates())}>Buscar actualizaciones</button>
          {state.status === 'available' && <button className="primary-button" disabled={running} onClick={() => void action(() => desktop!.downloadUpdate())}>{state.portable ? 'Descargar nuevo portátil' : 'Descargar actualización'}</button>}
          {!state.portable && state.status === 'downloaded' && <button className="primary-button" disabled={running || !state.canInstall} onClick={() => void action(() => desktop!.installUpdate())}>Instalar y reiniciar</button>}
        </div>
        {!state.portable && state.status === 'downloaded' && !state.canInstall && <p>Exporta tu montaje y termina las operaciones pendientes antes de reiniciar.</p>}
      </>}
      {error && <p role="alert" className="error">{error}</p>}
      <div className="updates-actions"><button className="text-button" onClick={() => void desktop!.openReleases().catch(() => setError('No se ha podido abrir GitHub.'))}>Ver versiones en GitHub</button><button disabled={state?.status === 'installing'} onClick={() => dialog.current?.close()}>Cerrar</button></div>
    </dialog>}
  </div>;
}
