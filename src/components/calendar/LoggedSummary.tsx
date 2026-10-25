import { CALENDAR_TYPES } from '@/lib/calendar/theme';
import type { Activity } from '@/types/activity';
import { formatMinutes } from '@/utils/workSessions';
import type { TaskDayStats } from '@/utils/workSessions';

export interface LoggedSummaryProps {
  /** "Fri 23" or "Today". */
  dayLabel: string;
  /** Already filtered and sorted by caller. */
  stats: TaskDayStats[];
  totalMinutes: number;
  onOpen: (activity: Activity) => void;
}

export function LoggedSummary({ dayLabel, stats, totalMinutes, onOpen }: LoggedSummaryProps) {
  return (
    <section aria-label="Logged work" className="flex min-h-0 flex-col">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[14px] font-medium text-slate-900">Logged · {dayLabel}</h2>
        <span className="text-[13px] tabular-nums text-slate-500">{formatMinutes(totalMinutes)}</span>
      </div>
      {stats.length === 0 ? (
        <p className="mt-3 text-[13px] text-slate-400">No work logged this day</p>
      ) : (
        <ul className="mt-3 space-y-0.5">
          {stats.map((stat) => {
            const dot = CALENDAR_TYPES[stat.activity.category].dot;
            const pct = totalMinutes > 0 ? Math.round((stat.totalMinutes / totalMinutes) * 100) : 0;

            return (
              <li key={stat.activity.id}>
                <button
                  type="button"
                  onClick={() => onOpen(stat.activity)}
                  className="-mx-2 block w-[calc(100%+1rem)] rounded-lg px-2 py-1.5 text-left outline-none hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-slate-400"
                >
                  <span className="flex items-start gap-3">
                    <span aria-hidden className="mt-[6px] h-2 w-2 shrink-0 rounded-sm" style={{ backgroundColor: dot }} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-slate-900">{stat.activity.title}</span>
                      {stat.untimedMinutes > 0 && (
                        <span className="block text-[12px] text-amber-700">{formatMinutes(stat.untimedMinutes)} untimed</span>
                      )}
                    </span>
                    <span className="shrink-0 text-[13px] tabular-nums text-slate-900">
                      {formatMinutes(stat.totalMinutes)}
                      <span className="ml-1.5 text-slate-400">{pct}%</span>
                    </span>
                  </span>
                  <span className="mt-1.5 block h-1 rounded-full bg-slate-100">
                    <span className="block h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: dot }} />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
