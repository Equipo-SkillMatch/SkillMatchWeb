const API_BASE = (process.env.REACT_APP_API_BASE_URL || 'http://localhost:4000/api').replace(/\/$/, '');

const API_ORIGIN = (() => {
  try {
    return new URL(API_BASE).origin;
  } catch (_error) {
    return API_BASE.replace(/\/api\/?$/, '');
  }
})();

const isBrowserProduction = typeof window !== 'undefined'
  && !['localhost', '127.0.0.1'].includes(window.location.hostname);

const configuredUploads = String(process.env.REACT_APP_UPLOADS_BASE_URL || '').trim();
const configuredUploadsLooksLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(configuredUploads);

// En producción, aunque haya quedado una variable antigua apuntando a localhost,
// usamos automáticamente el mismo host del API. Esto evita imágenes rotas tras deploys.
const UPLOADS_BASE = (
  !configuredUploads || (isBrowserProduction && configuredUploadsLooksLocal)
    ? `${API_ORIGIN}/uploads`
    : configuredUploads
).replace(/\/$/, '');

const AUTH_BASE = `${API_BASE}/auth`;

const buildFileUrl = (value) => {
  if (!value) return '';

  const path = String(value).trim();
  if (!path) return '';
  if (/^(https?:)?\/\//i.test(path)) return path.startsWith('//') ? `https:${path}` : path;
  if (path.startsWith('data:') || path.startsWith('blob:')) return path;

  const cleanPath = path
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .replace(/^backend\/uploads\//i, '')
    .replace(/^frontend\/uploads\//i, '')
    .replace(/^uploads\//i, '');

  return `${UPLOADS_BASE}/${cleanPath}`;
};

export { API_BASE, AUTH_BASE, UPLOADS_BASE, buildFileUrl };
