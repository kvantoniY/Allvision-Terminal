import { API_BASE_URL } from '@/shared/lib/api/baseUrl';
import { getToken } from '@/shared/lib/auth/authCookie';

let socket = null;

export async function getSocket() {
  if (socket) return socket;

  const { io } = await import('socket.io-client');

  const token = getToken();

  socket = io(API_BASE_URL, {
    transports: ['websocket'],
    withCredentials: true,
    auth: token ? { token } : {},
  });

  return socket;
}

export async function joinUserRoom(userId) {
  if (!userId) return;
  const s = await getSocket();
  s.emit('join', { room: `user:${userId}` });
}

export function closeSocket() {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
}
