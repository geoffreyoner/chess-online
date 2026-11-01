const test = require('node:test');
const assert = require('node:assert/strict');
const validation = require('../src/middleware/validation');

test('validate name', () => {
  assert.equal(validation.validateName('  Bob  '), 'Bob');
  assert.throws(() => validation.validateName(''), (err) => err.code === 'INVALID_NAME');
});

test('validate chess move', () => {
  const m = validation.validateMove({ from: 'e2', to: 'e4', requestId: '1234' });
  assert.equal(m.from, 'e2');
  assert.throws(() => validation.validateMove({ from: 'e2', to: 'e4' }), (err) => err.code === 'INVALID_MOVE');
});

test('validate room code', () => {
  assert.equal(validation.validateRoomCode('abcde'), 'ABCDE');
  assert.throws(() => validation.validateRoomCode('A1'), (err) => err.code === 'INVALID_ROOM_CODE');
});