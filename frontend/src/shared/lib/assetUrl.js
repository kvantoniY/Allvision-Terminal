export function assetUrl(path) {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;

  const base = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

  if (path.startsWith('/')) return `${base}${path}`;
  return `${base}/${path}`;
}

export function defaultAvatarUrl() {
  return assetUrl('/public/default-avatar.png');
}
