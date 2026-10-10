import { render, Fragment } from 'preact';
import { useState, useEffect, useMemo, useRef, useCallback, useLayoutEffect } from 'preact/hooks';
import { buildVault, searchTitles, searchContent, splitNumber } from './vault.js';
import { createRenderer, sliceSection, escapeHtml } from './markdown.js';
import { enhance, flashText } from './enhance.js';
import { isNative, post, fileUrl } from './native.js';
import { store, loadSettings, applySettings, onSystemModeChange, resolvedMode, DEFAULTS, MODES, THEMES } from './settings.js';
import { SettingsPage, ThemeArt } from './settings-page.jsx';
import { Icon } from './icons.jsx';

// Apply saved appearance before the first paint.
applySettings(loadSettings());

const progressStore = {
  all: () => store.get('progress', {}),
  set(path, p) {
    const all = store.get('progress', {});
    const prev = all[path];
    all[path] = { p, max: Math.max(p, prev?.max || 0), t: Date.now() };
    store.set('progress', all);
  },
};

// ---------- routing ----------

function parseRoute() {
  const h = location.hash.slice(1);
  const [path, query = ''] = h.split('?');
  const params = new URLSearchParams(query);
  if (path.startsWith('/n/')) return { view: 'note', path: decodeURIComponent(path.slice(3)), heading: params.get('h') || '', q: params.get('q') || '' };
  if (path.startsWith('/f/')) return { view: 'folder', path: decodeURIComponent(path.slice(3)) };
  if (path === '/settings') return { view: 'settings' };
  return { view: 'home' };
}

let pendingNav = null; // set by in-app navigation; absent for back/forward
function go(hash, intent = 'top') {
  pendingNav = intent;
  if (location.hash === hash) window.dispatchEvent(new HashChangeEvent('hashchange'));
  else location.hash = hash;
}
export const openNote = (path, { heading = '', q = '', resume = false } = {}) => {
  const params = new URLSearchParams();
  if (heading) params.set('h', heading);
  if (q) params.set('q', q);
  const qs = params.toString();
  go('#/n/' + encodeURIComponent(path) + (qs ? '?' + qs : ''), resume ? 'resume' : 'top');
};
const openFolder = (path) => go('#/f/' + encodeURIComponent(path));
const openHome = () => go('#/');
const openSettings = () => go('#/settings');

// ---------- helpers ----------

const fmtDate = (ms) => {
  const d = new Date(ms), now = new Date();
  const days = Math.floor((now - d) / 864e5);
  if (days < 1 && d.getDate() === now.getDate()) return 'Today';
  if (days < 2) return 'Yesterday';
  if (days < 7) return d.toLocaleDateString(undefined, { weekday: 'long' });
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
};
const fmtMinutes = (m) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${m % 60 ? (m % 60) + 'm' : ''}`.trim());

function NoteName({ name }) {
  const { num, label } = splitNumber(name);
  return <>{num && <span class="num">{num}</span>}{label}</>;
}

// ---------- app ----------

function App() {
  const [vault, setVault] = useState(null);
  const [error, setError] = useState(null);
  const [route, setRoute] = useState(parseRoute);
  const [settings, setSettingsState] = useState(loadSettings);
  const [sidebar, setSidebar] = useState(() => store.get('sidebar', true));
  const [palette, setPalette] = useState(null);
  const [quick, setQuick] = useState(false);
  const [lightbox, setLightbox] = useState(null);

  const setSettings = useCallback((patch) => setSettingsState((s) => {
    const next = typeof patch === 'function' ? patch(s) : { ...s, ...patch };
    store.set('settings', next);
    return next;
  }), []);

  const load = useCallback(async () => {
    try {
      const t0 = performance.now();
      const res = await fetch('api/vault', { cache: 'no-store' });
      if (!res.ok) throw new Error(await res.text());
      const payload = await res.json();
      if (payload.error) throw new Error(payload.error);
      const v = buildVault(payload);
      post('log', { message: `vault: ${v.notes.size} notes loaded+indexed in ${Math.round(performance.now() - t0)}ms` });
      setVault(v);
      setError(null);
    } catch (e) {
      setError(String(e.message || e));
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const onHash = () => setRoute(parseRoute());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  // Keep the native glass (which sits under the sidebar) in step with the collapse animation.
  const firstSidebar = useRef(true);
  useEffect(() => {
    store.set('sidebar', sidebar);
    post('sidebar', { open: sidebar, width: 264, animate: !firstSidebar.current });
    firstSidebar.current = false;
  }, [sidebar]);
  useEffect(() => { if (route.view === 'note') store.set('last', route.path); }, [route]);

  // After settling on a page, let WebKit release images/tiles cached from the pages left behind.
  useEffect(() => {
    const t = setTimeout(() => post('trimMemory'), 2500);
    return () => clearTimeout(t);
  }, [route]);

  // Reopen the last note on launch.
  useEffect(() => {
    if (!vault || location.hash) return;
    const last = store.get('last', null);
    if (last && vault.notes.has(last)) openNote(last, { resume: true });
  }, [vault]);

  useLayoutEffect(() => {
    applySettings(settings);
    if (settings.mode !== 'system') return;
    return onSystemModeChange(() => applySettings(settings));
  }, [settings]);

  const command = useCallback((name) => {
    switch (name) {
      case 'quickOpen': setQuick(false); setPalette({ q: '' }); break;
      case 'toggleSidebar': setSidebar((s) => !s); break;
      case 'toggleToc': setSettings((s) => ({ ...s, toc: !s.toc })); break;
      case 'settings': setPalette(null); setQuick((p) => !p); break;
      case 'settingsPage': setQuick(false); setPalette(null); openSettings(); break;
      case 'back': history.back(); break;
      case 'forward': history.forward(); break;
      case 'home': openHome(); break;
      case 'zoomIn': setSettings((s) => ({ ...s, size: Math.min(26, s.size + 1) })); break;
      case 'zoomOut': setSettings((s) => ({ ...s, size: Math.max(14, s.size - 1) })); break;
      case 'zoomReset': setSettings({ size: DEFAULTS.size }); break;
      case 'toggleMode': setSettings((s) => ({ ...s, mode: resolvedMode(s) === 'dark' ? 'light' : 'dark' })); break;
      case 'reload': load(); break;
      default:
        if (name.startsWith('theme:')) setSettings({ theme: name.slice(6) });
        if (name.startsWith('mode:')) setSettings({ mode: name.slice(5) });
    }
  }, [load, setSettings]);

  // Native shell hooks.
  useEffect(() => { window.quire = { command, vaultChanged: load }; }, [command, load]);

  // Keyboard shortcuts (handled here so the menu equivalents don't double-fire).
  useEffect(() => {
    const onKey = (e) => {
      const mod = e.metaKey || e.ctrlKey;
      const typing = /input|textarea/i.test(document.activeElement?.tagName);
      if (e.key === 'Escape') {
        if (lightbox) return setLightbox(null);
        if (palette) return setPalette(null);
        if (quick) return setQuick(false);
      }
      if (!mod) return;
      const k = e.key.toLowerCase();
      if (e.shiftKey && k === 'h') { e.preventDefault(); return command('home'); }
      if (e.shiftKey && k === 'l') { e.preventDefault(); return command('toggleMode'); }
      if (e.shiftKey && k === 'a') { e.preventDefault(); return command('settings'); }
      if (e.ctrlKey && e.metaKey && k === 's') { e.preventDefault(); return command('toggleSidebar'); }
      const map = {
        k: 'quickOpen', p: 'quickOpen', '\\': 'toggleSidebar', '[': 'back', ']': 'forward',
        '=': 'zoomIn', '+': 'zoomIn', '-': 'zoomOut', '0': 'zoomReset', '.': 'toggleToc', ',': 'settingsPage',
      };
      const cmd = e.shiftKey ? null : map[k];
      if (cmd && !(typing && '[]-=+0'.includes(k))) { e.preventDefault(); command(cmd); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [command, lightbox, palette, quick]);

  const note = vault && route.view === 'note' ? vault.notes.get(route.path) || vault.resolveNote(route.path) : null;

  useEffect(() => {
    post('title', { title: note ? note.title : route.view === 'settings' ? 'Settings' : 'Quire' });
  }, [note, route.view]);

  return (
    <div class={`app ${sidebar ? '' : 'no-sidebar'} ${isNative ? 'native' : 'web'} ${settings.progress ? '' : 'no-progress'}`}>
      <Sidebar vault={vault} route={route} note={note} onSearch={() => command('quickOpen')} />
      <section class="pane">
        {!vault && !error && <div class="loading"><div class="spinner" /></div>}
        {error && route.view !== 'settings' && <ErrorView error={error} />}
        {vault && route.view === 'home' && <Home key="home" vault={vault} />}
        {vault && route.view === 'folder' && <FolderView key={'f:' + route.path} vault={vault} path={route.path} />}
        {route.view === 'settings' && <SettingsPage key="settings" settings={settings} setSettings={setSettings} vault={vault} />}
        {vault && route.view === 'note' && (note
          ? <Reader key="reader" vault={vault} note={note} route={route} settings={settings} onLightbox={setLightbox} />
          : <NotFound path={route.path} />)}
        {!isNative && <WebToolbar command={command} />}
      </section>
      {quick && <QuickPanel settings={settings} setSettings={setSettings} onClose={() => setQuick(false)} />}
      {palette && vault && <Palette vault={vault} initial={palette.q} onClose={() => setPalette(null)} />}
      {lightbox && <Lightbox src={lightbox} onClose={() => setLightbox(null)} />}
    </div>
  );
}

function WebToolbar({ command }) {
  return (
    <div class="web-toolbar">
      <button onClick={() => command('toggleSidebar')} title="Toggle sidebar"><Icon name="sidebar" /></button>
      <span class="spacer" />
      <button onClick={() => command('quickOpen')} title="Search"><Icon name="search" /></button>
      <button onClick={() => command('toggleToc')} title="Contents"><Icon name="list" /></button>
      <button onClick={() => command('settings')} title="Appearance"><Icon name="textformat" /></button>
    </div>
  );
}

function ErrorView({ error }) {
  return (
    <div class="empty">
      <h2>Couldn't open the vault</h2>
      <p>{error}</p>
      {isNative && <button class="btn" onClick={() => post('chooseVault')}>Choose a vault folder…</button>}
    </div>
  );
}

function NotFound({ path }) {
  return <div class="empty"><h2>Note not found</h2><p>{path}</p><button class="btn" onClick={openHome}>Go home</button></div>;
}

// ---------- sidebar ----------

function Sidebar({ vault, route, note, onSearch }) {
  const [open, setOpen] = useState(() => new Set(store.get('open', [])));
  const activeFolder = route.view === 'folder' ? route.path : note?.folder;

  // Expand ancestors of whatever is being read.
  useEffect(() => {
    if (!activeFolder) return;
    setOpen((prev) => {
      const next = new Set(prev);
      let acc = '';
      for (const part of activeFolder.split('/')) { acc = acc ? acc + '/' + part : part; next.add(acc); }
      return next.size === prev.size ? prev : next;
    });
  }, [activeFolder]);
  useEffect(() => { store.set('open', [...open]); }, [open]);
  useEffect(() => {
    requestAnimationFrame(() => document.querySelector('.tree .row.active')?.scrollIntoView({ block: 'nearest' }));
  }, [note?.path]);

  const toggle = (path) => setOpen((prev) => { const n = new Set(prev); n.has(path) ? n.delete(path) : n.add(path); return n; });

  const renderFolder = (folder, depth) => (
    <>
      {folder.folders.map((f) => {
        const isOpen = open.has(f.path);
        return (
          <div key={f.path}>
            <div class={`row folder ${route.view === 'folder' && route.path === f.path ? 'active' : ''}`} style={{ '--depth': depth }}
              onClick={() => { if (!isOpen) toggle(f.path); openFolder(f.path); }}>
              <span class={`chev ${isOpen ? 'open' : ''}`} onClick={(e) => { e.stopPropagation(); toggle(f.path); }}><Icon name="chevron" /></span>
              <Icon name={isOpen ? 'folderOpen' : 'folder'} class="row-icon" />
              <span class="label">{f.name}</span>
              <span class="count">{f.count}</span>
            </div>
            {isOpen && renderFolder(f, depth + 1)}
          </div>
        );
      })}
      {folder.notes.map((n) => (
        <div key={n.path} class={`row note ${note?.path === n.path ? 'active' : ''}`} style={{ '--depth': depth }}
          onClick={() => openNote(n.path)} title={n.title}>
          <span class="chev" />
          <span class="label"><NoteName name={n.display} /></span>
        </div>
      ))}
    </>
  );

  return (
    <aside class="sidebar">
      <div class="sidebar-top" />
      <button class="search-pill" onClick={onSearch}>
        <Icon name="search" /><span>Search</span><kbd>⌘K</kbd>
      </button>
      <nav class="sidebar-scroll">
        <div class={`row nav ${route.view === 'home' ? 'active' : ''}`} onClick={openHome} style={{ '--depth': 0 }}>
          <Icon name="home" class="row-icon" /><span class="label">Home</span>
        </div>
        <div class="section-label">Library</div>
        <div class="tree">{vault && renderFolder(vault.tree, 0)}</div>
      </nav>
      <div class="sidebar-foot">
        <button class="foot-btn vault" onClick={() => post('chooseVault')} title={vault?.root}>
          <Icon name="vault" /><span>{vault?.name || 'Quire'}</span>
        </button>
        <button class={`foot-btn ${route.view === 'settings' ? 'active' : ''}`} onClick={openSettings} title="Settings (⌘,)">
          <Icon name="gear" />
        </button>
      </div>
    </aside>
  );
}

// ---------- reader ----------

function Reader({ vault, note, route, settings, onLightbox }) {
  const scrollRef = useRef(null);
  const articleRef = useRef(null);
  const stripRef = useRef(null);
  const barRef = useRef(null);
  const [headings, setHeadings] = useState([]);
  const [active, setActive] = useState(null);
  const [preview, setPreview] = useState(null);
  const sessionScroll = useRef(new Map());
  const frame = useRef(0);
  const headingEls = useRef([]);

  // One renderer + HTML cache per vault snapshot; navigating between notes reuses rendered HTML.
  const md = useMemo(() => {
    const ctx = { depth: 0, current: null, resolveNote: vault.resolveNote, resolveFile: vault.resolveFile, fileUrl };
    const renderer = createRenderer(ctx);
    ctx.renderEmbed = (target, heading) => {
      const saved = ctx.current;
      ctx.depth++; ctx.current = target;
      const html = renderer.render(sliceSection(target.body, heading));
      ctx.depth--; ctx.current = saved;
      return html;
    };
    const cache = new Map();
    const renderNote = (n, body = n.body) => { ctx.current = n; ctx.depth = 0; return renderer.render(body); };
    const cached = (n) => {
      if (!cache.has(n.path)) {
        const t0 = performance.now();
        if (cache.size >= 24) cache.delete(cache.keys().next().value);
        cache.set(n.path, renderNote(n));
        post('log', { message: `render ${n.path}: ${Math.round(performance.now() - t0)}ms` });
      }
      return cache.get(n.path);
    };
    return { renderNote, cached };
  }, [vault]);

  const html = useMemo(() => md.cached(note), [md, note]);

  useLayoutEffect(() => {
    const root = articleRef.current;
    enhance(root);
    const els = [...root.querySelectorAll('h2, h3')].filter((h) => !h.closest('.transclusion, .callout'));
    headingEls.current = els;
    setHeadings(els.map((h) => ({ id: h.id, text: h.textContent, level: +h.tagName[1] })));
  }, [html]);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    const intent = pendingNav; pendingNav = null;
    const saved = progressStore.all()[note.path];
    if (route.heading) {
      const target = articleRef.current.querySelector(`[id="${CSS.escape(route.heading)}"]`);
      el.scrollTop = target ? target.offsetTop - 80 : 0;
    } else if (route.q) {
      el.scrollTop = 0;
      requestAnimationFrame(() => flashText(articleRef.current, route.q, el));
    } else if (intent === 'resume' && saved && saved.p < 0.98) {
      el.scrollTop = saved.p * (el.scrollHeight - el.clientHeight);
    } else if (intent === null && sessionScroll.current.has(location.hash)) {
      el.scrollTop = sessionScroll.current.get(location.hash);
    } else {
      el.scrollTop = 0;
    }
    update();
  }, [note.path, route.heading, route.q, html]);

  // Scroll work runs at most once per frame and touches the DOM directly — no re-render per scroll.
  const lastSave = useRef(0);
  const update = () => {
    frame.current = 0;
    const el = scrollRef.current;
    if (!el) return;
    const max = el.scrollHeight - el.clientHeight;
    const p = max > 0 ? Math.min(1, el.scrollTop / max) : 1;
    if (barRef.current) barRef.current.style.transform = `scaleX(${p})`;
    stripRef.current?.classList.toggle('scrolled', el.scrollTop > 140);
    sessionScroll.current.set(location.hash, el.scrollTop);
    const now = Date.now();
    if (now - lastSave.current > 1000) { lastSave.current = now; progressStore.set(note.path, p); }
    let current = null;
    for (const h of headingEls.current) { if (h.offsetTop - 110 <= el.scrollTop) current = h.id; else break; }
    setActive((prev) => (prev === current ? prev : current));
  };
  const onScroll = () => { if (!frame.current) frame.current = requestAnimationFrame(update); };
  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  const onClick = (e) => {
    const a = e.target.closest('a');
    if (a) {
      if (a.dataset.note) {
        e.preventDefault();
        setPreview(null);
        return openNote(a.dataset.note, { heading: a.dataset.heading });
      }
      const href = a.getAttribute('href') || '';
      if (href.startsWith('#')) {
        e.preventDefault();
        const target = href.length > 1 && articleRef.current.querySelector(`[id="${CSS.escape(decodeURIComponent(href.slice(1)))}"]`);
        if (target) scrollRef.current.scrollTo({ top: target.offsetTop - 80, behavior: 'smooth' });
        return;
      }
      if (a.hasAttribute('data-external') || /^[a-z][a-z0-9+.-]*:/i.test(href)) {
        e.preventDefault();
        return post('openExternal', { url: a.href });
      }
    }
    const copy = e.target.closest('.code-copy');
    if (copy) {
      const text = copy.closest('figure').querySelector('code').innerText;
      if (isNative) post('copy', { text }); else navigator.clipboard?.writeText(text);
      copy.textContent = 'Copied';
      setTimeout(() => (copy.textContent = 'Copy'), 1200);
      return;
    }
    const img = e.target.closest('img');
    if (img && !img.closest('a')) onLightbox(img.dataset.full || img.src);
  };

  // Hover previews for internal links.
  const hoverTimer = useRef(null);
  const onOver = (e) => {
    if (!settings.previews) return;
    const a = e.target.closest('a[data-note]');
    if (!a) return;
    clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => {
      const target = vault.notes.get(a.dataset.note);
      if (!target || target === note) return;
      const r = a.getBoundingClientRect();
      setPreview({ note: target, html: md.renderNote(target, target.body.slice(0, 2500)), x: r.left, y: r.bottom, top: r.top });
    }, 450);
  };
  const onOut = (e) => { if (e.target.closest('a[data-note]')) clearTimeout(hoverTimer.current); };

  const parts = note.folder ? note.folder.split('/') : [];
  const { num, label } = splitNumber(note.display);
  const backlinks = vault.backlinks(note.path);
  const sib = vault.siblings(note);
  const titleIsName = note.title === note.display;
  const showToc = settings.toc && headings.length > 1;

  return (
    <div class="reader-scroll" ref={scrollRef} onScroll={onScroll}>
      <header class="strip" ref={stripRef}>
        <div class="strip-title">{note.title}</div>
        <div class="progress" ref={barRef} />
      </header>
      <div class={`page ${showToc ? 'with-toc' : ''}`}>
        <article class="note" key={note.path}>
          <div class="note-head">
            {parts.length > 0 && (
              <div class="crumbs">
                {parts.map((p, i) => (
                  <Fragment key={i}>
                    <a onClick={() => openFolder(parts.slice(0, i + 1).join('/'))}>{p}</a>
                    {i < parts.length - 1 && <span class="sep">›</span>}
                  </Fragment>
                ))}
              </div>
            )}
            {num && titleIsName && <div class="part">Part {num}</div>}
            <h1 class="title">{titleIsName ? label : note.title}</h1>
            <div class="meta">
              <span class="chip"><Icon name="clock" />{note.minutes} min read</span>
              <span class="chip"><Icon name="text" />{note.words.toLocaleString()} words</span>
              <span class="chip"><Icon name="calendar" />{fmtDate(note.mtime)}</span>
              {isNative && <a class="chip" onClick={() => post('openInObsidian', { path: note.path })}><Icon name="pencil" />Edit in Obsidian</a>}
            </div>
            {note.tags.length > 0 && <div class="tags">{note.tags.map((t) => <span class="tag" key={t}>#{t}</span>)}</div>}
          </div>
          <div class="prose" ref={articleRef} onClick={onClick} onMouseOver={onOver} onMouseOut={onOut}
            dangerouslySetInnerHTML={{ __html: html }} />
          <footer class="note-foot">
            {backlinks.length > 0 && (
              <div class="backlinks">
                <div class="foot-label">Linked from</div>
                {backlinks.map((b) => (
                  <a class="backlink" key={b.path} onClick={() => openNote(b.path)}>
                    <span>{b.title}</span><span class="bl-path">{b.folder || 'Vault'}</span>
                  </a>
                ))}
              </div>
            )}
            {(sib.prev || sib.next) && (
              <div class="pager">
                {sib.prev ? (
                  <a class="pager-card prev" onClick={() => openNote(sib.prev.path)}>
                    <span class="pager-dir"><Icon name="arrowLeft" /> Previous</span>
                    <span class="pager-title">{sib.prev.title}</span>
                  </a>
                ) : <span />}
                {sib.next ? (
                  <a class="pager-card next" onClick={() => openNote(sib.next.path)}>
                    <span class="pager-dir">Next <Icon name="arrowRight" /></span>
                    <span class="pager-title">{sib.next.title}</span>
                  </a>
                ) : <span />}
              </div>
            )}
          </footer>
        </article>
        {showToc && (
          <aside class="toc">
            <div class="toc-label">On this page</div>
            {headings.map((h) => (
              <a key={h.id} class={`toc-item l${h.level} ${active === h.id ? 'active' : ''}`}
                onClick={() => {
                  const el = articleRef.current.querySelector(`[id="${CSS.escape(h.id)}"]`);
                  scrollRef.current.scrollTo({ top: el.offsetTop - 80, behavior: 'smooth' });
                }}>{h.text}</a>
            ))}
          </aside>
        )}
      </div>
      {preview && <Preview preview={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}

function Preview({ preview, onClose }) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ left: preview.x, top: preview.y + 8 });
  useLayoutEffect(() => {
    const el = ref.current, r = el.getBoundingClientRect();
    let top = preview.y + 8;
    if (top + r.height > innerHeight - 16) top = Math.max(16, preview.top - r.height - 8);
    setPos({ left: Math.max(16, Math.min(preview.x, innerWidth - r.width - 16)), top });
    enhance(el.querySelector('.prose'));
  }, [preview]);
  return (
    <div class="preview" ref={ref} style={{ left: pos.left + 'px', top: pos.top + 'px' }} onMouseLeave={onClose}
      onClick={(e) => { e.preventDefault(); onClose(); openNote(preview.note.path); }}>
      <div class="preview-title">{preview.note.title}</div>
      <div class="prose" dangerouslySetInnerHTML={{ __html: preview.html }} />
      <div class="preview-fade" />
    </div>
  );
}

// ---------- home ----------

function greeting() {
  const h = new Date().getHours();
  return h < 5 ? 'Up late' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

function Home({ vault }) {
  const progress = progressStore.all();
  const totalMinutes = vault.sorted.reduce((s, n) => s + n.minutes, 0);
  const reading = Object.entries(progress)
    .filter(([p, v]) => vault.notes.has(p) && v.p > 0.02 && v.p < 0.97)
    .sort((a, b) => b[1].t - a[1].t).slice(0, 5)
    .map(([p, v]) => ({ note: vault.notes.get(p), ...v }));
  const [first, ...rest] = reading;
  const finished = vault.sorted.filter((n) => (progress[n.path]?.max || 0) >= 0.95).length;

  return (
    <div class="reader-scroll">
      <header class="strip" />
      <div class="home">
        <div class="home-hero">
          <div class="kicker">{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</div>
          <h1>{greeting()}.</h1>
          <p class="lede">Your library <em>{vault.name}</em> is ready. Pick up where you left off, or wander somewhere new.</p>
          <div class="stats">
            <div class="stat"><b>{vault.notes.size}</b><span>notes</span></div>
            <div class="stat"><b>{fmtMinutes(totalMinutes)}</b><span>of reading</span></div>
            <div class="stat"><b>{finished}</b><span>finished</span></div>
            <div class="stat"><b>{vault.tree.folders.length}</b><span>collections</span></div>
          </div>
        </div>

        {first && (
          <section>
            <h2 class="home-h"><Icon name="bookmark" />Continue reading</h2>
            <a class="resume" onClick={() => openNote(first.note.path, { resume: true })}>
              <div>
                <div class="resume-path">{first.note.folder.split('/').slice(-1)[0] || vault.name}</div>
                <div class="resume-title">{first.note.title}</div>
                <div class="resume-meta">
                  <span class="bar"><span style={{ width: `${first.p * 100}%` }} /></span>
                  {Math.round(first.p * 100)}% · {Math.max(1, Math.round((1 - first.p) * first.note.minutes))} min left
                </div>
              </div>
              <span class="resume-go"><Icon name="arrowRight" /></span>
            </a>
            {rest.length > 0 && (
              <div class="cards">
                {rest.map(({ note, p }) => (
                  <a class="card" key={note.path} onClick={() => openNote(note.path, { resume: true })}>
                    <span class="card-path">{note.folder.split('/').slice(-1)[0] || vault.name}</span>
                    <span class="card-title">{note.title}</span>
                    <span class="bar"><span style={{ width: `${p * 100}%` }} /></span>
                  </a>
                ))}
              </div>
            )}
          </section>
        )}

        <section>
          <h2 class="home-h"><Icon name="stack" />Collections</h2>
          <div class="collections">
            {vault.tree.folders.map((f) => <Collection key={f.path} folder={f} progress={progress} />)}
          </div>
        </section>

        <section>
          <h2 class="home-h"><Icon name="clock" />Recently updated</h2>
          <div class="list">
            {vault.recent(6).map((n) => (
              <a class="list-row" key={n.path} onClick={() => openNote(n.path)}>
                <span class="lr-title">{n.title}</span>
                <span class="lr-path">{n.folder}</span>
                <span class="lr-date">{fmtDate(n.mtime)}</span>
              </a>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function folderNotes(folder) {
  return [...folder.notes, ...folder.folders.flatMap(folderNotes)];
}

function Collection({ folder, progress }) {
  const all = folderNotes(folder);
  const done = all.filter((n) => (progress[n.path]?.max || 0) >= 0.95).length;
  const minutes = all.reduce((s, n) => s + n.minutes, 0);
  return (
    <div class="collection">
      <div class="col-icon"><Icon name="folder" /></div>
      <div class="col-ring"><Ring value={all.length ? done / all.length : 0} /></div>
      <a class="col-name" onClick={() => openFolder(folder.path)}>{folder.name}</a>
      <div class="col-meta">{all.length} {all.length === 1 ? 'note' : 'notes'} · {fmtMinutes(minutes)}{done > 0 && ` · ${done} read`}</div>
      <div class="col-list">
        {folder.folders.slice(0, 4).map((f) => <a key={f.path} onClick={() => openFolder(f.path)}><Icon name="folder" />{f.name}</a>)}
        {folder.notes.slice(0, Math.max(0, 4 - folder.folders.length)).map((n) => <a key={n.path} onClick={() => openNote(n.path)}><Icon name="doc" />{n.title}</a>)}
      </div>
    </div>
  );
}

function Ring({ value, size = 28 }) {
  const r = size / 2 - 3, c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} class="ring">
      <circle cx={size / 2} cy={size / 2} r={r} class="ring-bg" />
      <circle cx={size / 2} cy={size / 2} r={r} class="ring-fg" stroke-dasharray={c} stroke-dashoffset={c * (1 - value)} />
    </svg>
  );
}

// ---------- folder ----------

function findFolder(tree, path) {
  let node = tree;
  for (const part of path ? path.split('/') : []) {
    node = node.folders.find((f) => f.name === part);
    if (!node) return null;
  }
  return node;
}

function FolderView({ vault, path }) {
  const folder = findFolder(vault.tree, path);
  const progress = progressStore.all();
  if (!folder) return <NotFound path={path} />;
  const all = folderNotes(folder);
  const done = all.filter((n) => (progress[n.path]?.max || 0) >= 0.95).length;
  const parts = path.split('/');
  return (
    <div class="reader-scroll">
      <header class="strip" />
      <div class="folder-page">
        {parts.length > 1 && (
          <div class="crumbs">
            {parts.slice(0, -1).map((p, i) => (
              <Fragment key={i}><a onClick={() => openFolder(parts.slice(0, i + 1).join('/'))}>{p}</a><span class="sep">›</span></Fragment>
            ))}
          </div>
        )}
        <h1 class="title">{folder.name}</h1>
        <div class="meta">
          <span class="chip"><Icon name="doc" />{all.length} notes</span>
          <span class="chip"><Icon name="clock" />{fmtMinutes(all.reduce((s, n) => s + n.minutes, 0))}</span>
          {done > 0 && <span class="chip"><Icon name="check" />{done} of {all.length} read</span>}
        </div>
        {folder.folders.length > 0 && (
          <div class="subfolders">
            {folder.folders.map((f) => (
              <a class="subfolder" key={f.path} onClick={() => openFolder(f.path)}>
                <Icon name="folder" /><span class="sf-name">{f.name}</span><span class="sf-count">{f.count}</span>
              </a>
            ))}
          </div>
        )}
        {folder.notes.length > 0 && (
          <ol class="lessons">
            {folder.notes.map((n, i) => {
              const pr = progress[n.path];
              const { num, label } = splitNumber(n.display);
              const state = (pr?.max || 0) >= 0.95 ? 'done' : pr && pr.p > 0.02 ? 'started' : '';
              return (
                <li key={n.path} class={`lesson ${state}`} onClick={() => openNote(n.path, { resume: state === 'started' })}>
                  <span class="lesson-num">{state === 'done' ? <Icon name="check" /> : num || String(i + 1).padStart(2, '0')}</span>
                  <span class="lesson-body">
                    <span class="lesson-title">{n.title === n.display ? label : n.title}</span>
                    <span class="lesson-snippet">{n.plain.slice(0, 160)}</span>
                  </span>
                  <span class="lesson-meta">{state === 'started' ? `${Math.round(pr.p * 100)}%` : `${n.minutes} min`}</span>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}

// ---------- palette ----------

function highlightTerms(text, terms) {
  let html = escapeHtml(text);
  for (const t of terms) html = html.replace(new RegExp(`(${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'), '<mark>$1</mark>');
  return html;
}

function Palette({ vault, initial, onClose }) {
  const [q, setQ] = useState(initial);
  const [sel, setSel] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  useEffect(() => { inputRef.current.focus(); }, []);

  const results = useMemo(() => {
    const titles = searchTitles(vault, q, q ? 6 : 8).map((r) => ({ kind: 'note', ...r }));
    const content = q.trim().length > 1 ? searchContent(vault, q, 25).map((r) => ({ kind: 'text', ...r })) : [];
    return [...titles, ...content];
  }, [q, vault]);

  useEffect(() => { setSel(0); }, [q]);
  useEffect(() => { listRef.current?.querySelector('.sel')?.scrollIntoView({ block: 'nearest' }); }, [sel]);

  const choose = (r) => {
    onClose();
    if (r.kind === 'text') openNote(r.note.path, { q: r.terms[0] });
    else openNote(r.note.path);
  };

  const onKey = (e) => {
    if (e.key === 'ArrowDown' || (e.ctrlKey && e.key === 'n')) { e.preventDefault(); setSel((s) => Math.min(results.length - 1, s + 1)); }
    else if (e.key === 'ArrowUp' || (e.ctrlKey && e.key === 'p')) { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
    else if (e.key === 'Enter' && results[sel]) { e.preventDefault(); choose(results[sel]); }
  };

  const firstText = results.findIndex((r) => r.kind === 'text');
  return (
    <div class="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div class="palette">
        <div class="palette-input">
          <Icon name="search" />
          <input ref={inputRef} value={q} onInput={(e) => setQ(e.currentTarget.value)} onKeyDown={onKey}
            placeholder="Search notes and their contents…" spellcheck={false} />
          <kbd>esc</kbd>
        </div>
        <div class="palette-list" ref={listRef}>
          {results.length === 0 && <div class="palette-empty">No notes match “{q}”</div>}
          {results.map((r, i) => (
            <Fragment key={r.kind + r.note.path}>
              {i === 0 && r.kind === 'note' && <div class="palette-group">{q ? 'Notes' : 'Recently updated'}</div>}
              {i === firstText && <div class="palette-group">Mentions</div>}
              <div class={`palette-item ${r.kind} ${i === sel ? 'sel' : ''}`} onMouseMove={() => setSel(i)} onClick={() => choose(r)}>
                {r.kind === 'note' ? (
                  <>
                    <Icon name="doc" />
                    <span class="pi-title">{r.note.title}</span>
                    <span class="pi-path">{r.note.folder}</span>
                  </>
                ) : (
                  <div class="pi-text">
                    <div class="pi-title">{r.note.title}<span class="pi-path">{r.note.folder}</span></div>
                    <div class="pi-snippet" dangerouslySetInnerHTML={{ __html: highlightTerms(r.snippet, r.terms) }} />
                  </div>
                )}
              </div>
            </Fragment>
          ))}
        </div>
        <div class="palette-foot"><span><kbd>↑</kbd><kbd>↓</kbd> navigate</span><span><kbd>↵</kbd> open</span></div>
      </div>
    </div>
  );
}

// ---------- quick appearance panel ----------

function QuickPanel({ settings, setSettings, onClose }) {
  useEffect(() => {
    const close = (e) => { if (!e.target.closest('.quick, .web-toolbar')) onClose(); };
    const t = setTimeout(() => window.addEventListener('mousedown', close));
    return () => { clearTimeout(t); window.removeEventListener('mousedown', close); };
  }, []);
  const mode = resolvedMode(settings);
  return (
    <div class="quick">
      <div>
        <div class="quick-label">Appearance</div>
        <div class="seg">
          {MODES.map((m) => <button key={m.id} class={settings.mode === m.id ? 'on' : ''} onClick={() => setSettings({ mode: m.id })}>{m.label}</button>)}
        </div>
      </div>
      <div>
        <div class="quick-label">Theme</div>
        <div class="quick-themes">
          {THEMES.map((t) => (
            <button key={t.id} class={`tile ${settings.theme === t.id ? 'on' : ''}`} onClick={() => setSettings({ theme: t.id, canvas: 'auto' })}>
              <ThemeArt theme={t} mode={mode} />{t.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <div class="quick-label">Text size <span>{settings.size}px</span></div>
        <div class="size-row">
          <button class="size-btn small" onClick={() => setSettings({ size: Math.max(14, settings.size - 1) })}>A</button>
          <input type="range" min="14" max="26" value={settings.size} onInput={(e) => setSettings({ size: +e.currentTarget.value })} />
          <button class="size-btn big" onClick={() => setSettings({ size: Math.min(26, settings.size + 1) })}>A</button>
        </div>
      </div>
      <div class="quick-foot">
        <button class="btn" onClick={() => { onClose(); openSettings(); }}><Icon name="gear" />All settings</button>
      </div>
    </div>
  );
}

function Lightbox({ src, onClose }) {
  return <div class="lightbox" onClick={onClose}><img src={src} /></div>;
}

render(<App />, document.getElementById('root'));
