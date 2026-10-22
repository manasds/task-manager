'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Activity, ActivityStatus, goalNames, normalizeActivity } from './types/activity';
import { CloudUser, DOCUMENT_SCHEMA_VERSION, FocusTimerSnapshot, PersistedDocument } from './types/document';
import { getTodayDateString } from './utils/dates';
import { soundManager } from './utils/audio';
import { Navbar, ActiveTab } from './components/Navbar';
import { StatSummaryStrip } from './components/StatSummaryStrip';
import { BoardView } from './components/BoardView';
import { ByTypeView } from './components/ByTypeView';
import { DayPlannerView } from './components/DayPlannerView';
import { DayActivityView } from './components/DayActivityView';
import { AnalyticsView } from './components/AnalyticsView';
import { TaskModal } from './components/TaskModal';
import { FocusTimerBar } from './components/FocusTimerBar';
import { MobileBottomNav } from './components/MobileBottomNav';
import { OfflineIndicator } from './components/OfflineIndicator';
import { useSessionPersistence } from './hooks/useSessionPersistence';
import { applyRemoteActivities } from './utils/syncPolicy';
import { createWorkSession, formatMinutes, timerElapsedSeconds } from './utils/workSessions';

function withUpdatedAt(activity: Activity): Activity {
  return { ...activity, updatedAt: new Date().toISOString() };
}

/** Set before the sign-out reload so the fresh page can confirm it. */
const SIGNED_OUT_FLAG = 'orbittask_signed_out';

/** Drop a timer whose task no longer exists; it has nothing to log to. */
function timerFor(timer: FocusTimerSnapshot | null, activities: Activity[]): FocusTimerSnapshot | null {
  return timer && activities.some((a) => a.id === timer.activityId) ? timer : null;
}

export default function App({ initialUser, sessionError }: { initialUser: CloudUser | null; sessionError?: boolean }) {
  const [hydrated, setHydrated] = useState(false);
  const skipDirtyRef = useRef(true);

  const [activities, setActivities] = useState<Activity[]>([]);
  const [dailyGoalMinutes, setDailyGoalMinutes] = useState<number>(360);
  const [activeTab, setActiveTab] = useState<ActiveTab>('board');
  const [selectedDate, setSelectedDate] = useState<string>(getTodayDateString());
  /** Goal filter shared by the Progress and By type views: 'all' or a goal name. */
  const [goal, setGoal] = useState('all');
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [timer, setTimer] = useState<FocusTimerSnapshot | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [modalDefaultStatus, setModalDefaultStatus] = useState<ActivityStatus>('backlog');
  const [modalDefaultTime, setModalDefaultTime] = useState<string | undefined>(undefined);
  const [toast, setToast] = useState<{ message: string; undo?: () => void } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persistence = useSessionPersistence(
    (update) => {
      const upserts = update.upserts.map(normalizeActivity);
      setActivities((prev) => applyRemoteActivities(prev, { ...update, upserts }));
      if (update.deletes.length > 0) {
        setTimer((current) => (current && update.deletes.includes(current.activityId) ? null : current));
      }
      if (update.dailyGoalMinutes !== undefined) setDailyGoalMinutes(update.dailyGoalMinutes);
    },
    { initialUser, sessionError }
  );
  const { authReady, currentDocument, persistLocal } = persistence;
  const userId = persistence.user?.id;

  const activeTimerTask = timer ? activities.find((a) => a.id === timer.activityId) ?? null : null;

  const showToast = (message: string, undo?: () => void) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message, undo });
    toastTimerRef.current = setTimeout(() => setToast(null), undo ? 6000 : 3200);
  };

  const dismissToast = () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast(null);
  };

  // Load the stored board once auth settles. localStorage is an external store that
  // the server render cannot read, so this is a one-time sync into React state.
  useEffect(() => {
    if (!authReady) return;
    const doc = currentDocument();
    skipDirtyRef.current = true;
    // Tasks saved before Build/Learn are converted as they load, on every device.
    // eslint-disable-next-line react/set-state-in-effect
    setActivities(doc.activities.map(normalizeActivity));
    setDailyGoalMinutes(doc.dailyGoalMinutes);
    setActiveTab(doc.settings.lastTab);
    setSelectedDate(doc.settings.selectedDate || getTodayDateString());
    setIsMuted(doc.settings.muted);
    setTimer(timerFor(doc.timer, doc.activities));
    setHydrated(true);
    if (sessionStorage.getItem(SIGNED_OUT_FLAG)) {
      sessionStorage.removeItem(SIGNED_OUT_FLAG);
      showToast('Signed out');
    }
    soundManager.setMuted(doc.settings.muted);
  }, [authReady, userId, currentDocument]);

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
      timer,
      updatedAt: new Date().toISOString(),
    };
    const markDirty = !skipDirtyRef.current;
    skipDirtyRef.current = false;
    persistLocal(doc, markDirty);
  }, [hydrated, activities, dailyGoalMinutes, isMuted, activeTab, selectedDate, timer, persistLocal]);

  // The board's date filter can hold non-date values like "all"; day views need a real date.
  const dayViewDate = /^\d{4}-\d{2}-\d{2}$/.test(selectedDate) ? selectedDate : getTodayDateString();

  const handleUpdateActivity = (updated: Activity) => {
    const next = withUpdatedAt(updated);
    setActivities((prev) => {
      const exists = prev.some((a) => a.id === next.id);
      if (exists) return prev.map((a) => (a.id === next.id ? next : a));
      return [next, ...prev];
    });
  };

  const handleDeleteActivity = (activityId: string) => {
    const removed = activities.find((a) => a.id === activityId);
    soundManager.playDrop();
    setActivities((prev) => prev.filter((a) => a.id !== activityId));
    setTimer((current) => (current?.activityId === activityId ? null : current));
    showToast(
      'Activity deleted',
      removed
        ? () => {
            handleUpdateActivity(removed);
            dismissToast();
          }
        : undefined
    );
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

  /** Add a work session ending now to an activity. */
  const logMinutes = (activityId: string, minutes: number) => {
    const now = new Date().toISOString();
    const session = createWorkSession(activityId, minutes);
    setActivities((prev) =>
      prev.map((a) => {
        if (a.id !== activityId) return a;
        return {
          ...a,
          actualMinutes: (a.actualMinutes || 0) + minutes,
          workSessions: [...(a.workSessions ?? []), session],
          updatedAt: now,
        };
      })
    );
  };

  /** Save a timer's elapsed time (rounded to minutes) and return what was saved. */
  const saveTimer = (current: FocusTimerSnapshot): number => {
    const minutes = Math.round(timerElapsedSeconds(current) / 60);
    if (minutes > 0) logMinutes(current.activityId, minutes);
    return minutes;
  };

  const handleStartFocus = (act: Activity) => {
    if (timer?.activityId === act.id) {
      if (!timer.isRunning) setTimer({ ...timer, isRunning: true, startedAt: new Date().toISOString() });
      showToast(`Already focusing on ${act.title}`);
      return;
    }
    const saved = timer ? saveTimer(timer) : 0;
    setTimer({ activityId: act.id, secondsElapsed: 0, isRunning: true, startedAt: new Date().toISOString() });
    showToast(
      saved > 0 && activeTimerTask
        ? `Saved ${formatMinutes(saved)} to ${activeTimerTask.title} · Focus: ${act.title}`
        : `Focus session: ${act.title}`
    );
  };

  const handleLogTime = (minutes: number) => {
    if (!timer) return;
    logMinutes(timer.activityId, minutes);
    setTimer({
      ...timer,
      secondsElapsed: 0,
      startedAt: timer.isRunning ? new Date().toISOString() : undefined,
    });
    showToast(`Logged ${formatMinutes(minutes)} to activity`);
  };

  const handleStopTimer = () => {
    if (!timer) return;
    const saved = saveTimer(timer);
    setTimer(null);
    showToast(saved > 0 ? `Focus stopped · saved ${formatMinutes(saved)}` : 'Focus stopped · under a minute, nothing logged');
  };

  const handleCompleteActivity = (activityId: string) => {
    const saved = timer?.activityId === activityId ? saveTimer(timer) : 0;
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
    setTimer(null);
    showToast(saved > 0 ? `Activity completed · saved ${formatMinutes(saved)}` : 'Activity completed');
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
            const imported: Activity[] = parsed
              .filter(
                (item): item is Activity =>
                  !!item &&
                  typeof item.id === 'string' &&
                  typeof item.title === 'string' &&
                  typeof item.status === 'string'
              )
              .map((item) => ({ ...item, updatedAt: now }));
            setActivities(imported);
            setTimer((current) => timerFor(current, imported));
            soundManager.playDrop();
            showToast(`Imported ${imported.length} activities`);
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

  const handleSignOut = async () => {
    try {
      await persistence.logout();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Sign out failed');
      return;
    }
    // A fresh page load resets every bit of the signed-in session's state.
    sessionStorage.setItem(SIGNED_OUT_FLAG, '1');
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      <Navbar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onOpenNewTaskModal={() => handleOpenNewTaskModal('backlog')}
        onExportData={handleExportData}
        onImportData={handleImportData}
        isMuted={isMuted}
        onToggleMute={handleToggleMute}
        user={persistence.user}
        syncPhase={persistence.phase}
        lastError={persistence.lastError}
        onGoogleSignIn={persistence.signIn}
        onFlush={() => {
          void persistence.retrySync();
        }}
        onSignOut={() => {
          void handleSignOut();
        }}
      />

      <StatSummaryStrip
        activities={activities}
        dailyGoalMinutes={dailyGoalMinutes}
      />

      <main className="flex-1 pb-24 md:pb-8">
        {activeTab === 'board' && (
          <BoardView
            activities={activities}
            onUpdateActivity={handleUpdateActivity}
            onDeleteActivity={handleDeleteActivity}
            onMoveActivityStatus={handleMoveActivityStatus}
            onStartFocus={handleStartFocus}
            onEditActivity={handleEditActivity}
            activeTimerTaskId={activeTimerTask?.id}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            goal={goal}
            onGoalChange={setGoal}
          />
        )}

        {activeTab === 'types' && (
          <ByTypeView
            activities={activities}
            goal={goal}
            onGoalChange={setGoal}
            signedIn={!!userId}
            onEdit={handleEditActivity}
            onDelete={handleDeleteActivity}
            onAddTask={() => handleOpenNewTaskModal('backlog')}
          />
        )}

        {activeTab === 'planner' && (
          <DayPlannerView
            activities={activities}
            onUpdateActivity={handleUpdateActivity}
            onOpenNewTaskModal={handleOpenNewTaskModal}
            onStartFocus={handleStartFocus}
            onEditActivity={handleEditActivity}
            selectedDate={dayViewDate}
            onSelectDate={setSelectedDate}
            activeTimerTaskId={activeTimerTask?.id}
          />
        )}

        {activeTab === 'activity' && (
          <DayActivityView
            activities={activities}
            selectedDate={dayViewDate}
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

      {isModalOpen && (
        <TaskModal
          onClose={() => setIsModalOpen(false)}
          onSave={handleUpdateActivity}
          initialActivity={editingActivity}
          defaultStatus={modalDefaultStatus}
          defaultTime={modalDefaultTime}
          goals={goalNames(activities)}
          defaultGoal={goal === 'all' ? undefined : goal}
          doingTasks={activities.filter((a) => a.status === 'in_progress' && !a.parked)}
        />
      )}

      {activeTimerTask && timer && (
        <FocusTimerBar
          key={activeTimerTask.id}
          activity={activeTimerTask}
          timer={timer}
          onTimerChange={setTimer}
          onLogTime={handleLogTime}
          onCompleteActivity={handleCompleteActivity}
          onStop={handleStopTimer}
        />
      )}

      <MobileBottomNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onOpenNewTaskModal={() => handleOpenNewTaskModal('backlog')}
      />

      <OfflineIndicator signedIn={!!persistence.user} />

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-16 sm:top-20 right-4 sm:right-6 z-50 bg-slate-900 text-white text-xs font-semibold pl-4 pr-2 py-2 min-h-10 rounded-xl shadow-xl border border-slate-800 animate-in flex items-center gap-3"
        >
          <span className="py-0.5">{toast.message}</span>
          {toast.undo && (
            <button
              type="button"
              onClick={toast.undo}
              className="px-2.5 py-1 rounded-lg text-indigo-300 hover:text-white hover:bg-slate-800 transition-colors"
            >
              Undo
            </button>
          )}
        </div>
      )}
    </div>
  );
}
