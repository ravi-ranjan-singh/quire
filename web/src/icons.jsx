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
};

export function Icon({ name, class: cls = '' }) {
  return (
    <svg class={`icon ${cls}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      {PATHS[name]}
    </svg>
  );
}
