'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { z } from 'zod';
import { getSessionUserId, signInWithGoogle } from '@/auth/client';
import { canvasSectionSchema, linkPreviewSchema, type CanvasSection } from '@/types/canvas';
import { getDomain } from '@/utils/canvas';
import { readSharedLink } from '@/utils/shareTarget';

type Phase = 'loading' | 'signed-out' | 'form' | 'saved';

const sectionsResponseSchema = z.object({ sections: z.array(canvasSectionSchema) });
const savedResponseSchema = z.object({ section: z.object({ id: z.string(), name: z.string() }) });

const LAST_SECTION_KEY = 'tasky.share.lastSection';

function readLastSection(): string | null {
  try {
    return localStorage.getItem(LAST_SECTION_KEY);
  } catch {
    return null;
  }
}

function writeLastSection(id: string) {
  try {
    localStorage.setItem(LAST_SECTION_KEY, id);
  } catch {
    // Only a convenience: the next share starts on the first section instead.
  }
}

const isWebLink = (value: string) => /^https?:\/\/\S+$/i.test(value);

const fieldClass =
  'w-full rounded-xl border border-slate-300 bg-page px-3 py-2.5 text-[15px] font-normal text-slate-800 focus:border-indigo-400 focus:outline-none focus:ring-[3px] focus:ring-indigo-100';

const labelClass = 'flex flex-col gap-1 text-xs font-semibold text-slate-500';

/**
 * Opened by Android's share menu (the manifest's share_target) with what another app shared.
 * Fills in the link, title and last-used section, and saves to the canvas once you confirm.
 */
export default function ShareSheet() {
  const [phase, setPhase] = useState<Phase>('loading');
  const [message, setMessage] = useState('');
  const [sections, setSections] = useState<CanvasSection[]>([]);
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [note, setNote] = useState('');
  const [image, setImage] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedTo, setSavedTo] = useState('');
  // What the form was filled with, so a different pasted link drops the shared title and image.
  const prefilled = useRef({ url: '', title: '' });
  const titleEdited = useRef(false);

  useEffect(() => {
    void (async () => {
      const params = new URLSearchParams(window.location.search);
      const shared = readSharedLink({ url: params.get('url'), title: params.get('title'), text: params.get('text') });

      try {
        if (!(await getSessionUserId())) return setPhase('signed-out');

        const response = await fetch('/api/canvas', { cache: 'no-store' });

        if (response.status === 401) return setPhase('signed-out');

        const body = sectionsResponseSchema.parse(await response.json());
        const last = readLastSection();

        prefilled.current = { url: shared.url, title: shared.title };
        setUrl(shared.url);
        setTitle(shared.title);
        setSections(body.sections);
        setSectionId(body.sections.some(s => s.id === last) ? (last ?? '') : (body.sections[0]?.id ?? ''));
        setPhase('form');
      } catch {
        setUrl(shared.url);
        setTitle(shared.title);
        setPhase('form');
        setMessage('Could not reach Tasky. Check your connection and try again.');

        return;
      }

      if (!shared.url) return;

      // The page's own title and image, looked up once here so saving doesn't look them up again.
      try {
        const response = await fetch(`/api/canvas/preview?url=${encodeURIComponent(shared.url)}`);

        if (!response.ok) return;

        const preview = linkPreviewSchema.parse(await response.json());

        if (prefilled.current.url !== shared.url) return;

        if (preview.image) setImage(preview.image);

        const pageTitle = preview.title?.slice(0, 300);

        // The page's title replaces a missing one, or one that is just the domain, unless you already typed.
        if (pageTitle && !titleEdited.current && (!shared.title || shared.title === getDomain(shared.url))) {
          prefilled.current.title = pageTitle;
          setTitle(pageTitle);
        }
      } catch {
        // No preview: the cover shows the domain, and the server fills in the title on save.
      }
    })();
  }, []);

  const changeUrl = (value: string) => {
    setUrl(value);

    if (value.trim() === prefilled.current.url) return;

    // A different link: the shared title and image no longer belong to it.
    if (title === prefilled.current.title) setTitle('');
    prefilled.current = { url: value.trim(), title: '' };
    setImage('');
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const link = url.trim();

    if (!isWebLink(link)) return setMessage('Enter a web link that starts with http:// or https://');

    setSaving(true);
    setMessage('');

    try {
      const response = await fetch('/api/canvas/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: link,
          title: title.trim() || undefined,
          note: note.trim() || undefined,
          sectionId: sectionId || undefined,
          image: image || undefined,
        }),
      });

      if (response.status === 401) return setPhase('signed-out');

      const body = savedResponseSchema.safeParse(await response.json().catch(() => null));

      if (!response.ok || !body.success) throw new Error('not saved');

      writeLastSection(body.data.section.id);
      setSavedTo(body.data.section.name);
      setPhase('saved');
    } catch {
      setMessage('Could not save. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  const signIn = () => {
    signInWithGoogle(window.location.pathname + window.location.search).catch(() =>
      setMessage('Could not start Google sign-in.')
    );
  };

  const domain = getDomain(url.trim());

  return (
    <main className="min-h-dvh bg-page p-4 text-slate-800">
      <div className="mx-auto w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-4 pop-shadow">
        <header className="mb-3 flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.svg" alt="" width={20} height={20} />
          <span className="font-semibold tracking-tight text-slate-900">Save to Tasky</span>
          {(phase === 'loading' || phase === 'form') && (
            <Link href="/canvas" className="ml-auto text-[13px] font-semibold text-indigo-600 hover:underline">
              Open canvas
            </Link>
          )}
        </header>

        {message && (
          <p role="status" className="mb-3 rounded-xl bg-red-50 px-2.5 py-2 text-[13px] text-red-700">
            {message}
          </p>
        )}

        {phase === 'loading' && <p className="text-sm text-slate-500">Getting your sections…</p>}

        {phase === 'signed-out' && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-slate-600">Sign in to save this link to your canvas.</p>
            <button
              type="button"
              onClick={signIn}
              className="btn-ink rounded-xl px-3 py-2.5 text-[15px] font-medium"
            >
              Sign in with Google
            </button>
          </div>
        )}

        {phase === 'form' && (
          <form onSubmit={save} className="flex flex-col gap-3">
            <div
              className="flex aspect-[1.91/1] items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-100 to-slate-300 bg-cover bg-center text-[13px] text-slate-500"
              style={image ? { backgroundImage: `url("${image.replace(/"/g, '%22')}")` } : undefined}
            >
              {!image && (domain || 'Paste a link')}
            </div>
            <label className={labelClass}>
              Title
              <input
                className={fieldClass}
                value={title}
                onChange={e => {
                  titleEdited.current = true;
                  setTitle(e.target.value);
                }}
                maxLength={300}
                placeholder="Filled in from the page if left empty"
              />
            </label>
            <label className={labelClass}>
              Link
              <input
                className={`${fieldClass} text-ellipsis !text-sm !text-slate-500`}
                type="url"
                inputMode="url"
                value={url}
                onChange={e => changeUrl(e.target.value)}
                maxLength={2000}
                placeholder="Paste any link"
              />
            </label>
            <label className={labelClass}>
              Section
              <select className={fieldClass} value={sectionId} onChange={e => setSectionId(e.target.value)}>
                {sections.length === 0 && <option value="">Links (new section)</option>}
                {sections.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label className={labelClass}>
              Note
              <textarea
                className={`${fieldClass} resize-none`}
                rows={2}
                value={note}
                onChange={e => setNote(e.target.value)}
                maxLength={5000}
                placeholder="Optional"
              />
            </label>
            <button
              type="submit"
              disabled={saving}
              className="btn-ink rounded-xl px-3 py-3 text-[15px] font-medium disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save to Tasky'}
            </button>
          </form>
        )}

        {phase === 'saved' && (
          <div className="flex flex-col gap-3">
            <p className="mt-1 text-[15px] text-emerald-700">
              ✓ Saved to <strong>{savedTo}</strong>
            </p>
            <Link
              href="/canvas"
              className="btn-ink rounded-xl px-3 py-3 text-center text-[15px] font-medium"
            >
              Open canvas
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
