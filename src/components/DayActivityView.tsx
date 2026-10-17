import React from 'react';
import { Clock } from 'lucide-react';
import { Activity, CATEGORIES } from '../types/activity';
import { DayDateNav } from './DayDateNav';
import {
  formatMinutes,
  layoutDayTimeline,
  sessionDate,
  sessionEndDate,
  taskStatsForDate,
} from '../utils/workSessions';

interface DayActivityViewProps {
  activities: Activity[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
  onEditActivity: (activity: Activity) => void;
}

const ROW_HEIGHT_PX = 56;
const MIN_BLOCK_PX = 24;
/** Blocks shorter than this show a single line. */
const TWO_LINE_BLOCK_PX = 42;

function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export const DayActivityView: React.FC<DayActivityViewProps> = ({
  activities,
  selectedDate,
  onSelectDate,
  onEditActivity,
}) => {
  const taskStats = taskStatsForDate(activities, selectedDate);
  const totalMinutes = taskStats.reduce((sum, t) => sum + t.totalMinutes, 0);

  const { blocks, startHour, endHour } = layoutDayTimeline(activities, selectedDate);
  const hours = Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i);
  const timelineHeight = (endHour - startHour) * ROW_HEIGHT_PX;
  const toPx = (minutes: number) => ((minutes - startHour * 60) / 60) * ROW_HEIGHT_PX;

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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-start">
        {/* Per-task breakdown */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
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
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
          <div className="px-4 py-3 border-b border-slate-100">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Timeline
            </h3>
          </div>
          {blocks.length === 0 ? (
            <div className="py-12 text-center">
              <Clock className="w-5 h-5 text-slate-300 mx-auto mb-1.5" />
              <p className="text-xs font-medium text-slate-500">No timed sessions this day</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Start a focus timer on a task to fill the timeline</p>
            </div>
          ) : (
            <div className="flex px-3 sm:px-4 py-4">
              {/* Hour labels, centered on their grid lines */}
              <div className="relative w-11 sm:w-14 shrink-0" style={{ height: timelineHeight }}>
                {hours.map((hour) => (
                  <span
                    key={hour}
                    className="absolute right-2 sm:right-3 -translate-y-1/2 font-mono text-[11px] font-semibold text-slate-400 tabular-nums"
                    style={{ top: (hour - startHour) * ROW_HEIGHT_PX }}
                  >
                    {String(hour % 24).padStart(2, '0')}:00
                  </span>
                ))}
              </div>

              {/* Track: grid lines and session blocks share one coordinate system */}
              <div className="relative flex-1 min-w-0 border-l border-slate-200" style={{ height: timelineHeight }}>
                {hours.map((hour) => (
                  <div
                    key={hour}
                    className="absolute left-0 right-0 border-t border-slate-100"
                    style={{ top: (hour - startHour) * ROW_HEIGHT_PX }}
                  />
                ))}

                {blocks.map(({ session, activity, startMin, endMin, lane, lanes }) => {
                  const categoryMeta = CATEGORIES[activity.category] || CATEGORIES.deep_work;
                  const top = toPx(startMin);
                  const height = Math.max(toPx(endMin) - top, MIN_BLOCK_PX);
                  const compact = height < TWO_LINE_BLOCK_PX;
                  const fromPrevDay = sessionDate(session) !== selectedDate;
                  const intoNextDay = sessionEndDate(session) !== selectedDate;
                  const range = `${formatClock(session.start)}–${formatClock(session.end)}`;
                  const minutesLabel = formatMinutes(Math.round(endMin - startMin));
                  const crossLabel = fromPrevDay
                    ? ' · from previous day'
                    : intoNextDay
                      ? ' · continues next day'
                      : '';

                  return (
                    <button
                      key={`${session.id}-${selectedDate}`}
                      type="button"
                      onClick={() => onEditActivity(activity)}
                      className={`absolute rounded-lg pl-2.5 pr-2 text-left overflow-hidden border shadow-xs transition-shadow hover:shadow-md hover:z-10 focus-visible:outline-2 focus-visible:outline-indigo-500 ${
                        compact ? 'flex items-center gap-1.5' : 'py-1.5'
                      } ${fromPrevDay || intoNextDay ? 'border-dashed' : ''}`}
                      style={{
                        top: top + 1,
                        height: height - 2,
                        left: `calc(${(lane / lanes) * 100}% + 6px)`,
                        width: `calc(${100 / lanes}% - 10px)`,
                        backgroundColor: categoryMeta.lightBg,
                        borderColor: categoryMeta.borderColor,
                      }}
                      title={`${activity.title} · ${range} · ${minutesLabel}${crossLabel}`}
                    >
                      <span
                        className="absolute left-0 top-0 bottom-0 w-1"
                        style={{ backgroundColor: categoryMeta.color }}
                      />
                      <span className="block min-w-0 truncate text-[11px] font-semibold text-slate-900 leading-tight">
                        {activity.title}
                      </span>
                      <span
                        className={`block shrink-0 text-[10px] text-slate-500 tabular-nums leading-tight ${
                          compact ? '' : 'mt-0.5 truncate'
                        }`}
                      >
                        {compact ? minutesLabel : `${range} · ${minutesLabel}${crossLabel}`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
