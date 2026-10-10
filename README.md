# Quire

A calm, native macOS reader for Markdown notes, built for reading an Obsidian vault rather than editing it.

The Swift/AppKit shell (`Sources/Quire`) provides the window, translucent sidebar, toolbar, menus, and file
watching, and serves the vault over a private `quire://` scheme. The reading UI (`web/`) is Preact plus
markdown-it, rendered in WebKit.

## Build & install

```sh
npm install
npm run build        # bundles the UI, compiles Swift, installs ~/Applications/Quire.app
```

Requires the Xcode Command Line Tools (no full Xcode needed) and Node 18+.

## Develop

```sh
npm run dev          # rebuilds the UI on change and serves it at http://localhost:4747
```

To run the native shell against the live `web/` folder: `swift build -c release && QUIRE_WEB_DIR=$PWD/web .build/release/Quire`.
`QUIRE_VAULT=/path` opens a different vault without changing the saved one.

## What it reads

Wikilinks (`[[note]]`, `[[note#heading|alias]]`), embeds (`![[image.png | 600]]`, `![[note#section]]`),
callouts (`> [!tip]`, foldable `[!note]-`), `==highlights==`, `%%comments%%`, `#tags`, frontmatter,
GFM tables and task lists, footnotes, and syntax highlighting (unlabelled code blocks are auto-detected).

## Shortcuts

| | |
|---|---|
| ⌘K / ⌘P | Search notes and their contents |
| ⌘[ / ⌘] | Back / forward (or two-finger swipe) |
| ⌃⌘S or ⌘\ | Toggle library |
| ⌘. | Toggle contents |
| ⌘, | Settings (mode, theme, accent, background, fonts, reading options) |
| ⇧⌘A | Quick appearance panel |
| ⇧⌘L | Toggle light / dark |
| ⌘+ / ⌘− / ⌘0 | Text size |
| ⇧⌘H | Home |
| ⇧⌘O | Open a different vault |
| ⌘R | Reload vault |

The vault defaults to the one Obsidian last had open. Notes reload automatically when files change.
Reading progress is remembered per note and shown on Home and on folder pages.
