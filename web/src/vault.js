// In-memory model of the vault: notes, attachments, link graph, tree and search.
import { parseFrontmatter, stripComments, parseLinkTarget } from './markdown.js';

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
export const naturalSort = (a, b) => collator.compare(a, b);

const basename = (p) => p.slice(p.lastIndexOf('/') + 1);
const stripMd = (p) => p.replace(/\.md$/i, '');

/** "01. APIs" → { num: "01", label: "APIs" } */
/** "scopes-and-closures" → "Scopes and closures"; names with spaces are kept as written. */
export function humanize(name) {
  if (/\s/.test(name) || !/[-_]/.test(name)) return name === name.toLowerCase() ? name[0].toUpperCase() + name.slice(1) : name;
  const t = name.replace(/[-_]+/g, ' ').trim();
  return t[0].toUpperCase() + t.slice(1);
}

export function splitNumber(name) {
  const m = /^(\d{1,3})[.)\-_\s]+\s*(.+)$/.exec(name);
  return m ? { num: m[1], label: m[2] } : { num: '', label: name };
}

function stripCode(src) {
  return src.replace(/^```[\s\S]*?^```/gm, '').replace(/`[^`\n]*`/g, '');
}

export function buildVault(payload) {
  const notes = new Map();
  const notesByName = new Map();
  const filesByName = new Map();
  const files = payload.files || [];

  for (const f of files) {
    const key = basename(f).toLowerCase();
    const prev = filesByName.get(key);
    if (!prev || f.length < prev.length) filesByName.set(key, f);
  }

  for (const raw of payload.notes) {
    if (/\.excalidraw\.md$/i.test(raw.path)) continue;
    const { data, body } = parseFrontmatter(raw.content);
    const clean = stripComments(body);
    const name = stripMd(basename(raw.path));
    const folder = raw.path.includes('/') ? raw.path.slice(0, raw.path.lastIndexOf('/')) : '';

    // Use a leading H1 as the display title (and drop it from the body so it isn't shown twice).
    let title = humanize(name);
    let content = clean;
    const h1 = /^\s*#\s+(.+?)\s*#*\s*\n/.exec(clean);
    if (h1) { title = h1[1]; content = clean.slice(h1[0].length); }
    else if (data.title) title = String(data.title);

    const prose = stripCode(content);
    const words = (prose.match(/[\p{L}\p{N}'’-]+/gu) || []).length;
    const headings = [...content.matchAll(/^(#{2,3})\s+(.+?)\s*#*$/gm)].map((m) => ({ level: m[1].length, text: m[2] }));
    const tags = new Set([].concat(data.tags || [], data.tag || []).map((t) => String(t).replace(/^#/, '')));
    for (const m of prose.matchAll(/(?:^|\s)#([\p{L}_][\p{L}\p{N}_/-]*)/gu)) tags.add(m[1]);

    const note = {
      path: raw.path, name, display: humanize(name), title, folder, mtime: raw.mtime, frontmatter: data,
      body: content, words, minutes: Math.max(1, Math.round(words / 220)), headings, tags: [...tags],
      outgoing: [], linkTargets: [...prose.matchAll(/!?\[\[([^\]\n]+)\]\]/g)].map((m) => parseLinkTarget(m[1]).path),
      plain: prose.replace(/<[^>]+>/g, ' ').replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/https?:\/\/\S+/g, '').replace(/!?\[\[([^\]|\n]+)(?:\|([^\]\n]+))?\]\]/g, (_, a, b) => b || a).replace(/[#>*_=`~|-]+/g, ' ').replace(/\s+/g, ' '),
    };
    notes.set(note.path, note);
    const key = name.toLowerCase();
    const prev = notesByName.get(key);
    if (!prev || note.path.length < prev.path.length) notesByName.set(key, note);
  }

  const resolveNote = (target) => {
    if (!target) return null;
    const t = target.replace(/^\.?\//, '');
    return notes.get(t) || notes.get(t + '.md') || notesByName.get(stripMd(basename(t)).toLowerCase()) || null;
  };
  const resolveFile = (target) => {
    if (!target) return null;
    const t = target.replace(/^\.?\//, '');
    return files.includes(t) ? t : filesByName.get(basename(t).toLowerCase()) || null;
  };

  const backlinks = new Map();
  for (const note of notes.values()) {
    const seen = new Set();
    for (const t of note.linkTargets) {
      const target = resolveNote(t);
      if (!target || target === note || seen.has(target.path)) continue;
      seen.add(target.path);
      note.outgoing.push(target.path);
      if (!backlinks.has(target.path)) backlinks.set(target.path, []);
      backlinks.get(target.path).push(note.path);
    }
  }

  const sorted = [...notes.values()].sort((a, b) => naturalSort(a.path, b.path));
  return {
    name: payload.name, root: payload.root, notes, sorted, files,
    resolveNote, resolveFile,
    backlinks: (path) => (backlinks.get(path) || []).map((p) => notes.get(p)),
    tree: buildTree(sorted),
    siblings(note) {
      const list = sorted.filter((n) => n.folder === note.folder);
      const i = list.indexOf(note);
      return { prev: list[i - 1] || null, next: list[i + 1] || null, index: i, total: list.length };
    },
    recent(limit = 8) {
      return [...notes.values()].sort((a, b) => b.mtime - a.mtime).slice(0, limit);
    },
  };
}

function buildTree(sorted) {
  const root = { name: '', path: '', folders: new Map(), notes: [], count: 0 };
  for (const note of sorted) {
    let node = root;
    node.count++;
    if (note.folder) {
      let acc = '';
      for (const part of note.folder.split('/')) {
        acc = acc ? acc + '/' + part : part;
        if (!node.folders.has(part)) node.folders.set(part, { name: part, path: acc, folders: new Map(), notes: [], count: 0 });
        node = node.folders.get(part);
        node.count++;
      }
    }
    node.notes.push(note);
  }
  const finish = (n) => ({ ...n, folders: [...n.folders.values()].sort((a, b) => naturalSort(a.name, b.name)).map(finish) });
  return finish(root);
}

// ---------- search ----------

function fuzzyScore(query, text) {
  const q = query.toLowerCase(), t = text.toLowerCase();
  const idx = t.indexOf(q);
  if (idx >= 0) return 1000 - idx * 2 - (t.length - q.length) * 0.5 + (idx === 0 || /[\s/._-]/.test(t[idx - 1]) ? 200 : 0);
  let score = 0, ti = 0, streak = 0;
  for (const ch of q) {
    if (ch === ' ') continue;
    const found = t.indexOf(ch, ti);
    if (found < 0) return -1;
    streak = found === ti ? streak + 1 : 0;
    score += 10 + streak * 5 - Math.min(found - ti, 10);
    ti = found + 1;
  }
  return score;
}

export function searchTitles(vault, query, limit = 8) {
  if (!query.trim()) return vault.recent(limit).map((note) => ({ note }));
  const out = [];
  for (const note of vault.notes.values()) {
    const s = Math.max(fuzzyScore(query, note.title), fuzzyScore(query, note.name), fuzzyScore(query, note.path) - 50);
    if (s > 0) out.push({ note, score: s });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, limit);
}

export function searchContent(vault, query, limit = 30) {
  const terms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 1);
  if (!terms.length) return [];
  const out = [];
  for (const note of vault.notes.values()) {
    const hay = note.plain.toLowerCase();
    if (!terms.every((t) => hay.includes(t))) continue;
    const first = hay.indexOf(terms[0]);
    let hits = 0;
    for (const t of terms) { let i = -1; while ((i = hay.indexOf(t, i + 1)) >= 0) hits++; }
    const start = Math.max(0, first - 60);
    const snippet = (start ? '…' : '') + note.plain.slice(start, first + 140).trim() + '…';
    out.push({ note, snippet, terms, score: hits + (note.title.toLowerCase().includes(terms[0]) ? 50 : 0) });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, limit);
}
