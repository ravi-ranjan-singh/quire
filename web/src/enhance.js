// DOM post-processing for rendered notes: callouts, figures, tables, find-in-note flash.

const CALLOUTS = {
  note: ['note', 'pencil'], info: ['info', 'info'], todo: ['info', 'check'],
  tip: ['tip', 'flame'], hint: ['tip', 'flame'], important: ['tip', 'flame'],
  abstract: ['abstract', 'clipboard'], summary: ['abstract', 'clipboard'], tldr: ['abstract', 'clipboard'],
  success: ['success', 'check'], check: ['success', 'check'], done: ['success', 'check'],
  question: ['question', 'help'], help: ['question', 'help'], faq: ['question', 'help'],
  warning: ['warning', 'alert'], caution: ['warning', 'alert'], attention: ['warning', 'alert'],
  failure: ['danger', 'x'], fail: ['danger', 'x'], missing: ['danger', 'x'],
  danger: ['danger', 'zap'], error: ['danger', 'zap'], bug: ['danger', 'bug'],
  example: ['example', 'list'], quote: ['quote', 'quote'], cite: ['quote', 'quote'],
};

const ICONS = {
  pencil: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2-1-3-1.1-2.1-.2-4 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.2.4-2.3 1-3.3.3 1.5 1.2 2.8 2.5 2.8Z"/>',
  clipboard: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>',
  help: '<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01"/>',
  alert: '<path d="m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3Z"/><path d="M12 9v4M12 17h.01"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  zap: '<path d="M13 2 3 14h9l-1 8 10-12h-9z"/>',
  bug: '<rect x="8" y="6" width="8" height="14" rx="4"/><path d="m19 7-3 2M5 7l3 2M19 19l-3-2M5 19l3-2M20 13h-4M4 13h4M10 4l1 2M14 4l-1 2"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  quote: '<path d="M3 21c3 0 7-1 7-8V5c0-1.2-.8-2-2-2H4c-1.2 0-2 .8-2 2v6c0 1.1.9 2 2 2h3c0 4-2 6-4 8M15 21c3 0 7-1 7-8V5c0-1.2-.8-2-2-2h-4c-1.2 0-2 .8-2 2v6c0 1.1.9 2 2 2h3c0 4-2 6-4 8"/>',
};

const svg = (name) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`;

function callouts(root) {
  for (const bq of root.querySelectorAll('blockquote')) {
    const p = bq.firstElementChild;
    if (!p || p.tagName !== 'P') continue;
    const m = /^\s*\[!([\w-]+)\]([+-]?)[ \t]*([^\n]*)\n?/.exec(p.innerHTML);
    if (!m) continue;
    const kind = m[1].toLowerCase();
    const [variant, icon] = CALLOUTS[kind] || ['note', 'pencil'];
    const title = m[3].trim() || kind[0].toUpperCase() + kind.slice(1);
    p.innerHTML = p.innerHTML.slice(m[0].length);
    if (!p.innerHTML.trim()) p.remove();

    const box = document.createElement(m[2] ? 'details' : 'div');
    box.className = `callout callout-${variant}`;
    if (m[2] === '+') box.open = true;
    const head = document.createElement(m[2] ? 'summary' : 'div');
    head.className = 'callout-title';
    head.innerHTML = `<span class="callout-icon">${svg(icon)}</span><span>${title}</span>`;
    const body = document.createElement('div');
    body.className = 'callout-body';
    while (bq.firstChild) body.appendChild(bq.firstChild);
    box.append(head, body);
    bq.replaceWith(box);
  }
}

function figures(root) {
  for (const img of root.querySelectorAll('img')) {
    const p = img.parentElement;
    if (p?.tagName === 'P' && [...p.childNodes].every((n) => n === img || n.nodeName === 'IMG' || n.nodeName === 'BR' || (n.nodeType === 3 && !n.textContent.trim()))) {
      p.classList.add('figure');
      const alt = img.getAttribute('alt') || '';
      if (alt && !/\.(png|jpe?g|gif|webp|svg)$/i.test(alt) && !/^(image|screenshot|pasted)/i.test(alt) && p.querySelectorAll('img').length === 1) {
        const cap = document.createElement('span');
        cap.className = 'caption';
        cap.textContent = alt;
        p.appendChild(cap);
      }
    }
    const w = img.getAttribute('width');
    if (w && !img.style.getPropertyValue('--w')) {
      img.style.setProperty('--w', /^\d+$/.test(w) ? w + 'px' : w);
      img.removeAttribute('width');
      img.classList.add('sized');
    }
    img.addEventListener('load', () => img.classList.add('loaded'), { once: true });
    if (img.complete) img.classList.add('loaded');
  }
}

function tables(root) {
  for (const t of root.querySelectorAll('table')) {
    if (t.parentElement.classList.contains('table-wrap')) continue;
    const wrap = document.createElement('div');
    wrap.className = 'table-wrap';
    t.replaceWith(wrap);
    wrap.appendChild(t);
  }
}

export function enhance(root) {
  if (!root) return;
  callouts(root);
  figures(root);
  tables(root);
}

/** Find the first occurrence of `text` in the article, mark it and scroll it into view. */
export function flashText(root, text, scroller) {
  const needle = text.toLowerCase();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    const i = node.textContent.toLowerCase().indexOf(needle);
    if (i < 0) continue;
    const range = document.createRange();
    range.setStart(node, i);
    range.setEnd(node, i + text.length);
    const mark = document.createElement('mark');
    mark.className = 'flash';
    range.surroundContents(mark);
    const top = mark.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
    scroller.scrollTo({ top: Math.max(0, top - scroller.clientHeight / 3), behavior: 'smooth' });
    setTimeout(() => mark.classList.add('fade'), 2200);
    return;
  }
}
