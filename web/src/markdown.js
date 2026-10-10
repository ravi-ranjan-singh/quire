// Markdown → HTML with Obsidian flavour: wikilinks, embeds, callouts, highlights,
// %%comments%%, tags and frontmatter. Rendering is pure; DOM enhancement lives in enhance.js.
import MarkdownIt from 'markdown-it';
import footnote from 'markdown-it-footnote';
import taskLists from 'markdown-it-task-lists';
import mark from 'markdown-it-mark';
import hljs from './highlight.js';

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg|avif|bmp|heic)$/i;

export function slugify(text) {
  return text
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-');
}

export function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

/** Split leading YAML frontmatter. Only flat keys and simple lists are understood. */
export function parseFrontmatter(src) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(src);
  if (!m) return { data: {}, body: src };
  const data = {};
  let key = null;
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^([\w-]+):\s*(.*)$/.exec(line);
    if (kv) {
      key = kv[1];
      let v = kv[2].trim();
      if (v.startsWith('[') && v.endsWith(']')) {
        data[key] = v.slice(1, -1).split(',').map((s) => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
      } else {
        data[key] = v === '' ? [] : v.replace(/^["']|["']$/g, '');
      }
    } else if (key && /^\s*-\s+/.test(line)) {
      if (!Array.isArray(data[key])) data[key] = [];
      data[key].push(line.replace(/^\s*-\s+/, '').replace(/^["']|["']$/g, ''));
    }
  }
  return { data, body: src.slice(m[0].length) };
}

/** Remove Obsidian %%comments%% while leaving fenced code untouched. */
export function stripComments(src) {
  const parts = src.split(/(^```[\s\S]*?^```)/m);
  return parts.map((p, i) => (i % 2 ? p : p.replace(/%%[\s\S]*?%%/g, ''))).join('');
}

/** Parse the inside of [[...]] into target, heading and display/size. */
export function parseLinkTarget(inner) {
  const pipe = inner.indexOf('|');
  const target = (pipe >= 0 ? inner.slice(0, pipe) : inner).trim();
  const alias = pipe >= 0 ? inner.slice(pipe + 1).trim() : '';
  const hash = target.indexOf('#');
  return {
    path: (hash >= 0 ? target.slice(0, hash) : target).trim(),
    heading: hash >= 0 ? target.slice(hash + 1).replace(/^\^/, '').trim() : '',
    alias,
  };
}

function wikilinkPlugin(md, ctx) {
  md.inline.ruler.before('link', 'wikilink', (state, silent) => {
    const { src, pos } = state;
    const embed = src.charCodeAt(pos) === 0x21; /* ! */
    const start = embed ? pos + 1 : pos;
    if (src.charCodeAt(start) !== 0x5b || src.charCodeAt(start + 1) !== 0x5b) return false;
    const end = src.indexOf(']]', start + 2);
    if (end < 0) return false;
    const inner = src.slice(start + 2, end);
    if (!inner.trim() || inner.includes('\n') || inner.includes('[')) return false;
    if (!silent) {
      const t = state.push('wikilink', '', 0);
      t.meta = { embed, ...parseLinkTarget(inner) };
      t.content = src.slice(pos, end + 2);
    }
    state.pos = end + 2;
    return true;
  });

  md.renderer.rules.wikilink = (tokens, idx) => {
    const { embed, path, heading, alias } = tokens[idx].meta;
    const raw = tokens[idx].content;

    if (embed) {
      if (IMAGE_EXT.test(path)) {
        const file = ctx.resolveFile(path);
        const size = /^(\d+)(?:x(\d+))?$/.exec(alias);
        const style = size ? ` style="--w:${size[1]}px"` : '';
        if (!file) return `<span class="missing-embed">${escapeHtml(path)}</span>`;
        return `<img class="embed${size ? ' sized' : ''}" src="${ctx.fileUrl(file)}" alt="${escapeHtml(size ? path : alias || path)}"${style} loading="lazy">`;
      }
      if (/\.excalidraw$|\.excalidraw\.md$/i.test(path)) {
        return `<span class="embed-card excalidraw">✎ Excalidraw drawing · ${escapeHtml(path.replace(/\.excalidraw(\.md)?$/i, ''))}</span>`;
      }
      if (/\.pdf$/i.test(path)) {
        const file = ctx.resolveFile(path);
        return file ? `<a class="embed-card" href="${ctx.fileUrl(file)}" data-external>📄 ${escapeHtml(path)}</a>` : escapeHtml(raw);
      }
      const note = ctx.resolveNote(path);
      if (note && ctx.depth < 2) {
        return `<div class="transclusion" data-note="${escapeHtml(note.path)}"><div class="transclusion-title">${escapeHtml(note.title)}</div>${ctx.renderEmbed(note, heading)}</div>`;
      }
    }

    const note = path ? ctx.resolveNote(path) : ctx.current;
    const label = escapeHtml(alias || (heading && !path ? heading : path + (heading ? ' › ' + heading : '')));
    if (!note) return `<span class="wikilink-unresolved">${escapeHtml(raw)}</span>`;
    const anchor = heading ? `#${slugify(heading)}` : '';
    return `<a class="wikilink" href="#" data-note="${escapeHtml(note.path)}" data-heading="${escapeHtml(anchor.slice(1))}">${label}</a>`;
  };
}

function tagPlugin(md) {
  md.inline.ruler.push('tag', (state, silent) => {
    const { src, pos } = state;
    if (src.charCodeAt(pos) !== 0x23) return false;
    if (pos > 0 && !/\s/.test(src[pos - 1])) return false;
    const m = /^#([\p{L}_][\p{L}\p{N}_/-]*)/u.exec(src.slice(pos));
    if (!m) return false;
    if (!silent) {
      const t = state.push('tag', '', 0);
      t.content = m[1];
    }
    state.pos += m[0].length;
    return true;
  });
  md.renderer.rules.tag = (tokens, idx) => `<span class="tag">#${escapeHtml(tokens[idx].content)}</span>`;
}

function headingIds(md) {
  md.core.ruler.push('heading_ids', (state) => {
    const seen = new Map();
    const toks = state.tokens;
    for (let i = 0; i < toks.length; i++) {
      if (toks[i].type !== 'heading_open') continue;
      const text = toks[i + 1].children.map((c) => c.content).join('');
      let id = slugify(text) || 'section';
      const n = seen.get(id) || 0;
      seen.set(id, n + 1);
      if (n) id += '-' + n;
      toks[i].attrSet('id', id);
    }
  });
}

function highlight(code, lang) {
  lang = (lang || '').toLowerCase();
  if (lang && hljs.getLanguage(lang)) {
    return { html: hljs.highlight(code, { language: lang, ignoreIllegals: true }).value, lang };
  }
  if (!lang) {
    const auto = hljs.highlightAuto(code, hljs.autoSubset);
    if (auto.relevance >= 6) return { html: auto.value, lang: auto.language, guessed: true };
  }
  return { html: escapeHtml(code), lang: lang || '' };
}

const LANG_LABELS = {
  js: 'JavaScript', javascript: 'JavaScript', ts: 'TypeScript', typescript: 'TypeScript',
  python: 'Python', py: 'Python', bash: 'Shell', sh: 'Shell', shell: 'Shell', zsh: 'Shell',
  go: 'Go', json: 'JSON', sql: 'SQL', java: 'Java', xml: 'HTML', html: 'HTML', css: 'CSS',
  yaml: 'YAML', yml: 'YAML', rust: 'Rust', cpp: 'C++', c: 'C', diff: 'Diff', text: 'Text',
  plaintext: 'Text', markdown: 'Markdown', md: 'Markdown', dockerfile: 'Dockerfile', jsx: 'JSX', tsx: 'TSX',
};

export function createRenderer(ctx) {
  const md = new MarkdownIt({ html: true, linkify: true, typographer: true, breaks: false });
  md.use(footnote).use(taskLists, { enabled: false }).use(mark);
  wikilinkPlugin(md, ctx);
  tagPlugin(md);
  headingIds(md);

  md.renderer.rules.fence = (tokens, idx) => {
    const t = tokens[idx];
    const info = t.info.trim().split(/\s+/)[0];
    const code = t.content.replace(/\n$/, '');
    const { html, lang, guessed } = highlight(code, info);
    const label = LANG_LABELS[lang] || lang;
    return `<figure class="code" data-lang="${escapeHtml(lang)}"${guessed ? ' data-guessed' : ''}>` +
      `<div class="code-bar"><span class="code-lang">${escapeHtml(label || '')}</span>` +
      `<button class="code-copy" type="button" aria-label="Copy code">Copy</button></div>` +
      `<pre><code class="hljs">${html}</code></pre></figure>`;
  };

  const defaultLinkOpen = md.renderer.rules.link_open || ((tokens, idx, opts, env, self) => self.renderToken(tokens, idx, opts));
  md.renderer.rules.link_open = (tokens, idx, opts, env, self) => {
    const href = tokens[idx].attrGet('href') || '';
    if (/^[a-z][a-z0-9+.-]*:/i.test(href)) {
      tokens[idx].attrSet('data-external', '');
    } else if (href && !href.startsWith('#')) {
      const decoded = safeDecode(href.split('#')[0]);
      const note = ctx.resolveNote(decoded);
      if (note) {
        tokens[idx].attrSet('data-note', note.path);
        tokens[idx].attrSet('href', '#');
        tokens[idx].attrJoin('class', 'wikilink');
      }
    }
    return defaultLinkOpen(tokens, idx, opts, env, self);
  };

  md.renderer.rules.image = (tokens, idx) => {
    const t = tokens[idx];
    let src = t.attrGet('src') || '';
    if (!/^[a-z][a-z0-9+.-]*:/i.test(src)) {
      const file = ctx.resolveFile(safeDecode(src));
      if (file) src = ctx.fileUrl(file);
    }
    const alt = t.children.map((c) => c.content).join('');
    const size = /^(.*?)\|\s*(\d+)$/.exec(alt);
    const style = size ? ` style="--w:${size[2]}px"` : '';
    return `<img class="embed${size ? ' sized' : ''}" src="${escapeHtml(src)}" alt="${escapeHtml(size ? size[1] : alt)}"${style} loading="lazy">`;
  };

  return md;
}

function safeDecode(s) {
  try { return decodeURIComponent(s); } catch { return s; }
}

/** Pull out a section of markdown under a given heading (for ![[note#heading]]). */
export function sliceSection(body, heading) {
  if (!heading) return body;
  const lines = body.split('\n');
  const want = slugify(heading);
  let start = -1, level = 0;
  for (let i = 0; i < lines.length; i++) {
    const h = /^(#{1,6})\s+(.*)$/.exec(lines[i]);
    if (!h) continue;
    if (start < 0 && slugify(h[2]) === want) { start = i; level = h[1].length; continue; }
    if (start >= 0 && h[1].length <= level) return lines.slice(start, i).join('\n');
  }
  return start >= 0 ? lines.slice(start).join('\n') : body;
}
