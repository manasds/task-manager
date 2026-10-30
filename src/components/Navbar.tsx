import React from 'react';
import Link from 'next/link';
import { Plus, Download, Upload, MoreHorizontal, LayoutGrid, Smartphone } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { CloudUser } from '../types/document';
import { SyncPhase } from '../hooks/useSessionPersistence';

export type ActiveTab = 'board' | 'types' | 'calendar' | 'analytics';

const TABS: { id: ActiveTab; label: string }[] = [
  { id: 'board', label: 'Progress' },
  { id: 'types', label: 'Kanban' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'analytics', label: 'Analytics' },
];

/** Sync state as a dot plus one or two words; the tooltip has the details. */
const SYNC_DOT: Record<SyncPhase, { color: string; label: string; detail: string }> = {
  idle: { color: 'bg-slate-300', label: 'Signed in', detail: 'Signed in' },
  dirty: { color: 'bg-amber-400', label: 'Saving', detail: 'Saved on this device, syncing shortly' },
  flushing: { color: 'bg-amber-400 animate-pulse', label: 'Syncing', detail: 'Syncing with your account' },
  synced: { color: 'bg-emerald-500', label: 'Synced', detail: 'Everything is saved to your account' },
  offline: { color: 'bg-slate-400', label: 'Offline', detail: 'Offline · changes are saved on this device' },
  error: { color: 'bg-rose-500', label: 'Sync paused', detail: 'Sync paused · open the menu to retry' },
};

const menuItemClass =
  'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-slate-700 hover:bg-slate-100';

function UtilityMenu({
  onExportData,
  onImportData,
  fileInputRef,
  user,
  syncPhase,
  onFlush,
  onSignOut,
}: {
  onExportData: () => void;
  onImportData: (e: React.ChangeEvent<HTMLInputElement>) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  user: CloudUser | null;
  syncPhase: SyncPhase;
  onFlush: () => void;
  onSignOut: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const pwa = usePWAInstall();
  const menuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!(event.target instanceof Node && menuRef.current?.contains(event.target))) setOpen(false);
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
        className="size-9 pointer-coarse:size-11 flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
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
          className="absolute right-0 top-full z-40 mt-1.5 w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg"
        >
          {user && (
            <div>
              <p className="truncate px-2.5 py-1.5 text-xs text-slate-400">{user.email}</p>
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
          {!pwa.isInstalled && (pwa.isInstallable || pwa.isIOS) && (
            <>
              <div className="my-1 border-t border-slate-100" />
              {pwa.isInstallable ? (
                <button type="button" role="menuitem" className={menuItemClass} onClick={() => closeAnd(() => void pwa.install())}>
                  <Smartphone className="w-3.5 h-3.5 text-slate-400" />
                  Install app
                </button>
              ) : (
                <p className="px-2.5 py-2 text-xs text-slate-500">To install: Share → Add to Home Screen</p>
              )}
            </>
          )}
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
  user: CloudUser | null;
  syncPhase: SyncPhase;
  lastError: string | null;
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
  user,
  syncPhase,
  lastError,
  onGoogleSignIn,
  onFlush,
  onSignOut,
}) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleTabClick = (tab: ActiveTab) => {
    onTabChange(tab);
  };

  const dot = SYNC_DOT[syncPhase];

  return (
    <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-12 md:h-14 flex items-center gap-6">
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-7 h-7 rounded-lg bg-slate-900 flex items-center justify-center text-white">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 3" />
            </svg>
          </div>
          <span className="text-[15px] font-semibold tracking-tight text-slate-900">Tasky</span>
        </div>

        {/* Phones use the bottom bar instead. */}
        <nav className="hidden md:flex items-stretch h-full gap-5" aria-label="Desktop Views">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => handleTabClick(id)}
              aria-current={activeTab === id ? 'page' : undefined}
              className={`relative text-sm whitespace-nowrap transition-colors ${
                activeTab === id ? 'text-slate-900 font-medium' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {label}
              {activeTab === id && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-indigo-600" />}
            </button>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1.5 shrink-0">
          {user ? (
            <span
              className="flex h-9 items-center gap-1.5 px-2 text-xs text-slate-500 whitespace-nowrap"
              title={lastError || dot.detail}
            >
              <span className={`size-2 rounded-full ${dot.color}`} />
              {dot.label}
            </span>
          ) : (
            <button
              type="button"
              onClick={() => {
                void onGoogleSignIn().catch(() => {});
              }}
              className="h-9 px-3 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Sign in
            </button>
          )}

          <UtilityMenu
            onExportData={onExportData}
            onImportData={onImportData}
            fileInputRef={fileInputRef}
            user={user}
            syncPhase={syncPhase}
            onFlush={onFlush}
            onSignOut={onSignOut}
          />

          <button
            type="button"
            onClick={() => onOpenNewTaskModal()}
            className="hidden sm:flex items-center gap-1 h-9 pl-2.5 pr-3 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            New
          </button>
        </div>
      </div>
    </header>
  );
};
