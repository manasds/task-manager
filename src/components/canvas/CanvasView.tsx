'use client';

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  BookOpen,
  Check,
  FileText,
  Headphones,
  Link as LinkIcon,
  Pencil,
  Plus,
  RotateCcw,
  StickyNote,
  Trash2,
  X,
  Youtube,
  type LucideIcon,
} from 'lucide-react';
import {
  CanvasKind,
  CanvasTile,
  detectKind,
  getDomain,
  getYouTubeId,
  loadCanvasTiles,
  saveCanvasTiles,
  youtubeThumbnail,
} from '@/utils/canvasStorage';

const KIND_META: Record<CanvasKind, { label: string; icon: LucideIcon; cover: string; iconColor: string }> = {
  youtube: { label: 'YouTube', icon: Youtube, cover: 'from-red-100 to-red-300', iconColor: 'text-red-500/70' },
  blog: { label: 'Blog', icon: BookOpen, cover: 'from-amber-100 to-amber-300', iconColor: 'text-amber-600/70' },
  article: { label: 'Article', icon: FileText, cover: 'from-sky-100 to-sky-300', iconColor: 'text-sky-600/70' },
  podcast: { label: 'Podcast', icon: Headphones, cover: 'from-violet-100 to-violet-300', iconColor: 'text-violet-600/70' },
  other: { label: 'Other', icon: LinkIcon, cover: 'from-slate-100 to-slate-300', iconColor: 'text-slate-500/70' },
};

type Filter = 'all' | 'watching' | 'reading' | 'done';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'watching', label: 'Watching' },
  { id: 'reading', label: 'Reading' },
  { id: 'done', label: 'Done' },
];

const inputClass =
  'w-full min-w-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100';

const actionBtn =
  'inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-slate-600 shadow-sm backdrop-blur hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400';

function matches(tile: CanvasTile, filter: Filter): boolean {
  switch (filter) {
    case 'watching':
      return tile.status === 'active' && (tile.kind === 'youtube' || tile.kind === 'podcast');
    case 'reading':
      return tile.status === 'active' && (tile.kind === 'blog' || tile.kind === 'article');
    case 'done':
      return tile.status === 'done';
    default:
      return true;
  }
}

function normalizeUrl(raw: string): string {
  const v = raw.trim();
  if (!v) return v;
  return /^[a-z][a-z0-9+.-]*:/i.test(v) ? v : `https://${v}`;
}

function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function stop(e: React.SyntheticEvent) {
  e.preventDefault();
  e.stopPropagation();
}

export default function CanvasView() {
  const [tiles, setTiles] = useState<CanvasTile[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');

  const [adding, setAdding] = useState(false);
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<CanvasKind>('other');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editNote, setEditNote] = useState('');

  const [dragId, setDragId] = useState<string | null>(null);
  const tilesRef = useRef<CanvasTile[]>([]);
  const draggingRef = useRef(false);
  const suppressClickRef = useRef(false);
  const applyDragRef = useRef<(() => void) | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const initial = loadCanvasTiles();
    tilesRef.current = initial;
    setTiles(initial);
    setLoaded(true);
    return () => cleanupRef.current?.();
  }, []);

  // Keep the dragged tile glued to the pointer after live reorders change its natural slot.
  useLayoutEffect(() => {
    applyDragRef.current?.();
  }, [tiles]);

  const startGesture = (e: React.PointerEvent<HTMLElement>, id: string) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if ((e.target as HTMLElement).closest('button')) return;
    cleanupRef.current?.();
    const el = e.currentTarget;
    const pid = e.pointerId;
    const touch = e.pointerType === 'touch';
    const sx = e.clientX;
    const sy = e.clientY;
    let px = sx;
    let py = sy;
    let grabX = 0;
    let grabY = 0;
    let dragging = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const apply = () => {
      if (!dragging) return;
      el.style.transform = 'none';
      const r = el.getBoundingClientRect();
      el.style.transform = `translate(${px - grabX - r.left}px, ${py - grabY - r.top}px) scale(1.03)`;
    };

    const begin = () => {
      if (dragging) return;
      dragging = true;
      draggingRef.current = true;
      const r = el.getBoundingClientRect();
      grabX = sx - r.left;
      grabY = sy - r.top;
      el.style.pointerEvents = 'none';
      try {
        el.setPointerCapture(pid);
      } catch {
        /* window listeners still track the pointer */
      }
      applyDragRef.current = apply;
      setDragId(id);
      apply();
    };

    const blockTouchScroll = (ev: TouchEvent) => {
      if (dragging && ev.cancelable) ev.preventDefault();
    };

    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== pid) return;
      px = ev.clientX;
      py = ev.clientY;
      if (!dragging) {
        const dist = Math.hypot(px - sx, py - sy);
        if (touch) {
          if (dist > 8) cleanup();
        } else if (dist > 6) {
          begin();
        }
        return;
      }
      if (ev.cancelable) ev.preventDefault();
      apply();
      const over = document.elementFromPoint(px, py)?.closest<HTMLElement>('[data-tile-id]');
      const overId = over?.dataset.tileId;
      if (overId && overId !== id) {
        const list = tilesRef.current;
        const from = list.findIndex(t => t.id === id);
        const to = list.findIndex(t => t.id === overId);
        if (from !== -1 && to !== -1 && from !== to) {
          const next = list.slice();
          const [moved] = next.splice(from, 1);
          next.splice(to, 0, moved);
          tilesRef.current = next;
          setTiles(next);
        }
      }
    };

    const onEnd = (ev: PointerEvent) => {
      if (ev.pointerId !== pid) return;
      const wasDragging = dragging;
      cleanup();
      if (wasDragging) {
        suppressClickRef.current = true;
        setTimeout(() => {
          suppressClickRef.current = false;
        }, 60);
        saveCanvasTiles(tilesRef.current);
      }
    };

    function cleanup() {
      if (timer) clearTimeout(timer);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onEnd);
      window.removeEventListener('pointercancel', onEnd);
      window.removeEventListener('touchmove', blockTouchScroll);
      if (dragging) {
        el.style.transform = '';
        el.style.pointerEvents = '';
        try {
          el.releasePointerCapture(pid);
        } catch {
          /* already released */
        }
        setDragId(null);
      }
      dragging = false;
      draggingRef.current = false;
      applyDragRef.current = null;
      if (cleanupRef.current === cleanup) cleanupRef.current = null;
    }

    cleanupRef.current = cleanup;
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onEnd);
    window.addEventListener('pointercancel', onEnd);
    window.addEventListener('touchmove', blockTouchScroll, { passive: false });
    if (touch) timer = setTimeout(begin, 250);
  };

  const update = (next: CanvasTile[]) => {
    tilesRef.current = next;
    setTiles(next);
    saveCanvasTiles(next);
  };

  const onUrlChange = (value: string) => {
    setUrl(value);
    setKind(detectKind(normalizeUrl(value)));
  };

  const resetAdd = () => {
    setAdding(false);
    setUrl('');
    setTitle('');
    setKind('other');
  };

  const onAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const finalUrl = normalizeUrl(url);
    if (!finalUrl) return;
    const k = kind;
    const fallback = getDomain(finalUrl) || (k === 'youtube' ? 'YouTube video' : finalUrl);
    const tile: CanvasTile = {
      id: newId(),
      url: finalUrl,
      title: title.trim() || (k === 'youtube' && getYouTubeId(finalUrl) ? 'YouTube video' : fallback),
      kind: k,
      status: 'active',
      note: '',
      createdAt: new Date().toISOString(),
    };
    update([tile, ...tiles]);
    resetAdd();
  };

  const toggleStatus = (id: string) =>
    update(tiles.map(t => (t.id === id ? { ...t, status: t.status === 'done' ? 'active' : 'done' } : t)));

  const startEdit = (t: CanvasTile) => {
    setEditingId(t.id);
    setEditTitle(t.title);
    setEditNote(t.note);
  };

  const saveEdit = (id: string) => {
    update(tiles.map(t => (t.id === id ? { ...t, title: editTitle.trim() || t.title, note: editNote.trim() } : t)));
    setEditingId(null);
  };

  const remove = (t: CanvasTile) => {
    if (window.confirm(`Delete "${t.title}"?`)) update(tiles.filter(x => x.id !== t.id));
  };

  const visible = useMemo(() => tiles.filter(t => matches(t, filter)), [tiles, filter]);

  const onFormKey = (e: React.KeyboardEvent, cancel: () => void) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      cancel();
    }
  };

  return (
    <div
      className="min-h-screen bg-slate-50 text-slate-800"
      style={{ backgroundImage: 'radial-gradient(#a3b1c2 1px, transparent 1px)', backgroundSize: '20px 20px' }}
    >
      <div className="mx-auto w-full max-w-7xl px-4 py-3 sm:px-6">
        <header className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          <h1 className="flex items-baseline gap-2 text-lg font-bold text-slate-900">
            Canvas
            <span className="text-xs font-medium text-slate-400">
              {tiles.length} {tiles.length === 1 ? 'tile' : 'tiles'}
            </span>
          </h1>
          <div className="order-last flex w-full flex-wrap gap-1.5 sm:order-none sm:w-auto" role="group" aria-label="Filter tiles">
            {FILTERS.map(f => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                aria-pressed={filter === f.id}
                className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                  filter === f.id
                    ? 'border-indigo-600 bg-indigo-600 text-white'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          {tiles.length >= 2 && <span className="text-xs text-slate-400">Drag to reorder</span>}
          <Link
            href="/"
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </Link>
        </header>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {adding ? (
            <form
              onSubmit={onAdd}
              onKeyDown={e => onFormKey(e, resetAdd)}
              className="flex aspect-square min-w-0 flex-col justify-between gap-1.5 overflow-hidden rounded-2xl border border-indigo-300 bg-white p-2.5 shadow-sm"
            >
              <input
                type="text"
                inputMode="url"
                autoFocus
                required
                value={url}
                onChange={e => onUrlChange(e.target.value)}
                placeholder="Paste a link"
                aria-label="URL"
                className={inputClass}
              />
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Title (optional)"
                aria-label="Title"
                className={inputClass}
              />
              <select
                value={kind}
                onChange={e => setKind(e.target.value as CanvasKind)}
                aria-label="Kind"
                className={inputClass}
              >
                {(Object.keys(KIND_META) as CanvasKind[]).map(k => (
                  <option key={k} value={k}>
                    {KIND_META[k].label}
                  </option>
                ))}
              </select>
              <div className="flex gap-1.5">
                <button
                  type="submit"
                  className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-indigo-600 px-2 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add
                </button>
                <button
                  type="button"
                  onClick={resetAdd}
                  className="inline-flex flex-1 items-center justify-center rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="flex aspect-square min-w-0 flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-slate-300 bg-white text-slate-500 shadow-sm transition hover:border-indigo-400 hover:bg-indigo-50 hover:text-indigo-600"
            >
              <Plus className="h-7 w-7" />
              <span className="text-sm font-medium">Add</span>
            </button>
          )}

          {visible.map(t => {
            const meta = KIND_META[t.kind];
            const Icon = meta.icon;
            const domain = getDomain(t.url);
            const ytId = t.kind === 'youtube' ? getYouTubeId(t.url) : null;
            const done = t.status === 'done';

            if (editingId === t.id) {
              return (
                <form
                  key={t.id}
                  onSubmit={e => {
                    e.preventDefault();
                    saveEdit(t.id);
                  }}
                  onKeyDown={e => onFormKey(e, () => setEditingId(null))}
                  className="flex aspect-square min-w-0 flex-col justify-between gap-1.5 overflow-hidden rounded-2xl border border-indigo-300 bg-white p-2.5 shadow-sm"
                >
                  <input
                    type="text"
                    autoFocus
                    value={editTitle}
                    onChange={e => setEditTitle(e.target.value)}
                    placeholder="Title"
                    aria-label="Edit title"
                    className={inputClass}
                  />
                  <textarea
                    value={editNote}
                    onChange={e => setEditNote(e.target.value)}
                    placeholder="Note"
                    aria-label="Edit note"
                    className={`${inputClass} min-h-0 flex-1 resize-none`}
                  />
                  <div className="flex gap-1.5">
                    <button
                      type="submit"
                      className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-indigo-600 px-2 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
                    >
                      <Check className="h-3.5 w-3.5" />
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
                    >
                      <X className="h-3.5 w-3.5" />
                      Cancel
                    </button>
                  </div>
                </form>
              );
            }

            return (
              <article
                key={t.id}
                data-tile-id={t.id}
                onPointerDown={e => startGesture(e, t.id)}
                onClickCapture={e => {
                  if (suppressClickRef.current) {
                    e.preventDefault();
                    e.stopPropagation();
                  }
                }}
                onDragStart={e => e.preventDefault()}
                onContextMenu={e => {
                  if (draggingRef.current) e.preventDefault();
                }}
                className={`group relative aspect-square min-w-0 select-none overflow-hidden rounded-2xl border border-slate-200 bg-white [-webkit-touch-callout:none] ${
                  dragId === t.id
                    ? 'z-50 cursor-grabbing touch-none shadow-xl transition-none'
                    : 'cursor-grab shadow-sm transition hover:shadow-md'
                }`}
              >
                <a
                  href={t.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  draggable={false}
                  aria-label={`Open ${t.title}`}
                  className="absolute inset-0 block"
                >
                  <div className={`absolute inset-0 ${done ? 'opacity-60 grayscale' : ''}`}>
                    {ytId ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={youtubeThumbnail(ytId)}
                        alt=""
                        loading="lazy"
                        draggable={false}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${meta.cover}`}>
                        <Icon className={`h-14 w-14 ${meta.iconColor}`} />
                      </div>
                    )}
                  </div>
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-3 pb-2.5 pt-10">
                    <p
                      className={`line-clamp-2 break-words text-sm font-semibold text-white ${done ? 'line-through' : ''}`}
                    >
                      {t.title}
                    </p>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      {domain && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`}
                          alt=""
                          loading="lazy"
                          width={14}
                          height={14}
                          draggable={false}
                          onError={e => {
                            e.currentTarget.style.display = 'none';
                          }}
                          className="h-3.5 w-3.5 shrink-0 rounded-sm"
                        />
                      )}
                      <span className="min-w-0 flex-1 truncate text-[11px] text-white/70">{domain}</span>
                      {t.note && (
                        <span title={t.note} className="shrink-0 text-white/80">
                          <StickyNote className="h-3.5 w-3.5" />
                        </span>
                      )}
                    </div>
                  </div>
                </a>

                <span className="pointer-events-none absolute left-2 top-2 inline-flex max-w-[55%] items-center gap-1 truncate rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-slate-700 backdrop-blur">
                  {meta.label}
                  {done && <Check className="h-3 w-3 text-emerald-600" aria-label="Done" />}
                </span>

                <div className="absolute right-2 top-2 flex gap-1 md:opacity-0 md:transition-opacity md:group-hover:opacity-100 md:group-focus-within:opacity-100">
                  <button
                    type="button"
                    onClick={e => {
                      stop(e);
                      toggleStatus(t.id);
                    }}
                    aria-label={done ? 'Reopen' : 'Mark done'}
                    title={done ? 'Reopen' : 'Mark done'}
                    className={actionBtn}
                  >
                    {done ? <RotateCcw className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                  </button>
                  <button
                    type="button"
                    onClick={e => {
                      stop(e);
                      startEdit(t);
                    }}
                    aria-label="Edit"
                    title="Edit"
                    className={actionBtn}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={e => {
                      stop(e);
                      remove(t);
                    }}
                    aria-label="Delete"
                    title="Delete"
                    className={`${actionBtn} hover:text-red-600`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        {loaded && visible.length === 0 && (
          <p className="mt-4 text-sm text-slate-500">
            {tiles.length === 0 ? "Add a video or article you're into right now." : 'No tiles match this filter.'}
          </p>
        )}
      </div>
    </div>
  );
}
