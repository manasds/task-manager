import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/usePWAInstall';

interface OfflineIndicatorProps {
  /** Signed-in users already see "Offline" in the sync status. */
  signedIn: boolean;
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({ signedIn }) => {
  const isOnline = useOnlineStatus();

  if (isOnline || signedIn) return null;

  return (
    <div
      role="status"
      className="fixed bottom-20 sm:bottom-6 left-4 z-50 flex items-center gap-2 rounded-xl bg-slate-900/95 text-white px-3.5 py-2 text-xs font-semibold shadow-xl border border-slate-700 animate-in fade-in slide-in-from-bottom-2 duration-150"
    >
      <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />
      <span>Offline · your work is saved on this device</span>
    </div>
  );
};
