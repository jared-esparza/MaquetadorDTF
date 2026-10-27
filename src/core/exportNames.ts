/** One base name for downloads and ZIP entries on both platforms. */
export function defaultExportBaseName(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `DTF-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`;
}

export function normalizeExportBaseName(name: string): string {
  return name.trim().replace(/\.(png|pdf|zip)$/i, '').trim();
}

export function exportNameError(name: string): string {
  if (!name.trim()) return 'Introduce un nombre para el trabajo.';
  if (name.length > 120) return 'El nombre admite como máximo 120 caracteres.';
  if (/[<>:"/\\|?*\x00-\x1f]/.test(name) || name.includes('..')) return 'El nombre no puede contener rutas, caracteres como / \\ : * ? o dos puntos seguidos (..).';
  if (/[. ]$/.test(name)) return 'El nombre no puede terminar en punto ni espacio.';
  if (/^(con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/i.test(name)) return 'Ese nombre está reservado por Windows. Elige otro.';
  return '';
}

export function exportFilename(base: string, type: 'png' | 'pdf' | 'zip', page?: number): string {
  const error = exportNameError(base);
  if (error) throw new Error(error);
  return `${base}${page === undefined ? '' : `-pliego-${String(page).padStart(3, '0')}`}.${type}`;
}
