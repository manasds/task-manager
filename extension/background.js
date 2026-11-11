// Right-click "Save to Tasky" for the page or a link. Feedback is a short badge on the toolbar icon.
import { SignedOutError, canSave, getSettings, saveLink } from './shared.js';

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: 'save-page', title: 'Save page to Tasky', contexts: ['page'] });
    chrome.contextMenus.create({ id: 'save-link', title: 'Save link to Tasky…', contexts: ['link'] });
  });
});

async function flash(tabId, text, color) {
  await chrome.action.setBadgeBackgroundColor({ tabId, color });
  await chrome.action.setBadgeText({ tabId, text });
  setTimeout(() => chrome.action.setBadgeText({ tabId, text: '' }), 2500);
}

/** Save straight to the last section used, with a badge for feedback. */
async function quickSave(url, title, tabId) {
  try {
    const { lastSection } = await getSettings();
    await saveLink({ url, title: title || undefined, sectionId: lastSection || undefined });

    if (tabId) await flash(tabId, '✓', '#059669');
  } catch (error) {
    if (tabId) await flash(tabId, '!', '#dc2626');

    // Not signed in: open the popup so the Sign in button is right there.
    if (error instanceof SignedOutError) chrome.action.openPopup?.().catch(() => undefined);
  }
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const isLink = info.menuItemId === 'save-link';
  const url = isLink ? info.linkUrl : tab?.url;
  const tabId = tab?.id;

  if (!canSave(url)) {
    if (tabId) await flash(tabId, '!', '#dc2626');

    return;
  }

  if (!isLink) {
    await quickSave(url, tab?.title, tabId);

    return;
  }

  // A link opens the popup with that link filled in, so you can pick the section, title and note.
  // The link's text stands in for its title; left empty, Tasky looks the page up.
  const title = (info.linkText || '').trim().slice(0, 300);
  await chrome.storage.session.set({ pendingLink: { url, title, at: Date.now() } });

  try {
    await chrome.action.openPopup();
  } catch {
    // Browsers that can't open the popup from here save it straight away instead.
    await chrome.storage.session.remove('pendingLink');
    await quickSave(url, title, tabId);
  }
});
