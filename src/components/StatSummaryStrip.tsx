import React, { useMemo } from 'react';
import { Activity } from '../types/activity';
import { Sticker } from './Sticker';
import { getTodayDateString, shiftIsoDate } from '../utils/dates';
import { datesWithLoggedMinutes, isActivityOnDate, localDateString, loggedMinutesOnDate } from '../utils/workSessions';

/** Consecutive days with logged work or a completed task, ending today (or yesterday if today is still empty). */
function currentStreak(activities: Activity[], today: string): number {
  const completedDates = new Set(
    activities.flatMap((a) => (a.completedAt ? [localDateString(new Date(a.completedAt))] : []))
  );

  const loggedDates = datesWithLoggedMinutes(activities);

  const active = (date: string) => completedDates.has(date) || loggedDates.has(date);

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

const StatSummaryStripComponent: React.FC<StatSummaryStripProps> = ({
  activities,
  dailyGoalMinutes,
}) => {
  const today = getTodayDateString();

  const { totalTasks, completedTasks, totalMinutesLogged, streak } = useMemo(() => {
    const todayActivities = activities.filter((a) => isActivityOnDate(a, today));

    return {
      totalTasks: todayActivities.length,
      completedTasks: todayActivities.filter((a) => a.status === 'completed').length,
      totalMinutesLogged: loggedMinutesOnDate(activities, today),
      streak: currentStreak(activities, today),
    };
  }, [activities, today]);

  const loggedHours = Math.floor(totalMinutesLogged / 60);
  const loggedRemMinutes = totalMinutesLogged % 60;

  const goalPercent = Math.min(100, Math.round((totalMinutesLogged / (dailyGoalMinutes || 360)) * 100));

  const focusLogged = `${loggedHours}h ${String(loggedRemMinutes).padStart(2, '0')}m`;
  const completionPercent = totalTasks > 0 ? `${Math.round((completedTasks / totalTasks) * 100)}%` : '';

  const goalBar = (
    <span className="block h-1.5 w-12 md:w-auto md:max-w-28 md:flex-1 rounded-full overflow-hidden bg-slate-200">
      <span
        className="block h-full rounded-full bg-(--tile-fill) transition-all duration-500"
        style={{ width: `${goalPercent}%` }}
      />
    </span>
  );

  // md+: a white card per stat, with the sticker on a small pastel tile.
  const card = 'flex items-center gap-3 rounded-[20px] border border-slate-200 bg-white px-3.5 py-3 card-lift';
  const iconTile = 'flex size-11 shrink-0 items-center justify-center rounded-[14px]';
  const label = 'text-xs font-medium text-slate-500';
  const value = 'text-[22px] font-medium leading-none tracking-tight text-slate-900 tabular-nums';
  const unit = 'text-xs font-medium text-slate-500';

  return (
    <div className="max-w-7xl mx-auto w-full px-3 sm:px-6 lg:px-8 pt-3 md:pt-4">
      {/* Phones: all four stats on one line. */}
      <div className="md:hidden h-10 px-3.5 flex items-center justify-between rounded-2xl border border-slate-200 bg-white card-lift text-xs font-semibold text-slate-700 tabular-nums">
        <span className="flex items-center gap-1.5" title="Completed today">
          <Sticker name="check" className="size-4.5" />
          {completedTasks}/{totalTasks}
        </span>
        <span className="flex items-center gap-1.5" title="Focus logged today">
          <Sticker name="clock" className="size-4.5" />
          {focusLogged}
        </span>
        <span className="flex items-center gap-1.5" title="Daily target">
          <Sticker name="target" className="size-4.5" />
          {goalBar}
          {goalPercent}%
        </span>
        <span className="flex items-center gap-1.5" title="Streak">
          <Sticker name="flame" className="size-4.5" />
          {streak}d
        </span>
      </div>

      <div className="hidden md:grid grid-cols-4 gap-4">
        <div className={card}>
          <div className={`${iconTile} bg-(--tile-green-a)`}>
            <Sticker name="check" className="size-7.5 rotate-[8deg]" />
          </div>
          <div className="min-w-0 flex flex-col gap-1.5">
            <span className={label}>Completion</span>
            <span className="flex items-baseline gap-1.5">
              <span className={value}>
                {completedTasks}/{totalTasks}
              </span>
              <span className={unit}>{completionPercent}</span>
            </span>
          </div>
        </div>

        <div className={card}>
          <div className={`${iconTile} bg-(--tile-blue-a)`}>
            <Sticker name="clock" className="size-7.5 -rotate-[8deg]" />
          </div>
          <div className="min-w-0 flex flex-col gap-1.5">
            <span className={label}>Focus Logged</span>
            <span className={value}>{focusLogged}</span>
          </div>
        </div>

        <div className={card}>
          <div className={`${iconTile} bg-(--tile-yellow-a)`}>
            <Sticker name="target" className="size-7.5 rotate-[10deg]" />
          </div>
          <div className="min-w-0 flex-1 flex flex-col gap-1.5">
            <span className={label}>Target</span>
            <span className="flex items-center gap-2.5">
              <span className={value}>{goalPercent}%</span>
              {goalBar}
            </span>
          </div>
        </div>

        <div className={card}>
          <div className={`${iconTile} bg-(--tile-pink-a)`}>
            <Sticker name="flame" className="size-7.5 -rotate-[6deg]" />
          </div>
          <div className="min-w-0 flex flex-col gap-1.5">
            <span className={label}>Streak</span>
            <span className="flex items-baseline gap-1.5">
              <span className={value}>{streak}</span>
              <span className={unit}>{streak === 1 ? 'day' : 'days'}</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export const StatSummaryStrip = React.memo(StatSummaryStripComponent);
