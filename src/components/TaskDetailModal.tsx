import React, { useEffect, useState } from "react";
import { X, Pencil, CheckCircle2, Circle } from "lucide-react";
import { Activity, CATEGORIES, PRIORITY_CONFIG, STATUS_COLUMNS } from "../types/activity";
import { formatMinutes, parseLocalDate } from "../utils/workSessions";

interface TaskDetailModalProps {
  activity: Activity;
  /** Saves edited notes; called on close only if they changed. */
  onSave: (activity: Activity) => void;
  onClose: () => void;
  /** Open the full edit form instead. */
  onEdit: () => void;
}

function formatDate(date: string): string {
  return parseLocalDate(date).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function formatTime(time: string): string {
  const [h, m] = time.split(":").map(Number);

  return new Date(2000, 0, 1, h, m).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/** Read-only view of a task. Only the notes can be edited here. */
export const TaskDetailModal: React.FC<TaskDetailModalProps> = ({ activity, onSave, onClose, onEdit }) => {
  const [notes, setNotes] = useState(activity.description ?? "");
  const category = CATEGORIES[activity.category];
  const priority = PRIORITY_CONFIG[activity.priority];
  const status = STATUS_COLUMNS.find((c) => c.id === activity.status);
  const doneCount = activity.subtasks.filter((s) => s.completed).length;

  const saveNotes = () => {
    const trimmed = notes.trim();

    if (trimmed !== (activity.description ?? "")) onSave({ ...activity, description: trimmed || undefined });
  };

  const close = () => {
    saveNotes();
    onClose();
  };

  // Re-attached each render so Escape saves the latest notes.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };

    document.addEventListener("keydown", onKeyDown);

    return () => document.removeEventListener("keydown", onKeyDown);
  });

  const details: { label: string; value: string }[] = [
    { label: "Estimated", value: formatMinutes(activity.estimatedMinutes) },
    { label: "Logged", value: formatMinutes(activity.actualMinutes) },
    { label: "Start date", value: formatDate(activity.date) },
    { label: "Scheduled", value: activity.scheduledTime ? formatTime(activity.scheduledTime) : "Not set" },
    ...(activity.deadline ? [{ label: "Deadline", value: formatDate(activity.deadline) }] : []),
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/50 backdrop-blur-xs"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        className="bg-white rounded-t-3xl sm:rounded-2xl max-w-xl w-full max-h-[92vh] sm:max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in slide-in-from-bottom-5 sm:zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-detail-title"
      >
        <div className="sm:hidden pt-2.5 pb-1 flex justify-center">
          <div className="w-12 h-1.5 bg-slate-300 rounded-full" />
        </div>

        <div className="flex items-start justify-between gap-3 px-5 sm:px-6 py-3.5 border-b border-slate-100">
          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold">
              <span
                className="px-2 py-0.5 rounded-md border"
                style={{ backgroundColor: category.lightBg, borderColor: category.borderColor, color: category.textColor }}
              >
                {category.label}
              </span>
              <span className={`flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-50 ${priority.textColor}`}>
                <span className="size-1.5 rounded-full" style={{ backgroundColor: priority.dotColor }} />
                {priority.label}
              </span>
              {status && <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">{status.title}</span>}
            </div>
            <h3
              id="task-detail-title"
              className={`text-base font-bold leading-snug ${
                activity.status === "completed" ? "text-slate-500 line-through" : "text-slate-900"
              }`}
            >
              {activity.title}
            </h3>
          </div>
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={() => {
                saveNotes();
                onEdit();
              }}
              className="min-h-11 min-w-11 flex items-center justify-center text-slate-400 hover:text-slate-700 active:bg-slate-100 rounded-xl transition-colors"
              aria-label="Edit activity"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={close}
              className="min-h-11 min-w-11 flex items-center justify-center text-slate-400 hover:text-slate-700 active:bg-slate-100 rounded-xl transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 text-xs">
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {details.map((d) => (
              <div key={d.label} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                <dt className="text-[11px] text-slate-400 font-medium">{d.label}</dt>
                <dd className="mt-0.5 font-semibold text-slate-800 tabular-nums">{d.value}</dd>
              </div>
            ))}
          </dl>

          {activity.subtasks.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-700 text-xs">Checklist</span>
                <span className="text-[11px] text-slate-400 font-medium">
                  {doneCount}/{activity.subtasks.length} done
                </span>
              </div>
              <ul className="space-y-1.5">
                {activity.subtasks.map((sub) => (
                  <li key={sub.id} className="flex items-center gap-2.5 p-2 bg-slate-50 rounded-xl border border-slate-200/80">
                    {sub.completed ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <Circle className="w-4 h-4 text-slate-400 shrink-0" />
                    )}
                    <span className={sub.completed ? "text-slate-400 line-through" : "text-slate-800"}>{sub.title}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="task-detail-notes" className="font-semibold text-slate-700 text-xs">
              Notes
            </label>
            <textarea
              id="task-detail-notes"
              rows={6}
              placeholder="Context, requirements, links or outcomes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs leading-relaxed"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 px-5 sm:px-6 py-3 border-t border-slate-100 bg-white">
          <button
            type="button"
            onClick={close}
            className="min-h-11 px-5 font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-98 rounded-xl shadow-xs transition-all"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
