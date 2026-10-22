import { useEffect, useRef, useState } from 'react';
import { fetchWindowsRelease, RELEASES_URL, type WindowsRelease } from '../browser/releases';

export function WindowsDownloads() {
  const [state, setState] = useState<{ release: WindowsRelease | null; busy: boolean; error: boolean }>({ release: null, busy: true, error: false });
  const pending = useRef<AbortController | null>(null);
  const downloadFrame = useRef<HTMLIFrameElement | null>(null);
  async function refresh(kind?: 'installer' | 'portable') {
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    setState(current => ({ ...current, busy: true, error: false }));
    try {
      const release = await fetchWindowsRelease(controller.signal);
      if (controller.signal.aborted) return;
      setState({ release, busy: false, error: false });
      if (kind && downloadFrame.current) downloadFrame.current.src = release[kind];
    } catch {
      if (!controller.signal.aborted) setState({ release: null, busy: false, error: true });
    }
  }
  useEffect(() => { void refresh(); return () => pending.current?.abort(); }, []);
  return <section className="windows-downloads" aria-labelledby="windows-title" aria-busy={state.busy}>
    <div><h2 id="windows-title">Versión para Windows</h2><p className="muted">Instalador guiado o portátil · Windows x64</p>
      {state.release && <p className="windows-version">{state.release.version}{state.release.prerelease ? ' · Versión preliminar' : ''}</p>}
      {state.busy && <p role="status">Consultando la última publicación…</p>}
      {state.error && <p role="status">No se ha podido consultar la última versión. Puedes ver las descargas en GitHub.</p>}
    </div>
    <div className="windows-actions">
      {state.release && (['installer', 'portable'] as const).map(kind => <a key={kind} className="windows-download-link" href={state.release![kind]} aria-disabled={state.busy} onClick={event => { event.preventDefault(); if (!state.busy) void refresh(kind); }} onAuxClick={event => { if (event.button === 1) { event.preventDefault(); if (!state.busy) void refresh(kind); } }}>{kind === 'installer' ? 'Descargar instalador' : 'Descargar portátil'}</a>)}
      <a className="windows-releases-link" href={RELEASES_URL} target="_blank" rel="noopener noreferrer">Ver versiones en GitHub</a>
    </div>
    <iframe ref={downloadFrame} title="Descarga de Windows" hidden />
  </section>;
}
