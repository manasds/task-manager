import React from 'react';
import { Kanban, Columns3, Calendar, CalendarDays, BarChart3, Plus, Activity as ActivityIcon } from 'lucide-react';
import { ActiveTab } from './Navbar';
import { soundManager } from '../utils/audio';

interface MobileBottomNavProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  onOpenNewTaskModal: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  onTabChange,
  onOpenNewTaskModal,
}) => {
  const handleTabClick = (tab: ActiveTab) => {
    soundManager.playDragStart();
    onTabChange(tab);
  };

  return (
    <nav 
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-3 pt-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] shadow-lg"
      aria-label="Mobile Navigation"
    >
      <div className="grid grid-cols-7 items-center h-14 max-w-lg mx-auto">
        
        {/* Tab 1: Board */}
        <button
          onClick={() => handleTabClick('board')}
          className={`flex flex-col items-center justify-center min-h-11 min-w-11 rounded-xl transition-all ${
            activeTab === 'board'
              ? 'text-indigo-600 font-semibold'
              : 'text-slate-500 hover:text-slate-800'
          }`}
          aria-label="Board View"
        >
          <Kanban className={`w-5 h-5 ${activeTab === 'board' ? 'stroke-[2.5]' : ''}`} />
          <span className="text-[10px] tracking-tight mt-0.5">Progress</span>
        </button>

        {/* Tab 1b: Types */}
        <button
          onClick={() => handleTabClick('types')}
          className={`flex flex-col items-center justify-center min-h-11 min-w-11 rounded-xl transition-all ${
            activeTab === 'types'
              ? 'text-indigo-600 font-semibold'
              : 'text-slate-500 hover:text-slate-800'
          }`}
          aria-label="By Type View"
        >
          <Columns3 className={`w-5 h-5 ${activeTab === 'types' ? 'stroke-[2.5]' : ''}`} />
          <span className="text-[10px] tracking-tight mt-0.5">Types</span>
        </button>

        {/* Tab 2: Planner */}
        <button
          onClick={() => handleTabClick('planner')}
          className={`flex flex-col items-center justify-center min-h-11 min-w-11 rounded-xl transition-all ${
            activeTab === 'planner'
              ? 'text-indigo-600 font-semibold'
              : 'text-slate-500 hover:text-slate-800'
          }`}
          aria-label="Day Planner View"
        >
          <Calendar className={`w-5 h-5 ${activeTab === 'planner' ? 'stroke-[2.5]' : ''}`} />
          <span className="text-[10px] tracking-tight mt-0.5">Planner</span>
        </button>

        {/* Tab 3: Activity */}
        <button
          onClick={() => handleTabClick('activity')}
          className={`flex flex-col items-center justify-center min-h-[44px] min-w-[44px] rounded-xl transition-all ${
            activeTab === 'activity'
              ? 'text-indigo-600 font-semibold'
              : 'text-slate-500 hover:text-slate-800'
          }`}
          aria-label="Activity View"
        >
          <ActivityIcon className={`w-5 h-5 ${activeTab === 'activity' ? 'stroke-[2.5]' : ''}`} />
          <span className="text-[10px] tracking-tight mt-0.5">Activity</span>
        </button>

        {/* Tab 3b: Calendar (UI preview) */}
        <button
          onClick={() => handleTabClick('calendar')}
          className={`flex flex-col items-center justify-center min-h-11 min-w-11 rounded-xl transition-all ${
            activeTab === 'calendar'
              ? 'text-indigo-600 font-semibold'
              : 'text-slate-500 hover:text-slate-800'
          }`}
          aria-label="Calendar View"
        >
          <CalendarDays className={`w-5 h-5 ${activeTab === 'calendar' ? 'stroke-[2.5]' : ''}`} />
          <span className="text-[10px] tracking-tight mt-0.5">Calendar</span>
        </button>

        {/* Tab 4: Charts / Analytics */}
        <button
          onClick={() => handleTabClick('analytics')}
          className={`flex flex-col items-center justify-center min-h-11 min-w-11 rounded-xl transition-all ${
            activeTab === 'analytics'
              ? 'text-indigo-600 font-semibold'
              : 'text-slate-500 hover:text-slate-800'
          }`}
          aria-label="Analytics & Charts"
        >
          <BarChart3 className={`w-5 h-5 ${activeTab === 'analytics' ? 'stroke-[2.5]' : ''}`} />
          <span className="text-[10px] tracking-tight mt-0.5">Charts</span>
        </button>

        {/* Action: Quick Add Activity in Natural Thumb Zone */}
        <button
          onClick={() => {
            soundManager.playDragStart();
            onOpenNewTaskModal();
          }}
          className="flex flex-col items-center justify-center min-h-11 min-w-11 text-indigo-600 hover:text-indigo-700 active:scale-95 transition-transform"
          aria-label="Add New Activity"
        >
          <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-xs">
            <Plus className="w-4 h-4 stroke-[2.5]" />
          </div>
          <span className="text-[10px] font-semibold text-slate-800 tracking-tight mt-0.5">New</span>
        </button>

      </div>
    </nav>
  );
};
