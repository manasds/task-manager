import React from 'react';
import Link from 'next/link';
import { 
  Volume2, 
  VolumeX, 
  Plus, 
  Download, 
  Upload,
  Calendar,
  Kanban,
  BarChart3,
  MoreHorizontal,
  Activity as ActivityIcon,
  LayoutGrid
} from 'lucide-react';
import { soundManager } from '../utils/audio';
import { PWAInstallButton } from './PWAInstallButton';
import { AuthPanel } from './AuthPanel';
import { SyncStatus } from './SyncStatus';
import { CloudUser } from '../types/document';
import { SyncPhase } from '../hooks/useSessionPersistence';

export type ActiveTab = 'board' | 'planner' | 'activity' | 'analytics';

const menuItemClass =
  'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-100';

function UtilityMenu({
  isMuted,
  onToggleMute,
  onExportData,
  onImportData,
  fileInputRef,
  user,
  syncPhase,
  onFlush,
  onSignOut,
}: {
  isMuted: boolean;
  onToggleMute: () => void;
  onExportData: () => void;
  onImportData: (e: React.ChangeEvent<HTMLInputElement>) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  user: CloudUser | null;
  syncPhase: SyncPhase;
  onFlush: () => void;
  onSignOut: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const closeAnd = (action: () => void) => {
    setOpen(false);
    action();
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="min-h-11 min-w-11 flex items-center justify-center p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors"
        aria-label="More actions"
        aria-haspopup="menu"
        aria-expanded={open}
        title="More actions"
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={(event) => {
          onImportData(event);
          setOpen(false);
        }}
      />

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-40 mt-1.5 w-52 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg"
        >
          {user && (
            <div className="hidden xl:block">
              <p className="truncate px-2.5 py-1.5 text-[11px] text-slate-400">{user.email}</p>
              {syncPhase === 'error' && (
                <button type="button" role="menuitem" className={menuItemClass} onClick={() => closeAnd(onFlush)}>
                  Retry sync
                </button>
              )}
              <button type="button" role="menuitem" className={menuItemClass} onClick={() => closeAnd(onSignOut)}>
                Sign out
              </button>
              <div className="my-1 border-t border-slate-100" />
            </div>
          )}
          <Link href="/canvas" role="menuitem" className={menuItemClass} onClick={() => setOpen(false)}>
            <LayoutGrid className="w-3.5 h-3.5 text-slate-400" />
            Canvas
          </Link>
          <button
            type="button"
            role="menuitem"
            className={menuItemClass}
            onClick={() => closeAnd(onToggleMute)}
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5 text-slate-400" /> : <Volume2 className="w-3.5 h-3.5 text-slate-400" />}
            {isMuted ? 'Unmute sounds' : 'Mute sounds'}
          </button>
          <button type="button" role="menuitem" className={menuItemClass} onClick={() => closeAnd(onExportData)}>
            <Download className="w-3.5 h-3.5 text-slate-400" />
            Export
          </button>
          <button
            type="button"
            role="menuitem"
            className={menuItemClass}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="w-3.5 h-3.5 text-slate-400" />
            Import
          </button>
        </div>
      )}
    </div>
  );
}

interface NavbarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  onOpenNewTaskModal: () => void;
  onExportData: () => void;
  onImportData: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isMuted: boolean;
  onToggleMute: () => void;
  user: CloudUser | null;
  syncPhase: SyncPhase;
  lastError: string | null;
  lastSyncedAt: string | null;
  onGoogleSignIn: () => Promise<void>;
  onFlush: () => void;
  onSignOut: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onTabChange,
  onOpenNewTaskModal,
  onExportData,
  onImportData,
  isMuted,
  onToggleMute,
  user,
  syncPhase,
  lastError,
  lastSyncedAt,
  onGoogleSignIn,
  onFlush,
  onSignOut,
}) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleTabClick = (tab: ActiveTab) => {
    soundManager.playDragStart();
    onTabChange(tab);
  };

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex justify-between md:grid md:grid-cols-[1fr_auto_1fr] items-center h-14 sm:h-16 gap-3">
          
          {/* Zone 1: Brand Wordmark */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0 justify-self-start">
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
              className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap shrink-0 min-h-9 ${
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
              className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap shrink-0 min-h-9 ${
                activeTab === 'planner'
                  ? 'bg-white text-slate-900 shadow-xs ring-1 ring-slate-900/5'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Planner</span>
            </button>
            <button
              onClick={() => handleTabClick('activity')}
              className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap shrink-0 min-h-9 ${
                activeTab === 'activity'
                  ? 'bg-white text-slate-900 shadow-xs ring-1 ring-slate-900/5'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <ActivityIcon className="w-3.5 h-3.5" />
              <span>Activity</span>
            </button>
            <button
              onClick={() => handleTabClick('analytics')}
              className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap shrink-0 min-h-9 ${
                activeTab === 'analytics'
                  ? 'bg-white text-slate-900 shadow-xs ring-1 ring-slate-900/5'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Analytics</span>
            </button>
          </nav>

          {/* Zone 3: Account, overflow utilities, primary action */}
          <div className="flex items-center justify-end gap-1.5 sm:gap-2 shrink-0 justify-self-end min-w-0">
            <div className="hidden xl:flex items-center">
              <SyncStatus
                compact
                user={user}
                phase={syncPhase}
                lastError={lastError}
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

            <PWAInstallButton compact />

            <UtilityMenu
              isMuted={isMuted}
              onToggleMute={onToggleMute}
              onExportData={onExportData}
              onImportData={onImportData}
              fileInputRef={fileInputRef}
              user={user}
              syncPhase={syncPhase}
              onFlush={onFlush}
              onSignOut={onSignOut}
            />

            {/* Desktop Primary Action Button */}
            <button
              onClick={() => {
                soundManager.playDragStart();
                onOpenNewTaskModal();
              }}
              className="hidden sm:flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-xl shadow-xs transition-colors whitespace-nowrap shrink-0 min-h-11"
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
