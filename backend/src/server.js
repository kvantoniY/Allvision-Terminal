import http from 'http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { initDb } from './db/index.js';
import { initSocket } from './realtime/socket.js';

async function main() {
  await initDb();

  const app = createApp();
  const server = http.createServer(app);

  const io = initSocket(server);
  app.set('io', io);

  server.listen(env.PORT, () => {
    console.log(`API listening on :${env.PORT}`);
  });
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
