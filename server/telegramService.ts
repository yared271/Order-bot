import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { LayoutSettings, OrientationMode, UserSession, BotActivityLog } from './types.js';
import { DEFAULT_LAYOUT_SETTINGS, GAP_LEVELS, processBatchCards, processCardPair, detectCardSide } from './imageProcessor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SESSIONS_DIR = path.join(__dirname, '../data/sessions');

// Ensure sessions directory exists
if (!fs.existsSync(SESSIONS_DIR)) {
  fs.mkdirSync(SESSIONS_DIR, { recursive: true });
}

export interface TelegramConfig {
  token: string;
  defaultChatId: string;
  isRunning: boolean;
  isWebhook: boolean;
  webhookUrl: string;
}

export class TelegramBotManager {
  private token: string;
  private defaultChatId: string;
  private isPolling: boolean = false;
  private isWebhook: boolean = false;
  private currentWebhookUrl: string = '';
  private pollingAbortController: AbortController | null = null;
  private sessions: Map<string, UserSession> = new Map();
  private logs: BotActivityLog[] = [];
  private botInfo: any = null;

  constructor(token: string, defaultChatId: string) {
    this.token = token.trim();
    this.defaultChatId = defaultChatId.trim();
    this.loadPersistedSessions();
  }

  private getSessionFilePath(chatId: string | number): string {
    return path.join(SESSIONS_DIR, `session_${String(chatId)}.json`);
  }

  private loadPersistedSessions() {
    try {
      const files = fs.readdirSync(SESSIONS_DIR);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(SESSIONS_DIR, file);
          const raw = fs.readFileSync(filePath, 'utf-8');
          const data = JSON.parse(raw);
          if (data && data.chatId) {
            const session: UserSession = {
              chatId: String(data.chatId),
              language: data.language || 'am',
              settings: data.settings || { ...DEFAULT_LAYOUT_SETTINGS },
              fronts: (data.frontsBase64 || []).map((b: string) => Buffer.from(b, 'base64')),
              backs: (data.backsBase64 || []).map((b: string) => Buffer.from(b, 'base64')),
              createdAt: data.createdAt || Date.now(),
              lastActive: data.lastActive || Date.now()
            };
            this.sessions.set(String(session.chatId), session);
          }
        }
      }
      console.log(`[Sessions] Loaded ${this.sessions.size} persisted user sessions from disk.`);
    } catch (e) {
      console.error('[Sessions] Error loading persisted sessions:', e);
    }
  }

  private persistSession(session: UserSession) {
    try {
      const filePath = this.getSessionFilePath(String(session.chatId));
      const data = {
        chatId: session.chatId,
        language: session.language,
        settings: session.settings,
        frontsBase64: session.fronts.map(b => b.toString('base64')),
        backsBase64: session.backs.map(b => b.toString('base64')),
        createdAt: session.createdAt,
        lastActive: session.lastActive
      };
      fs.writeFileSync(filePath, JSON.stringify(data));
    } catch (e) {
      console.error('[Sessions] Error persisting session:', e);
    }
  }

  public getConfig(): TelegramConfig {
    return {
      token: this.token,
      defaultChatId: this.defaultChatId,
      isRunning: this.isPolling || this.isWebhook,
      isWebhook: this.isWebhook,
      webhookUrl: this.currentWebhookUrl
    };
  }

  public async setWebhook(webhookUrl: string): Promise<{ ok: boolean; result?: any; error?: string }> {
    try {
      this.stopPolling();
      const res = await this.callApi('setWebhook', { url: webhookUrl });
      this.isWebhook = true;
      this.currentWebhookUrl = webhookUrl;
      this.addLog('success', 'Bot', 'Webhook Activated', `Registered Telegram Webhook at: ${webhookUrl}`);
      return { ok: true, result: res };
    } catch (err: any) {
      this.addLog('error', 'Bot', 'Webhook Activation Failed', err.message);
      return { ok: false, error: err.message };
    }
  }

  public async deleteWebhook(): Promise<{ ok: boolean; result?: any; error?: string }> {
    try {
      const res = await this.callApi('deleteWebhook');
      this.isWebhook = false;
      this.currentWebhookUrl = '';
      this.addLog('info', 'Bot', 'Webhook Removed', 'Telegram Webhook disabled. Ready for long polling.');
      return { ok: true, result: res };
    } catch (err: any) {
      this.addLog('error', 'Bot', 'Webhook Removal Failed', err.message);
      return { ok: false, error: err.message };
    }
  }

  public async getWebhookInfo(): Promise<any> {
    try {
      return await this.callApi('getWebhookInfo');
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  }

  public getBotInfo() {
    return this.botInfo;
  }

  public getLogs(): BotActivityLog[] {
    return this.logs.slice(-100);
  }

  public getSession(chatId: string | number): UserSession {
    const id = String(chatId);
    let session = this.sessions.get(id);
    if (!session) {
      session = {
        chatId: id,
        language: 'am',
        settings: { ...DEFAULT_LAYOUT_SETTINGS },
        fronts: [],
        backs: [],
        createdAt: Date.now(),
        lastActive: Date.now()
      };
      this.sessions.set(id, session);
      this.persistSession(session);
    }
    session.lastActive = Date.now();
    return session;
  }

  public updateSessionSettings(chatId: string | number, settingsPartial: Partial<LayoutSettings>): UserSession {
    const session = this.getSession(chatId);
    session.settings = { ...session.settings, ...settingsPartial };
    this.persistSession(session);
    this.addLog('info', 'System', 'Session Settings Updated', `Chat: ${chatId}, Format: ${session.settings.format}`);
    return session;
  }

  public updateConfig(newToken?: string, newChatId?: string) {
    if (newToken && newToken !== this.token) {
      this.token = newToken.trim();
      this.botInfo = null;
      if (this.isPolling) {
        this.stopPolling();
        this.startPolling();
      }
    }
    if (newChatId) {
      this.defaultChatId = newChatId.trim();
    }
    this.addLog('info', 'System', 'Config Updated', `Token: ${this.token.slice(0, 10)}..., Chat ID: ${this.defaultChatId}`);
  }

  public addLog(type: 'info' | 'success' | 'warning' | 'error', user: string, action: string, details: string, chatId = '') {
    const log: BotActivityLog = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toLocaleTimeString(),
      chatId: chatId || this.defaultChatId,
      user,
      action,
      details,
      type
    };
    this.logs.unshift(log);
    if (this.logs.length > 200) {
      this.logs.pop();
    }
    console.log(`[Bot ${type.toUpperCase()}] ${action}: ${details}`);
  }

  public async callApi(method: string, body?: any): Promise<any> {
    const url = `https://api.telegram.org/bot${this.token}/${method}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    });
    const data = await res.json();
    if (!data.ok) {
      throw new Error(data.description || `Telegram API error on ${method}`);
    }
    return data.result;
  }

  public async testConnection(): Promise<{ ok: boolean; info?: any; error?: string }> {
    try {
      const info = await this.callApi('getMe');
      this.botInfo = info;
      return { ok: true, info };
    } catch (err: any) {
      return { ok: false, error: err.message || 'Failed to reach Telegram API' };
    }
  }

  public async startPolling() {
    if (this.isPolling) return;
    this.isPolling = true;
    this.pollingAbortController = new AbortController();

    try {
      const info = await this.callApi('getMe');
      this.botInfo = info;
      this.addLog('success', 'Bot', 'Connected', `Bot started as @${info.username} (${info.first_name})`);
    } catch (err: any) {
      this.addLog('error', 'Bot', 'Connection Error', err.message);
    }

    this.pollLoop();
  }

  public stopPolling() {
    this.isPolling = false;
    if (this.pollingAbortController) {
      this.pollingAbortController.abort();
      this.pollingAbortController = null;
    }
    this.addLog('info', 'Bot', 'Stopped', 'Telegram bot polling paused.');
  }

  private async pollLoop() {
    let offset = 0;
    while (this.isPolling) {
      try {
        const url = `https://api.telegram.org/bot${this.token}/getUpdates?offset=${offset}&timeout=25`;
        const res = await fetch(url, { signal: this.pollingAbortController?.signal });
        if (!res.ok) {
          await new Promise((r) => setTimeout(r, 2000));
          continue;
        }
        const data = await res.json();
        if (data.ok && Array.isArray(data.result)) {
          for (const update of data.result) {
            offset = update.update_id + 1;
            // Process immediately without blocking next iteration
            this.handleUpdate(update).catch((err) => {
              this.addLog('error', 'UpdateHandler', 'Error processing update', err.message);
            });
          }
        }
      } catch (err: any) {
        if (!this.isPolling) break;
        await new Promise((r) => setTimeout(r, 2500));
      }
    }
  }

  private getReplyKeyboard(lang: 'am' | 'en') {
    return {
      keyboard: [
        [{ text: '🚀 Start' }, { text: '📋 Status' }],
        [{ text: '⚙️ Settings' }, { text: '⏭️ Next ID' }],
        [{ text: '🔄 Reset' }, { text: '📄 Print' }],
        [{ text: '🌐 Language' }]
      ],
      resize_keyboard: true,
      persistent: true
    };
  }

  private getSettingsText(settings: LayoutSettings, lang: 'am' | 'en'): string {
    const isAm = lang === 'am';
    const q = settings.quality || 78;
    const qLabel = q <= 72 ? 'Super Light (~170 KB)' : q <= 78 ? 'Light (~210 KB)' : q <= 85 ? 'Standard (~260 KB)' : 'Maximum (~350 KB)';
    return `⚙️ Layout Settings (Auto-Saved)

📍 Mode: ${settings.mode}
📐 Size: ${settings.widthCm} x ${settings.heightCm} cm
↔️ Gap (Sides): ${settings.sideGapPx === 0 ? 'None (0px)' : settings.sideGapPx === 54 ? 'small (54px)' : `${settings.sideGapPx}px`}
↕️ Gap (Down): Level ${settings.downGapLevel} (${settings.downGapPx}px)
⬆️ Margin Top: ${settings.topMarginPx}px
📄 Format: ${settings.format}
📦 PDF Quality: ${q}% [${qLabel}]
${isAm ? '\n💡 ለማስተካከል ከታች ያሉትን ቁልፎች ይጠቀሙ:' : ''}`;
  }

  private getSettingsInlineKeyboard(settings: LayoutSettings) {
    const q = settings.quality || 78;
    const formatBtnLabel = settings.format === 'JPG' ? '🖼️ Format: JPG (Active)' : '📄 Format: PDF (Active)';
    return {
      inline_keyboard: [
        [{ text: `Mode: ✅ ${settings.mode === 'DEFAULT' ? 'Default' : settings.mode}`, callback_data: 'cfg:toggle_mode' }],
        [
          { text: '📐 Set Size (W * H)', callback_data: 'cfg:cycle_size' },
          { text: `↕️ Down Gap (${settings.downGapLevel}-4)`, callback_data: 'cfg:cycle_down_gap' }
        ],
        [
          { text: `↔️ Side Gap (${settings.sideGapPx}px)`, callback_data: 'cfg:cycle_side_gap' },
          { text: `⬆️ Top Margin (${settings.topMarginPx}px)`, callback_data: 'cfg:cycle_top_margin' }
        ],
        [
          { text: formatBtnLabel, callback_data: 'cfg:toggle_format' },
          { text: `📦 Quality: ${q}%`, callback_data: 'cfg:cycle_quality' }
        ],
        [
          { text: '📄 Set PDF', callback_data: 'cfg:set_pdf' },
          { text: '🖼️ Set JPG', callback_data: 'cfg:set_jpg' }
        ],
        [
          { text: '💾 Save Settings', callback_data: 'cfg:save' },
          { text: '❌ Close', callback_data: 'cfg:close' }
        ]
      ]
    };
  }

  public async handleUpdate(update: any) {
    if (update.message) {
      await this.handleMessage(update.message);
    } else if (update.callback_query) {
      await this.handleCallbackQuery(update.callback_query);
    }
  }

  private async handleMessage(msg: any) {
    const chatId = String(msg.chat.id);
    const text = (msg.text || '').trim();
    const user = msg.from?.username ? `@${msg.from.username}` : (msg.from?.first_name || 'User');
    const session = this.getSession(chatId);

    // Photos
    if (msg.photo && msg.photo.length > 0) {
      await this.handlePhotoUpload(chatId, user, msg.photo, session);
      return;
    }

    // Documents (uncompressed photos)
    if (msg.document && msg.document.mime_type && msg.document.mime_type.startsWith('image/')) {
      await this.handleDocumentPhotoUpload(chatId, user, msg.document, session);
      return;
    }

    this.addLog('info', user, 'Message Received', text, chatId);

    if (text === '/start' || text === '🚀 Start') {
      const welcome = session.language === 'am'
        ? `👋 ሰላም ${user}! ወደ orderbot እንኳን ደህና መጡ!

📸 እባክዎ የመታወቂያውን የፊት ገጽ (FRONT) ፎቶ ይላኩ።
ሁለተኛው ፎቶ ደግሞ የጀርባ ገጽ (BACK) ይሆናል::

በጣም ፈጣን (High-Speed 300 DPI) ፕሮሰሰር ዝግጁ ነው! ፎቶዎን ይላኩ።`
        : `👋 Hello ${user}! Welcome to orderbot.

📸 Please send the FRONT photo of the ID card.
Then send the BACK photo.

High-speed 300 DPI print generator is ready!`;

      await this.callApi('sendMessage', {
        chat_id: chatId,
        text: welcome,
        reply_markup: this.getReplyKeyboard(session.language)
      });
      return;
    }

    if (text === '/settings' || text === '⚙️ Settings') {
      await this.callApi('sendMessage', {
        chat_id: chatId,
        text: this.getSettingsText(session.settings, session.language),
        reply_markup: this.getSettingsInlineKeyboard(session.settings)
      });
      return;
    }

    if (text === '/status' || text === '📋 Status') {
      const fCount = session.fronts.length;
      const bCount = session.backs.length;
      const msgStatus = session.language === 'am'
        ? `📋 የወቅቱ ሁኔታ (Status):
• የተላከ የፊት ገጽ (Front): ${fCount}
• የተላከ የጀርባ ገጽ (Back): ${bCount}
• የተሟላ መታወቂያ (Ready IDs): ${Math.min(fCount, bCount)}
• Format: ${session.settings.format}

${fCount > bCount ? '⚠️ የጀርባ ገጽ (Back) ፎቶ ይጠበቃል!' : fCount === bCount && fCount > 0 ? `✅ ለማተም ዝግጁ ነው! /print (${session.settings.format}) ወይም 📄 Print ይጫኑ::` : '📸 እባክዎ የመታወቂያ ፎቶ ይላኩ::'}`
        : `📋 Current Status:
• Front photos: ${fCount}
• Back photos: ${bCount}
• Complete IDs: ${Math.min(fCount, bCount)}
• Format: ${session.settings.format}

${fCount > bCount ? '⚠️ Waiting for BACK photo!' : fCount === bCount && fCount > 0 ? `✅ Ready to print! Tap /print (${session.settings.format}) or 📄 Print.` : '📸 Please send ID photo.'}`;

      await this.callApi('sendMessage', {
        chat_id: chatId,
        text: msgStatus,
        reply_markup: this.getReplyKeyboard(session.language)
      });
      return;
    }

    if (text === '/reset' || text === '🔄 Reset') {
      session.fronts = [];
      session.backs = [];
      this.persistSession(session);
      await this.callApi('sendMessage', {
        chat_id: chatId,
        text: '✅ Reset done. Your data cleared.\n\nSend new images to start over!',
        reply_markup: this.getReplyKeyboard(session.language)
      });
      return;
    }

    if (text === '/next' || text === '⏭️ Next ID') {
      const nextMsg = session.language === 'am'
        ? `⏭️ ቀጣይ መታወቂያ (#${session.fronts.length + 1}) Front ፎቶ ይላኩ::`
        : `⏭️ Ready for Next ID (#${session.fronts.length + 1}). Send FRONT photo.`;
      await this.callApi('sendMessage', {
        chat_id: chatId,
        text: nextMsg,
        reply_markup: this.getReplyKeyboard(session.language)
      });
      return;
    }

    if (text === '🌐 Language') {
      session.language = session.language === 'am' ? 'en' : 'am';
      this.persistSession(session);
      const langNotice = session.language === 'am'
        ? '🌐 ቋንቋ ወደ አማርኛ ተቀይሯል!'
        : '🌐 Language switched to English!';
      await this.callApi('sendMessage', {
        chat_id: chatId,
        text: langNotice,
        reply_markup: this.getReplyKeyboard(session.language)
      });
      return;
    }

    if (text === '/pdf') {
      session.settings.format = 'PDF';
      this.persistSession(session);
      await this.callApi('sendMessage', {
        chat_id: chatId,
        text: session.language === 'am' ? '📄 Format ወደ PDF ተቀይሯል!' : '📄 Format set to PDF!'
      });
      await this.promptOrientation(chatId, session);
      return;
    }

    if (text === '/jpg') {
      session.settings.format = 'JPG';
      this.persistSession(session);
      await this.callApi('sendMessage', {
        chat_id: chatId,
        text: session.language === 'am' ? '🖼️ Format ወደ JPG ተቀይሯል!' : '🖼️ Format set to JPG!'
      });
      await this.promptOrientation(chatId, session);
      return;
    }

    if (text === '/print' || text === '📄 Print') {
      await this.promptOrientation(chatId, session);
      return;
    }

    // Default response
    const defaultMsg = session.language === 'am'
      ? '📸 እባክዎ የመታወቂያውን የፊት (FRONT) ወይም የጀርባ (BACK) ፎቶ ይላኩ፣ ወይም ⚙️ Settings በመጫን ያስተካክሉ።'
      : '📸 Please send ID FRONT or BACK photo, or tap ⚙️ Settings to customize.';
    await this.callApi('sendMessage', {
      chat_id: chatId,
      text: defaultMsg,
      reply_markup: this.getReplyKeyboard(session.language)
    });
  }

  private async handlePhotoUpload(chatId: string, user: string, photos: any[], session: UserSession) {
    const bestPhoto = photos[photos.length - 1];
    const fileId = bestPhoto.file_id;
    const buffer = await this.downloadTelegramFile(fileId);

    // Automatically detect whether the image is FRONT or BACK
    const detectedSide = await detectCardSide(buffer);
    const isFront = detectedSide === 'front';

    if (isFront) {
      session.fronts.push(buffer);
    } else {
      session.backs.push(buffer);
    }

    this.persistSession(session);

    const newF = session.fronts.length;
    const newB = session.backs.length;

    if (isFront) {
      this.addLog('success', user, 'Photo Received', `Front #${newF} detected & stored`, chatId);
      const text = `✅ Front (${newF}/${newF})\n\nNo. FRONT #${newF}. Total: ${newF} fronts, ${newB} backs.\nFormat: ${session.settings.format}\nPress /print or /pdf or /jpg to generate output.`;
      await this.callApi('sendMessage', {
        chat_id: chatId,
        text,
        reply_markup: this.getReplyKeyboard(session.language)
      });
    } else {
      this.addLog('success', user, 'Photo Received', `Back #${newB} detected & stored`, chatId);
      const text = `✅ Back (${newB}/${newB})\n\nNo. BACK #${newB}. Total: ${newF} fronts, ${newB} backs.\nFormat: ${session.settings.format}\nPress /print or /pdf or /jpg to generate output.`;
      await this.callApi('sendMessage', {
        chat_id: chatId,
        text,
        reply_markup: this.getReplyKeyboard(session.language)
      });
    }
  }

  private async handleDocumentPhotoUpload(chatId: string, user: string, doc: any, session: UserSession) {
    const buffer = await this.downloadTelegramFile(doc.file_id);

    // Automatically detect whether the document image is FRONT or BACK
    const detectedSide = await detectCardSide(buffer);
    const isFront = detectedSide === 'front';

    if (isFront) {
      session.fronts.push(buffer);
    } else {
      session.backs.push(buffer);
    }

    this.persistSession(session);

    const newF = session.fronts.length;
    const newB = session.backs.length;

    if (isFront) {
      this.addLog('success', user, 'Document Photo Received', `Front #${newF} detected & stored`, chatId);
      await this.callApi('sendMessage', {
        chat_id: chatId,
        text: `✅ Front (${newF}/${newF})\n\nNo. FRONT #${newF}. Total: ${newF} fronts, ${newB} backs.\nFormat: ${session.settings.format}\nPress /print or /pdf or /jpg to generate output.`,
        reply_markup: this.getReplyKeyboard(session.language)
      });
    } else {
      this.addLog('success', user, 'Document Photo Received', `Back #${newB} detected & stored`, chatId);
      await this.callApi('sendMessage', {
        chat_id: chatId,
        text: `✅ Back (${newB}/${newB})\n\nNo. BACK #${newB}. Total: ${newF} fronts, ${newB} backs.\nFormat: ${session.settings.format}\nPress /print or /pdf or /jpg to generate output.`,
        reply_markup: this.getReplyKeyboard(session.language)
      });
    }
  }

  private async promptOrientation(chatId: string, session: UserSession) {
    const count = Math.min(session.fronts.length, session.backs.length);
    if (count === 0) {
      const msg = session.language === 'am'
        ? `⚠️ እባክዎ መጀመሪያ ቢያንስ አንድ የፊት (FRONT) እና የጀርባ (BACK) ፎቶ ይላኩ!
ወይም በናሙና መታወቂያ መሞከር ይችላሉ:`
        : `⚠️ Please send at least one FRONT and one BACK photo first!
Or test using sample ID:`;

      const sampleButtons = {
        inline_keyboard: [
          [{ text: '🚀 በናሙና መታወቂያ ሞክር (Try Sample ID)', callback_data: 'orient:sample_normal' }]
        ]
      };
      await this.callApi('sendMessage', { chat_id: chatId, text: msg, reply_markup: sampleButtons });
      return;
    }

    const promptText = `📋 Ready to generate high-quality ${session.settings.format} with ${count} ID(s).

Choose orientation:
Normal = front left, back right
Reverse = back left, front right
Flip + Reverse = mirror images + swap sides`;

    const inlineKeyboard = {
      inline_keyboard: [
        [
          { text: '📄 Normal', callback_data: 'orient:normal' },
          { text: 'Reverse', callback_data: 'orient:reverse' }
        ],
        [
          { text: '🔄 Flip + Reverse', callback_data: 'orient:flip_reverse' }
        ]
      ]
    };

    await this.callApi('sendMessage', {
      chat_id: chatId,
      text: promptText,
      reply_markup: inlineKeyboard
    });
  }

  private async handleCallbackQuery(cb: any) {
    const chatId = String(cb.message?.chat?.id);
    const messageId = cb.message?.message_id;
    const data = cb.data as string;
    const session = this.getSession(chatId);

    try {
      await this.callApi('answerCallbackQuery', { callback_query_id: cb.id });
    } catch (e) {
      // ignore
    }

    if (data.startsWith('cfg:')) {
      await this.handleConfigCallback(chatId, messageId, data, session, cb.id);
      return;
    }

    if (data.startsWith('orient:')) {
      const mode = data.replace('orient:', '');
      if (mode === 'sample_normal') {
        await this.renderAndSendSample(chatId, 'normal', session);
      } else {
        await this.renderAndSendResult(chatId, mode as OrientationMode, session);
      }
      return;
    }

    if (data === 'action:reset') {
      session.fronts = [];
      session.backs = [];
      this.persistSession(session);
      await this.callApi('sendMessage', {
        chat_id: chatId,
        text: '✅ Reset done. Your data cleared.\n\nSend new images to start over!',
        reply_markup: this.getReplyKeyboard(session.language)
      });
    }
  }

  private async handleConfigCallback(chatId: string, messageId: number, data: string, session: UserSession, callbackQueryId?: string) {
    const s = session.settings;

    if (data === 'cfg:toggle_mode') {
      const modes: Array<'DEFAULT' | 'PVC' | 'PAPER' | 'CUSTOM'> = ['DEFAULT', 'PVC', 'PAPER', 'CUSTOM'];
      const nextIdx = (modes.indexOf(s.mode) + 1) % modes.length;
      s.mode = modes[nextIdx];
      if (s.mode === 'PVC') {
        s.widthCm = 8.56;
        s.heightCm = 5.398;
      } else if (s.mode === 'DEFAULT') {
        s.widthCm = 8.95;
        s.heightCm = 5.70;
      }
    } else if (data === 'cfg:cycle_size') {
      const sizes = [
        { w: 8.95, h: 5.70 },
        { w: 8.50, h: 5.40 },
        { w: 8.60, h: 5.40 },
        { w: 9.00, h: 6.00 }
      ];
      const curIdx = sizes.findIndex((x) => x.w === s.widthCm && x.h === s.heightCm);
      const next = sizes[(curIdx + 1) % sizes.length];
      s.widthCm = next.w;
      s.heightCm = next.h;
    } else if (data === 'cfg:cycle_down_gap') {
      s.downGapLevel = (s.downGapLevel % 4) + 1;
      s.downGapPx = GAP_LEVELS[s.downGapLevel] ?? 27;
    } else if (data === 'cfg:cycle_side_gap') {
      const sideGaps = [0, 24, 40, 54, 80];
      const curIdx = sideGaps.indexOf(s.sideGapPx);
      s.sideGapPx = sideGaps[(curIdx + 1) % sideGaps.length];
    } else if (data === 'cfg:cycle_top_margin') {
      const margins = [0, 15, 30, 45];
      const curIdx = margins.indexOf(s.topMarginPx);
      s.topMarginPx = margins[(curIdx + 1) % margins.length];
    } else if (data === 'cfg:toggle_format') {
      s.format = s.format === 'JPG' ? 'PDF' : 'JPG';
    } else if (data === 'cfg:set_pdf') {
      s.format = 'PDF';
    } else if (data === 'cfg:set_jpg') {
      s.format = 'JPG';
    } else if (data === 'cfg:cycle_quality') {
      const qLevels = [72, 78, 85, 90];
      const curQ = s.quality || 78;
      const curIdx = qLevels.indexOf(curQ);
      s.quality = qLevels[(curIdx + 1) % qLevels.length];
    } else if (data === 'cfg:save') {
      this.persistSession(session);
      await this.callApi('sendMessage', {
        chat_id: chatId,
        text: `💾 Settings saved successfully!\nSize: ${s.widthCm}x${s.heightCm}cm | Format: ${s.format}`
      });
      return;
    } else if (data === 'cfg:close') {
      try {
        await this.callApi('deleteMessage', { chat_id: chatId, message_id: messageId });
      } catch (e) {
        // ignore
      }
      return;
    }

    this.persistSession(session);

    try {
      await this.callApi('editMessageText', {
        chat_id: chatId,
        message_id: messageId,
        text: this.getSettingsText(s, session.language),
        reply_markup: this.getSettingsInlineKeyboard(s)
      });
    } catch (e) {
      // ignore
    }
  }

  public async renderAndSendResult(chatId: string, orientation: OrientationMode, session: UserSession) {
    const count = Math.min(session.fronts.length, session.backs.length);
    if (count === 0) {
      // If no cards uploaded, offer sample fallback
      await this.promptOrientation(chatId, session);
      return;
    }

    try {
      // Send immediate feedback
      await this.callApi('sendChatAction', { chat_id: chatId, action: 'upload_document' });

      this.addLog('info', 'Bot', 'Generating Output', `High-speed Sharp rendering: ${orientation}, Count: ${count}`, chatId);

      const t0 = Date.now();
      const result = await processBatchCards({
        fronts: session.fronts.slice(0, count),
        backs: session.backs.slice(0, count),
        orientation,
        settings: session.settings
      });
      const elapsed = Date.now() - t0;

      // 1. Send the clean standalone document (JPG or PDF) with NO CAPTION
      // This allows forwarding the file directly to clients or print shops cleanly!
      await this.sendTelegramDocument(chatId, result.buffer, result.filename);

      // 2. Send the confirmation status and reset button as a separate message underneath
      const infoText = `✅ High-quality ${session.settings.format} generated with ${count} ID(s) (${orientation})\n300 DPI - Ready for printing`;
      await this.callApi('sendMessage', {
        chat_id: chatId,
        text: infoText,
        reply_markup: {
          inline_keyboard: [[{ text: '🔄 Reset & Start Over', callback_data: 'action:reset' }]]
        }
      });

      // 3. Automatically clean/clear the session so subsequent uploads start fresh from ID #1
      session.fronts = [];
      session.backs = [];
      this.persistSession(session);

      this.addLog('success', 'Bot', 'Delivered Output', `Sent ${result.filename} (${Math.round(result.buffer.length / 1024)} KB) in ${elapsed}ms. Auto-cleared session for next ID.`, chatId);
    } catch (err: any) {
      this.addLog('error', 'Bot', 'Render Failed', err.message, chatId);
      await this.callApi('sendMessage', {
        chat_id: chatId,
        text: `❌ Error generating output: ${err.message}`
      });
    }
  }

  public async renderAndSendSample(chatId: string, orientation: OrientationMode, session: UserSession) {
    try {
      await this.callApi('sendChatAction', { chat_id: chatId, action: 'upload_document' });

      const sampleFrontPath = path.join(__dirname, '../public/assets/aistudio/sample_front.jpg');
      const sampleBackPath = path.join(__dirname, '../public/assets/aistudio/sample_back.jpg');

      const frontBuf = fs.readFileSync(sampleFrontPath);
      const backBuf = fs.readFileSync(sampleBackPath);

      const t0 = Date.now();
      const result = await processCardPair({
        frontBuffer: frontBuf,
        backBuffer: backBuf,
        orientation,
        settings: session.settings
      });
      const elapsed = Date.now() - t0;

      // Send document with NO CAPTION
      await this.sendTelegramDocument(chatId, result.buffer, result.filename);

      // Send confirmation status as a separate message
      const infoText = `✅ High-quality ${session.settings.format} generated with 1 Sample ID (${orientation})\n300 DPI - Ready for printing`;
      await this.callApi('sendMessage', {
        chat_id: chatId,
        text: infoText,
        reply_markup: {
          inline_keyboard: [[{ text: '🔄 Reset & Start Over', callback_data: 'action:reset' }]]
        }
      });

      // Automatically clean session
      session.fronts = [];
      session.backs = [];
      this.persistSession(session);

      this.addLog('success', 'Bot', 'Delivered Sample', `Sent sample output in ${elapsed}ms`, chatId);
    } catch (err: any) {
      await this.callApi('sendMessage', { chat_id: chatId, text: `❌ ${err.message}` });
    }
  }

  public async sendTelegramDocument(chatId: string | number, buffer: Buffer, filename: string, caption?: string, replyMarkup?: any) {
    const formData = new FormData();
    formData.append('chat_id', String(chatId));
    formData.append('document', new Blob([new Uint8Array(buffer)]), filename);
    if (caption) {
      formData.append('caption', caption);
    }
    if (replyMarkup) {
      formData.append('reply_markup', JSON.stringify(replyMarkup));
    }

    const res = await fetch(`https://api.telegram.org/bot${this.token}/sendDocument`, {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    if (!data.ok) {
      throw new Error(data.description || 'Failed to send document to Telegram');
    }
    return data.result;
  }

  public async downloadTelegramFile(fileId: string): Promise<Buffer> {
    const fileInfo = await this.callApi('getFile', { file_id: fileId });
    if (!fileInfo.file_path) {
      throw new Error('No file_path returned by Telegram');
    }
    const downloadUrl = `https://api.telegram.org/file/bot${this.token}/${fileInfo.file_path}`;
    const res = await fetch(downloadUrl);
    if (!res.ok) {
      throw new Error(`Failed to download file from Telegram: ${res.statusText}`);
    }
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  public async sendTestMessage(targetChatId?: string): Promise<{ ok: boolean; result?: any; error?: string }> {
    const cid = targetChatId || this.defaultChatId;
    try {
      const res = await this.callApi('sendMessage', {
        chat_id: cid,
        text: `⚡️ Ethiopian ID Card Order Bot connected!\nHigh-Speed 300 DPI Engine Active.\nBot: @${this.botInfo?.username || 'order_bot'}`,
        reply_markup: this.getReplyKeyboard('am')
      });
      this.addLog('success', 'Admin', 'Test Message Sent', `Delivered to chat ${cid}`, cid);
      return { ok: true, result: res };
    } catch (err: any) {
      this.addLog('error', 'Admin', 'Test Message Failed', err.message, cid);
      return { ok: false, error: err.message };
    }
  }
}
