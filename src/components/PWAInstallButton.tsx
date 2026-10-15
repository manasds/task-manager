import React, { useState } from 'react';
import { Download, Share2, PlusSquare, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already installed and running standalone, hide the prompt
  if (isInstalled) {
    return null;
  }

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    return (
      <button
        onClick={install}
        className={`flex items-center justify-center gap-1.5 font-semibold text-slate-800 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 border border-slate-200/80 rounded-xl transition-all shadow-2xs active:scale-95 min-h-11 min-w-11 ${
          compact ? 'px-3 py-2 text-xs' : 'px-3.5 py-2 text-xs'
        }`}
        title="Install OrbitTask to your home screen"
      >
        <Download className="w-4 h-4 text-indigo-600 shrink-0" />
        <span className={compact ? 'hidden sm:inline' : ''}>Install App</span>
      </button>
    );
  }

  // iOS Safari flow
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className={`flex items-center justify-center gap-1.5 font-semibold text-slate-800 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 border border-slate-200/80 rounded-xl transition-all shadow-2xs active:scale-95 min-h-11 min-w-11 ${
            compact ? 'px-3 py-2 text-xs' : 'px-3.5 py-2 text-xs'
          }`}
          title="Install OrbitTask on iOS"
        >
          <Share2 className="w-4 h-4 text-indigo-600 shrink-0" />
          <span className={compact ? 'hidden sm:inline' : ''}>Install</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
            <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl border border-slate-200 animate-in slide-in-from-bottom-4 duration-200">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                <h3 className="text-base font-bold text-slate-900">Install OrbitTask on iOS</h3>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg min-h-11 min-w-11 flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4 text-xs text-slate-600">
                <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 font-bold">
                    1
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">Tap the Share icon</p>
                    <p className="text-slate-500 mt-0.5">
                      In the Safari browser bottom toolbar, tap the <Share2 className="w-3.5 h-3.5 inline mx-0.5 text-indigo-600" /> Share button.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 font-bold">
                    2
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">Add to Home Screen</p>
                    <p className="text-slate-500 mt-0.5">
                      Scroll down in the action menu and tap <strong className="text-slate-800">"Add to Home Screen"</strong> with the <PlusSquare className="w-3.5 h-3.5 inline mx-0.5 text-indigo-600" /> icon.
                    </p>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full min-h-11 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors"
              >
                Got It
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
