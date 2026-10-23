import type { SheetProfile } from '../core/model';

export interface ProfileState { profiles: SheetProfile[]; selected: string }
export interface DesktopPreferences { profileState?: ProfileState; hideWelcome: boolean; version: string; portable: boolean }
export type UpdateMode = 'manual' | 'notify' | 'auto';
export interface UpdateState {
  status: 'idle' | 'checking' | 'current' | 'available' | 'downloading' | 'downloaded' | 'installing' | 'error';
  mode: UpdateMode; currentVersion: string; portable: boolean; version: string; progress: number; message: string; canInstall: boolean;
}
export interface DesktopBridge {
  getPreferences(): Promise<DesktopPreferences>;
  updatePreferences(patch: { profileState?: ProfileState; hideWelcome?: boolean }): Promise<void>;
  savePdf(request: { filename: string; bytes: Uint8Array }): Promise<{ status: 'saved'; filename: string; warning?: string } | { status: 'cancelled' }>;
  saveRaster(request: { filename: string; type: 'png' | 'zip'; bytes: Uint8Array }): ReturnType<DesktopBridge['savePdf']>;
  showExportFolder(): Promise<void>;
  getUpdateState(): Promise<UpdateState>;
  setUpdateMode(mode: UpdateMode): Promise<UpdateState>;
  checkUpdates(): Promise<UpdateState>;
  downloadUpdate(): Promise<UpdateState>;
  installUpdate(): Promise<UpdateState>;
  openReleases(): Promise<void>;
  onUpdateState(callback: (state: UpdateState) => void): () => void;
  setDocumentState(state: { dirty: boolean; busy: boolean }): void;
  showHelp(topic: 'guide' | 'calibration' | 'about' | 'welcome'): Promise<void>;
  onHelp(callback: (topic: string) => void): () => void;
}
declare global { interface Window { desktop?: DesktopBridge } }

export const desktop = window.desktop;
