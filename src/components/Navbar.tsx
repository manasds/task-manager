import React from 'react';
import { 
  Volume2, 
  VolumeX, 
  Plus, 
  RotateCcw, 
  Download, 
  Upload,
  Calendar,
  Kanban,
  BarChart3
} from 'lucide-react';
import { soundManager } from '../utils/audio';
import { PWAInstallButton } from './PWAInstallButton';
import { AuthPanel } from './AuthPanel';
import { SyncStatus } from './SyncStatus';
import { CloudUser, FlushReason } from '../types/document';
import { SyncPhase } from '../hooks/useSessionPersistence';

export type ActiveTab = 'board' | 'planner' | 'analytics';

interface NavbarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  onOpenNewTaskModal: () => void;
  onResetData: () => void;
  onExportData: () => void;
  onImportData: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isMuted: boolean;
  onToggleMute: () => void;
  user: CloudUser | null;
  syncPhase: SyncPhase;
  lastError: string | null;
  lastFlushReason: FlushReason | null;
  lastSyncedAt: string | null;
  onGoogleSignIn: () => Promise<void>;
  onFlush: () => void;
  onSignOut: () => void;
  showResetDemo: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onTabChange,
  onOpenNewTaskModal,
  onResetData,
  onExportData,
  onImportData,
  isMuted,
  onToggleMute,
  user,
  syncPhase,
  lastError,
  lastFlushReason,
  lastSyncedAt,
  onGoogleSignIn,
  onFlush,
  onSignOut,
  showResetDemo,
}) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleTabClick = (tab: ActiveTab) => {
    soundManager.playDragStart();
    onTabChange(tab);
  };

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-16 gap-3 sm:gap-8">
          
          {/* Zone 1: Brand Wordmark */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-slate-900 flex items-center justify-center text-white shadow-xs">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 3" />
                <path d="M7 12a5 5 0 0 1 5-5" strokeOpacity="0.4" />
              </svg>
            </div>
            <span className="text-base sm:text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap">
              OrbitTask
            </span>
          </div>

          {/* Zone 2: Desktop Navigation Links (hidden on mobile, replaced by bottom bar) */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-100/90 p-1 rounded-xl border border-slate-200/60" aria-label="Desktop Views">
            <button
              onClick={() => handleTabClick('board')}
              className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap shrink-0 min-h-[36px] ${
                activeTab === 'board'
                  ? 'bg-white text-slate-900 shadow-xs ring-1 ring-slate-900/5'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <Kanban className="w-3.5 h-3.5" />
              <span>Board</span>
            </button>
            <button
              onClick={() => handleTabClick('planner')}
              className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap shrink-0 min-h-[36px] ${
                activeTab === 'planner'
                  ? 'bg-white text-slate-900 shadow-xs ring-1 ring-slate-900/5'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Day Planner</span>
            </button>
            <button
              onClick={() => handleTabClick('analytics')}
              className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap shrink-0 min-h-[36px] ${
                activeTab === 'analytics'
                  ? 'bg-white text-slate-900 shadow-xs ring-1 ring-slate-900/5'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Analytics & Charts</span>
            </button>
          </nav>

          {/* Zone 3: Primary Action & Install & Utility Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            
            {/* PWA Install Button (Responsive) */}
            <PWAInstallButton compact />

            {/* Audio Toggle (with >= 44px touch hitbox) */}
            <button
              onClick={onToggleMute}
              title={isMuted ? 'Unmute sound effects' : 'Mute sound effects'}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors"
              aria-label={isMuted ? 'Unmute sounds' : 'Mute sounds'}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            <div className="hidden xl:flex items-center">
              <SyncStatus
                user={user}
                phase={syncPhase}
                lastError={lastError}
                lastFlushReason={lastFlushReason}
                lastSyncedAt={lastSyncedAt}
                onFlush={onFlush}
                onSignOut={onSignOut}
              />
            </div>

            {!user && (
              <div className="hidden lg:block">
                <AuthPanel compact onGoogleSignIn={onGoogleSignIn} />
              </div>
            )}

            {/* Quick Demo Reset / Export on desktop */}
            <div className="hidden lg:flex items-center gap-1 border-r border-slate-200 pr-2 mr-1">
              {showResetDemo && (
                <button
                  onClick={onResetData}
                  title="Load sample activities on this device"
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors whitespace-nowrap"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
                  <span>Load demo</span>
                </button>
              )}
              <button
                onClick={onExportData}
                title="Export activities as JSON"
                className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
                aria-label="Export activities"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={onImportData}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                title="Import activities from JSON"
                className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
                aria-label="Import activities"
              >
                <Upload className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Desktop Primary Action Button */}
            <button
              onClick={() => {
                soundManager.playDragStart();
                onOpenNewTaskModal();
              }}
              className="hidden sm:flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-xl shadow-xs transition-colors whitespace-nowrap shrink-0 min-h-[44px]"
            >
              <Plus className="w-4 h-4" />
              <span>New Activity</span>
            </button>
          </div>

        </div>
      </div>
    </header>
  );
};
