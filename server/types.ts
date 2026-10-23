export interface LayoutSettings {
  mode: 'DEFAULT' | 'PVC' | 'PAPER' | 'CUSTOM';
  widthCm: number;      // e.g. 8.95
  heightCm: number;     // e.g. 5.70
  sideGapPx: number;    // e.g. 54
  downGapPx: number;    // e.g. 27
  downGapLevel: number; // 1 to 4
  topMarginPx: number;  // e.g. 15
  sideMarginPx: number; // e.g. 20
  format: 'JPG' | 'PDF';
  dpi: number;          // e.g. 300
  quality?: number;     // e.g. 78 for ultra-compressed lightweight PDF
}

export type OrientationMode = 'normal' | 'reverse' | 'flip_reverse';

export interface UserSession {
  chatId: number | string;
  language: 'am' | 'en';
  settings: LayoutSettings;
  fronts: Buffer[];
  backs: Buffer[];
  createdAt: number;
  lastActive: number;
}

export interface BotActivityLog {
  id: string;
  timestamp: string;
  chatId: string;
  user: string;
  action: string;
  details: string;
  type: 'info' | 'success' | 'warning' | 'error';
}
