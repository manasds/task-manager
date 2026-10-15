import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/usePWAInstall';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-20 sm:bottom-6 left-4 z-50 flex items-center gap-2 rounded-xl bg-slate-900/95 text-white px-3.5 py-2 text-xs font-semibold shadow-xl border border-slate-700 animate-in fade-in slide-in-from-bottom-2 duration-150">
      <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />
      <span>Offline Mode — Cached data is being used</span>
    </div>
  );
};
