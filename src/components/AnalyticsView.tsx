import React, { useState } from 'react';
import { 
  PieChart as PieIcon, 
  Clock, 
  Target, 
  TrendingUp, 
  Sliders
} from 'lucide-react';
import { Activity, CATEGORIES, ActivityCategory, activityCategorySchema } from '../types/activity';
import { getDateOffset, getTodayDateString } from '../utils/dates';
import { focusMinutesByHour, formatMinutes, isActivityOnDate, localDateString, loggedMinutesOnDate, taskStatsForDate } from '../utils/workSessions';

function hourLabel(hour: number): string {
  const h = hour % 24;

  return `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? 'a' : 'p'}`;
}

interface AnalyticsViewProps {
  activities: Activity[];
  dailyGoalMinutes: number;
  onUpdateDailyGoal: (minutes: number) => void;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  activities,
  dailyGoalMinutes,
  onUpdateDailyGoal,
}) => {
  const [velocityMetric, setVelocityMetric] = useState<'hours' | 'tasks'>('hours');
  const [hoveredCategory, setHoveredCategory] = useState<ActivityCategory | null>(null);
  const [hoveredDayIndex, setHoveredDayIndex] = useState<number | null>(null);
  const [timeframe, setTimeframe] = useState<'7days' | '14days'>('7days');

  const daysCount = timeframe === '7days' ? 7 : 14;

  const daySeries = Array.from({ length: daysCount }).map((_, i) => {
    const offset = -(daysCount - 1 - i);
    const dateStr = getDateOffset(offset);
    const dayActs = activities.filter((a) => isActivityOnDate(a, dateStr));
    
    const totalMinutes = loggedMinutesOnDate(activities, dateStr);

    const completedTasks = dayActs.filter(
      (a) => a.completedAt && localDateString(new Date(a.completedAt)) === dateStr
    ).length;

    const totalTasks = dayActs.length;

    const dateObj = new Date(dateStr + 'T00:00:00');
    const label = dateObj.toLocaleDateString('en-US', { weekday: 'narrow' });
    const fullDate = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    return {
      dateStr,
      label,
      fullDate,
      totalMinutes,
      hours: Math.round((totalMinutes / 60) * 10) / 10,
      completedTasks,
      totalTasks,
    };
  });

  const categoryTotals: Record<ActivityCategory, number> = { build: 0, learn: 0 };

  for (const day of daySeries) {
    for (const stat of taskStatsForDate(activities, day.dateStr)) {
      categoryTotals[stat.activity.category] += stat.totalMinutes;
    }
  }

  const grandTotalMinutes = Object.values(categoryTotals).reduce((a, b) => a + b, 0);

  const degreesFor = (minutes: number) => (grandTotalMinutes > 0 ? (minutes / grandTotalMinutes) * 360 : 0);

  const donutSlices = activityCategorySchema.options.map((category, index, categories) => {
    const minutes = categoryTotals[category];
    const meta = CATEGORIES[category];
    const percentage = grandTotalMinutes > 0 ? (minutes / grandTotalMinutes) * 100 : 0;
    const angle = degreesFor(minutes);
    const minutesBefore = categories.slice(0, index).reduce((sum, earlier) => sum + categoryTotals[earlier], 0);
    const startAngle = degreesFor(minutesBefore);

    return {
      category,
      label: meta.label,
      color: meta.color,
      minutes,
      hours: Math.round((minutes / 60) * 10) / 10,
      percentage: Math.round(percentage),
      startAngle,
      angle,
    };
  });

  const minutesByHour = focusMinutesByHour(activities, daySeries.map((d) => d.dateStr));
  const firstHour = minutesByHour.findIndex((m) => m > 0);
  const lastHour = 23 - [...minutesByHour].reverse().findIndex((m) => m > 0);
  const hourRangeStart = firstHour === -1 ? 7 : Math.min(7, firstHour);
  const hourRangeEnd = firstHour === -1 ? 22 : Math.max(22, lastHour);

  const hourlyFocus = Array.from({ length: hourRangeEnd - hourRangeStart + 1 }, (_, i) => {
    const hour = hourRangeStart + i;

    return { hour, hourLabel: hourLabel(hour), minutes: minutesByHour[hour] };
  });

  const maxHourlyMinutes = Math.max(1, ...hourlyFocus.map((h) => h.minutes));
  const peakHour = firstHour === -1 ? null : minutesByHour.indexOf(Math.max(...minutesByHour));

  const today = getTodayDateString();
  const todayLoggedMinutes = loggedMinutesOnDate(activities, today);
  const todayGoalPercent = Math.min(100, Math.round((todayLoggedMinutes / (dailyGoalMinutes || 360)) * 100));

  const primaryCategory = grandTotalMinutes > 0
    ? [...activityCategorySchema.options].sort((a, b) => categoryTotals[b] - categoryTotals[a])[0]
    : null;

  // Leave room for the goal line even when every day is below it.
  const maxHours = Math.max(8, dailyGoalMinutes / 60, ...daySeries.map((d) => d.hours));
  const maxTasks = Math.max(5, ...daySeries.map((d) => d.totalTasks));

  const getArcPath = (startAngle: number, sweepAngle: number, radius: number, cx: number, cy: number) => {
    const startRad = ((startAngle - 90) * Math.PI) / 180.0;
    const endRad = ((startAngle + sweepAngle - 90) * Math.PI) / 180.0;

    const x1 = cx + radius * Math.cos(startRad);
    const y1 = cy + radius * Math.sin(startRad);
    const x2 = cx + radius * Math.cos(endRad);
    const y2 = cy + radius * Math.sin(endRad);

    const largeArcFlag = sweepAngle <= 180 ? '0' : '1';

    return `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`;
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6">
      
      {/* Analytics Header & Scope Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-indigo-600" />
            <span>Productivity & Velocity</span>
          </h2>
          <p className="text-xs text-slate-500">
            Built from the time you log with the focus timer and on tasks
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-full sm:w-auto">
            <button
              onClick={() => setTimeframe('7days')}
              className={`flex-1 sm:flex-initial min-h-9 px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                timeframe === '7days' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              7 Days
            </button>
            <button
              onClick={() => setTimeframe('14days')}
              className={`flex-1 sm:flex-initial min-h-9 px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                timeframe === '14days' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              14 Days
            </button>
          </div>
        </div>
      </div>

      {/* Grid: Chart 1 (Velocity Bars) & Radial Progress / Goal */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-stretch">
        
        {/* Custom Velocity Chart */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Daily Focus Velocity
                </h3>
                <p className="text-xs text-slate-500">
                  {velocityMetric === 'hours' ? 'Hours focused per day vs target' : 'Completed vs planned tasks'}
                </p>
              </div>

              {/* Metric Toggle */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl self-start sm:self-auto">
                <button
                  onClick={() => setVelocityMetric('hours')}
                  className={`min-h-9 px-2.5 py-1 text-xs font-medium rounded-lg transition-all ${
                    velocityMetric === 'hours' ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'text-slate-600'
                  }`}
                >
                  Hours
                </button>
                <button
                  onClick={() => setVelocityMetric('tasks')}
                  className={`min-h-9 px-2.5 py-1 text-xs font-medium rounded-lg transition-all ${
                    velocityMetric === 'tasks' ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'text-slate-600'
                  }`}
                >
                  Tasks
                </button>
              </div>
            </div>

            {/* Bar chart: the goal line and tooltips live inside the bar area so nothing gets clipped */}
            <div className="pt-2 pb-2">
              <div className="relative h-48 sm:h-56 flex items-end justify-between gap-1.5 sm:gap-3 px-1 border-b border-slate-100">
                {velocityMetric === 'hours' && (
                  <div
                    className="absolute left-0 right-0 border-t border-dashed border-amber-400 z-10 pointer-events-none"
                    style={{ bottom: `${(dailyGoalMinutes / 60 / maxHours) * 100}%` }}
                  >
                    <span className="absolute right-1 -top-2.5 text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-sm border border-amber-200 tabular-nums">
                      Target: {(dailyGoalMinutes / 60).toFixed(1)}h
                    </span>
                  </div>
                )}

                {daySeries.map((d, idx) => {
                  const val = velocityMetric === 'hours' ? d.hours : d.completedTasks;
                  const max = velocityMetric === 'hours' ? maxHours : maxTasks;
                  const heightPercent = val > 0 ? Math.max(3, Math.min(100, (val / max) * 100)) : 0;
                  const isHovered = hoveredDayIndex === idx;

                  // Keep edge tooltips inside the chart instead of hanging off the card.
                  const tooltipAlign =
                    idx < 2 ? 'left-0' : idx > daySeries.length - 3 ? 'right-0' : 'left-1/2 -translate-x-1/2';

                  return (
                    <div
                      key={d.dateStr}
                      onClick={() => setHoveredDayIndex(isHovered ? null : idx)}
                      onMouseEnter={() => setHoveredDayIndex(idx)}
                      onMouseLeave={() => setHoveredDayIndex(null)}
                      className="flex-1 flex flex-col items-center justify-end h-full relative cursor-pointer"
                    >
                      {isHovered && (
                        <div className={`absolute top-0 ${tooltipAlign} z-20 bg-slate-900 text-white rounded-xl p-2.5 text-xs shadow-xl w-36 pointer-events-none`}>
                          <div className="font-semibold text-slate-100 border-b border-slate-700/80 pb-1 mb-1 text-[11px]">
                            {d.fullDate}
                          </div>
                          <div className="flex justify-between py-0.5 text-slate-300 text-[11px]">
                            <span>Focus:</span>
                            <span className="font-mono tabular-nums text-white font-semibold">{d.hours}h</span>
                          </div>
                          <div className="flex justify-between py-0.5 text-slate-300 text-[11px]">
                            <span>Tasks:</span>
                            <span className="font-mono tabular-nums text-white font-semibold">{d.completedTasks}/{d.totalTasks}</span>
                          </div>
                        </div>
                      )}

                      <div
                        className={`w-full max-w-9 rounded-t-lg transition-all duration-300 ${
                          isHovered
                            ? 'bg-indigo-600 shadow-md'
                            : d.dateStr === today
                            ? 'bg-indigo-500 ring-2 ring-indigo-200'
                            : 'bg-indigo-400/90'
                        }`}
                        style={{ height: `${heightPercent}%` }}
                      />
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-between gap-1.5 sm:gap-3 px-1 mt-2">
                {daySeries.map((d) => (
                  <div key={d.dateStr} className="flex-1 text-center">
                    <div className={`text-[10px] sm:text-[11px] font-semibold ${
                      d.dateStr === today ? 'text-indigo-600 font-bold' : 'text-slate-600'
                    }`}>
                      {d.label}
                    </div>
                    <div className="text-[9px] sm:text-[10px] text-slate-400 tabular-nums font-mono">
                      {velocityMetric === 'hours' ? `${d.hours}h` : `${d.completedTasks}`}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500 pt-3 border-t border-slate-100 mt-2">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-indigo-500 rounded-sm" />
                <span>Logged</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 border-t border-dashed border-amber-500" />
                <span>Goal ({(dailyGoalMinutes / 60).toFixed(1)}h)</span>
              </span>
            </div>
            <span className="tabular-nums font-mono text-slate-600 font-semibold text-[11px]">
              Avg: {(daySeries.reduce((a, b) => a + b.hours, 0) / daySeries.length).toFixed(1)}h
            </span>
          </div>
        </div>

        {/* Circular Target & Interactive Goal Setting */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Today's Goal Gauge
              </h3>
              <Target className="w-4 h-4 text-amber-500" />
            </div>

            <div className="flex flex-col items-center justify-center my-3">
              <div className="relative w-36 h-36 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="transparent"
                    stroke="#f1f5f9"
                    strokeWidth="9"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="transparent"
                    stroke="#4f46e5"
                    strokeWidth="9"
                    strokeDasharray={2 * Math.PI * 40}
                    strokeDashoffset={2 * Math.PI * 40 * (1 - todayGoalPercent / 100)}
                    strokeLinecap="round"
                    className="transition-all duration-700 ease-out"
                  />
                </svg>

                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-2xl font-extrabold text-slate-900 tabular-nums">
                    {todayGoalPercent}%
                  </span>
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                    {Math.floor(todayLoggedMinutes / 60)}h {todayLoggedMinutes % 60}m logged
                  </span>
                </div>
              </div>
            </div>

            {/* Slider with touch hit area */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 space-y-2 mt-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                <span className="flex items-center gap-1">
                  <Sliders className="w-3.5 h-3.5 text-slate-400" />
                  <span>Adjust Target</span>
                </span>
                <span className="font-mono text-indigo-600 tabular-nums font-bold">
                  {(dailyGoalMinutes / 60).toFixed(1)} hrs
                </span>
              </div>
              <input
                type="range"
                min="120"
                max="600"
                step="30"
                value={dailyGoalMinutes}
                onChange={(e) => onUpdateDailyGoal(parseInt(e.target.value, 10))}
                className="w-full accent-indigo-600 cursor-pointer min-h-9"
              />
              <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                <span>2 hrs</span>
                <span>6 hrs</span>
                <span>10 hrs</span>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 text-xs text-slate-500 flex items-center justify-between">
            <span>Remaining today:</span>
            <span className="font-bold text-slate-800 tabular-nums">
              {Math.max(0, dailyGoalMinutes - todayLoggedMinutes)}m
            </span>
          </div>
        </div>

      </div>

      {/* Grid: Category Donut & Hourly Density */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-stretch">
        
        {/* Category Donut */}
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Category Breakdown
                </h3>
                <p className="text-xs text-slate-500">
                  Tap or hover slices to inspect categories
                </p>
              </div>
              <PieIcon className="w-4 h-4 text-indigo-600" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center my-2">
              <div className="sm:col-span-5 flex justify-center">
                <div className="relative w-40 h-40">
                  <svg className="w-full h-full" viewBox="0 0 160 160">
                    {donutSlices.map((slice) => {
                      if (slice.angle <= 0) return null;
                      const path = getArcPath(slice.startAngle, slice.angle, 60, 80, 80);
                      const isHovered = hoveredCategory === slice.category;

                      return (
                        <path
                          key={slice.category}
                          d={path}
                          fill="none"
                          stroke={slice.color}
                          strokeWidth={isHovered ? 26 : 22}
                          strokeLinecap="round"
                          className="transition-all duration-200 cursor-pointer"
                          onClick={() => setHoveredCategory(isHovered ? null : slice.category)}
                          onMouseEnter={() => setHoveredCategory(slice.category)}
                          onMouseLeave={() => setHoveredCategory(null)}
                        />
                      );
                    })}
                  </svg>

                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none p-2">
                    {hoveredCategory ? (
                      <>
                        <span className="text-[11px] font-semibold text-slate-600 line-clamp-1">
                          {CATEGORIES[hoveredCategory]?.label}
                        </span>
                        <span className="text-base font-bold text-slate-900 tabular-nums">
                          {Math.round((categoryTotals[hoveredCategory] / 60) * 10) / 10}h
                        </span>
                        <span className="text-[10px] text-slate-500 tabular-nums">
                          {grandTotalMinutes > 0
                            ? `${Math.round((categoryTotals[hoveredCategory] / grandTotalMinutes) * 100)}%`
                            : ''}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="text-[11px] text-slate-500 font-medium">Focus</span>
                        <span className="text-base font-bold text-slate-900 tabular-nums">
                          {Math.round((grandTotalMinutes / 60) * 10) / 10}h
                        </span>
                        <span className="text-[10px] text-slate-400">{daysCount} days</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Category Breakdown Cards with min-h-9.5 */}
              <div className="sm:col-span-7 space-y-1">
                {donutSlices.map((slice) => (
                  <div
                    key={slice.category}
                    onClick={() => setHoveredCategory(hoveredCategory === slice.category ? null : slice.category)}
                    onMouseEnter={() => setHoveredCategory(slice.category)}
                    onMouseLeave={() => setHoveredCategory(null)}
                    className={`flex items-center justify-between p-2 rounded-xl border transition-colors cursor-pointer min-h-10 ${
                      hoveredCategory === slice.category
                        ? 'bg-slate-50 border-slate-300 shadow-2xs'
                        : 'border-transparent hover:bg-slate-50/60'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: slice.color }}
                      />
                      <span className="text-xs font-semibold text-slate-700 truncate">
                        {slice.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 text-xs">
                      <span className="text-slate-500 font-mono tabular-nums">{slice.hours}h</span>
                      <span className="font-bold text-slate-800 tabular-nums w-8 text-right">
                        {slice.percentage}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 text-xs text-slate-500 flex justify-between">
            <span>Primary Focus:</span>
            <span className="font-bold text-indigo-600">
              {primaryCategory ? CATEGORIES[primaryCategory].label : 'None yet'}
            </span>
          </div>
        </div>

        {/* 24-Hour Focus Density */}
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Focus by Hour
                </h3>
                <p className="text-xs text-slate-500">
                  Timed work per hour of day, last {daysCount} days
                </p>
              </div>
              <Clock className="w-4 h-4 text-indigo-600" />
            </div>

            <div className="space-y-1.5 my-2">
              {hourlyFocus.map((slot) => {
                const widthPercent = (slot.minutes / maxHourlyMinutes) * 100;

                return (
                  <div key={slot.hour} className="flex items-center gap-2 sm:gap-3 text-xs">
                    <span className="w-8 text-right text-slate-500 font-mono tabular-nums text-[10px] sm:text-[11px] shrink-0 font-medium">
                      {slot.hourLabel}
                    </span>
                    <div className="flex-1 bg-slate-100 rounded-full h-2 sm:h-2.5 overflow-hidden relative">
                      {slot.minutes > 0 && (
                        <div
                          className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                          style={{ width: `${Math.max(10, widthPercent)}%` }}
                        />
                      )}
                    </div>
                    <span className="w-12 text-right text-slate-600 font-mono tabular-nums font-semibold shrink-0 text-[11px]">
                      {slot.minutes > 0 ? formatMinutes(slot.minutes) : '-'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 text-xs text-slate-500 flex justify-between">
            <span>Peak focus:</span>
            <span className="font-bold text-indigo-600">
              {peakHour === null ? 'No timed sessions yet' : `${hourLabel(peakHour)}m – ${hourLabel(peakHour + 1)}m`}
            </span>
          </div>
        </div>

      </div>

    </div>
  );
};
