'use client';

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Minimize2, Trash2 } from 'lucide-react';
import { Sticker } from '@/components/Sticker';
import type { CanvasSection, CanvasTile } from '@/types/canvas';
import type { Rect } from '@/utils/canvasBoard';
import { LinkCard, type CardActions } from './LinkCard';

interface Props extends CardActions {
  section: CanvasSection;
  /** The section's tiles that pass the current filter, in order. */
  tiles: CanvasTile[];
  /** The box this page grows out of, relative to the page's container; null opens it in place. */
  from: Rect | null;
  /** Set when closing: shrink back into this box, or just fade when it is gone. */
  closingTo: Rect | 'fade' | null;
  onClosed: () => void;
  onClose: () => void;
  onDeleteSection: () => void;
  onOpen: (tile: CanvasTile) => void;
  /** Move a tile to `index` among the other shown tiles. */
  onReorder: (id: string, index: number) => void;
}

const EASE = 'cubic-bezier(.2,.8,.2,1)';
const GROW = ['left', 'top', 'width', 'height', 'border-radius'].map(p => `${p} .34s ${EASE}`).join(', ');

/** On touch a card waits for a short hold before it drags, so a swipe still scrolls the page. */
const TOUCH_HOLD_MS = 250;

interface Drag {
  id: string;
  index: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

function place(el: HTMLElement, rect: Rect | 'full', radius: number) {
  const full = rect === 'full';
  el.style.left = full ? '0px' : `${rect.x}px`;
  el.style.top = full ? '0px' : `${rect.y}px`;
  el.style.width = full ? `${el.parentElement?.clientWidth ?? 0}px` : `${rect.w}px`;
  el.style.height = full ? `${el.parentElement?.clientHeight ?? 0}px` : `${rect.h}px`;
  el.style.borderRadius = `${radius}px`;
}

/** A section opened as its own page: the box grows to fill the screen and its cards spread out in a grid. */
export default function SectionPage(props: Props) {
  const { section, tiles, from, closingTo, onClosed, onOpen, onReorder } = props;
  const rootRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const cardEls = useRef(new Map<string, HTMLElement>());
  const draggedEl = useRef<HTMLElement | null>(null);
  const beforeRects = useRef<Map<string, DOMRect> | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);

  useLayoutEffect(() => {
    dragRef.current = drag;
  }, [drag]);

  // Grow out of the box on the board.
  useLayoutEffect(() => {
    const el = rootRef.current;
    const content = contentRef.current;

    if (!el || !content) return;
    el.style.transition = 'none';
    content.style.transition = 'none';

    if (!from) {
      place(el, 'full', 0);
      el.style.width = '100%';
      el.style.height = '100%';
      content.style.opacity = '1';

      return;
    }

    place(el, from, 16);
    content.style.opacity = '0';
    el.getBoundingClientRect();
    el.style.transition = GROW;
    content.style.transition = 'opacity .22s ease .14s';
    place(el, 'full', 0);
    content.style.opacity = '1';

    const done = setTimeout(() => {
      el.style.transition = 'none';
      el.style.width = '100%';
      el.style.height = '100%';
    }, 360);

    return () => clearTimeout(done);
  }, [from]);

  // Shrink back into the box (or fade out if it was deleted), then let the parent unmount the page.
  useLayoutEffect(() => {
    const el = rootRef.current;
    const content = contentRef.current;

    if (!closingTo || !el || !content) return;
    place(el, 'full', 0);
    el.getBoundingClientRect();
    content.style.transition = 'opacity .12s ease';
    content.style.opacity = '0';

    if (closingTo === 'fade') {
      el.style.transition = 'opacity .2s ease';
      el.style.opacity = '0';
    } else {
      el.style.transition = `${GROW}, opacity .3s ease`;
      place(el, closingTo, 16);
    }

    const done = setTimeout(onClosed, 320);

    return () => clearTimeout(done);
  }, [closingTo, onClosed]);

  // Cards that shifted to make room slide from where they were.
  useLayoutEffect(() => {
    const before = beforeRects.current;
    beforeRects.current = null;

    if (!before) return;

    for (const [id, el] of cardEls.current) {
      const a = before.get(id);

      if (!a) continue;
      const b = el.getBoundingClientRect();

      if (a.left === b.left && a.top === b.top) continue;
      el.style.transition = 'none';
      el.style.transform = `translate(${a.left - b.left}px, ${a.top - b.top}px)`;
      el.getBoundingClientRect();
      el.style.transition = 'transform .2s ease';
      el.style.transform = '';
    }
  }, [drag?.index]);

  const others = drag ? tiles.filter(t => t.id !== drag.id) : tiles;
  const dragged = drag ? tiles.find(t => t.id === drag.id) : undefined;

  const startPress = (e: React.PointerEvent<HTMLElement>, tile: CanvasTile) => {
    if (e.button !== 0 || closingTo) return;
    const card = e.currentTarget;
    const touch = e.pointerType === 'touch';
    const sx = e.clientX;
    const sy = e.clientY;
    let px = sx;
    let py = sy;
    let gx = 0;
    let gy = 0;
    let started = false;
    let cancelled = false;
    let hold: ReturnType<typeof setTimeout> | undefined;

    const begin = () => {
      if (started || cancelled) return;
      started = true;
      const r = card.getBoundingClientRect();
      gx = sx - r.left;
      gy = sy - r.top;
      setDrag({ id: tile.id, index: tiles.indexOf(tile), x: px - gx, y: py - gy, w: r.width, h: r.height });
    };

    const blockScroll = (ev: TouchEvent) => {
      if (started && ev.cancelable) ev.preventDefault();
    };

    const onMove = (ev: PointerEvent) => {
      px = ev.clientX;
      py = ev.clientY;

      if (!started) {
        const dist = Math.hypot(px - sx, py - sy);

        if (touch && dist > 8) cancelled = true;
        else if (!touch && dist >= 4) begin();

        return;
      }

      if (draggedEl.current) {
        draggedEl.current.style.left = `${px - gx}px`;
        draggedEl.current.style.top = `${py - gy}px`;
      }

      const current = dragRef.current;

      if (!current) return;
      const shown = tiles.filter(t => t.id !== current.id);
      let index = current.index;

      for (const [i, t] of shown.entries()) {
        const r = cardEls.current.get(t.id)?.getBoundingClientRect();

        if (!r || px < r.left || px > r.right || py < r.top || py > r.bottom) continue;
        index = px < r.left + r.width / 2 ? i : i + 1;
        break;
      }

      if (index === current.index) return;
      beforeRects.current = new Map(Array.from(cardEls.current, ([id, el]) => [id, el.getBoundingClientRect()]));
      setDrag({ ...current, index, x: px - gx, y: py - gy });
    };

    const stopListening = () => {
      clearTimeout(hold);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      window.removeEventListener('touchmove', blockScroll);
    };

    // The browser took the pointer away: put the card back without opening or moving anything.
    const onCancel = () => {
      stopListening();
      setDrag(null);
    };

    const onUp = () => {
      stopListening();

      if (started) {
        const current = dragRef.current;

        if (current) onReorder(current.id, current.index);
        setDrag(null);
      } else if (!cancelled && Math.hypot(px - sx, py - sy) < 4) {
        onOpen(tile);
      }
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    window.addEventListener('touchmove', blockScroll, { passive: false });

    if (touch) hold = setTimeout(begin, TOUCH_HOLD_MS);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) props.onClose();
    };

    window.addEventListener('keydown', onKey);

    return () => window.removeEventListener('keydown', onKey);
  }, [props]);

  const cardClass =
    'group relative flex w-full max-w-[280px] select-none flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white sm:w-[280px]';

  const gap = drag && <div key="gap" className="w-full max-w-[280px] sm:w-[280px]" style={{ height: drag.h }} />;

  return (
    <section
      ref={rootRef}
      aria-label={section.name}
      className="absolute z-30 flex flex-col overflow-hidden border border-indigo-200 bg-page"
    >
      <div ref={contentRef} className="flex min-h-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center gap-3 border-b border-slate-100 px-4 sm:px-6">
          <h2 className="truncate text-2xl font-normal tracking-tight text-slate-900">{section.name}</h2>
          <span className="rounded-full bg-slate-100 px-1.5 py-px font-mono text-[11px] font-medium text-slate-500">
            {tiles.length}
          </span>
          <button
            type="button"
            onClick={props.onDeleteSection}
            title="Delete section"
            aria-label={`Delete ${section.name}`}
            className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-red-600"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={props.onClose}
            title="Back to the board (Esc)"
            aria-label="Back to the board"
            className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            <Minimize2 className="h-4 w-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-28 pt-6 sm:px-6">
          {tiles.length === 0 ? (
            <div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-2xl border-[1.5px] border-dashed border-slate-300 px-6 py-16">
              <Sticker name="moon" className="size-14 -rotate-[10deg]" />
              <p className="text-center text-sm text-slate-400">No links here yet. Use Add link, or drag cards into this box on the board.</p>
            </div>
          ) : (
            <div className="flex flex-wrap justify-center gap-5">
              {others.map((tile, i) => (
                <React.Fragment key={tile.id}>
                  {drag?.index === i && gap}
                  <article
                    ref={el => {
                      if (el) cardEls.current.set(tile.id, el);
                      else cardEls.current.delete(tile.id);
                    }}
                    role="link"
                    tabIndex={0}
                    aria-label={`Open ${tile.title}`}
                    onPointerDown={e => startPress(e, tile)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') onOpen(tile);
                    }}
                    onContextMenu={e => {
                      if (drag) e.preventDefault();
                    }}
                    className={`${cardClass} card-lift cursor-grab focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400`}
                    style={{ touchAction: 'pan-y' }}
                  >
                    <LinkCard tile={tile} size="page" onToggleDone={props.onToggleDone} onEdit={props.onEdit} onDelete={props.onDelete} />
                  </article>
                </React.Fragment>
              ))}
              {drag && drag.index >= others.length && gap}
            </div>
          )}
        </div>
      </div>

      {drag && dragged && (
        <article
          ref={draggedEl}
          aria-hidden
          className={`${cardClass} pointer-events-none z-50`}
          style={{
            // Inline, because the shared card classes include `relative`, which would beat a `fixed` class.
            position: 'fixed',
            left: drag.x,
            top: drag.y,
            width: drag.w,
            maxWidth: 'none',
            transform: 'rotate(1.5deg) scale(1.04)',
            boxShadow: '0 18px 40px rgba(15,23,42,.22)',
          }}
        >
          <LinkCard tile={dragged} size="page" onToggleDone={props.onToggleDone} onEdit={props.onEdit} onDelete={props.onDelete} />
        </article>
      )}
    </section>
  );
}
