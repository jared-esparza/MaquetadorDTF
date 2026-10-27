import { useEffect, useRef, useState } from 'react';
import { analyzePdf, type PdfCandidate } from '../browser/pdf';
import type { Raster } from '../core/model';

function Thumbnail({ raster }: { raster: Raster }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => { canvas.current!.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(raster.data),raster.width,raster.height),0,0); },[raster]);
  return <canvas ref={canvas} width={raster.width} height={raster.height} className="checker" aria-label="Vista previa del recorte" />;
}
export function PdfImport({ file, onComplete }: { file: File; onComplete: (pages: PdfCandidate[]) => void }) {
  const dialog = useRef<HTMLDialogElement>(null), controller = useRef<AbortController | null>(null);
  const [pages,setPages] = useState<PdfCandidate[]>([]), [selected,setSelected] = useState<Set<number>>(new Set());
  const [ready,setReady] = useState(false), [total,setTotal] = useState(0), [error,setError] = useState('');
  useEffect(() => {
    const abort = new AbortController(); controller.current = abort; dialog.current?.showModal();
    setPages([]); setSelected(new Set()); setReady(false); setError('');
    void analyzePdf(file,abort.signal,(page,count) => {
      setTotal(count); setPages(previous => [...previous,page]);
      if (page.pdf) setSelected(previous => new Set([...previous,page.pageNumber]));
    }).catch(error => { if (!abort.signal.aborted) setError(error instanceof Error ? error.message : 'No se puede leer el PDF.'); })
      .finally(() => { if (!abort.signal.aborted) setReady(true); });
    return () => abort.abort();
  },[file]);
  const cancel = () => { controller.current?.abort(); onComplete([]); };
  return <dialog ref={dialog} className="pdf-dialog" aria-labelledby="pdf-import-title" onCancel={event => { event.preventDefault(); cancel(); }}>
    <h2 id="pdf-import-title">Importar páginas PDF</h2><p>{file.name}</p>
    <p>Se recorta el espacio transparente exterior. El blanco dibujado se conserva. Comprueba las medidas antes de importar.</p>
    {!ready && <p role="status">Analizando página {Math.min(pages.length + 1,total || 1)}{total ? ` de ${total}` : ''}…</p>}
    {error && <p className="error-box" role="alert">{error}</p>}
    <button disabled={!ready || !!error} onClick={() => setSelected(new Set(pages.filter(page => page.pdf).map(page => page.pageNumber)))}>Seleccionar todas</button>
    <div className="pdf-pages">{pages.map(page => <label key={page.pageNumber} className="pdf-page">
      <span><input type="checkbox" aria-label={`Importar página ${page.pageNumber}`} disabled={!ready || !page.pdf} checked={selected.has(page.pageNumber)} onChange={event => setSelected(previous => { const next = new Set(previous); if (event.target.checked) next.add(page.pageNumber); else next.delete(page.pageNumber); return next; })} /> Página {page.pageNumber}</span>
      {page.raster && <Thumbnail raster={page.raster} />}
      {page.pdf && <span>{(page.pdf.widthPt * 25.4 / 72).toFixed(2)} × {(page.pdf.heightPt * 25.4 / 72).toFixed(2)} mm · PDF original</span>}
      {page.error && <span className="error">{page.error}</span>}
    </label>)}</div>
    <div className="editor-actions"><button className="primary-button" disabled={!ready || !!error || !selected.size} onClick={() => onComplete(pages.filter(page => page.pdf && selected.has(page.pageNumber)))}>Importar seleccionadas ({selected.size})</button><button onClick={cancel}>Cancelar importación</button></div>
  </dialog>;
}

export function PdfConversion({ name,onConfirm,onCancel }: { name: string; onConfirm: (dpi: number) => void; onCancel: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null), [dpi,setDpi] = useState(300);
  useEffect(() => { dialog.current?.showModal(); },[]);
  return <dialog ref={dialog} className="pdf-dialog conversion-dialog" aria-labelledby="pdf-conversion-title" onCancel={event => { event.preventDefault(); onCancel(); }}>
    <h2 id="pdf-conversion-title">Convertir PDF para editar</h2><p>{name}</p>
    <p>Este diseño se convertirá en imagen a su tamaño actual. Al aplicar la edición dejará de conservar vectores en el PDF. Puedes deshacer para recuperar el original.</p>
    <label>Resolución de conversión<select value={dpi} onChange={event => setDpi(Number(event.target.value))}><option value={300}>300 ppp</option><option value={600}>600 ppp</option></select></label>
    <div className="editor-actions"><button className="primary-button" onClick={() => onConfirm(dpi)}>Convertir y editar</button><button onClick={onCancel}>Cancelar</button></div>
  </dialog>;
}
