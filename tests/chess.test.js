const test = require('node:test');
const assert = require('node:assert/strict');
const chess = require('../src/games/chess');

function mkRoom() {
  return {
    game: chess.create(),
    timeControl: { initial: 600, increment: 0 },
    clocks: { white: 600000, black: 600000, activeSince: null, activeColor: null },
    rematchVotes: { white: false, black: false }
  };
}

test('legal opening move', () => {
  const r = mkRoom(); chess.start(r);
  chess.applyMove(r, 'white', { from: 'e2', to: 'e4' });
  assert.equal(r.game.chess.turn(), 'b');
});

test('illegal move rejected', () => {
  const r = mkRoom(); chess.start(r);
  assert.throws(() => chess.applyMove(r, 'white', { from: 'e2', to: 'e5' }), /ILLEGAL_MOVE/);
});

test('checkmate ends game', () => {
  const r = mkRoom(); chess.start(r);
  chess.applyMove(r, 'white', { from: 'e2', to: 'e4' });
  chess.applyMove(r, 'black', { from: 'e7', to: 'e5' });
  chess.applyMove(r, 'white', { from: 'f1', to: 'c4' });
  chess.applyMove(r, 'black', { from: 'b8', to: 'c6' });
  chess.applyMove(r, 'white', { from: 'd1', to: 'h5' });
  chess.applyMove(r, 'black', { from: 'g8', to: 'f6' });
  chess.applyMove(r, 'white', { from: 'h5', to: 'f7' });
  assert.equal(r.game.status, 'finished');
  assert.equal(r.game.result.winner, 'w');
});