# Quire

A native macOS app for **reading** Markdown notes, made for an Obsidian vault (default: `~/Documents/knowledge-base`).
Obsidian is still the editor. Quire is the calm, good-looking place to read the notes. The goal for every change is
reading comfort and aesthetics: typography, spacing, motion, and finding things quickly.

## Tech stack

| Layer | Tech | Where |
|---|---|---|
| Native shell | Swift 6 / AppKit + WebKit (`WKWebView`), built with SwiftPM. No Xcode project; Command Line Tools are enough | `Sources/Quire/` |
| UI | Preact 10 (JSX, hooks), plain CSS with theme tokens | `web/src/app.jsx`, `web/src/settings*.js(x)`, `web/styles.css` |
| Markdown | markdown-it 14 + footnote / task-lists / mark plugins + custom Obsidian plugins | `web/src/markdown.js` |
| Highlighting | highlight.js 11 core with ~20 registered languages and auto-detect for unlabelled fences | `web/src/highlight.js` |
| Bundler | esbuild (IIFE bundle → `web/dist/app.js`) | `package.json` scripts |
| Fonts | System only: New York (`ui-serif`), Charter, SF Pro, SF Mono. No web fonts, works offline | `styles.css` |

## Architecture

```
NSWindow (transparent titlebar, unified NSToolbar, fullSizeContentView, backgroundColor = theme --bg)
└─ container NSView
   ├─ NSVisualEffectView (.sidebar, behind-window glass), pinned left, width = sidebar width or 0 when collapsed
   ├─ WKWebView (drawsBackground = false) loads quire://app/index.html
   └─ DragStrip (top 52pt, transparent) ← moves the window; toolbar items sit above it in the titlebar
        │  fetch('api/vault') ──────────► SchemeHandler → Vault.payload()   (every .md with content + list of other files)
        │  <img src="vault/…?w=1600"> ──► SchemeHandler → ImageScaler (downscaled to display size, disk-cached) or raw file
        │  webkit.messageHandlers.quire ─► AppDelegate (openExternal, copy, openInObsidian, chooseVault, revealVault,
        │                                   title, appearance {mode, background}, log)
        ◄── evaluateJavaScript: window.quire.command(name) / window.quire.vaultChanged()   (menus, toolbar, FSEvents)
```

- **The native side stays thin.** It serves files, watches the folder, and owns the window, menus and toolbar. All
  logic (parsing, link graph, backlinks, search, tree, routing) runs in JS over one JSON payload. The vault is about
  0.5 MB, so the UI re-fetches the whole thing on every change.
- **Routing** is hash-based: `#/` home, `#/n/<encoded path>?h=<heading>&q=<search term>` note, `#/f/<path>` folder.
  Hash history means ⌘[ / ⌘] and trackpad swipe both use real browser history.
- **Persistence** uses `localStorage` keys prefixed `quire.` (`settings`, `sidebar`, `open` folders, `last` note,
  `progress` = `{path: {p, max, t}}`). The `settings` object is defined in `web/src/settings.js` (`DEFAULTS`). The vault path lives in `UserDefaults` (`vaultPath`). If it isn't set, the app
  falls back to the vault Obsidian last had open (`~/Library/Application Support/obsidian/obsidian.json`).

### File map

- `Sources/Quire/main.swift`: AppDelegate, window, native toolbar items, menu bar, JS bridge, navigation policy
  (non-`quire:` URLs open in the default browser). Saves the theme background colour (`windowBackground` default) so
  the window opens in the right colour before the page paints.
- `Sources/Quire/DragStrip.swift`: transparent view over the titlebar that drags the window and handles double-click zoom.
- `Sources/Quire/ImageScaler.swift`: ImageIO downscaling of vault images to the `?w=` width the page asks for. Results
  are cached as PNGs in `~/Library/Caches/com.ravi.quire/images`.
- `Sources/Quire/SchemeHandler.swift`: `quire://app/...` serves the web UI, `/api/vault`, and `/vault/<path>`.
- `Sources/Quire/Vault.swift`: directory walk (skips hidden dirs such as `.obsidian` and `.git`), FSEvents watcher
  (ignores `.obsidian/` churn, 300 ms debounce), Obsidian default-vault lookup.
- `Sources/Quire/Debug.swift`: dev-only hooks, active only when `QUIRE_DEBUG` is set.
- `web/src/app.jsx`: App (state, commands, shortcuts), Sidebar, Reader (TOC, scroll spy, progress, hover previews,
  prev/next, backlinks, render cache), Home, FolderView, Palette (⌘K), QuickPanel (toolbar "Aa"), Lightbox.
- `web/src/settings.js`: preference model: modes, themes (with preview swatches), accents, canvases, fonts, `DEFAULTS`,
  and `applySettings()`, which writes `data-theme`/`data-mode`/`data-canvas` and CSS variables onto `<html>`.
- `web/src/settings-page.jsx`: the full Settings page (`#/settings`, ⌘,) and the `ThemeArt` mini previews.
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
scripts/run-dev.sh [vault]   # build:web + swift build + sign + launch with QUIRE_DEBUG and QUIRE_WEB_DIR
```

### Code signing (why macOS doesn't keep asking for Documents access)

The vault lives in `~/Documents`, which macOS privacy (TCC) protects. TCC remembers "Allow" against the app's
*designated requirement*. An ad-hoc signature (`codesign -s -`) pins that requirement to the cdhash, which changes on
every build, so each rebuild re-prompts. Builds are therefore signed with a self-signed certificate,
**"Quire Local Signing"** (login keychain, 10 years, code-signing only). That gives a stable requirement:
`identifier "com.ravi.quire" and certificate leaf = H"c7af1c92…"`. The certificate shows as `CSSMERR_TP_NOT_TRUSTED`,
which is fine: codesign and TCC don't need it trusted. `build-app.sh` falls back to ad-hoc (with a warning) if it is
missing. `run-dev.sh` signs the dev binary as `com.ravi.quire.dev`, which has its own one-time permission.

To recreate the certificate on a new Mac, use OpenSSL 3 and export the `.p12` with `-legacy -certpbe PBE-SHA1-3DES
-keypbe PBE-SHA1-3DES -macalg sha1`; otherwise `security import` fails with "MAC verification failed". Then run
`security import quire.p12 -k ~/Library/Keychains/login.keychain-db -P <pass> -T /usr/bin/codesign`.
The certificate needs `extendedKeyUsage = critical, codeSigning`.

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

- **The top 52px is the titlebar.** The web view runs under it (`fullSizeContentView`), and `DragStrip` covers that band
  so dragging moves the window. Web content there is not clickable, so put buttons in the native toolbar
  (`toolbar(_:itemForItemIdentifier:)` in main.swift) and keep `--strip-h: 52px` in sync. Check routing with
  `swift scripts/debug.swift hittest 600,20` (it prints the view under that point to stdout). Synthetic mouse events
  from the terminal are blocked (no Accessibility permission), so real drags can't be automated. The web toolbar
  (`.web-toolbar`) only renders in browser mode.
- **Keyboard shortcuts** are handled in JS (`onKey` in App) with `preventDefault()`, which stops the matching
  menu items from firing twice. Menu items and toolbar buttons call `window.quire.command(name)`. When adding a
  command, wire all three: the `command()` switch, `onKey`, and the menu/toolbar selector.
- **Appearance is two independent axes.** Mode is `system`/`light`/`dark` (→ `data-mode`), and the theme is
  `paper`/`graphite`/`sepia`/`grid` (→ `data-theme`). Every theme defines a palette for *both* modes in `styles.css`
  (`[data-theme=x][data-mode=y]`). Accent, canvas (plain/grid/dots), fonts, size, leading and width are separate settings.
  Derived colours (`--accent-soft`, `--accent-line`, `--sel`) come from `--accent` via `color-mix`, so a custom accent
  just overrides `--accent`. Never hard-code colours. To add a theme: add both palettes in CSS, plus an entry in
  `THEMES` with preview swatches.
- **The sidebar is web content over native glass.** It is edge-to-edge (the user prefers it integrated, not floating)
  with a light `--glass` tint at 38%. The real blur comes from the `NSVisualEffectView` underneath. The web posts
  `sidebar {open, width, animate}` on every toggle, and main.swift animates the glass width (0.3s, same curve as the
  CSS `margin-left` transition) and hides it when collapsed. Keep `--sidebar-w` (264px) and the posted width in sync.
  The reading pane (`.pane`) is opaque and owns the canvas pattern; `body` is transparent in the app. Avoid CSS
  `backdrop-filter` on large or persistent elements (a floating blurred sidebar measured about +20 MB in the page
  process). The native blur is composited by the WindowServer and adds nothing to Quire's own processes.
- **The vault's own quirks:** JS notes use `[[Prototype]]`-style spec notation, so unresolved wikilinks render
  literally (monospace) rather than as broken links. There are 211 code fences with no language, so auto-detect
  matters (`hljs.autoSubset`, relevance ≥ 6). `*.excalidraw.md` files are hidden (they can't render outside Obsidian).
  A leading `# H1` becomes the title and is removed from the body. Names like `01. APIs` show a "Part 01" kicker and
  dim numbers in the sidebar.
- **Reading size is fluid.** `.page` defines `--fs` (the reading size). With `data-fluid="on"` (setting "Scale with
  window", default on) it grows from `--size` to about 1.4× at a 2560pt full screen. `--measure` is in **em** (36em
  normal), so the column grows with the text and line length stays at about 70–80 characters. Past ~1600pt the
  column also widens up to +5em (`--measure-fluid`). Anything in the reader that should scale (TOC, crumbs, chips,
  code, tables) sizes from `--fs` or in em; UI chrome stays in px. In the settings sample and hover preview, `--fs` is
  unset and falls back to `--size`.
- **Per-font tuning** (`BODY_FONTS[*].tune` in settings.js → `--font-scale`, `--tracking`, `--word-spacing`,
  `--leading-adjust`). Large-x-height sans faces (IBM Plex, SF Pro, Avenir) are scaled to about 0.92 and given extra
  letter, word and line spacing. Without this they read cramped: the user reported Plex looking "congested".
  Code and tables reset tracking and word spacing to 0.
- **Grid and dots run behind the text on purpose.** The user likes the transparent, graph-paper feel, so don't mask
  the reading column (a feathered "reading lane" was tried and rejected). Keep the lines subtle instead: `--grid` and
  `--grid-major` alphas are around 0.02–0.07.
- **Images** inside `p.figure` break out of the text column (`100cqw` container units on `.reader-scroll`). Sizes come
  from `|800` in embeds or `width=` on `<img>`, and are stored as `--w: 800/19` (unitless) so that
  `width = --w × --fs` scales with fluid text.
- Comment density is low. Match the existing style: small named functions, no framework beyond Preact.

## Performance budget

Goal: light enough that it never feels heavier than the Markdown it shows. Measured on 2026-10-10 (1320×860 window, Retina):

| | |
|---|---|
| Cold launch → note rendered | ~0.55 s |
| Vault load + index (65 notes) | ~40 ms; a note render is 3–5 ms |
| Idle CPU | 0% (no timers or infinite animations; FSEvents only) |
| Memory (all 4 processes, footprint as Activity Monitor shows it) | ~195 MB on Home, ~220 MB on a typical note, ~270 MB on the image-heaviest note, and up to ~300 MB after long sessions. Over half of the page process is WebKit graphics surfaces (pooled for reuse, and mostly marked reclaimable). WebKit only frees them under system memory pressure, and there is no public API to force it |
| Continuous scrolling | ~14% CPU in the page process (was 19% before rAF throttling) |

Rules that keep it there:
- Scroll handling runs at most once per animation frame and writes the DOM directly (progress bar, strip class).
  Never `setState` per scroll event. The active TOC entry is set only when it changes.
- Rendered HTML is cached per vault snapshot (LRU, 24 notes). Rebuilding the vault invalidates it.
- WebKit's memory cache is cleared (`WKWebsiteDataTypeMemoryCache`) 2.5s after every route change (the web posts
  `trimMemory`) and whenever the app resigns active. Without this, decoded images from earlier notes accumulated:
  387 MB on Saga after browsing, versus 267 MB with it.
- Images: `loading="lazy" decoding="async"`, requested at display width (`?w=` = 2× CSS width), and downscaled natively.
  `data-full` holds the original for the lightbox.
- Avoid `backdrop-filter` and `will-change` on large or persistent elements. Each composited layer costs a
  window-sized buffer at 2×.

Run `scripts/profile.sh [binary] [webdir]` for the full scenario profile (launch → notes → browse → collapse → scroll).
Measure single things with `scripts/measure.sh` (footprint + CPU of Quire and its WebKit helpers),
`scripts/memtest.sh <binary> [webdir] [note] [js]` (fresh-launch memory for one note), and `scripts/scrolltest.sh [note]`
(CPU while auto-scrolling). All three need a `QUIRE_DEBUG=1` build running.

## Ideas / roadmap

- Math (KaTeX) and Mermaid diagrams, lazy-loaded only when a note uses them.
- Render Excalidraw embeds (the plugin can store SVG exports alongside the drawing).
- Find-in-note (⌘F), with search scoped to a folder.
- Keyboard navigation in the sidebar. `j`/`k` and space for paging.
- Reading stats and a "review" mode (spaced resurfacing of finished notes) for learning.
- Export a note to a nicely typeset PDF.
- Optional: real Developer ID signing and notarisation if the app is ever shared.
- If memory must go much lower (~60–80 MB), the only big lever is a native text renderer (TextKit 2 / AttributedString)
  instead of WebKit. That is a large rewrite and would lose some rendering fidelity.
