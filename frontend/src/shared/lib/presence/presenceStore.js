const presence = new Map();
const listeners = new Set();

function emit() {
  for (const l of listeners) {
    try { l(); } catch (_) {}
  }
}

export function setPresence(userId, next) {
  if (!userId) return;
  const id = String(userId);
  const prev = presence.get(id) || {};
  presence.set(id, { ...prev, ...next });
  emit();
}

export function getPresence(userId) {
  if (!userId) return null;
  return presence.get(String(userId)) || null;
}

export function subscribePresence(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
