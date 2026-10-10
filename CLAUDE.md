# Quire

A native macOS app for **reading** Markdown notes, made for an Obsidian vault (default: `~/Documents/knowledge-base`).
Obsidian is still the editor. Quire is the calm, good-looking place to read the notes. The goal for every change is
reading comfort and aesthetics: typography, spacing, motion, and finding things quickly.

## Tech stack

| Layer | Tech | Where |
|---|---|---|
| Native shell | Swift 6 / AppKit + WebKit (`WKWebView`), built with SwiftPM. No Xcode project; Command Line Tools are enough | `Sources/Quire/` |
| UI | Preact 10 (JSX, hooks), plain CSS with theme tokens | `web/src/app.jsx`, `web/styles.css` |
| Markdown | markdown-it 14 + footnote / task-lists / mark plugins + custom Obsidian plugins | `web/src/markdown.js` |
| Highlighting | highlight.js 11 core with ~20 registered languages and auto-detect for unlabelled fences | `web/src/highlight.js` |
| Bundler | esbuild (IIFE bundle → `web/dist/app.js`) | `package.json` scripts |
| Fonts | System only: New York (`ui-serif`), Charter, SF Pro, SF Mono. No web fonts, works offline | `styles.css` |

## Architecture

```
NSWindow (transparent titlebar, unified NSToolbar, fullSizeContentView)
└─ NSVisualEffectView (.sidebar vibrancy)  ← shows through the web sidebar
   └─ WKWebView (drawsBackground = false) loads quire://app/index.html
        │  fetch('api/vault') ──────────► SchemeHandler → Vault.payload()   (every .md with content + list of other files)
        │  <img src="vault/…"> ─────────► SchemeHandler → raw file from vault (path-traversal guarded)
        │  webkit.messageHandlers.quire ─► AppDelegate (openExternal, copy, openInObsidian, chooseVault, title, appearance)
        ◄── evaluateJavaScript: window.quire.command(name) / window.quire.vaultChanged()   (menus, toolbar, FSEvents)
```

- **The native side stays thin.** It serves files, watches the folder, and owns the window, menus and toolbar. All
  logic (parsing, link graph, backlinks, search, tree, routing) runs in JS over one JSON payload. The vault is about
  0.5 MB, so the UI re-fetches the whole thing on every change.
- **Routing** is hash-based: `#/` home, `#/n/<encoded path>?h=<heading>&q=<search term>` note, `#/f/<path>` folder.
  Hash history means ⌘[ / ⌘] and trackpad swipe both use real browser history.
- **Persistence** uses `localStorage` keys prefixed `quire.` (`settings`, `sidebar`, `toc`, `open` folders, `last` note,
  `progress` = `{path: {p, max, t}}`). The vault path lives in `UserDefaults` (`vaultPath`). If it isn't set, the app
  falls back to the vault Obsidian last had open (`~/Library/Application Support/obsidian/obsidian.json`).

### File map

- `Sources/Quire/main.swift`: AppDelegate, window, native toolbar items, menu bar, JS bridge, navigation policy
  (non-`quire:` URLs open in the default browser).
- `Sources/Quire/SchemeHandler.swift`: `quire://app/...` serves the web UI, `/api/vault`, and `/vault/<path>`.
- `Sources/Quire/Vault.swift`: directory walk (skips hidden dirs such as `.obsidian` and `.git`), FSEvents watcher
  (ignores `.obsidian/` churn, 300 ms debounce), Obsidian default-vault lookup.
- `Sources/Quire/Debug.swift`: dev-only hooks, active only when `QUIRE_DEBUG` is set.
- `web/src/app.jsx`: the whole UI: App (state, shortcuts, theme), Sidebar, Reader (TOC, scroll spy, progress,
  hover previews, prev/next, backlinks), Home, FolderView, Palette (⌘K), SettingsPanel, Lightbox.
- `web/src/vault.js`: builds the model from the payload. Covers title rules, humanised names, link resolution
  (Obsidian-style, by basename anywhere in the vault, shortest path wins), backlinks, natural-sort tree, fuzzy title
  search, and full-text search.
- `web/src/markdown.js`: renderer and the Obsidian syntax plugins: `[[wikilinks]]`, `![[embeds]]` (image sizes via
  `|600`, note/section transclusion up to depth 2), `#tags`, `%%comments%%`, frontmatter, heading ids, code fences.
- `web/src/enhance.js`: DOM post-processing after render (callouts, figures/captions, table wrappers, find-and-flash).
- `web/src/native.js`: bridge wrapper. Degrades to browser behaviour when not inside the app.
- `dev-server.mjs`: Node server mirroring the `quire://` API for browser development.
- `scripts/build-app.sh`: assembles and signs `Quire.app` and installs it. `scripts/make-icon.swift` draws the icon.

## Build & run

```sh
npm install                 # once
npm run build               # build:web + swift build -c release + assemble build/Quire.app + install to ~/Applications
npm run build:web           # UI bundle only (fast)
npm run dev                 # esbuild --watch + dev server at http://localhost:4747 (browser mode)
```

`scripts/build-app.sh` runs: esbuild → `swift build -c release` → copy the binary and `web/{index.html,styles.css,dist/}`
into `Contents/Resources/web` → render the icon (1024 PNG → `sips` sizes → `iconutil` → `.icns`) → write `Info.plist`
(bundle id `com.ravi.quire`, macOS 13+) → ad-hoc `codesign` → replace `~/Applications/Quire.app`.

Running the native shell against the live UI (no reinstall, so you only rerun `npm run build:web` between edits):

```sh
swift build -c release
QUIRE_DEBUG=1 QUIRE_WEB_DIR=$PWD/web .build/release/Quire
```

Environment variables: `QUIRE_WEB_DIR` serves the UI from a folder instead of the bundle. `QUIRE_VAULT=/path` opens a
vault without saving it as the default. `QUIRE_DEBUG=1` enables the debug hooks below.

## Verifying UI changes

The terminal has no Screen Recording permission, so `screencapture` fails. Use these instead:

1. **Native app (preferred, real WebKit and real fonts).** Launch with `QUIRE_DEBUG=1` as above. Then:
   ```sh
   swift scripts/debug.swift js "location.hash='#/n/'+encodeURIComponent('Study/React/Part 1.md')"
   swift scripts/debug.swift js "quire.command('theme:night')"
   swift scripts/debug.swift snapshot /tmp/quire.png      # the app captures its own window
   ```
   Then view the PNG (shrink it with `sips -Z 1400` first; snapshots are 2x).
2. **Browser mode.** Run `npm run dev` (or `PORT=4748 node dev-server.mjs /path/to/vault`), then
   `scripts/shot.sh /tmp/out.png "http://localhost:4747/#/..." 1440 900 light`. Chrome falls back to Georgia
   instead of New York, so check final typography in the native app.

To check syntax coverage, build a throwaway vault (callouts, tables, tasks, footnotes, `![[note#section]]`) and run with
`QUIRE_VAULT`. Never write test files into the real vault: it is git-synced via obsidian-git.

## Conventions & gotchas

- **The top 52px is the titlebar.** With `fullSizeContentView` and a unified toolbar, the titlebar container sits above
  the web view and catches clicks for window dragging, so web content in that strip is not interactive. Put buttons
  in the native toolbar (`toolbar(_:itemForItemIdentifier:)` in main.swift) and keep `--strip-h: 52px` in sync. The web
  toolbar (`.web-toolbar`) only renders in browser mode.
- **Keyboard shortcuts** are handled in JS (`onKey` in App) with `preventDefault()`, which stops the matching
  menu items from firing twice. Menu items and toolbar buttons call `window.quire.command(name)`. When adding a
  command, wire all three: the `command()` switch, `onKey`, and the menu/toolbar selector.
- **Themes** are CSS custom properties per `[data-theme]` (paper, sepia, night, plus `auto`). Never hard-code colours;
  add a token to all three themes. Syntax colours are tokens too (`--hl-*`). The JS posts `appearance` so the native
  vibrancy and toolbar follow the theme.
- **The sidebar is web, not native.** Its background is semi-transparent in native mode so the vibrancy shows.
  The reader pane is opaque.
- **The vault's own quirks:** JS notes use `[[Prototype]]`-style spec notation, so unresolved wikilinks render
  literally (monospace) rather than as broken links. There are 211 code fences with no language, so auto-detect
  matters (`hljs.autoSubset`, relevance ≥ 6). `*.excalidraw.md` files are hidden (they can't render outside Obsidian).
  A leading `# H1` becomes the title and is removed from the body. Names like `01. APIs` show a "Part 01" kicker and
  dim numbers in the sidebar.
- **Images** inside `p.figure` break out of the text column (`100cqw` container units on `.reader-scroll`). Sizes come
  from `|800` in embeds or `width=` on `<img>`.
- Comment density is low. Match the existing style: small named functions, no framework beyond Preact.

## Ideas / roadmap

- Math (KaTeX) and Mermaid diagrams, lazy-loaded only when a note uses them.
- Render Excalidraw embeds (the plugin can store SVG exports alongside the drawing).
- Find-in-note (⌘F), with search scoped to a folder.
- Keyboard navigation in the sidebar. `j`/`k` and space for paging.
- Reading stats and a "review" mode (spaced resurfacing of finished notes) for learning.
- Export a note to a nicely typeset PDF.
- Optional: real Developer ID signing and notarisation if the app is ever shared.
