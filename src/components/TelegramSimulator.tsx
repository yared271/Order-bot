import React, { useState } from 'react';
import {
  Send,
  Image as ImageIcon,
  RotateCw,
  FlipHorizontal,
  Bot,
  ExternalLink,
  Check,
  CheckCheck,
  Sparkles,
  Download
} from 'lucide-react';
import { LayoutSettings, OrientationMode, Language } from '../types.js';

interface Message {
  id: string;
  sender: 'user' | 'bot';
  text?: string;
  photoUrl?: string;
  document?: {
    name: string;
    size: string;
    downloadUrl: string;
    caption: string;
  };
  inlineKeyboard?: Array<Array<{ text: string; action: string }>>;
  time: string;
}

interface TelegramSimulatorProps {
  settings: LayoutSettings;
  lang: Language;
  targetChatId: string;
  botUsername?: string;
}

export const TelegramSimulator: React.FC<TelegramSimulatorProps> = ({
  settings,
  lang,
  targetChatId,
  botUsername = 'pdf2_converter_bot'
}) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      sender: 'bot',
      text: `👋 ሰላም! ወደ orderbot እንኳን ደህና መጡ!\nWelcome to Ethiopian ID Card Order Bot.\n\n📸 እባክዎ የመታወቂያውን የፊት ገጽ (FRONT) ፎቶ ይላኩ።`,
      time: '7:19 AM'
    }
  ]);

  const [inputVal, setInputVal] = useState('');
  const [frontUploaded, setFrontUploaded] = useState(false);
  const [backUploaded, setBackUploaded] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const getCurrentTime = () => {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handleSendText = (customText?: string) => {
    const textToSend = customText || inputVal.trim();
    if (!textToSend) return;

    const userMsg: Message = {
      id: String(Date.now()),
      sender: 'user',
      text: textToSend,
      time: getCurrentTime()
    };

    setMessages(prev => [...prev, userMsg]);
    setInputVal('');

    setTimeout(() => {
      respondToCommand(textToSend);
    }, 400);
  };

  const respondToCommand = (cmd: string) => {
    const time = getCurrentTime();

    if (cmd === '/start' || cmd === '🚀 Start') {
      setMessages(prev => [
        ...prev,
        {
          id: String(Date.now()),
          sender: 'bot',
          text: `👋 ሰላም! ወደ orderbot እንኳን ደህና መጡ!\n\n📸 እባክዎ የመታወቂያውን የፊት ገጽ (FRONT) ፎቶ ይላኩ።`,
          time
        }
      ]);
    } else if (cmd === '⚙️ Settings' || cmd === '/settings') {
      setMessages(prev => [
        ...prev,
        {
          id: String(Date.now()),
          sender: 'bot',
          text: `⚙️ Layout Settings (Auto-Saved)\n\n📍 Mode: ${settings.mode}\n📐 Size: ${settings.widthCm} x ${settings.heightCm} cm\n↔️ Gap (Sides): small (${settings.sideGapPx}px)\n↕️ Gap (Down): Level ${settings.downGapLevel} (${settings.downGapPx}px)\n⬆️ Margin Top: ${settings.topMarginPx}px\n📄 Format: ${settings.format}`,
          inlineKeyboard: [
            [{ text: `Mode: ✅ Default`, action: 'noop' }],
            [
              { text: '📐 Set Size (W * H)', action: 'noop' },
              { text: '↕️ Down Gap (1-4)', action: 'noop' }
            ],
            [
              { text: '↔️ Side Gap', action: 'noop' },
              { text: '⬆️ Top Margin', action: 'noop' }
            ],
            [
              { text: '📄 Format', action: 'noop' },
              { text: '💾 Save current size', action: 'noop' }
            ],
            [{ text: '❌ Close Settings', action: 'close_settings' }]
          ],
          time
        }
      ]);
    } else if (cmd === '📋 Status' || cmd === '/status') {
      setMessages(prev => [
        ...prev,
        {
          id: String(Date.now()),
          sender: 'bot',
          text: `📋 Current Status:\n• Fronts: ${frontUploaded ? 1 : 0}\n• Backs: ${backUploaded ? 1 : 0}\n• Ready IDs: ${frontUploaded && backUploaded ? 1 : 0}\n\n${frontUploaded && backUploaded ? '✅ Ready to print! Send /pdf' : '📸 Please send ID photos.'}`,
          time
        }
      ]);
    } else if (cmd === '🔄 Reset' || cmd === '/reset') {
      setFrontUploaded(false);
      setBackUploaded(false);
      setMessages(prev => [
        ...prev,
        {
          id: String(Date.now()),
          sender: 'bot',
          text: '🔄 Session reset! All photos cleared. Please send new FRONT photo.',
          time
        }
      ]);
    } else if (cmd === '/pdf' || cmd === '📄 Print') {
      promptOrientationChoice();
    } else {
      setMessages(prev => [
        ...prev,
        {
          id: String(Date.now()),
          sender: 'bot',
          text: '📸 እባክዎ የመታወቂያ ፎቶ ይላኩ ወይም ከታች ያሉትን ቁልፎች ይጠቀሙ::',
          time
        }
      ]);
    }
  };

  const simulateSendFront = () => {
    const time = getCurrentTime();
    setFrontUploaded(true);
    setMessages(prev => [
      ...prev,
      {
        id: String(Date.now()),
        sender: 'user',
        photoUrl: '/assets/aistudio/sample_front.jpg',
        time
      },
      {
        id: String(Date.now() + 1),
        sender: 'bot',
        text: `✅ Front (1/1)\n\nNo. FRONT #1. Total: 1 fronts, ${backUploaded ? 1 : 0} backs. /pdf`,
        time
      }
    ]);
  };

  const simulateSendBack = () => {
    const time = getCurrentTime();
    setBackUploaded(true);
    setMessages(prev => [
      ...prev,
      {
        id: String(Date.now()),
        sender: 'user',
        photoUrl: '/assets/aistudio/sample_back.jpg',
        time
      },
      {
        id: String(Date.now() + 1),
        sender: 'bot',
        text: `✅ Back (1/1)\n\nNo. BACK #1. Total: ${frontUploaded ? 1 : 1} fronts, 1 backs. /pdf`,
        time
      }
    ]);
  };

  const promptOrientationChoice = () => {
    const time = getCurrentTime();
    setMessages(prev => [
      ...prev,
      {
        id: String(Date.now()),
        sender: 'bot',
        text: `📋 Ready to generate high-quality JPG with 1 ID(s).\n\nChoose orientation:\nNormal = front left, back right\nReverse = back left, front right\nFlip + Reverse = mirror images + swap sides`,
        inlineKeyboard: [
          [
            { text: '📄 Normal', action: 'orient:normal' },
            { text: 'Reverse', action: 'orient:reverse' }
          ],
          [
            { text: '🔄 Flip + Reverse', action: 'orient:flip_reverse' }
          ]
        ],
        time
      }
    ]);
  };

  const handleInlineAction = async (action: string) => {
    if (action.startsWith('orient:')) {
      const mode = action.replace('orient:', '') as OrientationMode;
      setIsProcessing(true);

      const time = getCurrentTime();
      setMessages(prev => [
        ...prev,
        {
          id: String(Date.now()),
          sender: 'user',
          text: mode === 'normal' ? '📄 Normal' : mode === 'reverse' ? 'Reverse' : '🔄 Flip + Reverse',
          time
        }
      ]);

      try {
        const res = await fetch('/api/render-layout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            useSample: 'true',
            orientation: mode,
            format: 'JPG',
            widthCm: settings.widthCm,
            heightCm: settings.heightCm,
            sideGapPx: settings.sideGapPx,
            downGapPx: settings.downGapPx,
            topMarginPx: settings.topMarginPx,
            sideMarginPx: settings.sideMarginPx,
            dpi: 300,
            returnJson: 'true'
          })
        });
        const data = await res.json();

        // 1. Send clean document by itself (so it can be forwarded without text!)
        // 2. Send status message underneath separately
        setMessages(prev => [
          ...prev,
          {
            id: String(Date.now() + 10),
            sender: 'bot',
            document: {
              name: data.filename || `pub_1ids_${mode}_17886881648.jpg`,
              size: `${data.sizeKb || 874} KB JPG`,
              downloadUrl: data.dataUrl || '/assets/aistudio/sample_front.jpg',
              caption: ''
            },
            time: getCurrentTime()
          },
          {
            id: String(Date.now() + 11),
            sender: 'bot',
            text: `✅ High-quality JPG generated with 1 ID(s) (${mode})\n300 DPI - Ready for printing`,
            inlineKeyboard: [
              [{ text: '🔄 Reset & Start Over', action: 'reset_start_over' }]
            ],
            time: getCurrentTime()
          }
        ]);

        // Automatically clear uploaded state so next upload starts fresh from #1
        setFrontUploaded(false);
        setBackUploaded(false);
      } catch (e) {
        console.error(e);
      } finally {
        setIsProcessing(false);
      }
    } else if (action === 'reset_start_over') {
      setFrontUploaded(false);
      setBackUploaded(false);
      const time = getCurrentTime();
      setMessages(prev => [
        ...prev,
        {
          id: String(Date.now()),
          sender: 'bot',
          text: '✅ Reset done. Your data cleared.\n\nSend new images to start over!',
          time
        }
      ]);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
      {/* Simulation Info & Live Telegram Link */}
      <div className="lg:col-span-1 space-y-4">
        <div className="p-5 rounded-3xl bg-zinc-900 border border-zinc-800 space-y-4 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Live Telegram Bot</h3>
              <p className="text-xs text-zinc-400">@{botUsername}</p>
            </div>
          </div>

          <p className="text-xs text-zinc-300 leading-relaxed">
            {lang === 'am'
              ? 'ቦቱ አሁን በይፋ በቴሌግራም ላይ እየሰራ ነው። በቴሌግራም መተግበሪያዎ ውስጥ መክፈት ወይም በዚህ ሲሙሌተር ውስጥ መሞከር ይችላሉ።'
              : 'The bot is actively running and polling updates from Telegram. You can test it right here or open in Telegram.'}
          </p>

          <a
            href={`https://t.me/${botUsername}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold transition shadow-lg shadow-blue-950/40"
          >
            <span>Open in Telegram</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>

          <div className="pt-2 border-t border-zinc-800 space-y-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 block">
              Quick Test Actions
            </span>
            <div className="flex flex-col gap-2">
              <button
                onClick={simulateSendFront}
                className="w-full py-2 px-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-xs font-medium text-emerald-400 flex items-center justify-between transition cursor-pointer"
              >
                <span>📸 Send Sample FRONT ID</span>
                <Check className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={simulateSendBack}
                className="w-full py-2 px-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-xs font-medium text-cyan-400 flex items-center justify-between transition cursor-pointer"
              >
                <span>📸 Send Sample BACK ID</span>
                <Check className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Telegram Phone Simulator Frame (Screenshot 1 & 2 Replica) */}
      <div className="lg:col-span-2">
        <div className="rounded-3xl border border-zinc-800 bg-[#0f141c] overflow-hidden shadow-2xl flex flex-col h-[650px] relative">
          {/* Telegram Header */}
          <div className="bg-[#17212b] px-4 py-3 flex items-center justify-between border-b border-zinc-800/80">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-amber-600 flex items-center justify-center font-bold text-white text-sm">
                O
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white leading-tight">orderbot</h4>
                <p className="text-[11px] text-zinc-400">bot</p>
              </div>
            </div>
            <div className="text-zinc-400 text-xs font-mono">
              Chat: {targetChatId}
            </div>
          </div>

          {/* Chat Messages Scrollable Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#0e1621] bg-opacity-95">
            {messages.map((m) => {
              const isUser = m.sender === 'user';
              return (
                <div
                  key={m.id}
                  className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed shadow-md ${
                      isUser
                        ? 'bg-[#2b5278] text-white rounded-br-none'
                        : 'bg-[#182533] text-zinc-100 rounded-bl-none border border-zinc-800/50'
                    }`}
                  >
                    {/* Photo message */}
                    {m.photoUrl && (
                      <div className="mb-2 rounded-lg overflow-hidden border border-black/30">
                        <img
                          src={m.photoUrl}
                          alt="ID Upload"
                          className="max-h-40 w-auto object-cover"
                        />
                      </div>
                    )}

                    {/* Text */}
                    {m.text && (
                      <div className="whitespace-pre-line">{m.text}</div>
                    )}

                    {/* Document / Generated file */}
                    {m.document && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-3 p-2.5 rounded-xl bg-black/30 border border-white/5">
                          <div className="w-9 h-9 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center">
                            <Download className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-[11px] truncate text-white">
                              {m.document.name}
                            </div>
                            <div className="text-[10px] text-zinc-400">
                              {m.document.size}
                            </div>
                          </div>
                          <a
                            href={m.document.downloadUrl}
                            download={m.document.name}
                            className="px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-[10px] font-medium"
                          >
                            Save
                          </a>
                        </div>
                        <div className="text-[11px] whitespace-pre-line text-emerald-300 font-medium">
                          {m.document.caption}
                        </div>
                      </div>
                    )}

                    {/* Timestamp */}
                    <div className="flex items-center justify-end gap-1 mt-1 text-[10px] text-zinc-400">
                      <span>{m.time}</span>
                      {isUser && <CheckCheck className="w-3 h-3 text-blue-300" />}
                    </div>
                  </div>

                  {/* Inline Keyboard */}
                  {m.inlineKeyboard && (
                    <div className="mt-1.5 space-y-1 w-full max-w-[85%]">
                      {m.inlineKeyboard.map((row, rIdx) => (
                        <div key={rIdx} className="flex gap-1">
                          {row.map((btn, bIdx) => (
                            <button
                              key={bIdx}
                              onClick={() => handleInlineAction(btn.action)}
                              className="flex-1 py-1.5 px-2 bg-[#242f3d] hover:bg-[#2e3b4d] active:scale-95 text-blue-300 rounded-lg text-xs font-medium text-center transition cursor-pointer border border-zinc-700/50"
                            >
                              {btn.text}
                            </button>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {isProcessing && (
              <div className="flex items-center gap-2 text-xs text-zinc-400 italic">
                <RotateCw className="w-3.5 h-3.5 animate-spin text-blue-400" />
                <span>orderbot is generating 300 DPI composite layout...</span>
              </div>
            )}
          </div>

          {/* Telegram Persistent Reply Keyboard (Screenshot 1 replica) */}
          <div className="bg-[#17212b] p-2 border-t border-zinc-800 space-y-1">
            <div className="grid grid-cols-2 gap-1">
              <button
                onClick={() => handleSendText('🚀 Start')}
                className="py-2 px-3 bg-[#242f3d] hover:bg-[#2b394a] rounded-lg text-xs font-medium text-white transition text-center cursor-pointer"
              >
                🚀 Start
              </button>
              <button
                onClick={() => handleSendText('📋 Status')}
                className="py-2 px-3 bg-[#242f3d] hover:bg-[#2b394a] rounded-lg text-xs font-medium text-white transition text-center cursor-pointer"
              >
                📋 Status
              </button>
            </div>
            <div className="grid grid-cols-2 gap-1">
              <button
                onClick={() => handleSendText('⚙️ Settings')}
                className="py-2 px-3 bg-[#242f3d] hover:bg-[#2b394a] rounded-lg text-xs font-medium text-white transition text-center cursor-pointer"
              >
                ⚙️ Settings
              </button>
              <button
                onClick={() => handleSendText('⏭️ Next ID')}
                className="py-2 px-3 bg-[#242f3d] hover:bg-[#2b394a] rounded-lg text-xs font-medium text-white transition text-center cursor-pointer"
              >
                ⏭️ Next ID
              </button>
            </div>
            <div className="grid grid-cols-2 gap-1">
              <button
                onClick={() => handleSendText('🔄 Reset')}
                className="py-2 px-3 bg-[#242f3d] hover:bg-[#2b394a] rounded-lg text-xs font-medium text-white transition text-center cursor-pointer"
              >
                🔄 Reset
              </button>
              <button
                onClick={() => handleSendText('📄 Print')}
                className="py-2 px-3 bg-[#242f3d] hover:bg-[#2b394a] rounded-lg text-xs font-medium text-white transition text-center cursor-pointer"
              >
                📄 Print
              </button>
            </div>
            <div className="grid grid-cols-1">
              <button
                onClick={() => handleSendText('🌐 Language')}
                className="py-1.5 px-3 bg-[#242f3d] hover:bg-[#2b394a] rounded-lg text-xs font-medium text-white transition text-center cursor-pointer"
              >
                🌐 Language
              </button>
            </div>
          </div>

          {/* Bottom message input field */}
          <div className="bg-[#17212b] px-3 py-2 flex items-center gap-2 border-t border-zinc-800">
            <input
              type="text"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendText()}
              placeholder="Message @orderbot..."
              className="flex-1 bg-transparent text-xs text-white placeholder-zinc-500 focus:outline-none"
            />
            <button
              onClick={() => handleSendText()}
              className="p-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
