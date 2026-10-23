import React, { useState, useEffect } from 'react';
import { Header } from './components/Header.js';
import { CardStudio } from './components/CardStudio.js';
import { SettingsPanel } from './components/SettingsPanel.js';
import { TelegramSimulator } from './components/TelegramSimulator.js';
import { ActivityLogs } from './components/ActivityLogs.js';
import { LayoutSettings, BotStatusResponse, Language } from './types.js';

export default function App() {
  const [lang, setLang] = useState<Language>('am');
  const [activeTab, setActiveTab] = useState<'studio' | 'settings' | 'simulator' | 'logs'>('studio');
  const [botStatus, setBotStatus] = useState<BotStatusResponse | null>(null);
  const [loadingStatus, setLoadingStatus] = useState<boolean>(true);

  // Settings state defaults based on Screenshot 1
  const [settings, setSettings] = useState<LayoutSettings>({
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

  const fetchBotStatus = async () => {
    try {
      const res = await fetch('/api/bot/status');
      const data = await res.json();
      if (data.ok) {
        setBotStatus(data);
      }
    } catch (err) {
      console.error('Error fetching bot status:', err);
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    fetchBotStatus();
    const timer = setInterval(fetchBotStatus, 10000);
    return () => clearInterval(timer);
  }, []);

  const targetChatId = botStatus?.config?.defaultChatId || '6689699811';
  const botUsername = botStatus?.botInfo?.username || 'pdf2_converter_bot';

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-black">
      {/* Top Header */}
      <Header
        status={botStatus}
        loading={loadingStatus}
        lang={lang}
        setLang={setLang}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onRefreshStatus={fetchBotStatus}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'studio' && (
          <CardStudio
            settings={settings}
            setSettings={setSettings}
            lang={lang}
            targetChatId={targetChatId}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsPanel
            settings={settings}
            setSettings={setSettings}
            lang={lang}
          />
        )}

        {activeTab === 'simulator' && (
          <TelegramSimulator
            settings={settings}
            lang={lang}
            targetChatId={targetChatId}
            botUsername={botUsername}
          />
        )}

        {activeTab === 'logs' && (
          <ActivityLogs lang={lang} />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-900 bg-zinc-950 py-4 text-center text-xs text-zinc-500">
        <p>
          Ethiopian Digital ID Card Layout Bot • 300 DPI High-Resolution Print Engine • Telegram Bot @{botUsername}
        </p>
      </footer>
    </div>
  );
}
