'use client';

import React, { memo } from 'react';
import {
  BookOpen,
  Check,
  FileText,
  Headphones,
  Link as LinkIcon,
  Pencil,
  RotateCcw,
  StickyNote,
  Trash2,
  Youtube,
  type LucideIcon,
} from 'lucide-react';
import type { CanvasKind, CanvasTile } from '@/types/canvas';
import { getDomain, getYouTubeId, youtubeThumbnail } from '@/utils/canvas';

export const KIND_META: Record<CanvasKind, { label: string; icon: LucideIcon; cover: string; iconColor: string }> = {
  youtube: { label: 'YouTube', icon: Youtube, cover: 'from-red-100 to-red-300', iconColor: 'text-red-500/70' },
  blog: { label: 'Blog', icon: BookOpen, cover: 'from-amber-100 to-amber-300', iconColor: 'text-amber-600/70' },
  article: { label: 'Article', icon: FileText, cover: 'from-sky-100 to-sky-300', iconColor: 'text-sky-600/70' },
  podcast: { label: 'Podcast', icon: Headphones, cover: 'from-violet-100 to-violet-300', iconColor: 'text-violet-600/70' },
  other: { label: 'Other', icon: LinkIcon, cover: 'from-slate-100 to-slate-300', iconColor: 'text-slate-500/70' },
};

/** The page's own preview, then a YouTube thumbnail, else nothing (the card shows its kind instead). */
export function coverImage(tile: CanvasTile): string | null {
  if (tile.image) return tile.image;
  const ytId = tile.kind === 'youtube' ? getYouTubeId(tile.url) : null;

  return ytId ? youtubeThumbnail(ytId) : null;
}

export interface CardActions {
  onToggleDone: (tile: CanvasTile) => void;
  onEdit: (tile: CanvasTile) => void;
  onDelete: (tile: CanvasTile) => void;
}

interface Props extends CardActions {
  tile: CanvasTile;
  /** Board cards are fixed-size; page cards are larger and fill their grid column. */
  size: 'board' | 'page';
}

/** Buttons on a card act on their own; a press on one must not start a drag of the card. */
const keepPointer = (e: React.PointerEvent) => e.stopPropagation();

function LinkCardBody({ tile, size, onToggleDone, onEdit, onDelete }: Props) {
  const done = tile.status === 'done';
  const meta = KIND_META[tile.kind];
  const Icon = meta.icon;
  const image = coverImage(tile);
  const domain = getDomain(tile.url);
  const page = size === 'page';
  const btn = `inline-flex items-center justify-center rounded-full bg-white/95 text-slate-600 shadow-sm ${page ? 'h-7 w-7' : 'h-6 w-6'}`;
  const icon = page ? 'h-3.5 w-3.5' : 'h-3 w-3';

  return (
    <>
      <div className={`relative shrink-0 overflow-hidden bg-slate-100 ${page ? 'aspect-[1.91/1]' : 'h-[117px]'}`}>
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt=""
            loading="lazy"
            draggable={false}
            className={`pointer-events-none h-full w-full object-cover ${done ? 'opacity-60 grayscale' : ''}`}
          />
        ) : (
          <div className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${meta.cover}`}>
            <Icon className={`${page ? 'h-12 w-12' : 'h-9 w-9'} ${meta.iconColor}`} />
          </div>
        )}
      </div>

      {done && (
        <span className="absolute left-2.5 top-2.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white">
          <Check className="h-3 w-3" aria-label="Done" />
        </span>
      )}

      <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        <button
          type="button"
          onPointerDown={keepPointer}
          onClick={() => onToggleDone(tile)}
          aria-label={done ? 'Reopen' : 'Mark done'}
          title={done ? 'Reopen' : 'Mark done'}
          className={`${btn} hover:text-emerald-600`}
        >
          {done ? <RotateCcw className={icon} /> : <Check className={icon} />}
        </button>
        <button
          type="button"
          onPointerDown={keepPointer}
          onClick={() => onEdit(tile)}
          aria-label="Edit"
          title="Edit"
          className={`${btn} hover:text-indigo-600`}
        >
          <Pencil className={icon} />
        </button>
        <button
          type="button"
          onPointerDown={keepPointer}
          onClick={() => onDelete(tile)}
          aria-label="Delete"
          title="Delete"
          className={`${btn} hover:text-red-600`}
        >
          <Trash2 className={icon} />
        </button>
      </div>

      <div className={`flex min-h-0 flex-1 flex-col ${page ? 'gap-2 p-4' : 'px-3 pb-3 pt-2.5'}`}>
        <p
          className={`line-clamp-2 break-words font-semibold leading-snug ${page ? 'text-[15px]' : 'text-[13px]'} ${
            done ? 'text-slate-400 line-through' : 'text-slate-900'
          }`}
        >
          {tile.title}
        </p>
        <div className="mt-auto flex items-center gap-1.5">
          {domain && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`}
              alt=""
              loading="lazy"
              draggable={false}
              onError={e => {
                e.currentTarget.style.display = 'none';
              }}
              className="h-3.5 w-3.5 shrink-0 rounded-sm"
            />
          )}
          <span className={`min-w-0 flex-1 truncate text-slate-500 ${page ? 'text-xs' : 'text-[11px]'}`}>{domain}</span>
          {tile.note && (
            <span title={tile.note} className="shrink-0 text-slate-400">
              <StickyNote className="h-3.5 w-3.5" />
            </span>
          )}
        </div>
      </div>
    </>
  );
}

/** The inside of a link card. The board and the section page each wrap it in their own positioned element. */
export const LinkCard = memo(LinkCardBody);
