import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  ActivityStatus 
} from './types/activity';
import { 
  loadActivities, 
  saveActivities, 
  loadDailyGoalMinutes, 
  saveDailyGoalMinutes, 
  generateInitialActivities, 
  getTodayDateString 
} from './utils/storage';
import { soundManager } from './utils/audio';
import { Navbar, ActiveTab } from './components/Navbar';
import { StatSummaryStrip } from './components/StatSummaryStrip';
import { BoardView } from './components/BoardView';
import { DayPlannerView } from './components/DayPlannerView';
import { AnalyticsView } from './components/AnalyticsView';
import { TaskModal } from './components/TaskModal';
import { FocusTimerBar } from './components/FocusTimerBar';
import { MobileBottomNav } from './components/MobileBottomNav';
import { OfflineIndicator } from './components/OfflineIndicator';

export default function App() {
  const [activities, setActivities] = useState<Activity[]>(() => loadActivities());
  const [dailyGoalMinutes, setDailyGoalMinutes] = useState<number>(() => loadDailyGoalMinutes());
  const [activeTab, setActiveTab] = useState<ActiveTab>('board');
  const [selectedDate, setSelectedDate] = useState<string>(getTodayDateString());
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // Focus Timer active task
  const [activeTimerTask, setActiveTimerTask] = useState<Activity | null>(null);

  // Task Modal state
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [modalDefaultStatus, setModalDefaultStatus] = useState<ActivityStatus>('backlog');
  const [modalDefaultTime, setModalDefaultTime] = useState<string | undefined>(undefined);

  // Toast notification state
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3200);
  };

  useEffect(() => {
    saveActivities(activities);
  }, [activities]);

  useEffect(() => {
    saveDailyGoalMinutes(dailyGoalMinutes);
  }, [dailyGoalMinutes]);

  const handleUpdateActivity = (updated: Activity) => {
    setActivities((prev) => {
      const exists = prev.some((a) => a.id === updated.id);
      if (exists) {
        return prev.map((a) => (a.id === updated.id ? updated : a));
      } else {
        return [updated, ...prev];
      }
    });

    if (activeTimerTask && activeTimerTask.id === updated.id) {
      setActiveTimerTask(updated);
    }
  };

  const handleDeleteActivity = (activityId: string) => {
    soundManager.playDrop();
    setActivities((prev) => prev.filter((a) => a.id !== activityId));
    if (activeTimerTask && activeTimerTask.id === activityId) {
      setActiveTimerTask(null);
    }
    showToast('Activity removed');
  };

  const handleMoveActivityStatus = (
    activityId: string, 
    newStatus: ActivityStatus
  ) => {
    setActivities((prev) =>
      prev.map((a) => {
        if (a.id !== activityId) return a;
        return {
          ...a,
          status: newStatus,
          completedAt: newStatus === 'completed' ? new Date().toISOString() : undefined,
        };
      })
    );
  };

  const handleOpenNewTaskModal = (initialStatus: ActivityStatus = 'backlog', initialTime?: string) => {
    setEditingActivity(null);
    setModalDefaultStatus(initialStatus);
    setModalDefaultTime(initialTime);
    setIsModalOpen(true);
  };

  const handleEditActivity = (act: Activity) => {
    setEditingActivity(act);
    setModalDefaultStatus(act.status);
    setModalDefaultTime(act.scheduledTime);
    setIsModalOpen(true);
  };

  const handleStartFocus = (act: Activity) => {
    setActiveTimerTask(act);
    showToast(`Focus session: ${act.title}`);
  };

  const handleLogTime = (activityId: string, minutesToAdd: number) => {
    setActivities((prev) =>
      prev.map((a) => {
        if (a.id !== activityId) return a;
        return {
          ...a,
          actualMinutes: (a.actualMinutes || 0) + minutesToAdd,
        };
      })
    );
    showToast(`Logged ${minutesToAdd}m to activity`);
  };

  const handleCompleteActivity = (activityId: string) => {
    setActivities((prev) =>
      prev.map((a) => {
        if (a.id !== activityId) return a;
        return {
          ...a,
          status: 'completed',
          completedAt: new Date().toISOString(),
        };
      })
    );
    setActiveTimerTask(null);
    showToast('Activity completed! 🎉');
  };

  const handleResetData = () => {
    const fresh = generateInitialActivities();
    setActivities(fresh);
    saveActivities(fresh);
    setActiveTimerTask(null);
    soundManager.playDrop();
    showToast('Demo activities restored');
  };

  const handleExportData = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(activities, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `orbittask_export_${getTodayDateString()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast('Activities exported to JSON');
  };

  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    if (e.target.files && e.target.files[0]) {
      fileReader.readAsText(e.target.files[0], 'UTF-8');
      fileReader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string);
          if (Array.isArray(parsed)) {
            setActivities(parsed);
            saveActivities(parsed);
            soundManager.playDrop();
            showToast(`Imported ${parsed.length} activities`);
          } else {
            showToast('Invalid JSON file format');
          }
        } catch {
          showToast('Failed to parse JSON file');
        }
      };
    }
  };

  const handleToggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    soundManager.setMuted(next);
    if (!next) soundManager.playDragStart();
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      
      {/* Top Bar with PWA install button and brand wordmark */}
      <Navbar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onOpenNewTaskModal={() => handleOpenNewTaskModal('backlog')}
        onResetData={handleResetData}
        onExportData={handleExportData}
        onImportData={handleImportData}
        isMuted={isMuted}
        onToggleMute={handleToggleMute}
      />

      {/* KPI & Stat Strip */}
      <StatSummaryStrip
        activities={activities}
        dailyGoalMinutes={dailyGoalMinutes}
        onOpenAnalytics={() => setActiveTab('analytics')}
      />

      {/* Main View Port (padded at bottom to accommodate mobile bottom nav) */}
      <main className="flex-1 pb-28 sm:pb-24">
        {activeTab === 'board' && (
          <BoardView
            activities={activities}
            onUpdateActivity={handleUpdateActivity}
            onDeleteActivity={handleDeleteActivity}
            onMoveActivityStatus={handleMoveActivityStatus}
            onOpenNewTaskModal={handleOpenNewTaskModal}
            onStartFocus={handleStartFocus}
            onEditActivity={handleEditActivity}
            activeTimerTaskId={activeTimerTask?.id}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
          />
        )}

        {activeTab === 'planner' && (
          <DayPlannerView
            activities={activities}
            onUpdateActivity={handleUpdateActivity}
            onOpenNewTaskModal={handleOpenNewTaskModal}
            onStartFocus={handleStartFocus}
            onEditActivity={handleEditActivity}
            onDeleteActivity={handleDeleteActivity}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
          />
        )}

        {activeTab === 'analytics' && (
          <AnalyticsView
            activities={activities}
            dailyGoalMinutes={dailyGoalMinutes}
            onUpdateDailyGoal={setDailyGoalMinutes}
          />
        )}
      </main>

      {/* Task Creation & Edit Modal (Bottom sheet on mobile, modal on desktop) */}
      <TaskModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleUpdateActivity}
        initialActivity={editingActivity}
        defaultStatus={modalDefaultStatus}
        defaultTime={modalDefaultTime}
      />

      {/* Active Focus Timer Dock */}
      <FocusTimerBar
        activity={activeTimerTask}
        onLogTime={handleLogTime}
        onCompleteActivity={handleCompleteActivity}
        onClose={() => setActiveTimerTask(null)}
      />

      {/* Mobile Fixed Bottom Navigation Bar (Natural Thumb Zone) */}
      <MobileBottomNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onOpenNewTaskModal={() => handleOpenNewTaskModal('backlog')}
      />

      {/* PWA Offline Indicator */}
      <OfflineIndicator />

      {/* Toast feedback */}
      {toastMessage && (
        <div className="fixed top-16 sm:top-20 right-4 sm:right-6 z-50 bg-slate-900 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-xl border border-slate-800 animate-in fade-in slide-in-from-top-2 duration-150 flex items-center gap-2">
          <span>{toastMessage}</span>
        </div>
      )}

    </div>
  );
}
