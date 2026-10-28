import http from 'node:http';
import { buildApp, corsOrigins } from './app';
import { env } from './config/env';
import { pool } from './db/client';
import { logger } from './lib/logger';
import { setIo } from './lib/realtime';
import { sweepSessions } from './modules/sessions/service';
import { attachSocket } from './modules/sessions/socket';

const app = buildApp();
const server = http.createServer(app);
const io = attachSocket(server, corsOrigins());

// Har 5 second: balance khatam hone par session band + purani requests MISSED
let sweeping = false;
const ticker = setInterval(async () => {
  if (sweeping) return;
  sweeping = true;
  try {
    await sweepSessions();
  } catch (err) {
    logger.error({ err }, 'session sweep failed');
  } finally {
    sweeping = false;
  }
}, 5000);

server.listen(env.PORT, () => logger.info(`Bondty API chalu: http://localhost:${env.PORT}/api/v1`));

async function shutdown(sig: string) {
  logger.info(`${sig} mila, server band ho raha hai`);
  clearInterval(ticker);
  setIo(null);
  io.close();
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
