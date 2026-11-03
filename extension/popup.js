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

async function showForm(tab) {
  const { base, lastSection } = await getSettings();
  $('open-canvas').href = `${base}/canvas`;
  $('open-canvas').classList.remove('hidden');

  if (!canSave(tab?.url)) {
    show('save-form');
    $('save').disabled = true;
    say("This page can't be saved. Open a website and try again.");

    return;
  }

  const [page, sections] = await Promise.all([readPage(tab), listSections()]);
  const domain = new URL(tab.url).hostname.replace(/^www\./, '');

  $('title').value = (page.title || tab.title || domain).slice(0, 300);
  $('url').textContent = tab.url;
  $('cover-domain').textContent = domain;

  if (/^https?:\/\//.test(page.image)) {
    $('cover').style.backgroundImage = `url("${page.image.replace(/"/g, '%22')}")`;
    $('cover').classList.add('has-image');
    $('cover').dataset.image = page.image;
  }

  const select = $('section');
  select.replaceChildren();

  if (sections.length === 0) select.append(new Option('Links (new section)', ''));

  for (const s of sections) select.append(new Option(s.name, s.id));
  select.value = sections.some(s => s.id === lastSection) ? lastSection : (sections[0]?.id ?? '');
  show('save-form');
  $('title').focus();
  $('title').select();
}

async function start() {
  say('');
  const { token } = await getSettings();
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!token) {
    show('signed-out');

    return;
  }

  try {
    await showForm(tab);
  } catch (error) {
    if (error instanceof SignedOutError) show('signed-out');
    else {
      show('signed-out');
      say(error.message);
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
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  $('save').disabled = true;
  $('save').textContent = 'Saving…';
  say('');

  try {
    const saved = await saveLink({
      url: tab.url,
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
