import { BUILT_IN_BASES, SignedOutError, canSave, getSettings, listSections, saveLink, setSettings, signIn, signOut } from './shared.js';

const $ = id => document.getElementById(id);
const views = ['signed-out', 'save-form', 'saved'];

function show(view) {
  for (const v of views) $(v).classList.toggle('hidden', v !== view);
}

function say(text) {
  $('message').textContent = text || '';
  $('message').classList.toggle('hidden', !text);
}

/** The page's own title and preview image, read from its tags. Fails quietly on pages extensions can't read. */
async function readPage(tab) {
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const meta = name =>
          document.querySelector(`meta[property="${name}"], meta[name="${name}"]`)?.getAttribute('content')?.trim() || '';

        const image = meta('og:image') || meta('twitter:image');
        let absolute = '';

        try {
          absolute = image ? new URL(image, location.href).href : '';
        } catch {
          absolute = '';
        }

        return { title: meta('og:title') || document.title, image: absolute };
      },
    });

    return result;
  } catch {
    return { title: tab.title || '', image: '' };
  }
}

function domainOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/** Show a preview image on the cover, or the domain when there is none. */
function setCover(url, image) {
  const cover = $('cover');
  $('cover-domain').textContent = domainOf(url) || 'Paste a link';

  if (/^https?:\/\//.test(image || '')) {
    cover.style.backgroundImage = `url("${image.replace(/"/g, '%22')}")`;
    cover.classList.add('has-image');
    cover.dataset.image = image;
  } else {
    cover.style.backgroundImage = '';
    cover.classList.remove('has-image');
    delete cover.dataset.image;
  }
}

/** A link picked with right-click "Save link to Tasky…" just before the popup opened. */
async function takePendingLink() {
  try {
    const { pendingLink } = await chrome.storage.session.get('pendingLink');
    await chrome.storage.session.remove('pendingLink');

    return pendingLink && Date.now() - pendingLink.at < 60_000 ? pendingLink : null;
  } catch {
    return null;
  }
}

// What the form was filled with, so a different pasted link drops the page's title and image.
let prefilled = { url: '', title: '' };

/** Fill the form with a link: the one right-clicked, else the page you're on, else empty to paste into. */
async function showForm(tab, pending) {
  const { base, lastSection } = await getSettings();
  $('open-canvas').href = `${base}/canvas`;
  $('open-canvas').classList.remove('hidden');

  let link = { url: '', title: '', image: '' };

  if (pending) link = { url: pending.url, title: pending.title || '', image: '' };
  else if (canSave(tab?.url)) {
    const page = await readPage(tab);
    link = { url: tab.url, title: page.title || tab.title || domainOf(tab.url), image: page.image };
  }

  const sections = await listSections();

  prefilled = { url: link.url, title: link.title.slice(0, 300) };
  $('url').value = link.url;
  $('title').value = prefilled.title;
  $('title').placeholder = 'Filled in from the page if left empty';
  setCover(link.url, link.image);

  const select = $('section');
  select.replaceChildren();

  if (sections.length === 0) select.append(new Option('Links (new section)', ''));

  for (const s of sections) select.append(new Option(s.name, s.id));
  select.value = sections.some(s => s.id === lastSection) ? lastSection : (sections[0]?.id ?? '');
  show('save-form');

  const first = link.url ? $('title') : $('url');
  first.focus();
  first.select();
}

$('url').addEventListener('input', () => {
  const url = $('url').value.trim();

  if (url === prefilled.url) return;

  // A different link: the page's title and image no longer belong to it.
  if ($('title').value === prefilled.title) $('title').value = '';
  prefilled = { url, title: '' };
  setCover(url, '');
});

async function start() {
  say('');
  const { token } = await getSettings();
  const pending = await takePendingLink();
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!token) {
    show('signed-out');

    return;
  }

  try {
    await showForm(tab, pending);
  } catch (error) {
    if (error instanceof SignedOutError) show('signed-out');
    else {
      // Still signed in, just can't reach Tasky right now.
      show('save-form');
      $('save').disabled = true;
      say('Could not reach Tasky. Check your connection and try again.');
    }
  }
}

$('sign-in').addEventListener('click', async () => {
  $('sign-in').disabled = true;
  say('');

  try {
    await signIn();
    await start();
  } catch (error) {
    say(error.message || 'Sign-in did not finish.');
  } finally {
    $('sign-in').disabled = false;
  }
});

$('sign-out').addEventListener('click', async () => {
  await signOut();
  show('signed-out');
  $('open-canvas').classList.add('hidden');
});

$('save-form').addEventListener('submit', async e => {
  e.preventDefault();
  const url = $('url').value.trim();

  if (!canSave(url)) {
    say('Enter a web link that starts with http:// or https://');
    $('url').focus();

    return;
  }

  $('save').disabled = true;
  $('save').textContent = 'Saving…';
  say('');

  try {
    const saved = await saveLink({
      url,
      title: $('title').value.trim() || undefined,
      note: $('note').value.trim() || undefined,
      sectionId: $('section').value || undefined,
      image: $('cover').dataset.image || undefined,
    });

    const { base } = await getSettings();
    $('saved-section').textContent = saved.section.name;
    $('saved-open').href = `${base}/canvas`;
    show('saved');
  } catch (error) {
    if (error instanceof SignedOutError) show('signed-out');
    say(error.message || 'Could not save.');
  } finally {
    $('save').disabled = false;
    $('save').textContent = 'Save to Tasky';
  }
});

// A different Tasky address (for example a local copy) needs its own permission and a fresh sign-in.
$('base-form').addEventListener('submit', async e => {
  e.preventDefault();
  let origin;

  try {
    origin = new URL($('base').value.trim()).origin;
  } catch {
    say('Enter a full address, like https://tasky.manasbuilds.me');

    return;
  }

  const granted = BUILT_IN_BASES.includes(origin) || (await chrome.permissions.request({ origins: [`${origin}/*`] }));

  if (!granted) {
    say('The extension needs permission to reach that address.');

    return;
  }

  const { base } = await getSettings();

  if (origin !== base) {
    await signOut();
    await setSettings({ base: origin, lastSection: null });
  }

  say('');
  $('base').value = origin;
});

getSettings().then(({ base }) => {
  $('base').value = base;
});

start();
