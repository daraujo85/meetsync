// Ícones SVG (paths do Material Symbols), renderizados via innerHTML dentro do Shadow DOM.
const wrap = (path: string) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="${path}"/></svg>`;

// Ícones de traço (line icons do mockup da aba Alertas) e de preenchimento.
// `style="fill:none"` (inline) vence regras CSS de `fill: currentColor` (que encheriam o traço).
const stroke = (inner: string) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true" style="fill:none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
const solid = (inner: string) => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">${inner}</svg>`;

export const icons = {
  bell: stroke('<path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 01-3.4 0"/>'),
  bellRing: stroke(
    '<path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 01-3.4 0"/><path d="M20.5 5.5c.9 1 1.5 2.3 1.5 3.7M3.5 5.5C2.6 6.5 2 7.8 2 9.2"/>',
  ),
  bellOff: stroke(
    '<path d="M9 8a6 6 0 019-4M18 8c0 7 3 9 3 9H8M4 4l16 16M5.2 9.2C5 13 3 15 3 15h2"/><path d="M13.7 21a2 2 0 01-3.4 0"/>',
  ),
  ear: stroke('<path d="M6 8.5a6 6 0 1112 0c0 3-2 4-3.2 5.2C13.8 14.7 13 15.5 13 17a2.5 2.5 0 01-5 .2M9 9a3 3 0 016 0"/>'),
  quote: solid('<path d="M7 7h4v6H5v-2a4 4 0 012-4zM17 7h-4v6h6v-2a4 4 0 00-2-4z" opacity="0.85"/>'),
  sparkles: solid(
    '<path d="M12 3l1.8 4.9L18.7 9.7l-4.9 1.8L12 16.4l-1.8-4.9L5.3 9.7l4.9-1.8z"/><path d="M18.5 14.5l.7 1.9 1.9.7-1.9.7-.7 1.9-.7-1.9-1.9-.7 1.9-.7z"/>',
  ),
  trash: stroke('<path d="M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2M6 7l1 13a1 1 0 001 1h8a1 1 0 001-1l1-13"/>'),
  plus: stroke('<path d="M12 5v14M5 12h14" stroke-width="2"/>'),
  video: solid('<rect x="3" y="7" width="12" height="10" rx="2.5"/><path d="M15 10.5l5-2.5v8l-5-2.5z"/>'),
  history: stroke('<path d="M3.5 12a8.5 8.5 0 109-8.48A8.5 8.5 0 005 7.5M3.5 4v3.5H7"/><path d="M12 7.5V12l3 1.8"/>'),
  calendar: stroke('<rect x="4" y="5" width="16" height="16" rx="2.5"/><path d="M4 9.5h16M8 3.5v3M16 3.5v3"/>'),
  search: stroke('<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/>'),
  star: stroke('<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 17l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>'),
  starFill: solid('<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 17l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>'),
  people: stroke('<circle cx="9" cy="8" r="3"/><path d="M3.5 19a5.5 5.5 0 0111 0M16 6.2a3 3 0 010 5.6M21 19a5.5 5.5 0 00-4-5.3"/>'),
  cloudUp: stroke('<path d="M7 18a4.5 4.5 0 01-.5-8.97 6 6 0 0111.64-1.2A4.5 4.5 0 0117.5 18"/><path d="M12 21v-8m0 0l-3 3m3-3l3 3"/>'),
  tag: stroke('<path d="M3 11.5V5a2 2 0 012-2h6.5L21 12.5a2 2 0 010 2.8l-5.7 5.7a2 2 0 01-2.8 0L3 11.5z"/><circle cx="7.5" cy="7.5" r="1.3"/>'),
  expand: wrap('M15 18l-6-6 6-6v12z'), // chevron-left (abrir painel à esquerda)
  collapse: wrap('M9 6l6 6-6 6V6z'), // chevron-right (recolher)
  chevronLeft: wrap('M15 18l-6-6 6-6v12z'),
  chevronRight: wrap('M9 6l6 6-6 6V6z'),
  captions: wrap(
    'M19 4H5c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zM11 11H9.5v-.5h-2v3h2V13H11v1c0 .55-.45 1-1 1H7c-.55 0-1-.45-1-1v-4c0-.55.45-1 1-1h3c.55 0 1 .45 1 1v1zm7 0h-1.5v-.5h-2v3h2V13H18v1c0 .55-.45 1-1 1h-3c-.55 0-1-.45-1-1v-4c0-.55.45-1 1-1h3c.55 0 1 .45 1 1v1z',
  ),
  download: wrap('M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z'),
  close: wrap('M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z'),
  info: wrap('M11 7h2v2h-2zm0 4h2v6h-2zm1-9C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z'),
  settings: wrap('M19.14 12.94a7.49 7.49 0 0 0 .05-.94 7.49 7.49 0 0 0-.05-.94l2.03-1.58a.5.5 0 0 0 .12-.61l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7 7 0 0 0-1.62-.94l-.36-2.54a.5.5 0 0 0-.5-.42h-3.84a.5.5 0 0 0-.5.42l-.36 2.54c-.59.24-1.13.56-1.62.94l-2.39-.96a.5.5 0 0 0-.6.22L2.74 8.87a.5.5 0 0 0 .12.61l2.03 1.58c-.03.31-.05.62-.05.94s.02.63.05.94l-2.03 1.58a.5.5 0 0 0-.12.61l1.92 3.32c.13.24.42.32.66.22l2.39-.96c.49.38 1.03.7 1.62.94l.36 2.54c.05.24.25.42.5.42h3.84c.25 0 .45-.18.5-.42l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.24.1.53.02.66-.22l1.92-3.32a.5.5 0 0 0-.12-.61l-2.03-1.58zM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7z'),
  doc: wrap('M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z'),
  lock: wrap('M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM9 6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9V6zm9 14H6V10h12v10zm-6-3a2 2 0 0 0 2-2 2 2 0 1 0-4 0 2 2 0 0 0 2 2z'),
  sync: wrap('M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46A7.93 7.93 0 0 0 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74A7.93 7.93 0 0 0 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z'),
  alert: wrap('M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z'),
  checkCircle: wrap('M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z'),
  clock: wrap('M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z'),
  globe: wrap('M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm6.93 6h-2.95a15.7 15.7 0 0 0-1.38-3.56A8.03 8.03 0 0 1 18.92 8zM12 4.04c.83 1.2 1.48 2.53 1.91 3.96h-3.82c.43-1.43 1.08-2.76 1.91-3.96zM4.26 14a7.9 7.9 0 0 1 0-4h3.38a16.6 16.6 0 0 0 0 4H4.26zm.81 2h2.95c.32 1.25.78 2.45 1.38 3.56A8 8 0 0 1 5.07 16zm2.95-8H5.07a8 8 0 0 1 4.33-3.56A15.7 15.7 0 0 0 8.02 8zM12 19.96c-.83-1.2-1.48-2.53-1.91-3.96h3.82A13.7 13.7 0 0 1 12 19.96zM14.34 14H9.66a14.8 14.8 0 0 1 0-4h4.68a14.8 14.8 0 0 1 0 4zm.26 5.56c.6-1.11 1.06-2.31 1.38-3.56h2.95a8 8 0 0 1-4.33 3.56zM16.36 14a16.6 16.6 0 0 0 0-4h3.38a7.9 7.9 0 0 1 0 4h-3.38z'),
  mail: wrap('M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z'),
  external: wrap('M19 19H5V5h7V3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z'),
  database: wrap('M12 3C7.58 3 4 4.79 4 7s3.58 4 8 4 8-1.79 8-4-3.58-4-8-4zm0 13c-4.42 0-8-1.79-8-4v3c0 2.21 3.58 4 8 4s8-1.79 8-4v-3c0 2.21-3.58 4-8 4zm0-5c-4.42 0-8-1.79-8-4v3c0 2.21 3.58 4 8 4s8-1.79 8-4V7c0 2.21-3.58 4-8 4z'),
  chatBubble: wrap('M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z'),
  // Ícones de provedor (monocromáticos) para diferenciar a reunião no histórico.
  provMeet: stroke('<rect x="3" y="6.5" width="12" height="11" rx="2.5"/><path d="M15 10l5-2.5v9L15 14z"/>'),
  provTeams: stroke('<rect x="3.5" y="3.5" width="17" height="17" rx="4.5"/><path d="M8 8.5h8M12 8.5V16"/>'),
  // Export/import de reunião (backup portátil entre dispositivos).
  exportFile: stroke('<path d="M12 15V4M12 4l-3.5 3.5M12 4l3.5 3.5"/><path d="M4 15v3a2 2 0 002 2h12a2 2 0 002-2v-3"/>'),
  importFile: stroke('<path d="M12 4v11M12 15l-3.5-3.5M12 15l3.5-3.5"/><path d="M4 15v3a2 2 0 002 2h12a2 2 0 002-2v-3"/>'),
  copy: stroke('<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M6 15H5a2 2 0 01-2-2V5a2 2 0 012-2h8a2 2 0 012 2v1"/>'),
};
