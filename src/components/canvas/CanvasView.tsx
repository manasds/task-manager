'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ChevronRight, Plus, SquareDashed } from 'lucide-react';
import {
  ApiError,
  deleteCanvasSection,
  deleteCanvasTile,
  fetchCanvas,
  fetchLinkPreview,
  saveCanvasSection,
  saveCanvasTile,
} from '@/api/client';
import { signInWithGoogle } from '@/auth/client';
import { canvasKindSchema, type CanvasKind, type CanvasSection, type CanvasTile } from '@/types/canvas';
import { detectKind, getDomain, getYouTubeId, positionBetween } from '@/utils/canvas';
import { boundsOf, boxRect, CARD_H, CARD_W, freeSpot, type Point, type Rect } from '@/utils/canvasBoard';
import CanvasBoard, { type BoardHandle, type TileDrop } from './CanvasBoard';
import { KIND_META } from './LinkCard';
import SectionPage from './SectionPage';

type Filter = 'all' | 'watching' | 'reading' | 'done';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'watching', label: 'Watching' },
  { id: 'reading', label: 'Reading' },
  { id: 'done', label: 'Done' },
];

const inputClass =
  'w-full min-w-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100';

/** Previews looked up for older links per visit; Microlink's free tier allows about 50 a day. */
const BACKFILL_PER_VISIT = 5;
const UNDO_MS = 6000;

/** A row of boxes wraps to a new row past this width, so the whole board stays readable. */
const ROW_WIDTH = 1500;

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

const byPosition = (a: CanvasTile, b: CanvasTile) => a.position - b.position || b.createdAt.localeCompare(a.createdAt);

/** Each section's tiles in order. */
function groupBySection(tiles: CanvasTile[]): Map<string, CanvasTile[]> {
  const groups = new Map<string, CanvasTile[]>();

  for (const t of [...tiles].sort(byPosition)) {
    if (!t.sectionId) continue;
    const list = groups.get(t.sectionId);

    if (list) list.push(t);
    else groups.set(t.sectionId, [t]);
  }

  return groups;
}

/** Everything a loose card must keep clear of: every box at its full size, and the other loose cards. */
function blockers(tiles: CanvasTile[], sections: CanvasSection[], except: string): Rect[] {
  const groups = groupBySection(tiles);
  const rects = sections.map(s => boxRect(s, groups.get(s.id)?.length ?? 0));

  for (const t of tiles) {
    if (t.id !== except && !t.sectionId && t.x !== null && t.y !== null) rects.push({ x: t.x, y: t.y, w: CARD_W, h: CARD_H });
  }

  return rects;
}

/** Push loose cards that a box now covers to the nearest free spot. Returns the new list and the cards that moved. */
interface Settled {
  tiles: CanvasTile[];
  moved: CanvasTile[];
}

function settleLoose(tiles: CanvasTile[], sections: CanvasSection[]): Settled {
  let next = tiles;
  const moved: CanvasTile[] = [];

  for (const t of tiles) {
    if (t.sectionId || t.x === null || t.y === null) continue;
    const spot = freeSpot({ x: t.x, y: t.y }, blockers(next, sections, t.id));

    if (spot.x === t.x && spot.y === t.y) continue;
    const updated = { ...t, x: spot.x, y: spot.y };
    moved.push(updated);
    next = next.map(o => (o.id === t.id ? updated : o));
  }

  return { tiles: next, moved };
}

/** Put a section back where it was in the list, so its tab returns to the same spot. */
function restoreAt(sections: CanvasSection[], section: CanvasSection, index: number): CanvasSection[] {
  const next = [...sections];
  next.splice(Math.min(index, next.length), 0, section);

  return next;
}

/** Where a new box goes: right of the last row, or under the board once that row is wide. */
function nextBoxSpot(tiles: CanvasTile[], sections: CanvasSection[]): Point {
  const last = sections.at(-1);
  const groups = groupBySection(tiles);
  const all = boundsOf(sections.map(s => boxRect(s, groups.get(s.id)?.length ?? 0)));

  if (!last || !all) return { x: 0, y: 0 };
  const row = boundsOf(sections.flatMap(s => (Math.abs(s.y - last.y) < 1 ? [boxRect(s, groups.get(s.id)?.length ?? 0)] : [])));
  const rowRight = row ? row.x + row.w : all.x + all.w;

  return rowRight - all.x > ROW_WIDTH ? { x: all.x, y: all.y + all.h + 60 } : { x: rowRight + 60, y: last.y };
}

interface PageState {
  id: string;
  from: Rect | null;
  closingTo: Rect | 'fade' | null;
}

interface Toast {
  text: string;
  undo: () => void;
}

export default function CanvasView() {
  const [tiles, setTiles] = useState<CanvasTile[]>([]);
  const [sections, setSections] = useState<CanvasSection[]>([]);
  const [load, setLoad] = useState<'loading' | 'ready' | 'signed-out' | 'failed'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [page, setPage] = useState<PageState | null>(null);
  const [editing, setEditing] = useState<CanvasTile | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);

  const [adding, setAdding] = useState(false);
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<CanvasKind>('other');
  const [addTo, setAddTo] = useState('');

  const boardRef = useRef<BoardHandle>(null);
  const tilesRef = useRef<CanvasTile[]>([]);
  const sectionsRef = useRef<CanvasSection[]>([]);
  /** Writes run one after another so the server sees edits in the order they were made. */
  const writesRef = useRef<Promise<void>>(Promise.resolve());
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const placedRef = useRef(false);
  const backfilledRef = useRef(false);

  /** Replace what is on screen with the server's copy. False when that is not possible. */
  const reload = useCallback(async (): Promise<boolean> => {
    try {
      const saved = await fetchCanvas();
      tilesRef.current = saved.tiles;
      sectionsRef.current = saved.sections;
      setTiles(saved.tiles);
      setSections(saved.sections);
      setLoad('ready');

      return true;
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) setLoad('signed-out');
      else setLoad(current => (current === 'ready' ? current : 'failed'));

      return false;
    }
  }, []);

  /** Show an edit at once and save it in the background. If the save fails, show the server's copy. */
  const commit = useCallback(
    <T,>(nextTiles: CanvasTile[], nextSections: CanvasSection[], save?: () => Promise<T>) => {
      tilesRef.current = nextTiles;
      sectionsRef.current = nextSections;
      setTiles(nextTiles);
      setSections(nextSections);

      if (!save) return;
      setError(null);
      writesRef.current = writesRef.current.then(save).then(
        () => undefined,
        async err => {
          if (err instanceof ApiError && err.status === 401) {
            setLoad('signed-out');

            return;
          }

          setError('Could not save that change. Showing what is saved.');
          await reload();
        }
      );
    },
    [reload]
  );

  useEffect(() => {
    void (async () => {
      if (!(await reload())) return;
      // Tiles saved on this device before the canvas moved to the database.
      let old: unknown;

      try {
        old = JSON.parse(localStorage.getItem('orbittask_canvas_v1') ?? '[]');
      } catch {
        return;
      }

      if (!Array.isArray(old) || old.length === 0) return;
      const lastPos = tilesRef.current.at(-1)?.position ?? 0;
      let failed = false;

      for (const [i, item] of old.entries()) {
        try {
          await saveCanvasTile({ ...item, position: lastPos + i + 1 });
        } catch (err) {
          if (!(err instanceof ApiError && err.status === 400)) failed = true;
        }
      }

      if (failed) return setError('Could not move the links saved on this device to your account.');
      localStorage.removeItem('orbittask_canvas_v1');
      await reload();
    })();
  }, [reload]);

  // Links saved before the board existed have no place on it yet: put them in a section.
  useEffect(() => {
    if (load !== 'ready' || placedRef.current) return;
    placedRef.current = true;
    const ids = new Set(sections.map(s => s.id));
    const unplaced = tiles.filter(t => (t.sectionId ? !ids.has(t.sectionId) : t.x === null || t.y === null));

    if (unplaced.length === 0) return;
    const home: CanvasSection = sections[0] ?? { id: newId(), name: 'Links', x: 0, y: 0, cols: 3, createdAt: new Date().toISOString() };
    const moving = new Map(unplaced.map(t => [t.id, { ...t, sectionId: home.id, x: null, y: null }]));
    const nextSections = sections[0] ? sections : [home];
    // A one-off repair of what the server sent, made once after the first load.
    // eslint-disable-next-line react/set-state-in-effect
    commit(
      tiles.map(t => moving.get(t.id) ?? t),
      nextSections,
      async () => {
        if (!sections[0]) await saveCanvasSection(home);

        for (const t of moving.values()) await saveCanvasTile(t);
      }
    );
  }, [load, tiles, sections, commit]);

  // Look up previews for a few older links that never had one.
  useEffect(() => {
    if (load !== 'ready' || backfilledRef.current) return;
    backfilledRef.current = true;
    const missing = tiles.filter(t => t.image === null).slice(0, BACKFILL_PER_VISIT);

    void (async () => {
      for (const t of missing) {
        try {
          const preview = await fetchLinkPreview(t.url);
          const current = tilesRef.current.find(o => o.id === t.id);

          if (!current) continue;
          const next = { ...current, image: preview.image ?? '' };
          commit(
            tilesRef.current.map(o => (o.id === t.id ? next : o)),
            sectionsRef.current,
            () => saveCanvasTile(next)
          );
        } catch (err) {
          // Out of free previews for today, or offline: try again on a later visit.
          if (err instanceof ApiError && err.status === 429) return;
        }
      }
    })();
  }, [load, tiles, commit]);

  // A whole board is unreadable on a phone, so narrow screens open on the first section's page.
  const openedOnPhone = useRef(false);
  useEffect(() => {
    if (load !== 'ready' || openedOnPhone.current || sections.length === 0) return;
    openedOnPhone.current = true;

    // The screen width is only known in the browser, after the first render.
    // eslint-disable-next-line react/set-state-in-effect
    if (window.innerWidth < 640) setPage({ id: sections[0].id, from: null, closingTo: null });
  }, [load, sections]);

  const visible = useMemo(() => tiles.filter(t => matches(t, filter)), [tiles, filter]);
  const tilesBySection = useMemo(() => groupBySection(visible), [visible]);
  const looseTiles = useMemo(() => visible.filter(t => !t.sectionId && t.x !== null && t.y !== null), [visible]);

  const focusId = page && !page.closingTo ? page.id : null;
  const pageSection = page ? sections.find(s => s.id === page.id) : undefined;

  const showToast = (text: string, undo: () => void) => {
    clearTimeout(toastTimer.current);
    setToast({ text, undo });
    toastTimer.current = setTimeout(() => setToast(null), UNDO_MS);
  };

  const openPage = (id: string) => {
    if (page && !page.closingTo) {
      setPage({ id, from: null, closingTo: null });

      return;
    }

    setPage({ id, from: boardRef.current?.screenRectOf(id) ?? null, closingTo: null });
  };

  const closePage = () => {
    if (!page || page.closingTo) return;
    setPage({ ...page, closingTo: boardRef.current?.screenRectOf(page.id) ?? 'fade' });
  };

  const onPageClosed = useCallback(() => setPage(null), []);

  const onFocus = (id: string | null) => (id ? openPage(id) : closePage());

  const openTile = useCallback((tile: CanvasTile) => {
    window.open(tile.url, '_blank', 'noopener,noreferrer');
  }, []);

  const toggleDone = useCallback(
    (tile: CanvasTile) => {
      const next: CanvasTile = { ...tile, status: tile.status === 'done' ? 'active' : 'done' };
      commit(
        tilesRef.current.map(t => (t.id === tile.id ? next : t)),
        sectionsRef.current,
        () => saveCanvasTile(next)
      );
    },
    [commit]
  );

  const deleteTile = useCallback(
    (tile: CanvasTile) => {
      commit(
        tilesRef.current.filter(t => t.id !== tile.id),
        sectionsRef.current,
        () => deleteCanvasTile(tile.id)
      );
      showToast(`Deleted “${tile.title}”`, () =>
        commit([...tilesRef.current, tile], sectionsRef.current, () => saveCanvasTile(tile))
      );
    },
    [commit]
  );

  const moveTile = (id: string, drop: TileDrop) => {
    const tile = tiles.find(t => t.id === id);

    if (!tile) return;
    let next: CanvasTile;

    if (drop.kind === 'section') {
      const shown = (tilesBySection.get(drop.sectionId) ?? []).filter(t => t.id !== id);
      const position = positionBetween(shown[drop.index - 1]?.position, shown[drop.index]?.position);
      next = { ...tile, sectionId: drop.sectionId, x: null, y: null, position };
    } else {
      const spot = freeSpot(drop.point, blockers(tiles, sections, id));
      next = { ...tile, sectionId: null, x: spot.x, y: spot.y };
    }

    const settled = settleLoose(
      tiles.map(t => (t.id === id ? next : t)),
      sections
    );

    commit(settled.tiles, sections, async () => {
      await saveCanvasTile(next);

      for (const t of settled.moved) await saveCanvasTile(t);
    });
  };

  const changeSection = (id: string, change: Partial<Pick<CanvasSection, 'x' | 'y' | 'cols' | 'name'>>) => {
    const section = sections.find(s => s.id === id);

    if (!section) return;
    const next = { ...section, ...change };
    const nextSections = sections.map(s => (s.id === id ? next : s));
    const settled = settleLoose(tiles, nextSections);
    commit(settled.tiles, nextSections, async () => {
      await saveCanvasSection(next);

      for (const t of settled.moved) await saveCanvasTile(t);
    });
  };

  const rename = (id: string, name: string | null) => {
    setRenamingId(null);
    const trimmed = name?.trim().slice(0, 100);
    const section = sections.find(s => s.id === id);

    if (!trimmed || !section || trimmed === section.name) return;
    changeSection(id, { name: trimmed });
  };

  const addSection = () => {
    const spot = nextBoxSpot(tiles, sections);
    const section: CanvasSection = { id: newId(), name: 'Untitled', x: spot.x, y: spot.y, cols: 2, createdAt: new Date().toISOString() };
    const nextSections = [...sections, section];
    const settled = settleLoose(tiles, nextSections);

    if (page) setPage(null);
    commit(settled.tiles, nextSections, async () => {
      await saveCanvasSection(section);

      for (const t of settled.moved) await saveCanvasTile(t);
    });
    setRenamingId(section.id);
    // Pull back once the new box is drawn so you can see where it landed.
    requestAnimationFrame(() => boardRef.current?.fit(true));
  };

  const deleteSection = (id: string) => {
    const section = sections.find(s => s.id === id);

    if (!section) return;
    const inside = tiles.filter(t => t.sectionId === id);

    if (page?.id === id) setPage(null);
    commit(
      tiles.filter(t => t.sectionId !== id),
      sections.filter(s => s.id !== id),
      () => deleteCanvasSection(id)
    );
    const n = inside.length;
    showToast(`Deleted “${section.name}”${n ? ` and ${n} link${n === 1 ? '' : 's'}` : ''}`, () =>
      commit([...tilesRef.current, ...inside], restoreAt(sectionsRef.current, section, sections.indexOf(section)), async () => {
        await saveCanvasSection(section);

        for (const t of inside) await saveCanvasTile(t);
      })
    );
  };

  const reorderInPage = (id: string, index: number) => {
    if (page) moveTile(id, { kind: 'section', sectionId: page.id, index });
  };

  const openAdd = () => {
    setAddTo(focusId ?? sections[0]?.id ?? '');
    setAdding(true);
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

    if (!getDomain(finalUrl)) {
      setError('Enter a web link that starts with http:// or https://.');

      return;
    }

    let nextSections = sections;
    let section = sections.find(s => s.id === addTo) ?? sections[0];
    const newSection = !section;

    if (!section) {
      section = { id: newId(), name: 'Links', x: 0, y: 0, cols: 3, createdAt: new Date().toISOString() };
      nextSections = [section];
    }

    const typed = title.trim();
    const fallback = kind === 'youtube' && getYouTubeId(finalUrl) ? 'YouTube video' : getDomain(finalUrl) || finalUrl;
    const last = groupBySection(tiles).get(section.id)?.at(-1);

    const tile: CanvasTile = {
      id: newId(),
      url: finalUrl,
      title: typed || fallback,
      kind,
      status: 'active',
      note: '',
      position: positionBetween(last?.position, undefined),
      createdAt: new Date().toISOString(),
      sectionId: section.id,
      x: null,
      y: null,
      image: null,
    };

    const settled = settleLoose([...tiles, tile], nextSections);
    const target = section;
    commit(settled.tiles, nextSections, async () => {
      if (newSection) await saveCanvasSection(target);
      await saveCanvasTile(tile);

      for (const t of settled.moved) await saveCanvasTile(t);
    });
    resetAdd();

    // Fill in the page's title and preview image once the server has looked them up.
    void fetchLinkPreview(finalUrl)
      .then(preview => {
        const current = tilesRef.current.find(t => t.id === tile.id);

        if (!current) return;
        const next = { ...current, title: typed ? current.title : (preview.title ?? current.title), image: preview.image ?? '' };
        commit(
          tilesRef.current.map(t => (t.id === tile.id ? next : t)),
          sectionsRef.current,
          () => saveCanvasTile(next)
        );
      })
      .catch(() => undefined);
  };

  const saveEdit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!editing) return;
    const form = new FormData(e.currentTarget);
    const nextTitle = String(form.get('title') ?? '').trim() || editing.title;
    const nextNote = String(form.get('note') ?? '').trim();
    setEditing(null);

    if (nextTitle === editing.title && nextNote === editing.note) return;
    const next = { ...editing, title: nextTitle.slice(0, 300), note: nextNote.slice(0, 5000) };
    commit(
      tiles.map(t => (t.id === next.id ? next : t)),
      sections,
      () => saveCanvasTile(next)
    );
  };

  const signIn = () => {
    signInWithGoogle().catch(err => setError(err instanceof Error ? err.message : 'Could not start sign-in.'));
  };

  const pageTiles = pageSection ? (tilesBySection.get(pageSection.id) ?? []) : [];
  const count = focusId ? pageTiles.length : tiles.length;

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-white text-slate-800">
      <nav className="relative z-40 flex h-14 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-3 sm:px-4">
        <Link
          href="/"
          aria-label="Back to tasks"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex min-w-0 items-center gap-1.5 text-sm">
          <button
            type="button"
            onClick={() => (page ? closePage() : boardRef.current?.fit(true))}
            className="font-bold text-slate-900 hover:text-indigo-600"
          >
            Canvas
          </button>
          {focusId && pageSection && (
            <>
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-300" />
              <span className="truncate font-semibold text-slate-900">{pageSection.name}</span>
            </>
          )}
          {load === 'ready' && (
            <span className="ml-1 rounded-full bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-500">{count}</span>
          )}
        </div>

        <div className="mx-auto hidden items-center rounded-lg bg-slate-100 p-0.5 sm:flex" role="group" aria-label="Filter links">
          {FILTERS.map(f => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              aria-pressed={filter === f.id}
              className={`rounded-md px-3 py-1 text-xs ${
                filter === f.id ? 'bg-white font-semibold text-slate-900 shadow-sm' : 'font-medium text-slate-500 hover:text-slate-800'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {load === 'ready' && (
          <div className="relative ml-auto flex items-center gap-2 sm:ml-0">
            <button
              type="button"
              onClick={addSection}
              aria-label="Add section"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
            >
              <SquareDashed className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Section</span>
            </button>
            <button
              type="button"
              onClick={() => (adding ? resetAdd() : openAdd())}
              aria-expanded={adding}
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
            >
              <Plus className="h-3.5 w-3.5" />
              Add<span className="hidden sm:inline"> link</span>
            </button>

            {adding && (
              <form
                onSubmit={onAdd}
                onKeyDown={e => {
                  if (e.key === 'Escape') resetAdd();
                }}
                className="absolute right-0 top-10 z-50 flex w-80 max-w-[calc(100vw-1.5rem)] flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-lg"
              >
                <input
                  type="text"
                  inputMode="url"
                  autoFocus
                  required
                  value={url}
                  onChange={e => {
                    setUrl(e.target.value);
                    setKind(detectKind(normalizeUrl(e.target.value)));
                  }}
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
                <div className="flex gap-2">
                  <select
                    value={kind}
                    onChange={e => setKind(canvasKindSchema.catch('other').parse(e.target.value))}
                    aria-label="Type"
                    className={inputClass}
                  >
                    {canvasKindSchema.options.map(k => (
                      <option key={k} value={k}>
                        {KIND_META[k].label}
                      </option>
                    ))}
                  </select>
                  {sections.length > 0 && (
                    <select value={addTo} onChange={e => setAddTo(e.target.value)} aria-label="Section" className={inputClass}>
                      {sections.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <button type="submit" className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700">
                  Add
                </button>
              </form>
            )}
          </div>
        )}
      </nav>

      <main className="relative min-h-0 flex-1">
        {error && (
          <p role="alert" className="absolute left-1/2 top-3 z-40 -translate-x-1/2 rounded-lg bg-red-50 px-3 py-1.5 text-xs text-red-700 shadow-sm">
            {error}
          </p>
        )}

        {load === 'loading' && <p className="p-6 text-sm text-slate-500">Loading your canvas…</p>}

        {load === 'failed' && (
          <p className="p-6 text-sm text-slate-500">
            Could not load your canvas.{' '}
            <button type="button" onClick={() => void reload()} className="font-medium text-indigo-600 hover:text-indigo-800">
              Try again
            </button>
          </p>
        )}

        {load === 'signed-out' && (
          <div className="m-6 flex max-w-sm flex-col items-start gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-600">Sign in to save links to your canvas.</p>
            <button
              type="button"
              onClick={signIn}
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
            >
              Continue with Google
            </button>
          </div>
        )}

        {load === 'ready' && (
          <>
            <CanvasBoard
              ref={boardRef}
              sections={sections}
              tilesBySection={tilesBySection}
              looseTiles={looseTiles}
              focusId={focusId}
              renamingId={renamingId}
              onFocus={onFocus}
              onOpen={openTile}
              onMoveTile={moveTile}
              onMoveSection={(id, to) => changeSection(id, { x: to.x, y: to.y })}
              onResizeSection={(id, cols) => changeSection(id, { cols })}
              onStartRename={setRenamingId}
              onRename={rename}
              onDeleteSection={deleteSection}
              onToggleDone={toggleDone}
              onEdit={setEditing}
              onDelete={deleteTile}
            />

            {sections.length === 0 && looseTiles.length === 0 && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <p className="text-sm text-slate-500">Add a link, or a section to group links in.</p>
              </div>
            )}

            {page && pageSection && (
              <SectionPage
                section={pageSection}
                tiles={pageTiles}
                from={page.from}
                closingTo={page.closingTo}
                onClosed={onPageClosed}
                onClose={closePage}
                onDeleteSection={() => deleteSection(pageSection.id)}
                onOpen={openTile}
                onReorder={reorderInPage}
                onToggleDone={toggleDone}
                onEdit={setEditing}
                onDelete={deleteTile}
              />
            )}
          </>
        )}

        {toast && (
          <div className="pointer-events-none absolute inset-x-0 bottom-20 z-50 flex justify-center px-4">
            <div role="status" className="pointer-events-auto flex items-center gap-3 rounded-xl bg-slate-900 py-2 pl-4 pr-2 text-xs text-white shadow-lg">
              <span>{toast.text}</span>
              <button
                type="button"
                onClick={() => {
                  clearTimeout(toastTimer.current);
                  toast.undo();
                  setToast(null);
                }}
                className="rounded-lg px-2.5 py-1 font-semibold text-indigo-300 hover:bg-white/10"
              >
                Undo
              </button>
            </div>
          </div>
        )}

        {editing && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/20 p-4" onClick={() => setEditing(null)}>
            <form
              onSubmit={saveEdit}
              onClick={e => e.stopPropagation()}
              onKeyDown={e => {
                if (e.key === 'Escape') setEditing(null);
              }}
              className="flex w-full max-w-sm flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl"
            >
              <p className="text-sm font-semibold text-slate-900">Edit link</p>
              <input name="title" defaultValue={editing.title} autoFocus aria-label="Title" maxLength={300} className={inputClass} />
              <textarea
                name="note"
                defaultValue={editing.note}
                placeholder="Note"
                aria-label="Note"
                rows={4}
                maxLength={5000}
                className={`${inputClass} resize-none`}
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button type="submit" className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700">
                  Save
                </button>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
