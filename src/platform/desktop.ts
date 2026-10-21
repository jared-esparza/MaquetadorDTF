import type { SheetProfile } from '../core/model';

export interface ProfileState { profiles: SheetProfile[]; selected: string }
export interface DesktopPreferences { profileState?: ProfileState; hideWelcome: boolean; version: string; portable: boolean }
export interface DesktopBridge {
  getPreferences(): Promise<DesktopPreferences>;
  updatePreferences(patch: { profileState?: ProfileState; hideWelcome?: boolean }): Promise<void>;
  savePdf(request: { filename: string; bytes: Uint8Array }): Promise<{ status: 'saved'; filename: string; warning?: string } | { status: 'cancelled' }>;
  showExportFolder(): Promise<void>;
  setDocumentState(state: { dirty: boolean; busy: boolean }): void;
  showHelp(topic: 'guide' | 'calibration' | 'about' | 'welcome'): Promise<void>;
  onHelp(callback: (topic: string) => void): () => void;
}
declare global { interface Window { desktop?: DesktopBridge } }

export const desktop = window.desktop;
