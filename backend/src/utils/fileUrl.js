function uploadedFilePath(file, folder) {
  if (!file) return null;
  const rawPath = file.path ? String(file.path) : '';
  if (/^https?:\/\//i.test(rawPath)) return rawPath;
  if (file.secure_url && /^https?:\/\//i.test(String(file.secure_url))) return String(file.secure_url);
  if (file.filename) return `${folder}/${file.filename}`;
  if (rawPath) return rawPath.replace(/\\/g, '/');
  return null;
}

function isSameAsset(a, b) {
  if (!a || !b) return false;
  const clean = (value) => String(value || '').split('?')[0].replace(/\\/g, '/').replace(/^\/+/, '');
  const aa = clean(a);
  const bb = clean(b);
  return aa === bb || aa.endsWith(`/${bb}`) || bb.endsWith(`/${aa}`);
}

module.exports = { uploadedFilePath, isSameAsset };
