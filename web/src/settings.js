// Reader preferences: definitions, persistence, and applying them to the document.
import { post } from './native.js';

export const store = {
  get(key, fallback) {
    try { const v = localStorage.getItem('quire.' + key); return v == null ? fallback : JSON.parse(v); } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem('quire.' + key, JSON.stringify(value)); } catch {}
  },
};

export const MODES = [
  { id: 'system', label: 'System' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
];

// `light`/`dark` are swatch colours for the preview tiles: [bg, sidebar, text, line, accent, grid].
export const THEMES = [
  { id: 'paper', label: 'Paper', light: ['#fbfaf7', '#efe9df', '#1f1d1a', '#d9d2c7', '#c0562f'], dark: ['#1a1918', '#2a2826', '#ece8e1', '#4a4642', '#ec9a6d'] },
  { id: 'graphite', label: 'Graphite', light: ['#fcfcfd', '#ececf0', '#18181b', '#d6d6dc', '#4f46e5'], dark: ['#111113', '#202024', '#ededef', '#3a3a41', '#8f91ff'] },
  { id: 'sepia', label: 'Sepia', light: ['#f5eddf', '#e7dbc4', '#36291c', '#d4c3a6', '#9c4a1f'], dark: ['#1e1913', '#2e261d', '#eadfcd', '#4b4032', '#e3a66b'] },
  { id: 'grid', label: 'Grid', canvas: 'grid', light: ['#f8fafc', '#e8eef6', '#111827', '#cfd6e2', '#2563eb', 'rgba(37,99,235,.14)'], dark: ['#0e1522', '#1a2538', '#e6edf7', '#2d3b52', '#7cb4ff', 'rgba(124,180,255,.14)'] },
];

export const ACCENTS = [
  { id: 'theme', label: 'Theme' },
  { id: 'terracotta', label: 'Terracotta', color: '#c0562f', dark: '#ec9a6d' },
  { id: 'blue', label: 'Blue', color: '#2563eb', dark: '#7aa7ff' },
  { id: 'indigo', label: 'Indigo', color: '#5b4bdb', dark: '#a59bff' },
  { id: 'green', label: 'Green', color: '#15803d', dark: '#6fd39a' },
  { id: 'rose', label: 'Rose', color: '#d6336c', dark: '#ff8db1' },
  { id: 'amber', label: 'Amber', color: '#b45309', dark: '#f5b453' },
];

export const CANVASES = [
  { id: 'auto', label: 'Theme' },
  { id: 'plain', label: 'Plain' },
  { id: 'grid', label: 'Grid' },
  { id: 'dots', label: 'Dots' },
];

// `tune` corrects for each face's proportions: sans faces with a large x-height read bigger and denser than
// serifs at the same pixel size, so they get scaled down a touch and given more letter/word space and leading.
export const BODY_FONTS = {
  newyork: { label: 'New York', stack: 'ui-serif, "New York", Charter, Georgia, serif', tune: { scale: 1, tracking: 0, words: 0.01, leading: 0 } },
  charter: { label: 'Charter', stack: 'Charter, "Bitstream Charter", Georgia, serif', tune: { scale: 0.98, tracking: 0.003, words: 0.01, leading: 0 } },
  iowan: { label: 'Iowan', stack: '"Iowan Old Style", Charter, Georgia, serif', tune: { scale: 0.97, tracking: 0.004, words: 0.01, leading: 0.02 } },
  athelas: { label: 'Athelas', stack: 'Athelas, Charter, Georgia, serif', tune: { scale: 1.04, tracking: 0.004, words: 0.02, leading: 0 } },
  georgia: { label: 'Georgia', stack: 'Georgia, serif', tune: { scale: 0.96, tracking: 0.003, words: 0.01, leading: 0.02 } },
  sfpro: { label: 'SF Pro', stack: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif', tune: { scale: 0.92, tracking: 0.002, words: 0.03, leading: 0.06 } },
  avenir: { label: 'Avenir Next', stack: '"Avenir Next", Avenir, -apple-system, sans-serif', tune: { scale: 0.95, tracking: 0.006, words: 0.03, leading: 0.05 } },
  plex: { label: 'IBM Plex', stack: '"IBM Plex Sans", -apple-system, sans-serif', tune: { scale: 0.92, tracking: 0.008, words: 0.05, leading: 0.08 } },
};

export const HEADING_FONTS = {
  sans: { label: 'SF Pro', stack: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif' },
  body: { label: 'Same as body', stack: 'var(--font-body)' },
  serif: { label: 'New York', stack: 'ui-serif, "New York", Georgia, serif' },
};

export const CODE_FONTS = {
  sfmono: { label: 'SF Mono', stack: 'ui-monospace, "SF Mono", SFMono-Regular, Menlo, monospace' },
  jetbrains: { label: 'JetBrains Mono', stack: '"JetBrains Mono", ui-monospace, Menlo, monospace' },
  fira: { label: 'Fira Code', stack: '"Fira Code", ui-monospace, Menlo, monospace' },
  menlo: { label: 'Menlo', stack: 'Menlo, monospace' },
};

// Column width in ems of the reading size, so the line length in characters stays the same as text scales.
export const WIDTHS = { narrow: 32, normal: 36, wide: 42 };

export const DEFAULTS = {
  mode: 'system', theme: 'paper', accent: 'theme', canvas: 'auto',
  font: 'newyork', headingFont: 'sans', codeFont: 'sfmono',
  size: 19, leading: 1.7, width: 'normal',
  toc: true, progress: true, previews: true, justify: false, motion: true, fluid: true,
};

export function loadSettings() {
  const saved = store.get('settings', {});
  return { ...DEFAULTS, ...saved };
}

const darkQuery = matchMedia('(prefers-color-scheme: dark)');

export function resolvedMode(settings) {
  return settings.mode === 'system' ? (darkQuery.matches ? 'dark' : 'light') : settings.mode;
}

export function onSystemModeChange(fn) {
  darkQuery.addEventListener('change', fn);
  return () => darkQuery.removeEventListener('change', fn);
}

/** Push settings onto <html> as data attributes and CSS variables, and tell the native shell. */
export function applySettings(s) {
  const root = document.documentElement;
  const mode = resolvedMode(s);
  const theme = THEMES.find((t) => t.id === s.theme) || THEMES[0];
  root.dataset.theme = theme.id;
  root.dataset.mode = mode;
  root.dataset.canvas = s.canvas === 'auto' ? theme.canvas || 'plain' : s.canvas;
  root.dataset.justify = s.justify ? 'on' : 'off';
  root.dataset.motion = s.motion ? 'on' : 'off';

  const accent = ACCENTS.find((a) => a.id === s.accent);
  if (accent?.color) root.style.setProperty('--accent', mode === 'dark' ? accent.dark : accent.color);
  else root.style.removeProperty('--accent');

  const body = BODY_FONTS[s.font] || BODY_FONTS.newyork;
  root.style.setProperty('--font-body', body.stack);
  root.style.setProperty('--font-scale', body.tune.scale);
  root.style.setProperty('--tracking', body.tune.tracking + 'em');
  root.style.setProperty('--word-spacing', body.tune.words + 'em');
  root.style.setProperty('--leading-adjust', body.tune.leading);
  root.dataset.fluid = s.fluid ? 'on' : 'off';
  root.style.setProperty('--font-heading', (HEADING_FONTS[s.headingFont] || HEADING_FONTS.sans).stack);
  root.style.setProperty('--font-mono', (CODE_FONTS[s.codeFont] || CODE_FONTS.sfmono).stack);
  root.style.setProperty('--size', s.size + 'px');
  root.style.setProperty('--leading', s.leading);
  root.style.setProperty('--measure', (WIDTHS[s.width] || WIDTHS.normal) + 'em');

  const bg = getComputedStyle(root).getPropertyValue('--bg').trim();
  post('appearance', { mode: s.mode === 'system' ? 'auto' : mode, background: bg });
}
