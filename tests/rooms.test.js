const test = require('node:test');
const assert = require('node:assert/strict');
const roomService = require('../src/services/roomService');

test('create chess room', () => {
  roomService._resetForTests();
  const { room } = roomService.createRoom({
    name: 'A', timeControl: { initial: 600, increment: 0 }, gameType: 'chess', socketId: 's1'
  });
  assert.equal(room.gameType, 'chess');
});

test('create tictactoe room', () => {
  roomService._resetForTests();
  const { room } = roomService.createRoom({
    name: 'A', timeControl: { initial: 600, increment: 0 }, gameType: 'tictactoe', socketId: 's1'
  });
  assert.equal(room.gameType, 'tictactoe');
});

test('join starts game', () => {
  roomService._resetForTests();
  const { room } = roomService.createRoom({
    name: 'A', timeControl: { initial: 600, increment: 0 }, gameType: 'tictactoe', socketId: 's1'
  });
  roomService.joinRoom({ name: 'B', roomCode: room.code, socketId: 's2' });
  assert.equal(room.game.status, 'active');
});