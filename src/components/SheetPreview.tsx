import type { CSSProperties } from 'react';
import type { Design, LayoutResult, SheetProfile } from '../core/model';

function Sheet({ page, profile, designs, mirror, small = false }: { page: LayoutResult['pages'][number]; profile: SheetProfile; designs: Design[]; mirror: boolean; small?: boolean }) {
  const designMap = new Map(designs.map(d => [d.id, d]));
  return <svg className="sheet-svg checker" viewBox={`0 0 ${profile.widthMm} ${profile.heightMm}`} role="img" aria-label={small ? 'Miniatura del pliego' : 'Vista previa del pliego'}>
    <g transform={mirror ? `translate(${profile.widthMm} 0) scale(-1 1)` : undefined}>
      {page.placements.map(p => {
        const design = designMap.get(p.designId);
        if (!design) return null;
        return <image key={`${p.designId}-${p.copyIndex}`} href={design.url} x={p.rotation ? 0 : p.xMm} y={p.rotation ? 0 : p.yMm} width={p.rotation ? p.heightMm : p.widthMm} height={p.rotation ? p.widthMm : p.heightMm} preserveAspectRatio="none" transform={p.rotation ? `translate(${p.xMm + p.widthMm} ${p.yMm}) rotate(90)` : undefined} />;
      })}
      {!small && <rect className="print-area" x={profile.margins.left} y={profile.margins.top} width={profile.widthMm - profile.margins.left - profile.margins.right} height={profile.heightMm - profile.margins.top - profile.margins.bottom} />}
    </g>
  </svg>;
}

interface Props {
  layout: LayoutResult; profile: SheetProfile; designs: Design[]; mirror: boolean;
  pageIndex: number; onPage: (index: number) => void;
  excludedPages: number[]; canDownloadPdf: boolean; canDownloadPng: boolean; busy: boolean;
  onDownload: (format: 'pdf' | 'png', index: number) => void; onInclude: (index: number) => void;
  spread: boolean; canSpread: boolean; spacingDisabled: boolean; spacingNotice: string; onToggleSpacing: () => void;
}

export function SheetPreview({ layout, profile, designs, mirror, pageIndex, onPage, excludedPages, canDownloadPdf, canDownloadPng, busy, onDownload, onInclude, spread, canSpread, spacingDisabled, spacingNotice, onToggleSpacing }: Props) {
  const index = Math.min(pageIndex, layout.pages.length - 1);
  const excluded = excludedPages.includes(index);
  return <>
    <div className={`sheet-frame ${excluded ? 'sheet-excluded' : ''}`} data-excluded={excluded} style={{ '--sheet-ratio': profile.widthMm / profile.heightMm } as CSSProperties}><Sheet page={layout.pages[index]} profile={profile} designs={designs} mirror={mirror} /></div>
    <p className="page-label">Pliego {index + 1} de {layout.pages.length} <span>{Math.round(layout.pages[index].utilization * 100)} % de aprovechamiento</span></p>
    <div className="sheet-spacing-actions">
      <button disabled={spacingDisabled || (!spread && !canSpread)} aria-describedby="spacing-help" onClick={onToggleSpacing}>{spread ? 'Restaurar compacto' : 'Repartir espacios'}</button>
      <span className="muted">{spread ? 'Espacios repartidos' : !canSpread ? 'No hay espacio que repartir' : 'Montaje compacto'}</span>
    </div>
    <p id="spacing-help" className="muted">Reparte el espacio libre entre diseños sin cambiar tamaños ni añadir pliegos. La distancia seleccionada se mantiene como mínimo.</p>
    {spacingNotice && <p className="muted" role="status">{spacingNotice}</p>}
    <div className="sheet-download-actions">
      <button disabled={!canDownloadPdf} onClick={() => onDownload('pdf', index)}>Descargar este pliego en PDF</button>
      <button disabled={!canDownloadPng} onClick={() => onDownload('png', index)}>Descargar este pliego en PNG</button>
      {excluded && <><span className="sheet-download-status">Descargado por separado</span><button disabled={busy} onClick={() => onInclude(index)}>Volver a incluir</button></>}
    </div>
    {mirror && <p className="mirror-note">Vista previa en espejo</p>}
    {layout.pages.length > 1 && <nav className="page-navigation" aria-label="Pliegos">
      <button className="icon-button" aria-label="Pliego anterior" disabled={index === 0} onClick={() => onPage(index - 1)}>‹</button>
      <div className="page-thumbnails">{layout.pages.map((page, i) => <button className={`page-thumbnail ${index === i ? 'active' : ''} ${excludedPages.includes(i) ? 'sheet-excluded' : ''}`} data-excluded={excludedPages.includes(i)} key={i} aria-label={`Ver pliego ${i + 1}`} aria-description={excludedPages.includes(i) ? 'Descargado por separado; excluido de la descarga general' : 'Incluido en la descarga general'} aria-current={index === i ? 'page' : undefined} onClick={() => onPage(i)}><span>{i + 1}{excludedPages.includes(i) ? ' ✓' : ''}</span><Sheet page={page} profile={profile} designs={designs} mirror={mirror} small /></button>)}</div>
      <button className="icon-button" aria-label="Pliego siguiente" disabled={index === layout.pages.length - 1} onClick={() => onPage(index + 1)}>›</button>
    </nav>}
    <p className="preview-caption">Vista previa a escala. El damero y las guías no se imprimen.</p>
  </>;
}
