const PATHS = {
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  sidebar: <><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M9 4v16" /></>,
  list: <><path d="M9 6h11M9 12h11M9 18h11" /><path d="M4.5 6h.01M4.5 12h.01M4.5 18h.01" /></>,
  textformat: <><path d="M3 18 8 6l5 12M4.6 14h6.8" /><path d="M14.5 12.5c.5-1 1.6-1.5 2.9-1.5 1.8 0 3.1 1 3.1 2.8V18m0-3.2c-.7-.3-1.6-.5-2.6-.5-1.7 0-3 .8-3 2s1 1.9 2.3 1.9c1.4 0 2.6-.7 3.3-1.8" /></>,
  chevron: <path d="m9 6 6 6-6 6" />,
  folder: <path d="M3.5 7.5A2 2 0 0 1 5.5 5.5h3.6l2 2h7.4a2 2 0 0 1 2 2v7.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2Z" />,
  folderOpen: <path d="M3.5 17V7.5a2 2 0 0 1 2-2h3.6l2 2h6.4a2 2 0 0 1 2 2V11M3.5 17l2.3-5.2a2 2 0 0 1 1.8-1.3h12.2a1 1 0 0 1 .9 1.4L18.6 17a2 2 0 0 1-1.8 1.5H5a1.5 1.5 0 0 1-1.5-1.5Z" />,
  home: <><path d="M4 10.5 12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5H15v-5.5H9v5.5H5.5A1.5 1.5 0 0 1 4 19Z" /></>,
  doc: <><path d="M14 3.5H7.5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V8Z" /><path d="M14 3.5V8h4.5M9 12.5h6M9 16h4" /></>,
  vault: <><path d="M4 6.5C4 5.1 7.6 4 12 4s8 1.1 8 2.5S16.4 9 12 9 4 7.9 4 6.5Z" /><path d="M4 6.5v11C4 18.9 7.6 20 12 20s8-1.1 8-2.5v-11M4 12c0 1.4 3.6 2.5 8 2.5s8-1.1 8-2.5" /></>,
  swap: <path d="m8 9 4-4 4 4M16 15l-4 4-4-4" />,
  arrowLeft: <path d="M19 12H5m6-6-6 6 6 6" />,
  arrowRight: <path d="M5 12h14m-6-6 6 6-6 6" />,
  check: <path d="M20 6 9 17l-5-5" />,
  gear: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  text: <path d="M4 6h16M4 12h16M4 18h10" />,
  calendar: <><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>,
  pencil: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></>,
  bookmark: <path d="M6.5 4.5A1.5 1.5 0 0 1 8 3h8a1.5 1.5 0 0 1 1.5 1.5V21l-5.5-3.5L6.5 21Z" />,
  stack: <><path d="m12 3 9 5-9 5-9-5Z" /><path d="m3 13 9 5 9-5" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  type: <><path d="M4 7V5h16v2M9 19h6M12 5v14" /></>,
  book: <><path d="M4 19.5V5a2 2 0 0 1 2-2h13v16H6.5A2.5 2.5 0 0 0 4 21.5v-2Z" /><path d="M8 7h7" /></>,
  keyboard: <><rect x="2.5" y="6" width="19" height="12" rx="2.5" /><path d="M6.5 10h.01M10 10h.01M14 10h.01M17.5 10h.01M8 14h8" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 16v-4M12 8h.01" /></>,
};

export function Icon({ name, class: cls = '' }) {
  return (
    <svg class={`icon ${cls}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      {PATHS[name]}
    </svg>
  );
}
