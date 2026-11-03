// Right-click "Save to Tasky" for the page or a link. Feedback is a short badge on the toolbar icon.
import { SignedOutError, canSave, getSettings, saveLink } from './shared.js';

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: 'save-page', title: 'Save page to Tasky', contexts: ['page'] });
  chrome.contextMenus.create({ id: 'save-link', title: 'Save link to Tasky', contexts: ['link'] });
});

async function flash(tabId, text, color) {
  await chrome.action.setBadgeBackgroundColor({ tabId, color });
  await chrome.action.setBadgeText({ tabId, text });
  setTimeout(() => chrome.action.setBadgeText({ tabId, text: '' }), 2500);
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const url = info.menuItemId === 'save-link' ? info.linkUrl : tab?.url;
  const tabId = tab?.id;

  if (!canSave(url)) {
    if (tabId) await flash(tabId, '!', '#dc2626');

    return;
  }

  try {
    const { lastSection } = await getSettings();
    // A link's own page title is unknown here; Tasky looks it up.
    const title = info.menuItemId === 'save-page' ? tab?.title : undefined;
    await saveLink({ url, title: title || undefined, sectionId: lastSection || undefined });

    if (tabId) await flash(tabId, '✓', '#059669');
  } catch (error) {
    if (tabId) await flash(tabId, '!', '#dc2626');

    // Not signed in: open the popup so the Sign in button is right there.
    if (error instanceof SignedOutError) chrome.action.openPopup?.().catch(() => undefined);
  }
});
