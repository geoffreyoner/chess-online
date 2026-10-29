const test = require('node:test');
const assert = require('node:assert/strict');
const roomService = require('../src/services/roomService');

test('room is created with creator as white', () => {
  roomService._resetForTests();
  const { room, token } = roomService.createRoom({
    name: 'Alice',
    timeControl: { initial: 600, increment: 0 },
    socketId: 'sock-1'
  });
  assert.ok(room.code);
  assert.ok(token.length >= 32);
  assert.equal(room.players.white.name, 'Alice');
  assert.equal(room.players.black, null);
});

test('joining as black starts the game', () => {
  roomService._resetForTests();
  const { room } = roomService.createRoom({
    name: 'Alice', timeControl: { initial: 600, increment: 0 }, socketId: 's1'
  });
  const join = roomService.joinRoom({ name: 'Bob', roomCode: room.code, socketId: 's2' });
  assert.equal(join.seat, 'black');
  assert.ok(join.token);
  assert.equal(room.game.status, 'active');
});

test('third and fourth users become spectators', () => {
  roomService._resetForTests();
  const { room } = roomService.createRoom({ name: 'A', timeControl: { initial: 600, increment: 0 }, socketId: 's1' });
  roomService.joinRoom({ name: 'B', roomCode: room.code, socketId: 's2' });
  const s3 = roomService.joinRoom({ name: 'C', roomCode: room.code, socketId: 's3' });
  const s4 = roomService.joinRoom({ name: 'D', roomCode: room.code, socketId: 's4' });
  assert.equal(s3.seat, 'spectator');
  assert.equal(s4.seat, 'spectator');
  assert.equal(room.spectators.size, 2);
});

test('fifth participant is rejected', () => {
  roomService._resetForTests();
  const { room } = roomService.createRoom({ name: 'A', timeControl: { initial: 600, increment: 0 }, socketId: 's1' });
  roomService.joinRoom({ name: 'B', roomCode: room.code, socketId: 's2' });
  roomService.joinRoom({ name: 'C', roomCode: room.code, socketId: 's3' });
  roomService.joinRoom({ name: 'D', roomCode: room.code, socketId: 's4' });
  assert.throws(() => roomService.joinRoom({ name: 'E', roomCode: room.code, socketId: 's5' }), /ROOM_FULL/);
});

test('invalid room code is rejected', () => {
  roomService._resetForTests();
  assert.throws(() => roomService.joinRoom({ name: 'X', roomCode: 'ZZZZZ', socketId: 's1' }), /ROOM_NOT_FOUND/);
});

test('reconnect restores seat', () => {
  roomService._resetForTests();
  const { room, token } = roomService.createRoom({ name: 'Alice', timeControl: { initial: 600, increment: 0 }, socketId: 's1' });
  roomService.removeSocket('s1');
  assert.equal(room.players.white.connected, false);
  const { seat } = roomService.reconnect({ token, roomCode: room.code, socketId: 's1b' });
  assert.equal(seat, 'white');
  assert.equal(room.players.white.connected, true);
  assert.equal(room.players.white.socketId, 's1b');
});

test('invalid reconnect token rejected', () => {
  roomService._resetForTests();
  const { room } = roomService.createRoom({ name: 'Alice', timeControl: { initial: 600, increment: 0 }, socketId: 's1' });
  assert.throws(() => roomService.reconnect({ token: 'deadbeef'.repeat(8), roomCode: room.code, socketId: 's2' }), /INVALID_TOKEN/);
});