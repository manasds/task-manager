import React from 'react';
import { CheckCircle2, Clock, Target, Flame } from 'lucide-react';
import { Activity } from '../types/activity';
import { getTodayDateString } from '../utils/storage';

interface StatSummaryStripProps {
  activities: Activity[];
  dailyGoalMinutes: number;
}

export const StatSummaryStrip: React.FC<StatSummaryStripProps> = ({
  activities,
  dailyGoalMinutes,
}) => {
  const today = getTodayDateString();
  const todayActivities = activities.filter((a) => a.date === today);
  const totalTasks = todayActivities.length;
  const completedTasks = todayActivities.filter((a) => a.status === 'completed').length;
  
  const totalMinutesLogged = todayActivities.reduce((acc, curr) => acc + (curr.actualMinutes || 0), 0);
  const loggedHours = Math.floor(totalMinutesLogged / 60);
  const loggedRemMinutes = totalMinutesLogged % 60;

  const goalPercent = Math.min(100, Math.round((totalMinutesLogged / (dailyGoalMinutes || 360)) * 100));

  const datesWithActivity = new Set(
    activities.filter((a) => a.actualMinutes > 0 || a.status === 'completed').map((a) => a.date)
  );
  
  let currentStreak = 0;
  for (let i = 0; i < 30; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (datesWithActivity.has(dateStr)) {
      currentStreak++;
    } else if (i === 0) {
      continue;
    } else {
      break;
    }
  }
  if (currentStreak === 0 && datesWithActivity.size > 0) currentStreak = 1;

  return (
    <div className="bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-3.5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-6">
          
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
                {currentStreak} <span className="text-xs font-normal text-slate-500">days</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
