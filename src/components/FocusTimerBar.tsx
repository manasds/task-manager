import React, { useState, useEffect } from 'react';
import { 
  Play, 
  Pause, 
  Plus, 
  Headphones, 
  X, 
  Check 
} from 'lucide-react';
import { Activity, CATEGORIES, WorkSession } from '../types/activity';
import { soundManager } from '../utils/audio';
import { createWorkSession } from '../utils/workSessions';

interface FocusTimerBarProps {
  activity: Activity | null;
  onLogTime: (activityId: string, minutesToAdd: number, session: WorkSession) => void;
  onCompleteActivity: (activityId: string) => void;
  onClose: () => void;
}

export const FocusTimerBar: React.FC<FocusTimerBarProps> = ({
  activity,
  onLogTime,
  onCompleteActivity,
  onClose,
}) => {
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [isRunning, setIsRunning] = useState(true);
  const [isAmbientOn, setIsAmbientOn] = useState(false);

  useEffect(() => {
    setSecondsElapsed(0);
    setIsRunning(true);
  }, [activity?.id]);

  useEffect(() => {
    let interval: any = null;
    if (isRunning && activity) {
      interval = setInterval(() => {
        setSecondsElapsed((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, activity]);

  if (!activity) return null;

  const categoryMeta = CATEGORIES[activity.category] || CATEGORIES.deep_work;
  const minutes = Math.floor(secondsElapsed / 60);
  const seconds = secondsElapsed % 60;

  const handleToggleTimer = () => {
    soundManager.playDragStart();
    setIsRunning(!isRunning);
  };

  const handleAddFiveMinutes = () => {
    soundManager.playDragStart();
    setSecondsElapsed((prev) => prev + 300);
  };

  const handleCommitLoggedTime = () => {
    const minsToLog = Math.max(1, Math.round(secondsElapsed / 60));
    soundManager.playDrop();
    onLogTime(activity.id, minsToLog, createWorkSession(activity.id, minsToLog));
    setSecondsElapsed(0);
  };

  const handleCompleteAndLog = () => {
    const minsToLog = Math.max(0, Math.round(secondsElapsed / 60));
    if (minsToLog > 0) {
      onLogTime(activity.id, minsToLog, createWorkSession(activity.id, minsToLog));
    }
    soundManager.playComplete();
    onCompleteActivity(activity.id);
    onClose();
  };

  const handleToggleAmbient = () => {
    if (isAmbientOn) {
      soundManager.stopAmbient();
      setIsAmbientOn(false);
    } else {
      const started = soundManager.startAmbientFocus();
      setIsAmbientOn(started);
    }
  };

  return (
    <div className="fixed bottom-16 sm:bottom-4 left-1/2 -translate-x-1/2 z-40 w-[96%] max-w-3xl">
      <div className="bg-slate-900/95 backdrop-blur-md text-white rounded-2xl p-2.5 sm:px-5 sm:py-3.5 shadow-2xl border border-slate-800 flex items-center justify-between gap-2 sm:gap-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
        
        {/* Left: Activity Details */}
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: categoryMeta.color }}
          />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] text-slate-400">
              <span className="uppercase tracking-wider font-semibold text-slate-300">Focus</span>
              <span>·</span>
              <span className="truncate">{categoryMeta.label}</span>
            </div>
            <h4 className="text-xs sm:text-sm font-bold text-white truncate">
              {activity.title}
            </h4>
          </div>
        </div>

        {/* Center: Running Timer Display */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <div className="font-mono font-bold text-sm sm:text-xl text-indigo-400 tabular-nums px-2 sm:px-2.5 py-1 bg-slate-800/80 rounded-xl border border-slate-700/60 shadow-inner">
            {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
          </div>

          {/* Play/Pause (Touch Target >= 44px) */}
          <button
            onClick={handleToggleTimer}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-xs transition-colors active:scale-95"
            title={isRunning ? 'Pause Timer' : 'Resume Timer'}
          >
            {isRunning ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
          </button>

          {/* Ambient Noise */}
          <button
            onClick={handleToggleAmbient}
            className={`min-h-[44px] min-w-[44px] flex items-center justify-center p-2 rounded-xl transition-colors active:scale-95 ${
              isAmbientOn
                ? 'bg-emerald-600 text-white'
                : 'text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700'
            }`}
            title={isAmbientOn ? 'Stop Ambient Rain' : 'Play Ambient Focus Rain'}
          >
            <Headphones className="w-4 h-4" />
          </button>

          {/* Quick +5m on desktop */}
          <button
            onClick={handleAddFiveMinutes}
            className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors tabular-nums min-h-[44px]"
            title="Add 5 minutes"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>5m</span>
          </button>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {secondsElapsed >= 30 && (
            <button
              onClick={handleCommitLoggedTime}
              className="min-h-[44px] px-2.5 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl transition-colors whitespace-nowrap active:scale-95"
              title="Save elapsed minutes to this activity"
            >
              Log
            </button>
          )}

          <button
            onClick={handleCompleteAndLog}
            className="min-h-[44px] flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-xs transition-colors whitespace-nowrap active:scale-95"
            title="Mark activity completed"
          >
            <Check className="w-4 h-4 stroke-[2.5]" />
            <span className="hidden sm:inline">Done</span>
          </button>

          <button
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
            title="Dismiss focus bar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

      </div>
    </div>
  );
};
