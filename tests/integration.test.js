const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const { io: ioClient } = require('socket.io-client');
const setupSocket = require('../src/socket');
const roomService = require('../src/services/roomService');

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server, { cors: { origin: true } });
  setupSocket(io);
  await new Promise(res => server.listen(0, '127.0.0.1', res));
  const port = server.address().port;
  return { server, io, port };
}

function makeClient(port) {
  const socket = ioClient(`http://127.0.0.1:${port}`, {
    transports: ['websocket'],
    forceNew: true
  });
  return new Promise((resolve, reject) => {
    socket.on('connect', () => resolve(socket));
    socket.on('connect_error', reject);
  });
}

function waitFor(socket, event, timeout = 4000) {
  return new Promise((resolve, reject) => {
    const to = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), timeout);
    socket.once(event, (data) => { clearTimeout(to); resolve(data); });
  });
}

test('two clients can join a room and sync a move', async () => {
  roomService._resetForTests();
  const { server, io, port } = await startServer();
  const c1 = await makeClient(port);
  const c2 = await makeClient(port);
  try {
    const create = await new Promise(res => c1.emit('room:create',
      { name: 'Alice', timeControl: { initial: 600, increment: 0 } }, res));
    assert.equal(create.ok, true);
    assert.equal(create.seat, 'white');

    const join = await new Promise(res => c2.emit('room:join',
      { name: 'Bob', roomCode: create.roomCode }, res));
    assert.equal(join.ok, true);
    assert.equal(join.seat, 'black');

    // Wait for both to receive active state
    const stateUpdate1 = waitFor(c1, 'state:update');
    const stateUpdate2 = waitFor(c2, 'state:update');
    const [s1, s2] = await Promise.all([stateUpdate1, stateUpdate2]);
    assert.equal(s1.game.status, 'active');
    assert.equal(s2.game.status, 'active');

    // White makes e2e4
    const waitState2 = waitFor(c2, 'state:update');
    const moveRes = await new Promise(res => c1.emit('game:move',
      { from: 'e2', to: 'e4', requestId: 'req-1' }, res));
    assert.equal(moveRes.ok, true);

    const after = await waitState2;
    assert.equal(after.game.history.length, 1);
    assert.equal(after.game.turn, 'b');
    assert.equal(after.game.history[0].san, 'e4');
  } finally {
    c1.disconnect(); c2.disconnect();
    io.close();
    server.close();
  }
});

test('spectator move is rejected', async () => {
  roomService._resetForTests();
  const { server, io, port } = await startServer();
  const c1 = await makeClient(port);
  const c2 = await makeClient(port);
  const c3 = await makeClient(port);
  try {
    const create = await new Promise(res => c1.emit('room:create',
      { name: 'A', timeControl: { initial: 600, increment: 0 } }, res));
    await new Promise(res => c2.emit('room:join',
      { name: 'B', roomCode: create.roomCode }, res));
    const spec = await new Promise(res => c3.emit('room:join',
      { name: 'C', roomCode: create.roomCode }, res));
    assert.equal(spec.seat, 'spectator');

    const res = await new Promise(r => c3.emit('game:move',
      { from: 'e2', to: 'e4', requestId: 'r1' }, r));
    assert.equal(res.ok, false);
    assert.match(res.error, /Spectator/i);
  } finally {
    c1.disconnect(); c2.disconnect(); c3.disconnect();
    io.close(); server.close();
  }
});