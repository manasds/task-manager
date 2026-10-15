import React from 'react';
import { Clock } from 'lucide-react';
import { Activity, CATEGORIES } from '../types/activity';
import { DayDateNav } from './DayDateNav';
import {
  TIMELINE_HOURS,
  formatMinutes,
  sessionBlockStyle,
  sessionDate,
  taskStatsForDate,
} from '../utils/workSessions';

interface DayActivityViewProps {
  activities: Activity[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
  onEditActivity: (activity: Activity) => void;
}

const ROW_HEIGHT_PX = 48;

export const DayActivityView: React.FC<DayActivityViewProps> = ({
  activities,
  selectedDate,
  onSelectDate,
  onEditActivity,
}) => {
  const taskStats = taskStatsForDate(activities, selectedDate);
  const totalMinutes = taskStats.reduce((sum, t) => sum + t.totalMinutes, 0);

  const timelineSessions = activities.flatMap((activity) =>
    (activity.workSessions ?? [])
      .filter((s) => sessionDate(s) === selectedDate)
      .map((session) => ({ session, activity }))
  );

  const timelineHeight = TIMELINE_HOURS.length * ROW_HEIGHT_PX;

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6">
      <DayDateNav
        selectedDate={selectedDate}
        onSelectDate={onSelectDate}
        subtitle="Actual work logged for this day"
        trailing={
          <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
            <div className="text-left sm:text-right">
              <span className="text-[10px] sm:text-xs text-slate-500 uppercase tracking-wider font-semibold">
                Total worked
              </span>
              <div className="text-xs sm:text-sm font-bold text-slate-900 tabular-nums">
                {formatMinutes(totalMinutes)}
              </div>
            </div>
          </div>
        }
      />

      {/* Per-task breakdown */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        <div className="px-4 py-3 border-b border-slate-100">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            By activity
          </h3>
        </div>
        {taskStats.length === 0 ? (
          <div className="py-12 text-center">
            <Clock className="w-5 h-5 text-slate-300 mx-auto mb-1.5" />
            <p className="text-xs font-medium text-slate-500">No work logged this day</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {taskStats.map(({ activity, untimedMinutes, totalMinutes: taskTotal }) => {
              const categoryMeta = CATEGORIES[activity.category] || CATEGORIES.deep_work;
              const pct = totalMinutes > 0 ? Math.round((taskTotal / totalMinutes) * 100) : 0;

              return (
                <button
                  key={activity.id}
                  type="button"
                  onClick={() => onEditActivity(activity)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50/80 transition-colors text-left"
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: categoryMeta.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-semibold text-slate-900 truncate">
                      {activity.title}
                    </h4>
                    <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5">
                      <span>{categoryMeta.label}</span>
                      {untimedMinutes > 0 && (
                        <>
                          <span>·</span>
                          <span className="text-amber-600 font-medium">
                            {formatMinutes(untimedMinutes)} untimed
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs font-bold text-slate-900 tabular-nums">
                      {formatMinutes(taskTotal)}
                    </div>
                    <div className="text-[10px] text-slate-500 tabular-nums">{pct}%</div>
                  </div>
                  <div className="hidden sm:block w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden shrink-0">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: categoryMeta.color,
                      }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Hour-by-hour timeline */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        <div className="px-4 py-3 border-b border-slate-100">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            Timeline
          </h3>
        </div>
        <div className="relative">
          {TIMELINE_HOURS.map((hour) => (
            <div
              key={hour}
              className="flex items-start gap-2.5 sm:gap-4 px-3 sm:px-4 border-b border-slate-100 last:border-b-0"
              style={{ height: ROW_HEIGHT_PX }}
            >
              <div className="w-12 sm:w-16 shrink-0 text-right pt-2">
                <span className="font-mono text-[11px] sm:text-xs font-semibold text-slate-500 tabular-nums">
                  {hour}
                </span>
              </div>
              <div className="flex-1 border-l border-slate-100 h-full" />
            </div>
          ))}

          {/* Session blocks overlay */}
          <div
            className="absolute top-0 left-0 right-0 pointer-events-none"
            style={{ height: timelineHeight }}
          >
            <div className="relative ml-[4.5rem] sm:ml-20 mr-3 sm:mr-4 h-full pointer-events-auto">
              {timelineSessions.map(({ session, activity }) => {
                const categoryMeta = CATEGORIES[activity.category] || CATEGORIES.deep_work;
                const { top, height } = sessionBlockStyle(session, ROW_HEIGHT_PX);
                const startTime = new Date(session.start).toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: false,
                });

                return (
                  <button
                    key={session.id}
                    type="button"
                    onClick={() => onEditActivity(activity)}
                    className="absolute left-0 right-0 rounded-lg px-2 py-1 text-left overflow-hidden border shadow-xs transition-opacity hover:opacity-90"
                    style={{
                      top,
                      height,
                      backgroundColor: categoryMeta.lightBg,
                      borderColor: categoryMeta.borderColor,
                    }}
                    title={`${activity.title} · ${session.minutes}m`}
                  >
                    <div
                      className="absolute left-0 top-0 bottom-0 w-1 rounded-l-lg"
                      style={{ backgroundColor: categoryMeta.color }}
                    />
                    <p className="text-[10px] font-bold text-slate-900 truncate pl-1.5">
                      {activity.title}
                    </p>
                    <p className="text-[9px] text-slate-500 tabular-nums pl-1.5">
                      {startTime} · {session.minutes}m
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
