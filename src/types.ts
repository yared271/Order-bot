export type OrientationMode = 'normal' | 'reverse' | 'flip_reverse';

export interface LayoutSettings {
  mode: 'DEFAULT' | 'PVC' | 'PAPER' | 'CUSTOM';
  widthCm: number;
  heightCm: number;
  sideGapPx: number;
  downGapPx: number;
  downGapLevel: number;
  topMarginPx: number;
  sideMarginPx: number;
  format: 'JPG' | 'PDF';
  dpi: number;
  quality?: number;
}

export interface BotStatusResponse {
  ok: boolean;
  botInfo?: {
    id: number;
    first_name: string;
    username: string;
  };
  config: {
    token: string;
    defaultChatId: string;
    isRunning: boolean;
    isWebhook?: boolean;
    webhookUrl?: string;
  };
  stats?: {
    timestamp: string;
  };
}

export interface BotLog {
  id: string;
  timestamp: string;
  chatId: string;
  user: string;
  action: string;
  details: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

export type Language = 'am' | 'en';
