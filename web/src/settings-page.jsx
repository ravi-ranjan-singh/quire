import { useMemo } from 'preact/hooks';
import { Icon } from './icons.jsx';
import { isNative, post } from './native.js';
import { createRenderer } from './markdown.js';
import {
  MODES, THEMES, ACCENTS, CANVASES, BODY_FONTS, HEADING_FONTS, CODE_FONTS, WIDTHS, DEFAULTS, resolvedMode,
} from './settings.js';

const SAMPLE = `## The event loop

JavaScript runs one task at a time. When the **call stack** is empty, the loop takes the next callback from the queue — which is why \`setTimeout(fn, 0)\` never runs *immediately*. Read more in [[Closures]].

- Microtasks drain before the next ==macrotask==
- Rendering happens between tasks

\`\`\`js
setTimeout(() => console.log('later'), 0);
Promise.resolve().then(() => console.log('sooner'));
\`\`\`
`;

/** Miniature window used for theme and mode pickers. */
export function ThemeArt({ theme, mode, half }) {
  const [bg, side, text, line, accent, grid] = theme[mode];
  const style = { '--m-bg': bg, '--m-side': side, '--m-text': text, '--m-line': line, '--m-accent': accent, '--m-grid': grid || 'transparent' };
  return (
    <span class="tile-art">
      <span class={`mini ${grid ? 'grid' : ''}`} style={style}>
        <span class="mini-side" />
        <span class="mini-body">
          <span class="mini-h" />
          <span class="mini-l" /><span class="mini-l" style={{ width: '85%' }} /><span class="mini-a" />
          <span class="mini-l" style={{ width: '70%' }} />
        </span>
      </span>
      {half && <ThemeArtHalf theme={theme} />}
    </span>
  );
}

function ThemeArtHalf({ theme }) {
  const [bg, side, text, line, accent] = theme.dark;
  return (
    <span class="mini half" style={{ '--m-bg': bg, '--m-side': side, '--m-text': text, '--m-line': line, '--m-accent': accent }}>
      <span class="mini-side" />
      <span class="mini-body"><span class="mini-h" /><span class="mini-l" /><span class="mini-l" style={{ width: '85%' }} /><span class="mini-a" /></span>
    </span>
  );
}

function Seg({ value, options, onChange }) {
  return (
    <div class="seg">
      {options.map(([id, label]) => <button key={id} class={value === id ? 'on' : ''} onClick={() => onChange(id)}>{label}</button>)}
    </div>
  );
}

function Toggle({ checked, onChange }) {
  return (
    <label class="switch">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.currentTarget.checked)} />
      <span />
    </label>
  );
}

function Row({ name, desc, children, stack }) {
  return (
    <div class={`set-row ${stack ? 'stack' : ''}`}>
      <div class="set-text"><span class="set-name">{name}</span>{desc && <span class="set-desc">{desc}</span>}</div>
      {children}
    </div>
  );
}

const SHORTCUTS = [
  ['Search notes', ['⌘', 'K']], ['Settings', ['⌘', ',']],
  ['Back', ['⌘', '[']], ['Forward', ['⌘', ']']],
  ['Toggle library', ['⌘', '\\']], ['Toggle contents', ['⌘', '.']],
  ['Larger text', ['⌘', '+']], ['Smaller text', ['⌘', '−']],
  ['Light / dark', ['⇧', '⌘', 'L']], ['Quick appearance', ['⇧', '⌘', 'A']],
  ['Home', ['⇧', '⌘', 'H']], ['Reload vault', ['⌘', 'R']],
];

export function SettingsPage({ settings: s, setSettings: set, vault }) {
  const mode = resolvedMode(s);
  const sampleHtml = useMemo(() => {
    const md = createRenderer({ depth: 0, resolveNote: (t) => (t === 'Closures' ? { path: '', title: 'Closures' } : null), resolveFile: () => null, fileUrl: (p) => p });
    return md.render(SAMPLE);
  }, []);

  return (
    <div class="reader-scroll">
      <header class="strip" />
      <div class="settings-page">
        <h1>Settings</h1>
        <p>Make reading feel right. Changes apply instantly.</p>

        <section class="set-section">
          <h2><Icon name="sun" />Appearance</h2>
          <div class="group">
            <Row name="Mode" stack>
              <div class="mode-tiles">
                {MODES.map((m) => {
                  const theme = THEMES.find((t) => t.id === s.theme) || THEMES[0];
                  return (
                    <button key={m.id} class={`tile ${s.mode === m.id ? 'on' : ''}`} onClick={() => set({ mode: m.id })}>
                      <ThemeArt theme={theme} mode={m.id === 'dark' ? 'dark' : 'light'} half={m.id === 'system'} />
                      {m.label}
                    </button>
                  );
                })}
              </div>
            </Row>
            <Row name="Theme" desc="Each theme has a light and a dark version." stack>
              <div class="theme-tiles">
                {THEMES.map((t) => (
                  <button key={t.id} class={`tile ${s.theme === t.id ? 'on' : ''}`} onClick={() => set({ theme: t.id, canvas: 'auto' })}>
                    <ThemeArt theme={t} mode={mode} />{t.label}
                  </button>
                ))}
              </div>
            </Row>
            <Row name="Accent colour">
              <div class="swatches">
                {ACCENTS.map((a) => (
                  <button key={a.id} title={a.label} class={`swatch ${a.id === 'theme' ? 'theme' : ''} ${s.accent === a.id ? 'on' : ''}`}
                    style={a.color ? { '--sw': mode === 'dark' ? a.dark : a.color } : { '--sw': 'var(--accent)' }}
                    onClick={() => set({ accent: a.id })}>
                    {s.accent === a.id && <Icon name="check" />}
                  </button>
                ))}
              </div>
            </Row>
            <Row name="Background" desc="Paper texture behind your notes.">
              <Seg value={s.canvas} options={CANVASES.map((c) => [c.id, c.label])} onChange={(canvas) => set({ canvas })} />
            </Row>
          </div>
        </section>

        <section class="set-section">
          <h2><Icon name="type" />Typography</h2>
          <div class="group">
            <Row name="Body font" stack>
              <div class="font-grid">
                {Object.entries(BODY_FONTS).map(([id, f]) => (
                  <button key={id} class={`font-card ${s.font === id ? 'on' : ''}`} onClick={() => set({ font: id })}>
                    <span class="aa" style={{ fontFamily: f.stack }}>Ag</span>
                    <span class="fname">{f.label}</span>
                  </button>
                ))}
              </div>
            </Row>
            <Row name="Headings">
              <Seg value={s.headingFont} options={Object.entries(HEADING_FONTS).map(([id, f]) => [id, f.label])} onChange={(headingFont) => set({ headingFont })} />
            </Row>
            <Row name="Code">
              <Seg value={s.codeFont} options={Object.entries(CODE_FONTS).map(([id, f]) => [id, f.label])} onChange={(codeFont) => set({ codeFont })} />
            </Row>
            <Row name="Text size" desc={`${s.size}px`}>
              <div class="slider-row">
                <input type="range" min="14" max="26" step="1" value={s.size} onInput={(e) => set({ size: +e.currentTarget.value })} />
              </div>
            </Row>
            <Row name="Line spacing" desc={s.leading.toFixed(2)}>
              <div class="slider-row">
                <input type="range" min="1.4" max="2" step="0.05" value={s.leading} onInput={(e) => set({ leading: +e.currentTarget.value })} />
              </div>
            </Row>
            <Row name="Line width">
              <Seg value={s.width} options={Object.keys(WIDTHS).map((w) => [w, w[0].toUpperCase() + w.slice(1)])} onChange={(width) => set({ width })} />
            </Row>
            <Row name="Preview" stack>
              <div class="sample" onClick={(e) => e.preventDefault()}><div class="prose" dangerouslySetInnerHTML={{ __html: sampleHtml }} /></div>
            </Row>
          </div>
        </section>

        <section class="set-section">
          <h2><Icon name="book" />Reading</h2>
          <div class="group">
            <Row name="Scale with window" desc="On big or full-screen windows, text and column grow together."><Toggle checked={s.fluid} onChange={(fluid) => set({ fluid })} /></Row>
            <Row name="Table of contents" desc="Section list beside the note on wide windows."><Toggle checked={s.toc} onChange={(toc) => set({ toc })} /></Row>
            <Row name="Reading progress bar"><Toggle checked={s.progress} onChange={(progress) => set({ progress })} /></Row>
            <Row name="Link previews" desc="Hover a [[link]] to peek at the note."><Toggle checked={s.previews} onChange={(previews) => set({ previews })} /></Row>
            <Row name="Justify text" desc="Even edges with hyphenation."><Toggle checked={s.justify} onChange={(justify) => set({ justify })} /></Row>
            <Row name="Animations"><Toggle checked={s.motion} onChange={(motion) => set({ motion })} /></Row>
          </div>
        </section>

        <section class="set-section">
          <h2><Icon name="vault" />Library</h2>
          <div class="group">
            <Row name="Vault" desc={vault ? `${vault.notes.size} notes` : 'Not loaded'}>
              <span class="set-path" title={vault?.root}>{vault?.root?.replace(/^\/Users\/[^/]+/, '~')}</span>
            </Row>
            {isNative && (
              <Row name="Change vault" desc="Any folder of Markdown files works.">
                <div class="btn-row">
                  <button class="btn" onClick={() => post('revealVault')}>Show in Finder</button>
                  <button class="btn primary" onClick={() => post('chooseVault')}>Choose…</button>
                </div>
              </Row>
            )}
          </div>
        </section>

        <section class="set-section">
          <h2><Icon name="keyboard" />Shortcuts</h2>
          <div class="group shortcuts">
            {SHORTCUTS.map(([name, keys]) => (
              <div class="shortcut" key={name}><span>{name}</span><span>{keys.map((k) => <kbd key={k}>{k}</kbd>)}</span></div>
            ))}
          </div>
        </section>

        <section class="set-section">
          <h2><Icon name="info" />About</h2>
          <div class="group">
            <Row name="Quire" desc="A calm reader for your notes." />
            <Row name="Reset appearance" desc="Restore default theme, fonts and sizes.">
              <button class="btn" onClick={() => set(DEFAULTS)}>Reset</button>
            </Row>
          </div>
        </section>
      </div>
    </div>
  );
}
