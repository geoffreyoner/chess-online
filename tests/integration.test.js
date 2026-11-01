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
  return new Promise((resolve, reject) => {
    const socket = ioClient(`http://127.0.0.1:${port}`, {
      transports: ['websocket'],
      forceNew: true
    });
    socket.on('connect', () => resolve(socket));
    socket.on('connect_error', reject);
  });
}

test('integration: chess move sync', async () => {
  roomService._resetForTests();
  const { server, io, port } = await startServer();
  const c1 = await makeClient(port);
  const c2 = await makeClient(port);
  
  try {
    const createRes = await new Promise(res => c1.emit('room:create', 
      { name: 'Alice', timeControl: { initial: 600, increment: 0 }, gameType: 'chess' }, res));
    
    assert.equal(createRes.ok, true);

    const joinRes = await new Promise(res => c2.emit('room:join', 
      { name: 'Bob', roomCode: createRes.roomCode }, res));
    
    assert.equal(joinRes.ok, true);

    // FIX: requestId minimal 4 karakter
    const moveRes = await new Promise(res => c1.emit('game:move', 
      { from: 'e2', to: 'e4', requestId: 'req-1234' }, res));
      
    assert.equal(moveRes.ok, true, JSON.stringify(moveRes));

    const room = roomService._getRoom(createRes.roomCode);
    assert.equal(room.game.chess.turn(), 'b');
    assert.equal(room.game.history[0].san, 'e4');

  } finally {
    c1.disconnect();
    c2.disconnect();
    io.close();
    server.close();
  }
});

test('integration: tictactoe move sync', async () => {
  roomService._resetForTests();
  const { server, io, port } = await startServer();
  const c1 = await makeClient(port);
  const c2 = await makeClient(port);
  
  try {
    const createRes = await new Promise(res => c1.emit('room:create', 
      { name: 'Alice', timeControl: { initial: 0, increment: 0 }, gameType: 'tictactoe' }, res));
    
    assert.equal(createRes.ok, true);

    const joinRes = await new Promise(res => c2.emit('room:join', 
      { name: 'Bob', roomCode: createRes.roomCode }, res));
    
    assert.equal(joinRes.ok, true);

    const moveRes = await new Promise(res => c1.emit('game:move', 
      { index: 0 }, res));
      
    assert.equal(moveRes.ok, true, JSON.stringify(moveRes));

    const room = roomService._getRoom(createRes.roomCode);
    assert.equal(room.game.board[0], 'X');
    assert.equal(room.game.turn, 'O');

  } finally {
    c1.disconnect();
    c2.disconnect();
    io.close();
    server.close();
  }
});