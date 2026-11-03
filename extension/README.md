# Tasky Saver

A browser extension that saves the page you're on, or any link, to your Tasky canvas.

- **Toolbar button** (or <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>S</kbd>): pick a section, edit the title, add a note, save.
- **Right-click** a page or a link: *Save page to Tasky* / *Save link to Tasky* puts it in the section you used last.
- **Sign in with Google** through Tasky. The extension gets its own key, which Tasky stores only as a hash; *Disconnect this browser* revokes it.
- The page's own preview image is sent along, so saving from the extension doesn't use the Microlink preview allowance.

## Install (Chrome, Edge, Brave, Arc)

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and choose this `extension` folder.
3. Pin **Tasky Saver** and click it, then **Sign in with Google**.

The `key` in `manifest.json` pins the extension id to `ahhkdlkaolkopiadpagcjpdddejcdafh`, which Tasky accepts out of the box.
A copy published to the Chrome Web Store gets a different id: add it to `TASKY_EXTENSION_IDS` (comma-separated) on the server.

## Using a local Tasky

The extension talks to `https://tasky.manasbuilds.me`. To use `http://localhost:3000` (or any other address), open
the popup while signed out, expand **Tasky address**, enter it and click **Use**, then sign in.
