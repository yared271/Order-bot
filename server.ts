import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import multer from 'multer';
import dotenv from 'dotenv';
import { TelegramBotManager } from './server/telegramService.js';
import { processCardPair, DEFAULT_LAYOUT_SETTINGS } from './server/imageProcessor.js';
import { LayoutSettings, OrientationMode } from './server/types.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024 } // 30MB
});

// Default credentials provided by user
const INITIAL_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8989577960:AAHBa8zimKDgVigqKg0HAjbA77MjUqMDz1c';
const INITIAL_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '6689699811';

const botManager = new TelegramBotManager(INITIAL_TOKEN, INITIAL_CHAT_ID);

// Start bot polling immediately
botManager.startPolling().catch((err) => {
  console.error('Failed to start Telegram Bot polling:', err);
});

// ----------------- API Endpoints -----------------

// Health check endpoint for Cloud Run & keep-alive pinging
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    service: 'Telegram ID Print Studio',
    botRunning: botManager.getConfig().isRunning
  });
});

// Telegram Webhook endpoint (Cloud Run instant trigger)
app.post('/api/telegram-webhook', async (req, res) => {
  try {
    const update = req.body;
    if (update) {
      // Process update asynchronously so Telegram gets fast 200 OK
      botManager.handleUpdate(update).catch((err) => {
        console.error('Webhook update handling error:', err);
      });
    }
    res.json({ ok: true });
  } catch (err: any) {
    console.error('Webhook error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Webhook management API
app.post('/api/bot/webhook', async (req, res) => {
  try {
    const { action, url } = req.body;
    if (action === 'set') {
      if (!url) return res.status(400).json({ ok: false, error: 'Webhook URL is required' });
      const targetUrl = url.endsWith('/api/telegram-webhook') ? url : `${url.replace(/\/$/, '')}/api/telegram-webhook`;
      const result = await botManager.setWebhook(targetUrl);
      return res.json(result);
    } else if (action === 'delete') {
      const result = await botManager.deleteWebhook();
      return res.json(result);
    } else if (action === 'info') {
      const info = await botManager.getWebhookInfo();
      return res.json({ ok: true, info });
    }
    res.status(400).json({ ok: false, error: 'Invalid action. Use set, delete, or info.' });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Status and bot information
app.get('/api/bot/status', async (req, res) => {
  try {
    const config = botManager.getConfig();
    let botInfo = botManager.getBotInfo();
    if (!botInfo) {
      const conn = await botManager.testConnection();
      botInfo = conn.info;
    }
    res.json({
      ok: true,
      botInfo,
      config: {
        token: config.token,
        defaultChatId: config.defaultChatId,
        isRunning: config.isRunning,
        isWebhook: config.isWebhook,
        webhookUrl: config.webhookUrl
      },
      stats: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Update bot credentials
app.post('/api/bot/config', (req, res) => {
  try {
    const { token, defaultChatId } = req.body;
    botManager.updateConfig(token, defaultChatId);
    res.json({ ok: true, config: botManager.getConfig() });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Toggle polling
app.post('/api/bot/toggle-polling', async (req, res) => {
  try {
    const config = botManager.getConfig();
    if (config.isWebhook) {
      await botManager.deleteWebhook();
    }
    if (config.isRunning && !config.isWebhook) {
      botManager.stopPolling();
    } else {
      await botManager.startPolling();
    }
    res.json({ ok: true, isRunning: botManager.getConfig().isRunning });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Get logs
app.get('/api/bot/logs', (req, res) => {
  res.json({ ok: true, logs: botManager.getLogs() });
});

// Send test message to Telegram chat
app.post('/api/bot/send-test', async (req, res) => {
  try {
    const { chatId } = req.body;
    const result = await botManager.sendTestMessage(chatId);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Render layout from uploaded files or base64
app.post(
  '/api/render-layout',
  upload.fields([
    { name: 'front', maxCount: 1 },
    { name: 'back', maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      let frontBuffer: Buffer | null = null;
      let backBuffer: Buffer | null = null;

      const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;

      if (files?.front?.[0]?.buffer) {
        frontBuffer = files.front[0].buffer;
      }
      if (files?.back?.[0]?.buffer) {
        backBuffer = files.back[0].buffer;
      }

      // Check if base64 provided in body
      if (!frontBuffer && req.body.frontBase64) {
        const cleanB64 = req.body.frontBase64.replace(/^data:image\/\w+;base64,/, '');
        frontBuffer = Buffer.from(cleanB64, 'base64');
      }
      if (!backBuffer && req.body.backBase64) {
        const cleanB64 = req.body.backBase64.replace(/^data:image\/\w+;base64,/, '');
        backBuffer = Buffer.from(cleanB64, 'base64');
      }

      // Fallback to sample images if requested
      if ((!frontBuffer || !backBuffer) && req.body.useSample === 'true') {
        const sampleFrontPath = path.join(__dirname, 'public/assets/aistudio/sample_front.jpg');
        const sampleBackPath = path.join(__dirname, 'public/assets/aistudio/sample_back.jpg');
        if (fs.existsSync(sampleFrontPath) && fs.existsSync(sampleBackPath)) {
          frontBuffer = fs.readFileSync(sampleFrontPath);
          backBuffer = fs.readFileSync(sampleBackPath);
        }
      }

      if (!frontBuffer || !backBuffer) {
        return res.status(400).json({ ok: false, error: 'Both front and back images are required.' });
      }

      const orientation: OrientationMode = req.body.orientation || 'normal';
      const settings: LayoutSettings = {
        mode: req.body.mode || 'DEFAULT',
        widthCm: req.body.widthCm ? parseFloat(req.body.widthCm) : DEFAULT_LAYOUT_SETTINGS.widthCm,
        heightCm: req.body.heightCm ? parseFloat(req.body.heightCm) : DEFAULT_LAYOUT_SETTINGS.heightCm,
        sideGapPx: req.body.sideGapPx ? parseInt(req.body.sideGapPx, 10) : DEFAULT_LAYOUT_SETTINGS.sideGapPx,
        downGapPx: req.body.downGapPx ? parseInt(req.body.downGapPx, 10) : DEFAULT_LAYOUT_SETTINGS.downGapPx,
        downGapLevel: req.body.downGapLevel ? parseInt(req.body.downGapLevel, 10) : DEFAULT_LAYOUT_SETTINGS.downGapLevel,
        topMarginPx: req.body.topMarginPx ? parseInt(req.body.topMarginPx, 10) : DEFAULT_LAYOUT_SETTINGS.topMarginPx,
        sideMarginPx: req.body.sideMarginPx ? parseInt(req.body.sideMarginPx, 10) : DEFAULT_LAYOUT_SETTINGS.sideMarginPx,
        format: req.body.format === 'PDF' ? 'PDF' : 'JPG',
        dpi: req.body.dpi ? parseInt(req.body.dpi, 10) : 300,
        quality: req.body.quality ? parseInt(req.body.quality, 10) : (DEFAULT_LAYOUT_SETTINGS.quality || 78)
      };

      const result = await processCardPair({
        frontBuffer,
        backBuffer,
        orientation,
        settings
      });

      // If json requested
      if (req.body.returnJson === 'true' || req.query.returnJson === 'true') {
        const base64 = `data:${result.mime};base64,${result.buffer.toString('base64')}`;
        return res.json({
          ok: true,
          mime: result.mime,
          filename: result.filename,
          sizeKb: Math.round(result.buffer.length / 1024),
          dataUrl: base64
        });
      }

      // Stream file directly
      res.setHeader('Content-Type', result.mime);
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      res.send(result.buffer);
    } catch (err: any) {
      console.error('Error rendering layout:', err);
      res.status(500).json({ ok: false, error: err.message });
    }
  }
);

// Dispatch layout directly to Telegram chat
app.post(
  '/api/bot/dispatch-to-telegram',
  upload.fields([
    { name: 'front', maxCount: 1 },
    { name: 'back', maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      const targetChatId = req.body.chatId || INITIAL_CHAT_ID;
      const orientation: OrientationMode = req.body.orientation || 'normal';

      let frontBuffer: Buffer | null = null;
      let backBuffer: Buffer | null = null;

      const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
      if (files?.front?.[0]?.buffer) frontBuffer = files.front[0].buffer;
      if (files?.back?.[0]?.buffer) backBuffer = files.back[0].buffer;

      if (!frontBuffer && req.body.frontBase64) {
        frontBuffer = Buffer.from(req.body.frontBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
      }
      if (!backBuffer && req.body.backBase64) {
        backBuffer = Buffer.from(req.body.backBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
      }

      if ((!frontBuffer || !backBuffer) || req.body.useSample === 'true') {
        const sampleFrontPath = path.join(__dirname, 'public/assets/aistudio/sample_front.jpg');
        const sampleBackPath = path.join(__dirname, 'public/assets/aistudio/sample_back.jpg');
        if (fs.existsSync(sampleFrontPath) && fs.existsSync(sampleBackPath)) {
          frontBuffer = fs.readFileSync(sampleFrontPath);
          backBuffer = fs.readFileSync(sampleBackPath);
        }
      }

      if (!frontBuffer || !backBuffer) {
        return res.status(400).json({ ok: false, error: 'Both front and back images are required.' });
      }

      const settings: LayoutSettings = {
        mode: req.body.mode || 'DEFAULT',
        widthCm: req.body.widthCm ? parseFloat(req.body.widthCm) : DEFAULT_LAYOUT_SETTINGS.widthCm,
        heightCm: req.body.heightCm ? parseFloat(req.body.heightCm) : DEFAULT_LAYOUT_SETTINGS.heightCm,
        sideGapPx: req.body.sideGapPx ? parseInt(req.body.sideGapPx, 10) : DEFAULT_LAYOUT_SETTINGS.sideGapPx,
        downGapPx: req.body.downGapPx ? parseInt(req.body.downGapPx, 10) : DEFAULT_LAYOUT_SETTINGS.downGapPx,
        downGapLevel: req.body.downGapLevel ? parseInt(req.body.downGapLevel, 10) : DEFAULT_LAYOUT_SETTINGS.downGapLevel,
        topMarginPx: req.body.topMarginPx ? parseInt(req.body.topMarginPx, 10) : DEFAULT_LAYOUT_SETTINGS.topMarginPx,
        sideMarginPx: req.body.sideMarginPx ? parseInt(req.body.sideMarginPx, 10) : DEFAULT_LAYOUT_SETTINGS.sideMarginPx,
        format: req.body.format === 'PDF' ? 'PDF' : 'JPG',
        dpi: req.body.dpi ? parseInt(req.body.dpi, 10) : 300,
        quality: req.body.quality ? parseInt(req.body.quality, 10) : (DEFAULT_LAYOUT_SETTINGS.quality || 78)
      };

      const result = await processCardPair({
        frontBuffer,
        backBuffer,
        orientation,
        settings
      });

      // Send document without caption so it can be forwarded cleanly
      const telegramResponse = await botManager.sendTelegramDocument(
        targetChatId,
        result.buffer,
        result.filename
      );

      // Send the info caption as a separate message underneath
      await botManager.callApi('sendMessage', {
        chat_id: targetChatId,
        text: `✅ High-quality ${settings.format} generated with 1 ID(s) (${orientation})\n300 DPI - Ready for printing`,
        reply_markup: {
          inline_keyboard: [[{ text: '🔄 Reset & Start Over', callback_data: 'action:reset' }]]
        }
      });

      // Auto-clear session for next upload
      const session = botManager.getSession(targetChatId);
      session.fronts = [];
      session.backs = [];

      botManager.addLog(
        'success',
        'Web Studio',
        'Direct Dispatch',
        `Dispatched ${result.filename} (${orientation}) to Telegram chat ${targetChatId}`,
        targetChatId
      );

      res.json({
        ok: true,
        filename: result.filename,
        sizeKb: Math.round(result.buffer.length / 1024),
        telegramResponse
      });
    } catch (err: any) {
      console.error('Dispatch error:', err);
      res.status(500).json({ ok: false, error: err.message });
    }
  }
);

// Serve static assets and Vite middlewares
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist/index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Telegram ID Card Print Server running on http://0.0.0.0:${PORT}`);
    console.log(`🤖 Telegram Bot active: Token=${INITIAL_TOKEN.slice(0, 10)}... TargetChat=${INITIAL_CHAT_ID}`);
  });
}

startServer();
