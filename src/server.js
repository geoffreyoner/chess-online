const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const config = require('./config');
const logger = require('./utils/logger');
const setupSocket = require('./socket');
const roomService = require('./services/roomService');

const app = express();
const server = http.createServer(app);
server.setMaxListeners(20);

const io = new Server(server, {
  cors: { origin: config.origin, methods: ['GET', 'POST'] },
  maxHttpBufferSize: 100_000,
  pingInterval: 25_000,
  pingTimeout: 20_000
});

app.use(express.static(path.join(__dirname, '..', 'public'), { extensions: ['html'] }));
app.get('/health', (_, res) => res.json({ ok: true, ts: Date.now() }));

setupSocket(io);

const cleanupInterval = setInterval(() => roomService.cleanup(), 60_000);
const timeoutInterval = setInterval(() => roomService.checkTimeouts(io), 500);

server.listen(config.port, config.host, () => {
  logger.info(`Chess Online listening on http://${config.host}:${config.port}`);
});

let shuttingDown = false;

function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`Shutting down (${signal})`);
  clearInterval(cleanupInterval);
  clearInterval(timeoutInterval);
  try { io.close(); } catch (_) {}
  server.close(() => process.exit(0));
  setTimeout(() => {
    logger.warn('Forced exit after 3s');
    process.exit(0);
  }, 3000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

module.exports = { app, server, io };