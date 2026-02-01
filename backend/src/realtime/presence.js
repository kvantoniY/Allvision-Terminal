// Simple in-memory presence tracker.
// NOTE: This is process-local (single Node process). If you run multiple instances,
// move presence to Redis or another shared store.

const online = new Map(); // userId -> { connectedAt: number }

export function setOnline(userId) {
  if (!userId) return;
  online.set(String(userId), { connectedAt: Date.now() });
}

export function setOffline(userId) {
  if (!userId) return;
  online.delete(String(userId));
}

export function isOnline(userId) {
  if (!userId) return false;
  return online.has(String(userId));
}

export function snapshotOnlineIds() {
  return Array.from(online.keys());
}
