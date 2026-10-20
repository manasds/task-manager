import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getTodayDateString, shiftIsoDate } from '../utils/dates';

interface DayDateNavProps {
  selectedDate: string;
  onSelectDate: (date: string) => void;
  subtitle?: string;
  trailing?: React.ReactNode;
}

export const DayDateNav: React.FC<DayDateNavProps> = ({
  selectedDate,
  onSelectDate,
  subtitle,
  trailing,
}) => {
  const handlePrevDay = () => {
    onSelectDate(shiftIsoDate(selectedDate, -1));
  };

  const handleNextDay = () => {
    onSelectDate(shiftIsoDate(selectedDate, 1));
  };

  const handleToday = () => {
    onSelectDate(getTodayDateString());
  };

  const formattedDate = new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4 bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-xs">
      <div className="flex items-center justify-between sm:justify-start gap-2 sm:gap-3">
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
          <button
            onClick={handlePrevDay}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-600 hover:text-slate-900 active:bg-white rounded-lg transition-colors"
            title="Previous Day"
            aria-label="Previous Day"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={handleToday}
            className="min-h-[44px] px-3 text-xs font-bold text-slate-800 hover:text-slate-900 active:bg-white rounded-lg transition-colors"
          >
            Today
          </button>
          <button
            onClick={handleNextDay}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-600 hover:text-slate-900 active:bg-white rounded-lg transition-colors"
            title="Next Day"
            aria-label="Next Day"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
        <div>
          <h2 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
            {formattedDate}
          </h2>
          {subtitle && (
            <p className="text-[11px] text-slate-500 hidden sm:block">{subtitle}</p>
          )}
        </div>
      </div>
      {trailing}
    </div>
  );
};
