import { io } from 'socket.io-client';

const TOKEN = process.env.TOKEN; // вставь токен через env или прямо строкой

if (!TOKEN) {
  console.log('Set TOKEN env var: TOKEN=... node scripts/socket-test.js');
  process.exit(1);
}

const socket = io('http://localhost:4000', {
  auth: { token: TOKEN }
});

socket.on('connect', () => console.log('connected', socket.id));
socket.on('connect_error', (e) => console.log('connect_error', e.message));

socket.on('message:new', (payload) => console.log('message:new', payload));
socket.on('dialog:update', (payload) => console.log('dialog:update', payload));

socket.on('notification:unread', (p) => console.log('notification:unread', p));
socket.on('notification:new', (p) => console.log('notification:new', p));
