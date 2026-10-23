import React, { useEffect, useState } from 'react';
import { BotLog, Language } from '../types.js';
import { RefreshCw, Terminal, CheckCircle2, AlertTriangle, Info, XCircle } from 'lucide-react';

interface ActivityLogsProps {
  lang: Language;
}

export const ActivityLogs: React.FC<ActivityLogsProps> = ({ lang }) => {
  const [logs, setLogs] = useState<BotLog[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/bot/logs');
      const data = await res.json();
      if (data.ok && Array.isArray(data.logs)) {
        setLogs(data.logs);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 4000);
    return () => clearInterval(interval);
  }, []);

  const getBadge = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
      case 'warning':
        return <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />;
      case 'error':
        return <XCircle className="w-3.5 h-3.5 text-red-400" />;
      default:
        return <Info className="w-3.5 h-3.5 text-blue-400" />;
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between p-4 rounded-2xl bg-zinc-900 border border-zinc-800">
        <div className="flex items-center gap-2">
          <Terminal className="w-5 h-5 text-emerald-400" />
          <h2 className="text-sm font-bold text-white">
            {lang === 'am' ? 'የቴሌግራም ቦት ክንውኖች (Activity Stream)' : 'Telegram Bot Real-Time Activity Log'}
          </h2>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700">
            {logs.length} events
          </span>
        </div>

        <button
          onClick={fetchLogs}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-medium transition cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      <div className="rounded-2xl bg-zinc-950 border border-zinc-800 overflow-hidden shadow-xl font-mono text-xs">
        <div className="p-3 bg-zinc-900 border-b border-zinc-800 text-zinc-400 text-[11px] grid grid-cols-12 gap-2">
          <span className="col-span-2">Time</span>
          <span className="col-span-2">User / Chat</span>
          <span className="col-span-3">Action</span>
          <span className="col-span-5">Details</span>
        </div>

        <div className="divide-y divide-zinc-900 max-h-[500px] overflow-y-auto">
          {logs.length === 0 ? (
            <div className="p-8 text-center text-zinc-500 text-xs">
              No activity logs recorded yet. Send a photo or command to the bot to see live events.
            </div>
          ) : (
            logs.map((log) => (
              <div
                key={log.id}
                className="p-3 grid grid-cols-12 gap-2 hover:bg-zinc-900/40 transition items-center text-zinc-300"
              >
                <span className="col-span-2 text-zinc-500 text-[11px]">
                  {log.timestamp}
                </span>
                <span className="col-span-2 truncate text-blue-400 font-semibold">
                  {log.user}
                </span>
                <div className="col-span-3 flex items-center gap-1.5 text-zinc-200">
                  {getBadge(log.type)}
                  <span className="truncate">{log.action}</span>
                </div>
                <span className="col-span-5 truncate text-zinc-400 text-[11px]">
                  {log.details}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
