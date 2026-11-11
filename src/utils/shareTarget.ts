/** What another app shared to Tasky, read from the share target's url, title and text fields. */
export interface SharedLink {
  url: string;
  title: string;
}

const LINK_PATTERN = /https?:\/\/[^\s<>"']+/i;

/** The first web link in some text, without punctuation that only ends the sentence around it. */
export function findLink(text: string): string {
  const match = LINK_PATTERN.exec(text)?.[0] ?? '';
  const link = match.replace(/[.,;:!?)\]}]+$/, '');

  try {
    return /^https?:$/.test(new URL(link).protocol) ? link : '';
  } catch {
    return '';
  }
}

/**
 * Apps fill the share fields differently: many leave `url` empty and put "Some title https://…" in `text`.
 * The link is the first one found in url, then text, then title. The title is the shared title, else what
 * the text says around the link; a title that is only the link counts as none.
 */
export function readSharedLink(fields: { url?: string | null; title?: string | null; text?: string | null }): SharedLink {
  const url = fields.url?.trim() ?? '';
  const title = fields.title?.trim() ?? '';
  const text = fields.text?.trim() ?? '';

  const link = findLink(url) || findLink(text) || findLink(title);
  const words = (value: string) => (link ? value.split(link).join(' ') : value).replace(/\s+/g, ' ').trim();
  const titleWords = words(title);

  return { url: link, title: (titleWords || words(text)).slice(0, 300) };
}
