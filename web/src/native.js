// Bridge to the Swift shell. In a plain browser (dev mode) it degrades gracefully.
const handler = window.webkit?.messageHandlers?.quire;
export const isNative = !!handler;

export function post(action, data = {}) {
  if (handler) return handler.postMessage({ action, ...data });
  if (action === 'openExternal') window.open(data.url, '_blank');
  else console.info('[quire native]', action, data);
}

export const fileUrl = (path) => 'vault/' + path.split('/').map(encodeURIComponent).join('/');
