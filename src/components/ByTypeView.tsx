import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { Activity, PRIORITY_CONFIG } from "../types/activity";
import type { CanvasTile } from "../types/canvas";
import { fetchCanvas } from "../api/client";
import { getDomain, getYouTubeId, youtubeThumbnail } from "../utils/canvas";
import { getTodayDateString } from "../utils/dates";

interface ByTypeViewProps {
  activities: Activity[];
  signedIn: boolean;
  onView: (activity: Activity) => void;
  onDelete: (activityId: string) => void;
}

type LinksState =
  | { phase: "loading" }
  | { phase: "error" }
  | { phase: "ready"; tiles: CanvasTile[] };

const mutedText =
  "h-28 border-2 border-dashed border-slate-200/90 rounded-2xl flex items-center justify-center p-4 text-center text-xs text-slate-400";

const cardClass =
  "block bg-white rounded-2xl border border-slate-200 hover:border-slate-300 p-3 space-y-2.5 text-left transition-[color,background-color,border-color,opacity,filter] duration-200";

const doneClass =
  "bg-slate-50/70 opacity-60 saturate-50 hover:opacity-100 hover:saturate-100";

const PRIORITY_PILL: Record<Activity["priority"], string> = {
  low: "bg-emerald-50 text-emerald-600",
  medium: "bg-amber-50 text-amber-500",
  high: "bg-rose-50 text-rose-500",
  urgent: "bg-rose-50 text-rose-500",
};

const formatDay = (date: Date) =>
  date.toLocaleDateString(undefined, { day: "numeric", month: "short" });

const Column: React.FC<{
  title: string;
  count: number;
  action?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, count, action, children }) => (
  <div className="flex flex-col bg-white border border-neutral-100 p-3 sm:p-3.5 min-h-125 sm:min-h-155 h-full">
    <div className="flex items-center justify-between pb-3 px-1 border-b border-slate-200/60 mb-3">
      <div className="flex items-center gap-2">
        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
          {title}
        </h3>
        <span className="text-[11px] font-semibold text-slate-600 bg-white/90 border border-slate-200 px-2 py-0.5 rounded-md tabular-nums shadow-2xs">
          {count}
        </span>
      </div>
      {action}
    </div>
    <div className="flex-1 space-y-2.5 p-0.5 -m-0.5">{children}</div>
  </div>
);

export const ByTypeView: React.FC<ByTypeViewProps> = ({
  activities,
  signedIn,
  onView,
  onDelete,
}) => {
  const [links, setLinks] = useState<LinksState>({ phase: "loading" });
  const today = getTodayDateString();

  useEffect(() => {
    if (!signedIn) return;
    let cancelled = false;
    fetchCanvas()
      .then(({ tiles }) => !cancelled && setLinks({ phase: "ready", tiles }))
      .catch(() => !cancelled && setLinks({ phase: "error" }));

    return () => {
      cancelled = true;
    };
  }, [signedIn]);

  const ofType = (category: Activity["category"]) => {
    const mine = activities.filter(
      (a) => a.category === category && a.status !== "parked",
    );

    return [
      ...mine.filter((a) => a.status !== "completed"),
      ...mine.filter((a) => a.status === "completed"),
    ];
  };

  const parked = activities.filter((a) => a.status === "parked");

  const tiles =
    links.phase === "ready"
      ? [
          ...links.tiles.filter((t) => t.status !== "done"),
          ...links.tiles.filter((t) => t.status === "done"),
        ]
      : [];

  const taskCard = (a: Activity) => {
    const done = a.status === "completed";
    const overdue = !!a.deadline && a.deadline < today && !done;

    return (
      <div
        key={a.id}
        role="button"
        tabIndex={0}
        onClick={() => onView(a)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && e.target === e.currentTarget) onView(a);
        }}
        className={`${cardClass} h-32 cursor-pointer focus-visible:outline-2 focus-visible:outline-indigo-500 ${
          done ? doneClass : ""
        }`}
      >
        <div className="flex items-start gap-1.5">
          <p className="flex-1 min-w-0 text-sm font-semibold leading-snug text-slate-900 line-clamp-2">
            {a.title}
          </p>
          <span
            className={`shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${PRIORITY_PILL[a.priority]}`}
          >
            {PRIORITY_CONFIG[a.priority].label}
          </span>
          <button
            type="button"
            aria-label="Delete task"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(a.id);
            }}
            className="shrink-0 size-7 max-sm:size-11 flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
        {a.description && (
          <p className="text-xs leading-relaxed text-slate-500 line-clamp-2">
            {a.description}
          </p>
        )}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs text-slate-500 tabular-nums">
          <span>{formatDay(new Date(a.createdAt))}</span>
          {a.deadline && (
            <span
              className={
                overdue ? "font-medium text-rose-600" : "text-slate-600"
              }
            >
              Due {formatDay(new Date(`${a.deadline}T00:00:00`))}
            </span>
          )}
        </div>
      </div>
    );
  };

  const taskColumn = (title: string, list: Activity[]) => (
    <Column title={title} count={list.length}>
      {list.length === 0 ? (
        <div className={mutedText}>Nothing here</div>
      ) : (
        list.map(taskCard)
      )}
    </Column>
  );

  const linksCount = links.phase === "ready" ? tiles.length : 0;

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 items-stretch">
        {taskColumn("To Build", ofType("build"))}
        {taskColumn("Learning", ofType("learn"))}
        <Column
          title="Open"
          count={linksCount}
          action={
            <Link
              href="/canvas"
              className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700"
            >
              Canvas
            </Link>
          }
        >
          {!signedIn ? (
            <div className={mutedText}>Sign in to see your Canvas links.</div>
          ) : links.phase === "loading" ? (
            <div className={mutedText}>Loading…</div>
          ) : links.phase === "error" ? (
            <div className={mutedText}>Could not load links.</div>
          ) : tiles.length === 0 ? (
            <div className={mutedText}>Nothing here</div>
          ) : (
            tiles.map((t) => {
              const ytId = getYouTubeId(t.url);

              return (
                <a
                  key={t.id}
                  href={t.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${cardClass} ${t.status === "done" ? doneClass : ""}`}
                >
                  <div className="flex items-start gap-2">
                    {ytId && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={youtubeThumbnail(ytId)}
                        alt=""
                        className="shrink-0 w-12 h-8 rounded-md object-cover"
                      />
                    )}
                    <p className="flex-1 min-w-0 text-sm font-semibold leading-snug text-slate-900 line-clamp-2">
                      {t.title || getDomain(t.url)}
                    </p>
                  </div>
                  <p className="text-xs leading-relaxed text-slate-500 line-clamp-2">
                    {getDomain(t.url)}
                  </p>
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs text-slate-500 tabular-nums">
                    <span>{formatDay(new Date(t.createdAt))}</span>
                  </div>
                </a>
              );
            })
          )}
        </Column>
        {taskColumn("Parking", parked)}
      </div>
    </div>
  );
};
