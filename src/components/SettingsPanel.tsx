import React, { useState, useEffect } from 'react';
import {
  Sliders,
  Settings as SettingsIcon,
  Maximize2,
  MoveVertical,
  MoveHorizontal,
  FileCheck,
  Save,
  CheckCircle2,
  RotateCcw,
  Cloud,
  Zap,
  Globe,
  Copy,
  Check,
  Radio,
  Activity,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';
import { LayoutSettings, Language } from '../types.js';
import { translations } from '../locales.js';

interface SettingsPanelProps {
  settings: LayoutSettings;
  setSettings: React.Dispatch<React.SetStateAction<LayoutSettings>>;
  lang: Language;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  settings,
  setSettings,
  lang
}) => {
  const t = translations[lang];
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  // Webhook and Cloud Run 24/7 State
  const [webhookUrlInput, setWebhookUrlInput] = useState<string>('');
  const [isWebhookActive, setIsWebhookActive] = useState<boolean>(false);
  const [webhookLoading, setWebhookLoading] = useState<boolean>(false);
  const [webhookNotice, setWebhookNotice] = useState<string | null>(null);
  const [copiedHealth, setCopiedHealth] = useState<boolean>(false);

  useEffect(() => {
    // Default to current site domain origin
    const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
    setWebhookUrlInput(currentOrigin);
    checkStatus();
  }, []);

  const checkStatus = async () => {
    try {
      const res = await fetch('/api/bot/status');
      const data = await res.json();
      if (data.ok && data.config) {
        setIsWebhookActive(!!data.config.isWebhook);
        if (data.config.webhookUrl) {
          setWebhookUrlInput(data.config.webhookUrl.replace(/\/api\/telegram-webhook$/, ''));
        }
      }
    } catch (e) {
      console.error('Failed to fetch status', e);
    }
  };

  const handleActivateWebhook = async () => {
    if (!webhookUrlInput) return;
    setWebhookLoading(true);
    setWebhookNotice(null);
    try {
      const res = await fetch('/api/bot/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set', url: webhookUrlInput })
      });
      const data = await res.json();
      if (data.ok) {
        setIsWebhookActive(true);
        setWebhookNotice('✅ Telegram 24/7 Webhook activated successfully! Cloud Run instant trigger enabled.');
      } else {
        setWebhookNotice(`⚠️ Webhook error: ${data.error || 'Failed to set webhook'}`);
      }
    } catch (err: any) {
      setWebhookNotice(`❌ Webhook activation failed: ${err.message}`);
    } finally {
      setWebhookLoading(false);
    }
  };

  const handleDisableWebhook = async () => {
    setWebhookLoading(true);
    setWebhookNotice(null);
    try {
      const res = await fetch('/api/bot/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete' })
      });
      const data = await res.json();
      if (data.ok) {
        setIsWebhookActive(false);
        setWebhookNotice('ℹ️ Webhook removed. Switched to Telegram long-polling mode.');
      } else {
        setWebhookNotice(`⚠️ Error: ${data.error}`);
      }
    } catch (err: any) {
      setWebhookNotice(`❌ Error: ${err.message}`);
    } finally {
      setWebhookLoading(false);
    }
  };

  const copyHealthEndpoint = () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const healthUrl = `${origin}/api/health`;
    navigator.clipboard.writeText(healthUrl);
    setCopiedHealth(true);
    setTimeout(() => setCopiedHealth(false), 2500);
  };

  const GAP_LEVELS: Record<number, number> = {
    1: 0,
    2: 10,
    3: 18,
    4: 27
  };

  const handleToggleMode = () => {
    const modes: Array<'DEFAULT' | 'PVC' | 'PAPER' | 'CUSTOM'> = ['DEFAULT', 'PVC', 'PAPER', 'CUSTOM'];
    const curIdx = modes.indexOf(settings.mode);
    const nextMode = modes[(curIdx + 1) % modes.length];
    
    if (nextMode === 'PVC') {
      setSettings(prev => ({ ...prev, mode: nextMode, widthCm: 8.56, heightCm: 5.398 }));
    } else if (nextMode === 'DEFAULT') {
      setSettings(prev => ({ ...prev, mode: nextMode, widthCm: 8.95, heightCm: 5.70 }));
    } else {
      setSettings(prev => ({ ...prev, mode: nextMode }));
    }
    triggerSave('Mode updated');
  };

  const handleCycleSize = () => {
    const sizes = [
      { w: 8.95, h: 5.70 },
      { w: 8.50, h: 5.40 },
      { w: 8.60, h: 5.40 },
      { w: 9.00, h: 6.00 }
    ];
    const curIdx = sizes.findIndex(x => x.w === settings.widthCm && x.h === settings.heightCm);
    const next = sizes[(curIdx + 1) % sizes.length];
    setSettings(prev => ({ ...prev, widthCm: next.w, heightCm: next.h }));
    triggerSave(`Size set to ${next.w} x ${next.h} cm`);
  };

  const handleCycleDownGap = () => {
    const nextLevel = (settings.downGapLevel % 4) + 1;
    const px = GAP_LEVELS[nextLevel] ?? 27;
    setSettings(prev => ({ ...prev, downGapLevel: nextLevel, downGapPx: px }));
    triggerSave(`Down Gap Level ${nextLevel} (${px}px)`);
  };

  const handleCycleSideGap = () => {
    const gaps = [0, 24, 40, 54, 80];
    const curIdx = gaps.indexOf(settings.sideGapPx);
    const nextGap = gaps[(curIdx + 1) % gaps.length];
    setSettings(prev => ({ ...prev, sideGapPx: nextGap }));
    triggerSave(`Side Gap ${nextGap}px`);
  };

  const handleCycleTopMargin = () => {
    const margins = [0, 15, 30, 45];
    const curIdx = margins.indexOf(settings.topMarginPx);
    const nextMargin = margins[(curIdx + 1) % margins.length];
    setSettings(prev => ({ ...prev, topMarginPx: nextMargin }));
    triggerSave(`Top Margin ${nextMargin}px`);
  };

  const handleToggleFormat = () => {
    const nextFmt = settings.format === 'JPG' ? 'PDF' : 'JPG';
    setSettings(prev => ({ ...prev, format: nextFmt }));
    triggerSave(`Format ${nextFmt}`);
  };

  const handleCycleQuality = () => {
    const qLevels = [72, 78, 85, 90];
    const curQ = settings.quality || 78;
    const curIdx = qLevels.indexOf(curQ);
    const nextQ = qLevels[(curIdx + 1) % qLevels.length];
    setSettings(prev => ({ ...prev, quality: nextQ }));
    triggerSave(`PDF Quality ${nextQ}% (~${nextQ <= 75 ? '170' : nextQ <= 80 ? '210' : '260'} KB)`);
  };

  const handleResetDefaults = () => {
    setSettings({
      mode: 'DEFAULT',
      widthCm: 8.95,
      heightCm: 5.70,
      sideGapPx: 54,
      downGapPx: 27,
      downGapLevel: 4,
      topMarginPx: 15,
      sideMarginPx: 20,
      format: 'PDF',
      dpi: 300,
      quality: 78
    });
    triggerSave('Reset to defaults');
  };

  const triggerSave = (msg: string) => {
    setSavedNotice(msg);
    setTimeout(() => setSavedNotice(null), 3000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Telegram-style Layout Settings Card (Screenshot 1 Replica) */}
      <div className="p-6 rounded-3xl bg-zinc-900 border border-zinc-800 shadow-xl space-y-5">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center text-zinc-300">
              <SettingsIcon className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                ⚙️ Layout Settings (Auto-Saved)
              </h2>
              <p className="text-xs text-zinc-400">
                {lang === 'am' ? 'በቴሌግራም ቦት ላይ የሚሰራው የቀጥታ ማስተካከያ' : 'Live settings used by Telegram Bot and Web Studio'}
              </p>
            </div>
          </div>

          <button
            onClick={handleResetDefaults}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-medium transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{lang === 'am' ? 'ወደ መደበኛ መልስ' : 'Reset Defaults'}</span>
          </button>
        </div>

        {/* Telegram Box readout - Exactly as in screenshot 1 */}
        <div className="p-4 rounded-2xl bg-zinc-950/80 border border-zinc-800/80 font-mono text-xs text-zinc-300 space-y-1.5">
          <div className="flex items-center gap-2">
            <span>📍 Mode:</span>
            <span className="font-semibold text-white">{settings.mode}</span>
          </div>
          <div className="flex items-center gap-2">
            <span>📐 Size:</span>
            <span className="font-semibold text-white">{settings.widthCm} x {settings.heightCm} cm</span>
          </div>
          <div className="flex items-center gap-2">
            <span>↔️ Gap (Sides):</span>
            <span className="font-semibold text-white">
              {settings.sideGapPx === 54 ? 'small (54px)' : `${settings.sideGapPx}px`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span>↕️ Gap (Down):</span>
            <span className="font-semibold text-white">Level {settings.downGapLevel} ({settings.downGapPx}px)</span>
          </div>
          <div className="flex items-center gap-2">
            <span>⬆️ Margin Top:</span>
            <span className="font-semibold text-white">{settings.topMarginPx}px</span>
          </div>
          <div className="flex items-center gap-2">
            <span>📄 Format:</span>
            <span className="font-semibold text-white">{settings.format}</span>
          </div>
          <div className="flex items-center gap-2">
            <span>📦 PDF Size / Quality:</span>
            <span className="font-semibold text-emerald-400">
              {settings.quality || 78}% ({(settings.quality || 78) <= 72 ? 'Super Light ~170 KB' : (settings.quality || 78) <= 80 ? 'Light ~210 KB' : 'Standard ~260 KB'})
            </span>
          </div>
        </div>

        {/* Telegram Bot Inline Button Grid (Identical to Screenshot 1) */}
        <div className="space-y-2 pt-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500 block">
            {lang === 'am' ? 'የቴሌግራም ቁልፎች (Inline Buttons)' : 'Interactive Inline Controls'}
          </label>

          <div className="grid grid-cols-1 gap-2">
            <button
              onClick={handleToggleMode}
              className="w-full py-2.5 px-4 bg-zinc-800/80 hover:bg-zinc-800 border border-zinc-700/60 rounded-xl text-xs font-medium text-white transition flex items-center justify-center gap-2 cursor-pointer"
            >
              Mode: ✅ {settings.mode === 'DEFAULT' ? 'Default' : settings.mode}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              onClick={handleCycleSize}
              className="py-2.5 px-4 bg-zinc-800/80 hover:bg-zinc-800 border border-zinc-700/60 rounded-xl text-xs font-medium text-white transition flex items-center justify-center gap-2 cursor-pointer"
            >
              📐 Set Size (W * H): {settings.widthCm} x {settings.heightCm} cm
            </button>
            <button
              onClick={handleCycleDownGap}
              className="py-2.5 px-4 bg-zinc-800/80 hover:bg-zinc-800 border border-zinc-700/60 rounded-xl text-xs font-medium text-white transition flex items-center justify-center gap-2 cursor-pointer"
            >
              ↕️ Down Gap ({settings.downGapLevel}-4): {settings.downGapPx}px
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              onClick={handleCycleSideGap}
              className="py-2.5 px-4 bg-zinc-800/80 hover:bg-zinc-800 border border-zinc-700/60 rounded-xl text-xs font-medium text-white transition flex items-center justify-center gap-2 cursor-pointer"
            >
              ↔️ Side Gap: {settings.sideGapPx}px
            </button>
            <button
              onClick={handleCycleTopMargin}
              className="py-2.5 px-4 bg-zinc-800/80 hover:bg-zinc-800 border border-zinc-700/60 rounded-xl text-xs font-medium text-white transition flex items-center justify-center gap-2 cursor-pointer"
            >
              ⬆️ Top Margin: {settings.topMarginPx}px
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              onClick={handleToggleFormat}
              className="py-2.5 px-4 bg-zinc-800/80 hover:bg-zinc-800 border border-zinc-700/60 rounded-xl text-xs font-medium text-white transition flex items-center justify-center gap-2 cursor-pointer"
            >
              📄 Format: {settings.format}
            </button>
            <button
              onClick={handleCycleQuality}
              className="py-2.5 px-4 bg-zinc-800/80 hover:bg-zinc-800 border border-zinc-700/60 rounded-xl text-xs font-medium text-white transition flex items-center justify-center gap-2 cursor-pointer"
            >
              📦 PDF Size: {settings.quality || 78}%
            </button>
          </div>

          <div className="grid grid-cols-1 gap-2 pt-1">
            <button
              onClick={() => triggerSave('Settings confirmed & saved')}
              className="w-full py-2.5 px-4 bg-emerald-600/30 hover:bg-emerald-600/40 border border-emerald-500/50 rounded-xl text-xs font-medium text-emerald-300 transition flex items-center justify-center gap-2 cursor-pointer"
            >
              💾 Save current size & settings
            </button>
          </div>
        </div>

        {savedNotice && (
          <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-800/80 text-xs text-emerald-300 flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{savedNotice}</span>
          </div>
        )}
      </div>

      {/* Advanced Fine-Tuning Sliders */}
      <div className="p-6 rounded-3xl bg-zinc-900 border border-zinc-800 shadow-xl space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Sliders className="w-4 h-4 text-emerald-400" />
          {lang === 'am' ? 'ዝርዝር ማስተካከያ (Fine-Tuning Controls)' : 'Precise Layout Sliders'}
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
          {/* Width */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-zinc-400">{lang === 'am' ? 'የካርድ ስፋት (Width)' : 'Card Width'}:</span>
              <span className="font-mono text-emerald-400 font-bold">{settings.widthCm} cm</span>
            </div>
            <input
              type="range"
              min="8.0"
              max="9.5"
              step="0.05"
              value={settings.widthCm}
              onChange={(e) => setSettings(prev => ({ ...prev, widthCm: parseFloat(e.target.value) }))}
              className="w-full accent-emerald-500 bg-zinc-800"
            />
          </div>

          {/* Height */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-zinc-400">{lang === 'am' ? 'የካርድ ርዝመት (Height)' : 'Card Height'}:</span>
              <span className="font-mono text-emerald-400 font-bold">{settings.heightCm} cm</span>
            </div>
            <input
              type="range"
              min="5.0"
              max="6.5"
              step="0.05"
              value={settings.heightCm}
              onChange={(e) => setSettings(prev => ({ ...prev, heightCm: parseFloat(e.target.value) }))}
              className="w-full accent-emerald-500 bg-zinc-800"
            />
          </div>

          {/* Side Gap */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-zinc-400">{t.sideGap}:</span>
              <span className="font-mono text-cyan-400 font-bold">{settings.sideGapPx} px</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="2"
              value={settings.sideGapPx}
              onChange={(e) => setSettings(prev => ({ ...prev, sideGapPx: parseInt(e.target.value, 10) }))}
              className="w-full accent-cyan-500 bg-zinc-800"
            />
          </div>

          {/* Top Margin */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-zinc-400">{t.topMargin}:</span>
              <span className="font-mono text-cyan-400 font-bold">{settings.topMarginPx} px</span>
            </div>
            <input
              type="range"
              min="0"
              max="60"
              step="5"
              value={settings.topMarginPx}
              onChange={(e) => setSettings(prev => ({ ...prev, topMarginPx: parseInt(e.target.value, 10) }))}
              className="w-full accent-cyan-500 bg-zinc-800"
            />
          </div>

          {/* PDF Compression / Quality */}
          <div className="space-y-2 sm:col-span-2">
            <div className="flex justify-between text-xs">
              <span className="text-zinc-400">
                {lang === 'am' ? 'የፒዲኤፍ ጥራት / መጠን (PDF Compression & Quality)' : 'PDF Compression / File Size'}:
              </span>
              <span className="font-mono text-emerald-400 font-bold">
                {settings.quality || 78}% (~{(settings.quality || 78) <= 72 ? '170 KB' : (settings.quality || 78) <= 80 ? '210 KB' : '260 KB'})
              </span>
            </div>
            <input
              type="range"
              min="65"
              max="95"
              step="1"
              value={settings.quality || 78}
              onChange={(e) => setSettings(prev => ({ ...prev, quality: parseInt(e.target.value, 10) }))}
              className="w-full accent-emerald-500 bg-zinc-800"
            />
            <div className="flex justify-between text-[10px] text-zinc-500">
              <span>Ultra Light (~160 KB)</span>
              <span>Light (~210 KB) [Recommended]</span>
              <span>High Quality (~270 KB)</span>
              <span>Max (~380 KB)</span>
            </div>
          </div>
        </div>
      </div>

      {/* 24/7 Cloud Run Deployment & Webhook Setup Card */}
      <div className="p-6 rounded-3xl bg-zinc-900 border border-emerald-900/50 shadow-xl space-y-5">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-950/80 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Cloud className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                ☁️ 24/7 Cloud Run & Webhook Configuration
              </h2>
              <p className="text-xs text-zinc-400">
                {lang === 'am'
                  ? 'ቦቱ 24 ሰአት ሳይቋረጥ በጎግል ክላውድ (Cloud Run) ላይ እንዲሰራ ያስችላል'
                  : 'Enable 24/7 zero-sleep readiness via Telegram Webhooks & Health monitoring'}
              </p>
            </div>
          </div>

          <div
            className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold border ${
              isWebhookActive
                ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300'
                : 'bg-zinc-800 border-zinc-700 text-zinc-400'
            }`}
          >
            <Radio className={`w-3.5 h-3.5 ${isWebhookActive ? 'text-emerald-400 animate-pulse' : 'text-zinc-500'}`} />
            <span>{isWebhookActive ? '24/7 Webhook Active' : 'Polling Mode'}</span>
          </div>
        </div>

        {/* Amharic Guidance Box */}
        <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-3">
          <div className="flex items-start gap-3">
            <Zap className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs text-zinc-300">
              <p className="font-bold text-white text-sm">
                {lang === 'am' ? '💡 የ24 ሰዓት Cloud Run ዝግጁነት መመሪያ' : '💡 24/7 Cloud Run Deployment Info'}
              </p>
              <p className="leading-relaxed">
                {lang === 'am'
                  ? 'በGoogle AI Studio የበላይ ቀኝ ጥግ ላይ ያለውን "Deploy to Cloud Run" የሚለውን ቁልፍ በመጫን አፕሊኬሽኑን ክላውድ ላይ መጫን ይችላሉ። ከታች ያለውን ዌብሁክ (Webhook) በ1-ክሊክ በማንቃት ቦቱ በ24 ሰአት ሁልጊዜ ፈጣን ምላሽ እንዲሰጥ ማድረግ ይቻላል።'
                  : 'Deploy directly via "Deploy to Cloud Run" in AI Studio. Then activate 1-click Webhook below to allow instant event-driven triggers with zero cold starts.'}
              </p>
            </div>
          </div>
        </div>

        {/* Webhook Configuration Inputs */}
        <div className="space-y-3">
          <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 block">
            {lang === 'am' ? 'የአፕሊኬሽኑ ዌብሳይት ሊንክ (App Domain / Webhook URL)' : 'App Domain / Deployment URL'}
          </label>

          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Globe className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3" />
              <input
                type="text"
                value={webhookUrlInput}
                onChange={(e) => setWebhookUrlInput(e.target.value)}
                placeholder="https://your-cloud-run-app.aistudio.dev"
                className="w-full pl-10 pr-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-200 focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>

            {isWebhookActive ? (
              <button
                onClick={handleDisableWebhook}
                disabled={webhookLoading}
                className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 rounded-xl text-xs font-medium transition flex items-center justify-center gap-2 cursor-pointer"
              >
                {webhookLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Radio className="w-3.5 h-3.5 text-amber-400" />}
                <span>{lang === 'am' ? 'ወደ Polling መልስ' : 'Disable Webhook'}</span>
              </button>
            ) : (
              <button
                onClick={handleActivateWebhook}
                disabled={webhookLoading || !webhookUrlInput}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50 cursor-pointer"
              >
                {webhookLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                <span>{lang === 'am' ? '🚀 24/7 Webhook አነቃ' : 'Activate 24/7 Webhook'}</span>
              </button>
            )}
          </div>

          <p className="text-[11px] text-zinc-500">
            Telegram Webhook endpoint: <code className="text-emerald-400 font-mono">{webhookUrlInput}/api/telegram-webhook</code>
          </p>
        </div>

        {/* Keep-Alive Health Monitoring Endpoint */}
        <div className="pt-3 border-t border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-400 shrink-0" />
            <div>
              <span className="font-semibold text-zinc-200 block">Health & Keep-Alive Ping URL:</span>
              <span className="text-zinc-500 text-[11px]">
                Use this URL for UptimeRobot or Cron pings to prevent sleep.
              </span>
            </div>
          </div>

          <button
            onClick={copyHealthEndpoint}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs font-medium transition cursor-pointer self-start sm:self-auto"
          >
            {copiedHealth ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-zinc-400" />}
            <span>{copiedHealth ? 'Copied!' : 'Copy Health URL'}</span>
          </button>
        </div>

        {webhookNotice && (
          <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 flex items-center gap-2 animate-fadeIn">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{webhookNotice}</span>
          </div>
        )}
      </div>
    </div>
  );
};
