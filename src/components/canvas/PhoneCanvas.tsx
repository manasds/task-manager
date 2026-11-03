'use client';

import React, { useEffect, useState } from 'react';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  EllipsisVertical,
  FolderInput,
  Pencil,
  Plus,
  RotateCcw,
  StickyNote,
  Trash2,
} from 'lucide-react';
import type { CanvasSection, CanvasTile } from '@/types/canvas';
import { getDomain } from '@/utils/canvas';
import { KIND_META, coverImage, type CardActions } from './LinkCard';

/** The id the phone view uses for links placed loose on the board, which have no section. */
export const UNSORTED = 'unsorted';

interface Props extends CardActions {
  sections: CanvasSection[];
  /** Each section's tiles that pass the current filter, in order. */
  tilesBySection: Map<string, CanvasTile[]>;
  /** Loose tiles that pass the current filter; shown as "Unsorted". */
  looseTiles: CanvasTile[];
  /** The open section's id, UNSORTED, or null on the list of sections. */
  openId: string | null;
  renamingId: string | null;
  /** The filter pills, drawn above the list of sections. */
  filterBar: React.ReactNode;
  onOpenChange: (id: string | null) => void;
  onOpen: (tile: CanvasTile) => void;
  onMoveTo: (tile: CanvasTile, sectionId: string) => void;
  onStartRename: (id: string) => void;
  onRename: (id: string, name: string | null) => void;
  onDeleteSection: (id: string) => void;
  onAddSection: () => void;
}

const favicon = (domain: string) => `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;

function Favicon({ domain, className }: { domain: string; className: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={favicon(domain)}
      alt=""
      loading="lazy"
      onError={e => {
        e.currentTarget.style.visibility = 'hidden';
      }}
      className={className}
    />
  );
}

function SectionRow({ name, tiles, muted, onOpen }: { name: string; tiles: CanvasTile[]; muted: boolean; onOpen: () => void }) {
  const domains = [...new Set(tiles.map(t => getDomain(t.url)))];

  return (
    <li>
      <button type="button" onClick={onOpen} className="flex w-full items-center gap-3 border-b border-slate-100 py-4 text-left active:bg-slate-50">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={`truncate text-[17px] font-bold tracking-tight ${muted ? 'text-slate-500' : 'text-slate-900'}`}>{name}</span>
            <span className="rounded-full border border-slate-200 px-1.5 py-0.5 text-[11px] font-semibold text-slate-500">{tiles.length}</span>
          </div>
          {domains.length > 0 ? (
            <div className="mt-1.5 flex items-center">
              {domains.slice(0, 5).map((d, i) => (
                <Favicon key={d} domain={d} className={`h-5 w-5 rounded-full border-2 border-white bg-white ${i ? '-ml-1.5' : ''}`} />
              ))}
              <span className="ml-2 truncate text-xs text-slate-400">{domains.slice(0, 3).join(', ')}</span>
            </div>
          ) : (
            <p className="mt-1 text-xs text-slate-400">No links yet</p>
          )}
        </div>
        <ChevronRight className="h-5 w-5 shrink-0 text-slate-300" />
      </button>
    </li>
  );
}

function PhoneCard({ tile, onOpen, onMenu }: { tile: CanvasTile; onOpen: () => void; onMenu: () => void }) {
  const done = tile.status === 'done';
  const meta = KIND_META[tile.kind];
  const Icon = meta.icon;
  const image = coverImage(tile);
  const domain = getDomain(tile.url);

  return (
    <article
      role="link"
      tabIndex={0}
      aria-label={`Open ${tile.title}`}
      onClick={onOpen}
      onKeyDown={e => {
        if (e.key === 'Enter') onOpen();
      }}
      className="relative flex w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm active:bg-slate-50"
    >
      <div className="relative aspect-[1.91/1] w-full overflow-hidden bg-slate-100">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" loading="lazy" className={`h-full w-full object-cover ${done ? 'opacity-60 grayscale' : ''}`} />
        ) : (
          <div className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${meta.cover}`}>
            <Icon className={`h-10 w-10 ${meta.iconColor}`} />
          </div>
        )}
        {done && (
          <span className="absolute left-3 top-3 inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-white">
            <Check className="h-3.5 w-3.5" aria-label="Done" />
          </span>
        )}
      </div>
      <div className="flex items-start gap-2 p-3.5">
        <div className="min-w-0 flex-1">
          <p className={`line-clamp-2 break-words text-[15px] font-semibold leading-snug ${done ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
            {tile.title}
          </p>
          <div className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500">
            {domain && <Favicon domain={domain} className="h-4 w-4 shrink-0 rounded-sm" />}
            <span className="min-w-0 truncate">{domain}</span>
            {tile.note && <StickyNote className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-label="Has a note" />}
          </div>
        </div>
        <button
          type="button"
          onClick={e => {
            e.stopPropagation();
            onMenu();
          }}
          aria-label={`More for ${tile.title}`}
          className="-mr-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-500 active:bg-slate-100"
        >
          <EllipsisVertical className="h-4 w-4" />
        </button>
      </div>
    </article>
  );
}

/**
 * The canvas on a phone: a list of section titles, and each section's links as a vertical list.
 * Box positions on the board are a desktop idea, so here they are ignored; the links and sections are the same.
 */
export default function PhoneCanvas(props: Props) {
  const { sections, tilesBySection, looseTiles, openId, renamingId, onOpenChange } = props;
  // Keep drawing the last section while it slides away, after openId goes back to null.
  const [shown, setShown] = useState(openId);
  const [menuFor, setMenuFor] = useState<CanvasTile | null>(null);

  if (openId && openId !== shown) setShown(openId);

  useEffect(() => {
    if (!menuFor && !openId) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (menuFor) setMenuFor(null);
      else onOpenChange(null);
    };

    window.addEventListener('keydown', onKey);

    return () => window.removeEventListener('keydown', onKey);
  }, [menuFor, openId, onOpenChange]);

  const section = shown && shown !== UNSORTED ? sections.find(s => s.id === shown) : undefined;
  const list = shown === UNSORTED ? looseTiles : section ? (tilesBySection.get(section.id) ?? []) : [];
  const moveTargets = sections.filter(s => s.id !== menuFor?.sectionId);

  const act = (run: () => void) => {
    setMenuFor(null);
    run();
  };

  const menuItem = 'flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[15px] text-slate-800 active:bg-slate-100';

  return (
    <div className="absolute inset-0 overflow-hidden bg-white">
      <div
        className="absolute inset-0 flex flex-col transition-transform duration-300 ease-out"
        style={{ transform: openId ? 'translateX(-30%)' : 'none' }}
        aria-hidden={openId !== null}
      >
        <div className="px-4 pt-3">{props.filterBar}</div>
        <ul className="min-h-0 flex-1 overflow-y-auto px-4 pb-10 pt-1">
          {sections.map(s => (
            <SectionRow key={s.id} name={s.name} tiles={tilesBySection.get(s.id) ?? []} muted={false} onOpen={() => onOpenChange(s.id)} />
          ))}
          {looseTiles.length > 0 && <SectionRow name="Unsorted" tiles={looseTiles} muted onOpen={() => onOpenChange(UNSORTED)} />}
          <li>
            <button
              type="button"
              onClick={props.onAddSection}
              className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300 py-3 text-sm font-medium text-slate-500 active:bg-slate-50"
            >
              <Plus className="h-4 w-4" /> New section
            </button>
          </li>
        </ul>
      </div>

      <div
        className="absolute inset-0 flex flex-col bg-white transition-transform duration-300 ease-out"
        style={{ transform: openId ? 'none' : 'translateX(100%)' }}
        aria-hidden={openId === null}
      >
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-slate-100 px-2">
          <button
            type="button"
            onClick={() => onOpenChange(null)}
            aria-label="Back to sections"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 active:bg-slate-100"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          {section && renamingId === section.id ? (
            <input
              autoFocus
              defaultValue={section.name}
              aria-label="Section name"
              maxLength={100}
              onFocus={e => e.currentTarget.select()}
              onKeyDown={e => {
                if (e.key === 'Enter') props.onRename(section.id, e.currentTarget.value);

                if (e.key === 'Escape') props.onRename(section.id, null);
              }}
              onBlur={e => props.onRename(section.id, e.currentTarget.value)}
              className="min-w-0 flex-1 rounded-md border border-indigo-300 px-2 py-1 text-base font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
          ) : (
            <h2 className="min-w-0 truncate text-base font-bold text-slate-900">{section?.name ?? 'Unsorted'}</h2>
          )}
          <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-500">{list.length}</span>
          {section && (
            <div className="ml-auto flex items-center">
              <button
                type="button"
                onClick={() => props.onStartRename(section.id)}
                aria-label={`Rename ${section.name}`}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 active:bg-slate-100"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => props.onDeleteSection(section.id)}
                aria-label={`Delete ${section.name}`}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 active:bg-slate-100 active:text-red-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          )}
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {list.length === 0 ? (
            <p className="px-6 py-24 text-center text-sm text-slate-400">No links here yet. Use Add to save one.</p>
          ) : (
            <div className="flex flex-col gap-4 px-4 pb-24 pt-4">
              {list.map(tile => (
                <PhoneCard key={tile.id} tile={tile} onOpen={() => props.onOpen(tile)} onMenu={() => setMenuFor(tile)} />
              ))}
            </div>
          )}
        </div>
      </div>

      {menuFor && (
        <>
          <div className="absolute inset-0 z-30 bg-slate-900/30" onClick={() => setMenuFor(null)} />
          <div role="dialog" aria-label={menuFor.title} className="absolute inset-x-0 bottom-0 z-40 rounded-t-2xl bg-white p-2 pb-6 shadow-2xl">
            <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-slate-200" />
            <p className="truncate px-3 pb-2 text-xs font-medium text-slate-400">{menuFor.title}</p>
            <button type="button" className={menuItem} onClick={() => act(() => props.onToggleDone(menuFor))}>
              {menuFor.status === 'done' ? <RotateCcw className="h-5 w-5 text-slate-500" /> : <Check className="h-5 w-5 text-slate-500" />}
              {menuFor.status === 'done' ? 'Reopen' : 'Mark done'}
            </button>
            <button type="button" className={menuItem} onClick={() => act(() => props.onEdit(menuFor))}>
              <Pencil className="h-5 w-5 text-slate-500" /> Edit title and note
            </button>
            {moveTargets.length > 0 && (
              <>
                <p className="px-3 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Move to</p>
                <div className="max-h-48 overflow-y-auto">
                  {moveTargets.map(s => (
                    <button key={s.id} type="button" className={menuItem} onClick={() => act(() => props.onMoveTo(menuFor, s.id))}>
                      <FolderInput className="h-5 w-5 text-slate-500" /> <span className="truncate">{s.name}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
            <div className="my-1 h-px bg-slate-100" />
            <button type="button" className={`${menuItem} text-red-600`} onClick={() => act(() => props.onDelete(menuFor))}>
              <Trash2 className="h-5 w-5" /> Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
}
