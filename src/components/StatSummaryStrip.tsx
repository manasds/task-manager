import React from 'react';
import { CheckCircle2, Clock, Target, Flame } from 'lucide-react';
import { Activity } from '../types/activity';
import { getTodayDateString, shiftIsoDate } from '../utils/dates';
import { isActivityOnDate, localDateString, loggedMinutesOnDate } from '../utils/workSessions';

/** Consecutive days with logged work or a completed task, ending today (or yesterday if today is still empty). */
function currentStreak(activities: Activity[], today: string): number {
  const completedDates = new Set(
    activities.flatMap((a) => (a.completedAt ? [localDateString(new Date(a.completedAt))] : []))
  );

  const active = (date: string) => completedDates.has(date) || loggedMinutesOnDate(activities, date) > 0;

  let date = active(today) ? today : shiftIsoDate(today, -1);
  let streak = 0;

  while (streak < 366 && active(date)) {
    streak++;
    date = shiftIsoDate(date, -1);
  }

  return streak;
}

interface StatSummaryStripProps {
  activities: Activity[];
  dailyGoalMinutes: number;
}

export const StatSummaryStrip: React.FC<StatSummaryStripProps> = ({
  activities,
  dailyGoalMinutes,
}) => {
  const today = getTodayDateString();
  const todayActivities = activities.filter((a) => isActivityOnDate(a, today));
  const totalTasks = todayActivities.length;
  const completedTasks = todayActivities.filter((a) => a.status === 'completed').length;
  
  const totalMinutesLogged = loggedMinutesOnDate(activities, today);
  const loggedHours = Math.floor(totalMinutesLogged / 60);
  const loggedRemMinutes = totalMinutesLogged % 60;

  const goalPercent = Math.min(100, Math.round((totalMinutesLogged / (dailyGoalMinutes || 360)) * 100));

  const streak = currentStreak(activities, today);

  return (
    <div className="bg-white border-b border-slate-200">
      {/* Phones: all four stats on one line. */}
      <div className="md:hidden px-3 sm:px-6 h-9 flex items-center justify-between text-xs font-semibold text-slate-700 tabular-nums">
        <span className="flex items-center gap-1" title="Completed today">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          {completedTasks}/{totalTasks}
        </span>
        <span className="flex items-center gap-1" title="Focus logged today">
          <Clock className="w-3.5 h-3.5 text-indigo-600" />
          {loggedHours}h {String(loggedRemMinutes).padStart(2, '0')}m
        </span>
        <span className="flex items-center gap-1.5" title="Daily target">
          <Target className="w-3.5 h-3.5 text-amber-600" />
          <span className="w-12 h-1.5 rounded-full bg-slate-200 overflow-hidden">
            <span className="block h-full bg-amber-500 rounded-full transition-all duration-500" style={{ width: `${goalPercent}%` }} />
          </span>
          {goalPercent}%
        </span>
        <span className="flex items-center gap-1" title="Streak">
          <Flame className="w-3.5 h-3.5 text-rose-600" />
          {streak}d
        </span>
      </div>

      <div className="hidden md:block max-w-7xl mx-auto px-6 lg:px-8 py-3.5">
        <div className="grid grid-cols-4 gap-6">
          
          {/* Stat 1: Daily Completion */}
          <div className="flex items-center gap-2.5 sm:gap-3 p-2 sm:p-0 bg-slate-50/80 sm:bg-transparent rounded-xl border sm:border-0 border-slate-100">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] sm:text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Completion
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-base sm:text-lg font-bold text-slate-900 tabular-nums">
                  {completedTasks}/{totalTasks}
                </span>
                <span className="text-[11px] text-slate-500 hidden sm:inline">
                  {totalTasks > 0 ? `(${Math.round((completedTasks / totalTasks) * 100)}%)` : ''}
                </span>
              </div>
            </div>
          </div>

          {/* Stat 2: Focus Time Logged */}
          <div className="flex items-center gap-2.5 sm:gap-3 p-2 sm:p-0 bg-slate-50/80 sm:bg-transparent rounded-xl border sm:border-0 border-slate-100">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
              <Clock className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] sm:text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Focus Logged
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-base sm:text-lg font-bold text-slate-900 tabular-nums">
                  {loggedHours}h {String(loggedRemMinutes).padStart(2, '0')}m
                </span>
              </div>
            </div>
          </div>

          {/* Stat 3: Daily Target Progress */}
          <div className="flex items-center gap-2.5 sm:gap-3 p-2 sm:p-0 bg-slate-50/80 sm:bg-transparent rounded-xl border sm:border-0 border-slate-100">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shrink-0">
              <Target className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] sm:text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Target
                </span>
                <span className="text-[11px] font-bold text-slate-700 tabular-nums">
                  {goalPercent}%
                </span>
              </div>
              <div className="w-full bg-slate-200/80 rounded-full h-1.5 mt-1 overflow-hidden">
                <div
                  className="bg-amber-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${goalPercent}%` }}
                />
              </div>
            </div>
          </div>

          {/* Stat 4: Active Streak */}
          <div className="flex items-center gap-2.5 sm:gap-3 p-2 sm:p-0 bg-slate-50/80 sm:bg-transparent rounded-xl border sm:border-0 border-slate-100">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shrink-0">
              <Flame className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] sm:text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Streak
              </div>
              <div className="text-base sm:text-lg font-bold text-slate-900 tabular-nums">
                {streak} <span className="text-xs font-normal text-slate-500">{streak === 1 ? 'day' : 'days'}</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
