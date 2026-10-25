import React, { useState, useEffect } from 'react';
import {
  Play,
  Pause,
  Plus,
  Square,
  Check
} from 'lucide-react';
import { Activity, CATEGORIES } from '../types/activity';
import { FocusTimerSnapshot } from '../types/document';
import { formatMinutes, timerElapsedSeconds } from '../utils/workSessions';

/** Rendered only while a timer runs on an existing task. */
interface FocusTimerBarProps {
  activity: Activity;
  timer: FocusTimerSnapshot;
  onTimerChange: (timer: FocusTimerSnapshot) => void;
  /** Save the elapsed minutes as a work session and reset the clock. */
  onLogTime: (minutes: number) => void;
  onCompleteActivity: (activityId: string) => void;
  /** Stop the timer, saving any elapsed time. */
  onStop: () => void;
}

function formatClock(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const mmss = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

  return h > 0 ? `${h}:${mmss}` : mmss;
}

const controlButton =
  'min-h-11 min-w-11 flex items-center justify-center rounded-xl transition-colors active:scale-95';

const quietButton = `${controlButton} text-slate-300 hover:text-white hover:bg-white/10`;

export const FocusTimerBar: React.FC<FocusTimerBarProps> = ({
  activity,
  timer,
  onTimerChange,
  onLogTime,
  onCompleteActivity,
  onStop,
}) => {
  const [, setTick] = useState(0);

  const isRunning = timer.isRunning;
  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => setTick((t) => t + 1), 1000);

    return () => clearInterval(interval);
  }, [isRunning]);

  const secondsElapsed = timerElapsedSeconds(timer);
  const categoryMeta = CATEGORIES[activity.category] || CATEGORIES.build;
  const isCompleted = activity.status === 'completed';
  const pendingMinutes = Math.max(1, Math.round(secondsElapsed / 60));

  // Progress counts time already logged on the task plus the running clock.
  const estimateMinutes = activity.estimatedMinutes || 0;
  const spentMinutes = (activity.actualMinutes || 0) + secondsElapsed / 60;
  const progress = estimateMinutes > 0 ? Math.min(1, spentMinutes / estimateMinutes) : 0;
  const overMinutes = estimateMinutes > 0 ? Math.floor(spentMinutes - estimateMinutes) : 0;
  const isOver = overMinutes > 0;

  const handleToggleTimer = () => {
    if (timer.isRunning) {
      onTimerChange({ ...timer, secondsElapsed, isRunning: false, startedAt: undefined });
    } else {
      onTimerChange({ ...timer, isRunning: true, startedAt: new Date().toISOString() });
    }
  };

  const handleAddFiveMinutes = () => {
    onTimerChange({ ...timer, secondsElapsed: timer.secondsElapsed + 300 });
  };

  const handleCommitLoggedTime = () => {
    onLogTime(pendingMinutes);
  };

  const handleCompleteAndLog = () => {
    onCompleteActivity(activity.id);
  };

  return (
    <div className="fixed bottom-20 md:bottom-4 inset-x-3 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 z-40 md:w-full max-w-3xl">
      <div
        role="region"
        aria-label="Focus timer"
        className="relative overflow-hidden bg-slate-900 text-white rounded-2xl shadow-2xl ring-1 ring-white/10 animate-in fade-in slide-in-from-bottom-2 duration-200"
      >
        {estimateMinutes > 0 && (
          <div
            className="absolute inset-x-0 top-0 h-1 bg-white/5"
            role="progressbar"
            aria-label="Time spent against estimate"
            aria-valuemin={0}
            aria-valuemax={estimateMinutes}
            aria-valuenow={Math.round(Math.min(spentMinutes, estimateMinutes))}
          >
            <div
              className={`h-full transition-[width] duration-1000 ease-linear ${isOver ? 'bg-amber-400' : 'bg-indigo-400'}`}
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        )}

        <div className="flex flex-wrap sm:flex-nowrap items-center gap-x-4 gap-y-2.5 px-3.5 pt-3.5 pb-3 sm:px-4">
          {/* Task */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider">
              <span className="relative flex size-2 shrink-0">
                {isRunning && (
                  <span
                    className="absolute inset-0 rounded-full animate-ping opacity-60"
                    style={{ backgroundColor: categoryMeta.color }}
                  />
                )}
                <span
                  className="relative size-2 rounded-full"
                  style={{ backgroundColor: isRunning ? categoryMeta.color : '#94a3b8' }}
                />
              </span>
              <span className={isRunning ? 'text-indigo-300' : 'text-amber-300'}>
                {isRunning ? 'Focusing' : 'Paused'}
              </span>
              <span className="text-slate-600" aria-hidden="true">·</span>
              <span className="text-slate-400 normal-case tracking-normal font-medium truncate">
                {categoryMeta.label}
              </span>
            </div>
            <h4 className="mt-0.5 text-sm font-semibold text-white truncate" title={activity.title}>
              {activity.title}
            </h4>
          </div>

          {/* Clock */}
          <div className="shrink-0 text-right">
            <div
              className={`font-mono text-2xl sm:text-[28px] leading-none font-semibold tabular-nums tracking-tight transition-opacity ${
                isRunning ? 'text-white' : 'text-slate-400'
              }`}
              aria-live="off"
            >
              {formatClock(secondsElapsed)}
            </div>
            {estimateMinutes > 0 && (
              <div className={`mt-1 text-[11px] tabular-nums ${isOver ? 'text-amber-300' : 'text-slate-400'}`}>
                {isOver
                  ? `${formatMinutes(overMinutes)} over estimate`
                  : `${formatMinutes(Math.floor(spentMinutes))} of ${formatMinutes(estimateMinutes)}`}
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="w-full sm:w-auto flex items-center justify-between sm:justify-end gap-2 sm:pl-4 sm:border-l sm:border-white/10">
            <div className="flex items-center gap-1">
              <button
                onClick={handleToggleTimer}
                className="size-11 shrink-0 flex items-center justify-center rounded-full bg-white text-slate-900 hover:bg-indigo-100 shadow-sm transition-colors active:scale-95"
                title={isRunning ? 'Pause timer' : 'Resume timer'}
                aria-label={isRunning ? 'Pause timer' : 'Resume timer'}
              >
                {isRunning ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
              </button>

              <button
                onClick={handleAddFiveMinutes}
                className={`${quietButton} gap-0.5 px-2 text-xs font-semibold tabular-nums`}
                title="Add 5 minutes"
                aria-label="Add 5 minutes"
              >
                <Plus className="w-3.5 h-3.5" />
                5m
              </button>
            </div>

            <div className="flex items-center gap-1">
              {secondsElapsed >= 30 && (
                <button
                  onClick={handleCommitLoggedTime}
                  className={`${quietButton} px-2.5 text-xs font-semibold whitespace-nowrap tabular-nums`}
                  title="Save elapsed minutes and keep focusing"
                >
                  Log {formatMinutes(pendingMinutes)}
                </button>
              )}

              {!isCompleted && (
                <button
                  onClick={handleCompleteAndLog}
                  className="min-h-11 flex items-center gap-1.5 px-3.5 text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl transition-colors whitespace-nowrap active:scale-95"
                  title="Save time and mark activity completed"
                >
                  <Check className="w-4 h-4 stroke-[2.5]" />
                  Done
                </button>
              )}

              <button
                onClick={onStop}
                className={`${controlButton} text-slate-400 hover:text-white hover:bg-white/10`}
                title="Stop and save time"
                aria-label="Stop and save time"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
