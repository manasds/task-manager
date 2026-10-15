'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Activity, ActivityStatus, WorkSession } from './types/activity';
import { DOCUMENT_SCHEMA_VERSION, PersistedDocument } from './types/document';
import { generateInitialActivities, getTodayDateString } from './utils/storage';
import { soundManager } from './utils/audio';
import { Navbar, ActiveTab } from './components/Navbar';
import { StatSummaryStrip } from './components/StatSummaryStrip';
import { BoardView } from './components/BoardView';
import { DayPlannerView } from './components/DayPlannerView';
import { DayActivityView } from './components/DayActivityView';
import { AnalyticsView } from './components/AnalyticsView';
import { TaskModal } from './components/TaskModal';
import { FocusTimerBar } from './components/FocusTimerBar';
import { MobileBottomNav } from './components/MobileBottomNav';
import { OfflineIndicator } from './components/OfflineIndicator';
import { AuthPanel } from './components/AuthPanel';
import { SyncStatus } from './components/SyncStatus';
import { useSessionPersistence } from './hooks/useSessionPersistence';

function withUpdatedAt(activity: Activity): Activity {
  return { ...activity, updatedAt: new Date().toISOString() };
}

export default function App() {
  const persistence = useSessionPersistence();
  const [hydrated, setHydrated] = useState(false);
  const skipDirtyRef = useRef(true);

  const [activities, setActivities] = useState<Activity[]>([]);
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const [dailyGoalMinutes, setDailyGoalMinutes] = useState<number>(360);
  const [activeTab, setActiveTab] = useState<ActiveTab>('board');
  const [selectedDate, setSelectedDate] = useState<string>(getTodayDateString());
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [activeTimerTask, setActiveTimerTask] = useState<Activity | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [modalDefaultStatus, setModalDefaultStatus] = useState<ActivityStatus>('backlog');
  const [modalDefaultTime, setModalDefaultTime] = useState<string | undefined>(undefined);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3200);
  };

  const applyDocument = (doc: PersistedDocument) => {
    skipDirtyRef.current = true;
    setActivities(doc.activities);
    setDeletedIds(doc.deletedIds);
    setDailyGoalMinutes(doc.dailyGoalMinutes);
    setActiveTab(doc.settings.lastTab);
    setSelectedDate(doc.settings.selectedDate || getTodayDateString());
    setIsMuted(doc.settings.muted);
    soundManager.setMuted(doc.settings.muted);
    setHydrated(true);
  };

  useEffect(() => {
    if (!persistence.authReady) return;
    applyDocument(persistence.currentDocument());
  }, [persistence.authReady, persistence.user?.id]);

  useEffect(() => {
    if (!hydrated) return;
    const doc: PersistedDocument = {
      schemaVersion: DOCUMENT_SCHEMA_VERSION,
      dailyGoalMinutes,
      settings: {
        muted: isMuted,
        lastTab: activeTab,
        selectedDate,
      },
      activities,
      deletedIds,
      timer: null,
      updatedAt: new Date().toISOString(),
    };
    const markDirty = !skipDirtyRef.current;
    if (skipDirtyRef.current) skipDirtyRef.current = false;
    persistence.persistLocal(doc, markDirty);
  }, [
    hydrated,
    activities,
    deletedIds,
    dailyGoalMinutes,
    isMuted,
    activeTab,
    selectedDate,
    persistence.persistLocal,
  ]);

  const handleUpdateActivity = (updated: Activity) => {
    const next = withUpdatedAt(updated);
    setActivities((prev) => {
      const exists = prev.some((a) => a.id === next.id);
      if (exists) return prev.map((a) => (a.id === next.id ? next : a));
      return [next, ...prev];
    });
    setDeletedIds((prev) => prev.filter((id) => id !== next.id));
    if (activeTimerTask && activeTimerTask.id === next.id) {
      setActiveTimerTask(next);
    }
  };

  const handleDeleteActivity = (activityId: string) => {
    soundManager.playDrop();
    setActivities((prev) => prev.filter((a) => a.id !== activityId));
    setDeletedIds((prev) => (prev.includes(activityId) ? prev : [...prev, activityId]));
    if (activeTimerTask && activeTimerTask.id === activityId) {
      setActiveTimerTask(null);
    }
    showToast('Activity removed');
  };

  const handleMoveActivityStatus = (activityId: string, newStatus: ActivityStatus) => {
    const now = new Date().toISOString();
    setActivities((prev) =>
      prev.map((a) => {
        if (a.id !== activityId) return a;
        return {
          ...a,
          status: newStatus,
          completedAt: newStatus === 'completed' ? now : undefined,
          updatedAt: now,
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

  const handleLogTime = (activityId: string, minutesToAdd: number, session: WorkSession) => {
    const now = new Date().toISOString();
    setActivities((prev) =>
      prev.map((a) => {
        if (a.id !== activityId) return a;
        const workSessions = [...(a.workSessions ?? []), session];
        return {
          ...a,
          actualMinutes: (a.actualMinutes || 0) + minutesToAdd,
          workSessions,
          updatedAt: now,
        };
      })
    );
    showToast(`Logged ${minutesToAdd}m to activity`);
  };

  const handleCompleteActivity = (activityId: string) => {
    const now = new Date().toISOString();
    setActivities((prev) =>
      prev.map((a) => {
        if (a.id !== activityId) return a;
        return {
          ...a,
          status: 'completed',
          completedAt: now,
          updatedAt: now,
        };
      })
    );
    setActiveTimerTask(null);
    showToast('Activity completed');
  };

  const handleResetData = () => {
    if (persistence.user) {
      showToast('Demo data is only available before you sign in');
      return;
    }
    const fresh = generateInitialActivities();
    setActivities(fresh);
    setDeletedIds([]);
    setActiveTimerTask(null);
    soundManager.playDrop();
    showToast('Demo activities loaded on this device');
  };

  const handleExportData = () => {
    const dataStr =
      'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(activities, null, 2));
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
            const now = new Date().toISOString();
            setDeletedIds((prev) => [...prev, ...activities.map((a) => a.id)]);
            setActivities(parsed.map((item: Activity) => ({ ...item, updatedAt: item.updatedAt || now })));
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

  const handleGoogleSignIn = async () => {
    await persistence.startGoogleSignIn();
  };

  const handleSignOut = async () => {
    const guest = await persistence.logout();
    applyDocument(guest);
    showToast('Signed out. Cloud changes were flushed first when possible.');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      <Navbar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onOpenNewTaskModal={() => handleOpenNewTaskModal('backlog')}
        onResetData={handleResetData}
        onExportData={handleExportData}
        onImportData={handleImportData}
        isMuted={isMuted}
        onToggleMute={handleToggleMute}
        user={persistence.user}
        syncPhase={persistence.phase}
        lastError={persistence.lastError}
        lastFlushReason={persistence.lastFlushReason}
        lastSyncedAt={persistence.lastSyncedAt}
        onGoogleSignIn={handleGoogleSignIn}
        onFlush={() => {
          void persistence.flush('explicit');
        }}
        onSignOut={() => {
          void handleSignOut();
        }}
        showResetDemo={!persistence.user}
      />

      {!persistence.user && persistence.authReady && (
        <div className="bg-indigo-50 border-b border-indigo-100">
          <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2.5 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
            <p className="text-xs text-indigo-900 flex-1">
              Signed-out work stays on this browser. Continue with Google to keep a personal board
              in Neon — edits save here instantly and sync when you leave the tab, go offline, or
              tap Sync now.
            </p>
            <div className="lg:hidden">
              <AuthPanel onGoogleSignIn={handleGoogleSignIn} />
            </div>
          </div>
        </div>
      )}

      {persistence.user && (
        <div className="xl:hidden bg-white border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-3 py-1.5">
            <SyncStatus
              user={persistence.user}
              phase={persistence.phase}
              lastError={persistence.lastError}
              lastFlushReason={persistence.lastFlushReason}
              lastSyncedAt={persistence.lastSyncedAt}
              onFlush={() => {
                void persistence.flush('explicit');
              }}
              onSignOut={() => {
                void handleSignOut();
              }}
            />
          </div>
        </div>
      )}

      <StatSummaryStrip
        activities={activities}
        dailyGoalMinutes={dailyGoalMinutes}
        onOpenAnalytics={() => setActiveTab('analytics')}
      />

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

        {activeTab === 'activity' && (
          <DayActivityView
            activities={activities}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            onEditActivity={handleEditActivity}
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

      <TaskModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleUpdateActivity}
        initialActivity={editingActivity}
        defaultStatus={modalDefaultStatus}
        defaultTime={modalDefaultTime}
      />

      <FocusTimerBar
        activity={activeTimerTask}
        onLogTime={handleLogTime}
        onCompleteActivity={handleCompleteActivity}
        onClose={() => setActiveTimerTask(null)}
      />

      <MobileBottomNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onOpenNewTaskModal={() => handleOpenNewTaskModal('backlog')}
      />

      <OfflineIndicator />

      {toastMessage && (
        <div className="fixed top-16 sm:top-20 right-4 sm:right-6 z-50 bg-slate-900 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-xl border border-slate-800 animate-in fade-in slide-in-from-top-2 duration-150 flex items-center gap-2">
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
