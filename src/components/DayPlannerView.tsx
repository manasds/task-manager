import React, { useState } from 'react';
import { 
  Clock, 
  Plus, 
  GripVertical,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Activity, CATEGORIES } from '../types/activity';
import { soundManager } from '../utils/audio';
import { getTodayDateString } from '../utils/storage';
import { DayDateNav } from './DayDateNav';
import { TIMELINE_HOURS } from '../utils/workSessions';

interface DayPlannerViewProps {
  activities: Activity[];
  onUpdateActivity: (activity: Activity) => void;
  onOpenNewTaskModal: (status?: any, initialTime?: string) => void;
  onStartFocus: (activity: Activity) => void;
  onEditActivity: (activity: Activity) => void;
  onDeleteActivity: (activityId: string) => void;
  selectedDate: string;
  onSelectDate: (date: string) => void;
}

export const DayPlannerView: React.FC<DayPlannerViewProps> = ({
  activities,
  onUpdateActivity,
  onOpenNewTaskModal,
  onStartFocus,
  onEditActivity,
  onDeleteActivity,
  selectedDate,
  onSelectDate,
}) => {
  const plannerDate = /^\d{4}-\d{2}-\d{2}$/.test(selectedDate) ? selectedDate : getTodayDateString();
  const [draggedActivityId, setDraggedActivityId] = useState<string | null>(null);
  const [activeDropHour, setActiveDropHour] = useState<string | null>(null);
  const [isUnscheduledDropActive, setIsUnscheduledDropActive] = useState(false);
  const [isQueueExpandedOnMobile, setIsQueueExpandedOnMobile] = useState(false);

  const dayActivities = activities.filter((a) => a.date === plannerDate);
  const scheduledActivities = dayActivities.filter((a) => Boolean(a.scheduledTime));
  const unscheduledActivities = dayActivities.filter((a) => !a.scheduledTime);

  const totalScheduledMinutes = scheduledActivities.reduce((acc, c) => acc + (c.estimatedMinutes || 0), 0);

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, activityId: string) => {
    e.dataTransfer.setData('text/plain', activityId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedActivityId(activityId);
    soundManager.playDragStart();
  };

  const handleDragEnd = () => {
    setDraggedActivityId(null);
    setActiveDropHour(null);
    setIsUnscheduledDropActive(false);
  };

  const handleDragOverHour = (e: React.DragEvent<HTMLDivElement>, hour: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (activeDropHour !== hour) {
      setActiveDropHour(hour);
    }
  };

  const handleDropOnHour = (e: React.DragEvent<HTMLDivElement>, hour: string) => {
    e.preventDefault();
    const actId = e.dataTransfer.getData('text/plain') || draggedActivityId;
    if (actId) {
      const act = activities.find((a) => a.id === actId);
      if (act) {
        soundManager.playDrop();
        onUpdateActivity({
          ...act,
          date: plannerDate,
          scheduledTime: hour,
        });
      }
    }
    setDraggedActivityId(null);
    setActiveDropHour(null);
  };

  const handleDropOnUnscheduled = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const actId = e.dataTransfer.getData('text/plain') || draggedActivityId;
    if (actId) {
      const act = activities.find((a) => a.id === actId);
      if (act) {
        soundManager.playDrop();
        onUpdateActivity({
          ...act,
          scheduledTime: undefined,
        });
      }
    }
    setDraggedActivityId(null);
    setIsUnscheduledDropActive(false);
  };

  // Quick 1-tap assign to next available slot on mobile
  const handleQuickAssignSlot = (act: Activity, hour: string) => {
    soundManager.playDrop();
    onUpdateActivity({
      ...act,
      date: plannerDate,
      scheduledTime: hour,
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6">
      
      <DayDateNav
        selectedDate={plannerDate}
        onSelectDate={onSelectDate}
        subtitle="Drag activities into hourly time blocks"
        trailing={
          <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
            <div className="text-left sm:text-right">
              <span className="text-[10px] sm:text-xs text-slate-500 uppercase tracking-wider font-semibold">Scheduled</span>
              <div className="text-xs sm:text-sm font-bold text-slate-900 tabular-nums">
                {Math.floor(totalScheduledMinutes / 60)}h {totalScheduledMinutes % 60}m
              </div>
            </div>
            <button
              onClick={() => onOpenNewTaskModal('in_progress', '09:00')}
              className="min-h-11 flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95 rounded-xl shadow-xs transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Schedule Slot</span>
            </button>
          </div>
        }
      />

      {/* 2-Column Split: Left Unscheduled Queue & Right Hourly Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-start">
        
        {/* Left: Unscheduled Pool (Collapsible on mobile) */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsUnscheduledDropActive(true);
          }}
          onDragLeave={() => setIsUnscheduledDropActive(false)}
          onDrop={handleDropOnUnscheduled}
          className={`lg:col-span-4 bg-slate-100/70 border rounded-2xl p-3 sm:p-4 transition-all ${
            isUnscheduledDropActive
              ? 'border-indigo-400 bg-indigo-50/50 ring-2 ring-indigo-400/20'
              : 'border-slate-200/80'
          }`}
        >
          <div 
            onClick={() => setIsQueueExpandedOnMobile(!isQueueExpandedOnMobile)}
            className="flex items-center justify-between pb-2 sm:pb-3 border-b border-slate-200/60 mb-2 sm:mb-3 cursor-pointer sm:cursor-default"
          >
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Unscheduled Queue
                </h3>
                <span className="text-xs font-semibold text-slate-700 bg-white border border-slate-200 px-2 py-0.5 rounded-md tabular-nums">
                  {unscheduledActivities.length}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 hidden sm:block">
                Drag into any hourly time block
              </p>
            </div>
            
            <button className="sm:hidden min-h-9 min-w-9 flex items-center justify-center text-slate-500">
              {isQueueExpandedOnMobile ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>

          <div className={`space-y-2 max-h-125 overflow-y-auto pr-1 ${
            isQueueExpandedOnMobile ? 'block' : 'hidden sm:block'
          }`}>
            {unscheduledActivities.length === 0 ? (
              <div className="py-8 sm:py-12 border-2 border-dashed border-slate-200 rounded-xl text-center p-3">
                <Clock className="w-5 h-5 text-slate-300 mx-auto mb-1.5" />
                <p className="text-xs font-medium text-slate-500">
                  {dayActivities.length === 0 ? 'Nothing on this day yet.' : 'All activities scheduled!'}
                </p>
              </div>
            ) : (
              unscheduledActivities.map((act) => {
                const categoryMeta = CATEGORIES[act.category] || CATEGORIES.deep_work;
                const isDragging = draggedActivityId === act.id;

                return (
                  <div
                    key={act.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, act.id)}
                    onDragEnd={handleDragEnd}
                    className={`bg-white rounded-xl p-3 border transition-all cursor-grab active:cursor-grabbing select-none ${
                      isDragging
                        ? 'opacity-40 border-indigo-400'
                        : 'border-slate-200 hover:border-slate-300 hover:shadow-2xs'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: categoryMeta.color }}
                        />
                        <span className="font-semibold text-slate-700 truncate">{categoryMeta.label}</span>
                        <span className="text-slate-300">·</span>
                        <span className="tabular-nums">{act.estimatedMinutes}m</span>
                      </div>
                      <GripVertical className="w-3.5 h-3.5 text-slate-300 hidden sm:block" />
                    </div>

                    <h4 className="text-xs font-semibold text-slate-800 line-clamp-2">
                      {act.title}
                    </h4>

                    {/* Mobile quick assign button */}
                    <div className="sm:hidden mt-2 pt-2 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[10px] text-slate-400">Quick schedule:</span>
                      <div className="flex items-center gap-1">
                        {['09:00', '13:00', '16:00'].map((time) => (
                          <button
                            key={time}
                            onClick={() => handleQuickAssignSlot(act, time)}
                            className="px-2 py-0.5 text-[10px] font-mono font-semibold bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 rounded-md text-slate-700"
                          >
                            {time}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Hourly Time Slots Grid */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs divide-y divide-slate-100">
          {TIMELINE_HOURS.map((hour) => {
            const hourActivities = scheduledActivities.filter((a) => {
              if (!a.scheduledTime) return false;
              const h = a.scheduledTime.split(':')[0];
              return h === hour.split(':')[0];
            });

            const isDropActive = activeDropHour === hour;

            return (
              <div
                key={hour}
                onDragOver={(e) => handleDragOverHour(e, hour)}
                onDragLeave={() => {
                  if (activeDropHour === hour) setActiveDropHour(null);
                }}
                onDrop={(e) => handleDropOnHour(e, hour)}
                className={`flex items-start gap-2.5 sm:gap-4 p-3 sm:p-3.5 transition-colors group ${
                  isDropActive ? 'bg-indigo-50/70 border-indigo-300' : 'hover:bg-slate-50/60'
                }`}
              >
                {/* Time Label (Touch target friendly) */}
                <div className="w-12 sm:w-16 shrink-0 text-right pt-1.5 sm:pt-1">
                  <span className="font-mono text-[11px] sm:text-xs font-semibold text-slate-500 tabular-nums">
                    {hour}
                  </span>
                </div>

                {/* Time Block Content Drop Area */}
                <div className="flex-1 min-w-0">
                  {hourActivities.length === 0 ? (
                    <div
                      onClick={() => onOpenNewTaskModal('in_progress', hour)}
                      className={`min-h-11 border border-dashed rounded-xl flex items-center justify-between px-3 cursor-pointer transition-colors ${
                        isDropActive
                          ? 'border-indigo-400 bg-indigo-100/50'
                          : 'border-slate-200/80 hover:border-slate-300 hover:bg-slate-100/50'
                      }`}
                    >
                      <span className="text-xs text-slate-400">
                        {isDropActive ? 'Drop activity into ' + hour : 'Available slot'}
                      </span>
                      <span className="text-xs font-semibold text-indigo-600 flex items-center gap-1 opacity-80 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add</span>
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {hourActivities.map((act) => {
                        const categoryMeta = CATEGORIES[act.category] || CATEGORIES.deep_work;
                        const isDragging = draggedActivityId === act.id;

                        return (
                          <div
                            key={act.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, act.id)}
                            onDragEnd={handleDragEnd}
                            className={`flex items-center justify-between p-3 rounded-xl border select-none transition-all cursor-grab active:cursor-grabbing ${
                              isDragging
                                ? 'opacity-40 border-indigo-400'
                                : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-xs'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: categoryMeta.color }}
                              />
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] text-slate-500">
                                  <span className="font-semibold text-slate-700">{categoryMeta.label}</span>
                                  <span>·</span>
                                  <span className="tabular-nums font-mono text-indigo-600 font-bold">{act.scheduledTime}</span>
                                  <span>·</span>
                                  <span className="tabular-nums">{act.estimatedMinutes}m</span>
                                </div>
                                <h4
                                  onClick={() => onEditActivity(act)}
                                  className="text-xs font-bold text-slate-900 truncate hover:text-indigo-600 cursor-pointer pt-0.5"
                                >
                                  {act.title}
                                </h4>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => onStartFocus(act)}
                              className="min-h-10 px-3 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 rounded-xl transition-colors flex items-center gap-1 active:scale-95 shrink-0 ml-2"
                            >
                              <span>Focus</span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

      </div>

    </div>
  );
};
