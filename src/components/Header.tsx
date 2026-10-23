import React, { useState } from 'react';
import { Bot, Send, CheckCircle2, AlertCircle, RefreshCw, Globe, MessageSquare } from 'lucide-react';
import { BotStatusResponse, Language } from '../types.js';
import { translations } from '../locales.js';

interface HeaderProps {
  status: BotStatusResponse | null;
  loading: boolean;
  lang: Language;
  setLang: (lang: Language) => void;
  activeTab: 'studio' | 'settings' | 'simulator' | 'logs';
  setActiveTab: (tab: 'studio' | 'settings' | 'simulator' | 'logs') => void;
  onRefreshStatus: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  status,
  loading,
  lang,
  setLang,
  activeTab,
  setActiveTab,
  onRefreshStatus
}) => {
  const [sendingPing, setSendingPing] = useState(false);
  const [pingResult, setPingResult] = useState<string | null>(null);
  const t = translations[lang];

  const handleSendTestPing = async () => {
    setSendingPing(true);
    setPingResult(null);
    try {
      const res = await fetch('/api/bot/send-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: status?.config?.defaultChatId || '6689699811' })
      });
      const data = await res.json();
      if (data.ok) {
        setPingResult('✅ Ping delivered to Telegram!');
      } else {
        setPingResult(`⚠️ ${data.error || 'Failed'}`);
      }
    } catch (err: any) {
      setPingResult('❌ Connection error');
    } finally {
      setSendingPing(false);
      setTimeout(() => setPingResult(null), 4000);
    }
  };

  const isBotActive = status?.config?.isRunning && status?.botInfo;

  return (
    <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Title */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 via-yellow-500 to-red-500 p-0.5 shadow-lg shadow-emerald-950/40">
              <div className="w-full h-full bg-zinc-900 rounded-[10px] flex items-center justify-center">
                <span className="text-xl">🇪🇹</span>
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  {t.appTitle}
                </h1>
                <span className="px-2 py-0.5 text-[10px] uppercase font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full">
                  v2.0 300 DPI
                </span>
              </div>
              <p className="text-xs text-zinc-400 hidden sm:block">
                {t.appSubtitle}
              </p>
            </div>
          </div>

          {/* Bot Status & Quick Actions */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Bot Status Pill */}
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs border ${
                isBotActive
                  ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
                  : 'bg-amber-950/40 border-amber-800/60 text-amber-300'
              }`}
            >
              <div
                className={`w-2 h-2 rounded-full ${
                  isBotActive ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                }`}
              />
              <Bot className="w-3.5 h-3.5" />
              <span className="font-medium hidden md:inline">
                {status?.botInfo?.username ? `@${status.botInfo.username}` : '@orderbot'}
              </span>
              <span className="text-[11px] text-zinc-400 hidden lg:inline">
                (Chat: {status?.config?.defaultChatId || '6689699811'})
              </span>
            </div>

            {/* Test Ping Button */}
            <button
              onClick={handleSendTestPing}
              disabled={sendingPing}
              title="Send test message to chat 6689699811"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 active:scale-95 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition-all shadow-md shadow-blue-900/30 cursor-pointer"
            >
              {sendingPing ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              <span className="hidden sm:inline">{t.sendTest}</span>
            </button>

            {/* Language Toggle */}
            <button
              onClick={() => setLang(lang === 'am' ? 'en' : 'am')}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-zinc-200 rounded-lg text-xs font-medium transition cursor-pointer"
              title="Toggle Language"
            >
              <Globe className="w-3.5 h-3.5 text-zinc-400" />
              <span>{lang === 'am' ? 'አማርኛ' : 'EN'}</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-t border-zinc-800/80 -mb-px overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('studio')}
            className={`px-4 py-2.5 text-xs sm:text-sm font-medium border-b-2 transition whitespace-nowrap cursor-pointer ${
              activeTab === 'studio'
                ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {t.studioTab}
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-2.5 text-xs sm:text-sm font-medium border-b-2 transition whitespace-nowrap cursor-pointer ${
              activeTab === 'settings'
                ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {t.settingsTab}
          </button>
          <button
            onClick={() => setActiveTab('simulator')}
            className={`px-4 py-2.5 text-xs sm:text-sm font-medium border-b-2 transition whitespace-nowrap cursor-pointer ${
              activeTab === 'simulator'
                ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {t.simulatorTab}
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`px-4 py-2.5 text-xs sm:text-sm font-medium border-b-2 transition whitespace-nowrap cursor-pointer ${
              activeTab === 'logs'
                ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {t.logsTab}
          </button>
        </div>
      </div>

      {pingResult && (
        <div className="bg-zinc-900 border-t border-b border-zinc-800 px-4 py-1.5 text-xs text-center text-zinc-200 animate-fadeIn">
          {pingResult}
        </div>
      )}
    </header>
  );
};
