'use client';

import React, { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { LocateFixed, Maximize2, Minus, MousePointer2, Plus, Trash2 } from 'lucide-react';
import type { CanvasSection, CanvasTile } from '@/types/canvas';
import {
  BOX_HEAD,
  CARD_H,
  CARD_W,
  boundsOf,
  boxRect,
  boxWidth,
  clampCamera,
  colsForWidth,
  contains,
  fitCamera,
  isOnScreen,
  slotIndexAt,
  slotPosition,
  zoomCamera,
  type Camera,
  type Point,
  type Rect,
} from '@/utils/canvasBoard';
import { LinkCard, type CardActions } from './LinkCard';

export type TileDrop = { kind: 'section'; sectionId: string; index: number } | { kind: 'loose'; point: Point };

export interface BoardHandle {
  /** Frame the whole board. */
  fit: (animate: boolean) => void;
  /** Where a box is drawn, relative to the board element; null when it is not on the board. */
  screenRectOf: (sectionId: string) => Rect | null;
}

interface Props extends CardActions {
  sections: CanvasSection[];
  /** Each section's tiles that pass the current filter, in display order. */
  tilesBySection: Map<string, CanvasTile[]>;
  /** Tiles placed loose on the canvas that pass the current filter. */
  looseTiles: CanvasTile[];
  focusId: string | null;
  renamingId: string | null;
  onFocus: (id: string | null) => void;
  onOpen: (tile: CanvasTile) => void;
  onMoveTile: (id: string, drop: TileDrop) => void;
  onMoveSection: (id: string, to: Point) => void;
  onResizeSection: (id: string, cols: number) => void;
  onStartRename: (id: string) => void;
  onRename: (id: string, name: string | null) => void;
  onDeleteSection: (id: string) => void;
}

/** Room the floating tab bar takes at the bottom, kept clear when framing the board. */
const BAR_SPACE = 64;
const FIT_PAD = 56;
const MAX_ZOOM = 2.5;

/** A box accepts a dropped card a little below its last row, where the next row would go. */
const DROP_SLACK = 40;

type Gesture =
  | { type: 'pan'; sx: number; sy: number; cx: number; cy: number; moved: boolean }
  | { type: 'card'; tile: CanvasTile; el: HTMLElement; sx: number; sy: number; gx: number; gy: number; moved: boolean }
  | { type: 'move'; id: string; sx: number; sy: number; ox: number; oy: number; moved: boolean }
  | { type: 'resize'; id: string; sx: number; ow: number; moved: boolean };

/** A card being dragged: where it is, and the box and slot it would drop into. Updated when the slot changes. */
interface DragState {
  id: string;
  target: string | null;
  index: number;
  x: number;
  y: number;
}

interface PlacedCard {
  tile: CanvasTile;
  x: number;
  y: number;
  dragging: boolean;
}

interface PlacedBox {
  section: CanvasSection;
  rect: Rect;
  count: number;
}

interface BoardCardProps extends CardActions {
  tile: CanvasTile;
  x: number;
  y: number;
  dragging: boolean;
  instant: boolean;
  onOpen: (tile: CanvasTile) => void;
}

const BoardCard = memo(function BoardCard({ tile, x, y, dragging, instant, onOpen, ...actions }: BoardCardProps) {
  return (
    <article
      data-tile-id={tile.id}
      role="link"
      tabIndex={0}
      aria-label={`Open ${tile.title}`}
      onKeyDown={e => {
        if (e.key === 'Enter') onOpen(tile);
      }}
      className={`group absolute flex select-none flex-col overflow-hidden rounded-xl border border-slate-200 bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
        dragging ? 'pointer-events-none z-50 cursor-grabbing' : 'z-10 cursor-grab shadow-sm hover:shadow-md'
      }`}
      style={{
        left: x,
        top: y,
        width: CARD_W,
        height: CARD_H,
        transition: dragging || instant ? 'none' : 'left .2s ease, top .2s ease, box-shadow .15s ease',
        transform: dragging ? 'rotate(1.5deg) scale(1.04)' : undefined,
        boxShadow: dragging ? '0 18px 40px rgba(15,23,42,.22)' : undefined,
      }}
    >
      <LinkCard tile={tile} size="board" {...actions} />
    </article>
  );
});

const CanvasBoard = forwardRef<BoardHandle, Props>(function CanvasBoard(props, ref) {
  const { sections, tilesBySection, looseTiles, focusId, renamingId, onFocus, onOpen, onMoveTile, onMoveSection, onResizeSection } =
    props;

  const { onToggleDone, onEdit, onDelete } = props;

  const rootRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const zoomLabelRef = useRef<HTMLSpanElement>(null);
  const camRef = useRef<Camera>({ x: 0, y: 0, z: 1 });
  /** True while the camera shows the framed board; panning or zooming by hand clears it. */
  const fittedRef = useRef(true);
  const animRef = useRef(0);
  const gestureRef = useRef<Gesture | null>(null);
  const dragPosRef = useRef<Point>({ x: 0, y: 0 });

  const [drag, setDrag] = useState<DragState | null>(null);
  const [moving, setMoving] = useState<{ id: string; x: number; y: number } | null>(null);
  const [resizing, setResizing] = useState<{ id: string; cols: number } | null>(null);
  const [lost, setLost] = useState(false);

  /** Every card and box position, including the gap a dragged card would drop into. */
  const layout = useMemo(() => {
    const cards: PlacedCard[] = [];
    const boxes: PlacedBox[] = [];

    for (const original of sections) {
      let section = original;

      if (moving?.id === section.id) section = { ...section, x: moving.x, y: moving.y };

      if (resizing?.id === section.id) section = { ...section, cols: resizing.cols };
      let slot = 0;

      for (const tile of tilesBySection.get(section.id) ?? []) {
        // The dragged card stays in this list, so React keeps its element while it follows the pointer.
        if (tile.id === drag?.id) {
          cards.push({ tile, x: drag.x, y: drag.y, dragging: true });
          continue;
        }

        if (drag?.target === section.id && slot === drag.index) slot++;
        cards.push({ tile, ...slotPosition(section, slot), dragging: false });
        slot++;
      }

      const gapAtEnd = drag?.target === section.id && drag.index >= slot;
      boxes.push({ section, rect: boxRect(section, slot + (gapAtEnd ? 1 : 0)), count: slot });
    }

    for (const tile of looseTiles) {
      if (tile.id === drag?.id) cards.push({ tile, x: drag.x, y: drag.y, dragging: true });
      else cards.push({ tile, x: tile.x ?? 0, y: tile.y ?? 0, dragging: false });
    }

    const rects = boxes.map(b => b.rect);

    for (const c of cards) if (!c.dragging) rects.push({ x: c.x, y: c.y, w: CARD_W, h: CARD_H });

    return { cards, boxes, content: boundsOf(rects) };
  }, [sections, tilesBySection, looseTiles, drag, moving, resizing]);

  const layoutRef = useRef(layout);

  // Handlers and the camera read the latest layout; this runs before the camera effect below.
  useLayoutEffect(() => {
    layoutRef.current = layout;
  }, [layout]);

  const viewSize = () => ({ width: viewportRef.current?.clientWidth ?? 0, height: viewportRef.current?.clientHeight ?? 0 });

  const fitTarget = useCallback((): Camera | null => {
    const { content } = layoutRef.current;
    const view = viewSize();

    if (!content || view.width < 50) return null;

    return fitCamera(content, { width: view.width, height: view.height - BAR_SPACE }, FIT_PAD, 1);
  }, []);

  /** Draw the camera: clamp it to the content, move the board, and decide whether to offer the way back. */
  const applyCam = useCallback(() => {
    const vp = viewportRef.current;
    const world = worldRef.current;

    if (!vp || !world) return;
    const view = viewSize();
    const { content, boxes, cards } = layoutRef.current;

    if (content && view.width > 0) camRef.current = clampCamera(camRef.current, content, view);
    const { x, y, z } = camRef.current;
    world.style.transform = `translate(${x}px, ${y}px) scale(${z})`;
    // Dots fade out as you zoom out, so the board never turns into noise.
    const dot = z < 0.45 ? 'transparent' : `rgba(148,163,184,${Math.min(0.55, (z - 0.45) * 1.2)})`;
    vp.style.backgroundImage = `radial-gradient(${dot} 1px, transparent 1px)`;
    vp.style.backgroundPosition = `${x}px ${y}px`;
    vp.style.backgroundSize = `${24 * z}px ${24 * z}px`;

    if (zoomLabelRef.current) zoomLabelRef.current.textContent = `${Math.round(z * 100)}%`;

    const nowLost =
      view.width > 0 &&
      content !== null &&
      !boxes.some(b => isOnScreen(b.rect, camRef.current, view)) &&
      !cards.some(c => isOnScreen({ x: c.x, y: c.y, w: CARD_W, h: CARD_H }, camRef.current, view));

    setLost(prev => (prev === nowLost ? prev : nowLost));
  }, []);

  const animateTo = useCallback(
    (target: Camera) => {
      cancelAnimationFrame(animRef.current);
      const from = camRef.current;
      const start = performance.now();

      const step = (now: number) => {
        const t = Math.min(1, (now - start) / 420);
        const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        camRef.current = { x: from.x + (target.x - from.x) * e, y: from.y + (target.y - from.y) * e, z: from.z + (target.z - from.z) * e };
        applyCam();

        if (t < 1) animRef.current = requestAnimationFrame(step);
      };

      animRef.current = requestAnimationFrame(step);
    },
    [applyCam]
  );

  const fit = useCallback(
    (animate: boolean) => {
      const target = fitTarget();
      fittedRef.current = true;

      if (!target) return;

      if (animate) animateTo(target);
      else {
        cancelAnimationFrame(animRef.current);
        camRef.current = target;
        applyCam();
      }
    },
    [fitTarget, animateTo, applyCam]
  );

  const zoomBy = useCallback(
    (factor: number, at: Point) => {
      cancelAnimationFrame(animRef.current);
      fittedRef.current = false;
      const minZoom = Math.min(1, fitTarget()?.z ?? 1) * 0.75;
      camRef.current = zoomCamera(camRef.current, factor, at, minZoom, MAX_ZOOM);
      applyCam();
    },
    [fitTarget, applyCam]
  );

  useImperativeHandle(
    ref,
    () => ({
      fit,
      screenRectOf: id => {
        const el = worldRef.current?.querySelector(`[data-section-id="${CSS.escape(id)}"]`);
        const root = rootRef.current?.getBoundingClientRect();

        if (!el || !root) return null;
        const r = el.getBoundingClientRect();

        return { x: r.left - root.left, y: r.top - root.top, w: r.width, h: r.height };
      },
    }),
    [fit]
  );

  // Re-clamp and re-check after every change to what is drawn.
  useLayoutEffect(() => {
    applyCam();
  });

  // Frame the board the first time there is something on it.
  const hasContent = layout.content !== null;
  useLayoutEffect(() => {
    if (hasContent && fittedRef.current) fit(false);
  }, [hasContent, fit]);

  // Keep a framed board framed when the window changes size; otherwise just keep it in bounds.
  useEffect(() => {
    const vp = viewportRef.current;

    if (!vp) return;
    const observer = new ResizeObserver(() => (fittedRef.current ? fit(false) : applyCam()));
    observer.observe(vp);

    return () => observer.disconnect();
  }, [fit, applyCam]);

  // Wheel pans; pinch or ⌘/Ctrl + wheel zooms. Needs a non-passive listener to stop the page scrolling.
  useEffect(() => {
    const vp = viewportRef.current;

    if (!vp) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      cancelAnimationFrame(animRef.current);
      const r = vp.getBoundingClientRect();

      if (e.ctrlKey || e.metaKey) {
        zoomBy(Math.exp(-e.deltaY * 0.01), { x: e.clientX - r.left, y: e.clientY - r.top });

        return;
      }

      fittedRef.current = false;
      camRef.current = { ...camRef.current, x: camRef.current.x - e.deltaX, y: camRef.current.y - e.deltaY };
      applyCam();
    };

    vp.addEventListener('wheel', onWheel, { passive: false });

    return () => vp.removeEventListener('wheel', onWheel);
  }, [zoomBy, applyCam]);

  useEffect(() => () => cancelAnimationFrame(animRef.current), []);

  const toCanvas = (clientX: number, clientY: number): Point => {
    const r = viewportRef.current?.getBoundingClientRect();
    const { x, y, z } = camRef.current;

    return { x: (clientX - (r?.left ?? 0) - x) / z, y: (clientY - (r?.top ?? 0) - y) / z };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || !(e.target instanceof Element) || e.target.closest('button, input')) return;
    cancelAnimationFrame(animRef.current);
    const sx = e.clientX;
    const sy = e.clientY;
    const cardEl = e.target.closest<HTMLElement>('[data-tile-id]');
    const boxEl = e.target.closest<HTMLElement>('[data-section-id]');
    const handle = e.target.closest<HTMLElement>('[data-drag]')?.dataset.drag;
    e.currentTarget.setPointerCapture(e.pointerId);

    if (cardEl) {
      const placed = layoutRef.current.cards.find(c => c.tile.id === cardEl.dataset.tileId);

      if (!placed) return;
      const at = toCanvas(sx, sy);
      gestureRef.current = { type: 'card', tile: placed.tile, el: cardEl, sx, sy, gx: at.x - placed.x, gy: at.y - placed.y, moved: false };
      dragPosRef.current = { x: placed.x, y: placed.y };

      return;
    }

    const section = boxEl ? sections.find(s => s.id === boxEl.dataset.sectionId) : undefined;

    if (section && handle === 'resize') {
      gestureRef.current = { type: 'resize', id: section.id, sx, ow: boxWidth(section.cols), moved: false };
    } else if (section && handle === 'move') {
      gestureRef.current = { type: 'move', id: section.id, sx, sy, ox: section.x, oy: section.y, moved: false };
    } else {
      gestureRef.current = { type: 'pan', sx, sy, cx: camRef.current.x, cy: camRef.current.y, moved: false };
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const g = gestureRef.current;

    if (!g) return;
    const dx = e.clientX - g.sx;
    const dy = g.type === 'resize' ? 0 : e.clientY - g.sy;

    if (!g.moved && Math.hypot(dx, dy) < 4) return;
    const first = !g.moved;
    g.moved = true;
    const z = camRef.current.z;

    switch (g.type) {
      case 'pan':
        fittedRef.current = false;
        viewportRef.current?.classList.add('cursor-grabbing');
        camRef.current = { ...camRef.current, x: g.cx + dx, y: g.cy + dy };
        applyCam();
        break;
      case 'card': {
        const at = toCanvas(e.clientX, e.clientY);
        dragPosRef.current = { x: at.x - g.gx, y: at.y - g.gy };
        g.el.style.left = `${dragPosRef.current.x}px`;
        g.el.style.top = `${dragPosRef.current.y}px`;
        const box = layoutRef.current.boxes.find(b => contains({ ...b.rect, h: b.rect.h + DROP_SLACK }, at));
        const target = box?.section.id ?? null;
        const index = box ? slotIndexAt(box.section, at, box.count) : 0;
        const { x, y } = dragPosRef.current;
        setDrag(prev =>
          !first && prev && prev.target === target && prev.index === index ? prev : { id: g.tile.id, target, index, x, y }
        );
        break;
      }

      case 'move':
        setMoving({ id: g.id, x: g.ox + dx / z, y: g.oy + dy / z });
        break;
      case 'resize': {
        const cols = colsForWidth(g.ow + dx / z);
        setResizing(prev => (prev?.cols === cols ? prev : { id: g.id, cols }));
        break;
      }
    }
  };

  const onPointerUp = () => {
    const g = gestureRef.current;
    gestureRef.current = null;
    viewportRef.current?.classList.remove('cursor-grabbing');

    if (!g) return;

    if (g.type === 'card') {
      if (!g.moved) onOpen(g.tile);
      else if (drag?.target) onMoveTile(g.tile.id, { kind: 'section', sectionId: drag.target, index: drag.index });
      else onMoveTile(g.tile.id, { kind: 'loose', point: dragPosRef.current });
      setDrag(null);
    } else if (g.type === 'move') {
      if (!g.moved) onFocus(g.id);
      else if (moving) onMoveSection(g.id, { x: moving.x, y: moving.y });
      setMoving(null);
    } else if (g.type === 'resize') {
      if (resizing) onResizeSection(g.id, resizing.cols);
      setResizing(null);
    }
  };

  const onDoubleClick = (e: React.MouseEvent) => {
    if (!(e.target instanceof Element) || e.target.closest('[data-tile-id], button, input')) return;

    if (e.target.closest('[data-name]')) {
      const id = e.target.closest<HTMLElement>('[data-section-id]')?.dataset.sectionId;

      if (id) props.onStartRename(id);

      return;
    }

    const id = e.target.closest<HTMLElement>('[data-section-id]')?.dataset.sectionId;

    if (id) onFocus(id);
  };

  const zoomAtCentre = (factor: number) => {
    const view = viewSize();
    zoomBy(factor, { x: view.width / 2, y: view.height / 2 });
  };

  const draggedFrom = drag ? (layout.cards.find(c => c.dragging)?.tile.sectionId ?? null) : null;

  return (
    <div ref={rootRef} className="absolute inset-0">
      <div
        ref={viewportRef}
        className="absolute inset-0 cursor-grab touch-none overflow-hidden bg-white"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={onDoubleClick}
      >
        <div ref={worldRef} className="absolute left-0 top-0 origin-top-left">
          {layout.boxes.map(({ section, rect, count }) => {
            const target = drag?.target === section.id && section.id !== draggedFrom;

            return (
              <div
                key={section.id}
                data-section-id={section.id}
                className={`group/sec absolute rounded-2xl border ${target ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 bg-slate-50'}`}
                style={{
                  left: rect.x,
                  top: rect.y,
                  width: rect.w,
                  height: rect.h,
                  transition: moving ? 'none' : 'width .2s ease, height .2s ease, background-color .2s, border-color .2s',
                }}
              >
                <div data-drag="move" className="flex cursor-move items-center gap-2 pl-5 pr-3" style={{ height: BOX_HEAD }}>
                  {renamingId === section.id ? (
                    <input
                      autoFocus
                      defaultValue={section.name}
                      aria-label="Section name"
                      maxLength={100}
                      onFocus={e => e.currentTarget.select()}
                      onKeyDown={e => {
                        e.stopPropagation();

                        if (e.key === 'Enter') props.onRename(section.id, e.currentTarget.value);

                        if (e.key === 'Escape') props.onRename(section.id, null);
                      }}
                      onBlur={e => props.onRename(section.id, e.currentTarget.value)}
                      className="w-56 rounded-md border border-indigo-300 bg-white px-1.5 py-0.5 text-lg font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                    />
                  ) : (
                    <span data-name title="Double-click to rename" className="truncate text-lg font-bold tracking-tight text-slate-900">
                      {section.name}
                    </span>
                  )}
                  <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                    {count}
                  </span>
                  <button
                    type="button"
                    onClick={() => props.onDeleteSection(section.id)}
                    title="Delete section"
                    aria-label={`Delete ${section.name}`}
                    className="ml-auto inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 opacity-0 transition-opacity hover:bg-slate-100 hover:text-red-600 focus-visible:opacity-100 group-hover/sec:opacity-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onFocus(section.id)}
                    title="Open full page"
                    aria-label={`Open ${section.name}`}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                  >
                    <Maximize2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                {count === 0 && !target && (
                  <p
                    className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-center gap-1.5 text-xs text-slate-400"
                    style={{ top: BOX_HEAD }}
                  >
                    <MousePointer2 className="h-3.5 w-3.5" /> Drag links here
                  </p>
                )}
                <div
                  data-drag="resize"
                  title="Drag to change columns"
                  className="absolute -right-1.5 top-1/2 h-10 w-3 -translate-y-1/2 cursor-ew-resize rounded-full opacity-0 hover:bg-indigo-300 hover:opacity-100"
                />
              </div>
            );
          })}

          {layout.cards.map(({ tile, x, y, dragging }) => (
            <BoardCard
              key={tile.id}
              tile={tile}
              x={x}
              y={y}
              dragging={dragging}
              instant={moving !== null}
              onOpen={onOpen}
              onToggleDone={onToggleDone}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      </div>

      {lost && !focusId && (
        <button
          type="button"
          onClick={() => fit(true)}
          className="absolute left-1/2 top-4 z-20 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-lg hover:bg-slate-50"
        >
          <LocateFixed className="h-3.5 w-3.5 text-indigo-600" /> Back to your board
        </button>
      )}

      {/* Above the section page too, so its tabs switch sections from there. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-4 z-40 flex justify-center px-4">
        <div className="pointer-events-auto flex max-w-full items-center gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white/95 p-1 shadow-lg backdrop-blur">
          {[{ id: null, name: 'Whole board' }, ...sections].map(s => {
            const active = (focusId ?? null) === s.id;

            return (
              <button
                key={s.id ?? 'all'}
                type="button"
                onClick={() => (s.id === null && !focusId ? fit(true) : onFocus(s.id))}
                aria-pressed={active}
                className={`whitespace-nowrap rounded-lg px-2.5 py-1 text-xs ${
                  active ? 'bg-indigo-600 font-semibold text-white' : 'font-medium text-slate-600 hover:bg-slate-100'
                }`}
              >
                {s.name}
              </button>
            );
          })}
          {!focusId && (
            <>
              <span className="mx-1 h-5 w-px shrink-0 bg-slate-200" />
              <button
                type="button"
                onClick={() => zoomAtCentre(1 / 1.2)}
                aria-label="Zoom out"
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span ref={zoomLabelRef} className="w-10 shrink-0 text-center text-[11px] tabular-nums text-slate-500" />
              <button
                type="button"
                onClick={() => zoomAtCentre(1.2)}
                aria-label="Zoom in"
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
});

export default CanvasBoard;
