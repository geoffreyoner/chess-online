const test = require('node:test');
const assert = require('node:assert/strict');
const validation = require('../src/middleware/validation');
const rateLimit = require('../src/middleware/rateLimit');

test('malformed move payload rejected', () => {
  assert.throws(() => validation.validateMove(null), /INVALID_PAYLOAD/);
  assert.throws(() => validation.validateMove({}), /INVALID_MOVE/);
  assert.throws(() => validation.validateMove({ from: 'z9', to: 'e4', requestId: 'abcd' }), /INVALID_MOVE/);
  assert.throws(() => validation.validateMove({ from: 'e2', to: 'e4' }), /INVALID_MOVE/);
});

test('oversized name rejected', () => {
  assert.throws(() => validation.validateName('x'.repeat(21)), /INVALID_NAME/);
  assert.throws(() => validation.validateName(''), /INVALID_NAME/);
});

test('oversized room code rejected', () => {
  assert.throws(() => validation.validateRoomCode('TOOLONG'), /INVALID_ROOM_CODE/);
});

test('invalid time control rejected', () => {
  assert.throws(() => validation.validateTimeControl({ initial: 42, increment: 0 }), /INVALID_TIME_CONTROL/);
  assert.throws(() => validation.validateTimeControl({ initial: 600, increment: 9 }), /INVALID_TIME_CONTROL/);
});

test('rate limit enforcement', () => {
  const socket = { data: { rl: {} } };
  for (let i = 0; i < 5; i++) rateLimit.check(socket, 'room:create');
  assert.throws(() => rateLimit.check(socket, 'room:create'), /RATE_LIMITED/);
});

test('promotion payload validation', () => {
  assert.doesNotThrow(() => validation.validateMove({ from: 'a7', to: 'a8', promotion: 'q', requestId: 'abcd1234' }));
  assert.throws(() => validation.validateMove({ from: 'a7', to: 'a8', promotion: 'k', requestId: 'abcd1234' }), /INVALID_MOVE/);
});

test('cross-room token mismatch rejected', () => {
  const roomService = require('../src/services/roomService');
  roomService._resetForTests();
  const a = roomService.createRoom({ name: 'A', timeControl: { initial: 600, increment: 0 }, socketId: 's1' });
  const b = roomService.createRoom({ name: 'B', timeControl: { initial: 600, increment: 0 }, socketId: 's2' });
  // Attempt to use A's token on B's room
  assert.throws(() => roomService.reconnect({ token: a.token, roomCode: b.room.code, socketId: 's3' }), /INVALID_TOKEN/);
});