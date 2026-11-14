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

  // Phones: four mini tiles on one line. md+: full tiles with a label and a corner sticker.
  const tile =
    'tile flex flex-col items-center justify-center gap-0.5 rounded-[14px] px-1 py-2 md:items-stretch md:justify-between md:gap-0 md:rounded-[22px] md:px-4 md:py-3 md:min-h-19';

  const label = 'hidden md:block text-xs font-medium text-(--tile-ink-2)';
  const value = 'text-[13px] md:text-2xl font-semibold md:font-medium leading-none md:tracking-tight tabular-nums';
  const unit = 'hidden md:inline ml-1 text-xs font-medium tracking-normal text-(--tile-ink-2)';
  const sticker = 'size-6 md:size-11 md:absolute md:right-3 md:top-1/2 md:-translate-y-1/2';

  return (
    <div className="max-w-7xl mx-auto w-full px-3 sm:px-6 lg:px-8 pt-3 md:pt-4">
      <div className="grid grid-cols-4 gap-1.5 md:gap-4">
        <div className={`${tile} tile-green`} title="Completed today">
          <span className={label}>Completion</span>
          <Sticker name="check" className={`${sticker} md:rotate-[8deg] max-md:order-first`} />
          <span className={value}>
            {completedTasks}/{totalTasks}
            <span className={unit}>{completionPercent}</span>
          </span>
        </div>

        <div className={`${tile} tile-blue`} title="Focus logged today">
          <span className={label}>Focus Logged</span>
          <Sticker name="clock" className={`${sticker} md:-rotate-[8deg] max-md:order-first`} />
          <span className={value}>{focusLogged}</span>
        </div>

        <div className={`${tile} tile-yellow`} title="Daily target">
          <span className={label}>Target</span>
          <Sticker name="target" className={`${sticker} md:rotate-[10deg] max-md:order-first`} />
          <div className="md:mr-14">
            <span className={value}>{goalPercent}%</span>
            <div className="hidden md:block h-1.5 mt-1.5 rounded-full overflow-hidden bg-(--tile-track)">
              <div
                className="h-full rounded-full bg-(--tile-fill) transition-all duration-500"
                style={{ width: `${goalPercent}%` }}
              />
            </div>
          </div>
        </div>

        <div className={`${tile} tile-pink`} title="Streak">
          <span className={label}>Streak</span>
          <Sticker name="flame" className={`${sticker} md:-rotate-[6deg] max-md:order-first`} />
          <span className={value}>
            {streak}
            <span className="md:hidden">d</span>
            <span className={unit}>{streak === 1 ? 'day' : 'days'}</span>
          </span>
        </div>
      </div>
    </div>
  );
};

export const StatSummaryStrip = React.memo(StatSummaryStripComponent);
