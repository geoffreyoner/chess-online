const test = require('node:test');
const assert = require('node:assert/strict');
const tic = require('../src/games/tictactoe');

function mkRoom() {
  return {
    game: tic.create(),
    timeControl: { initial: 0, increment: 0 },
    clocks: { white: 0, black: 0, activeSince: null, activeColor: null },
    rematchVotes: { white: false, black: false }
  };
}

test('legal tictactoe move', () => {
  const r = mkRoom(); tic.start(r);
  tic.applyMove(r, 'white', { index: 0 });
  assert.equal(r.game.board[0], 'X');
  assert.equal(r.game.turn, 'O');
});

test('illegal tictactoe move', () => {
  const r = mkRoom(); tic.start(r);
  tic.applyMove(r, 'white', { index: 0 });
  assert.throws(() => tic.applyMove(r, 'black', { index: 0 }), /ILLEGAL_MOVE/);
});

test('win detection X', () => {
  const r = mkRoom(); tic.start(r);
  tic.applyMove(r, 'white', { index: 0 });
  tic.applyMove(r, 'black', { index: 3 });
  tic.applyMove(r, 'white', { index: 1 });
  tic.applyMove(r, 'black', { index: 4 });
  tic.applyMove(r, 'white', { index: 2 });
  assert.equal(r.game.status, 'finished');
  assert.equal(r.game.result.winner, 'w');
  assert.equal(r.game.result.reason, 'line');
});

test('draw detection', () => {
  const r = mkRoom(); tic.start(r);
  tic.applyMove(r, 'white', { index: 0 });
  tic.applyMove(r, 'black', { index: 1 });
  tic.applyMove(r, 'white', { index: 2 });
  tic.applyMove(r, 'black', { index: 4 });
  tic.applyMove(r, 'white', { index: 3 });
  tic.applyMove(r, 'black', { index: 5 });
  tic.applyMove(r, 'white', { index: 7 });
  tic.applyMove(r, 'black', { index: 6 });
  tic.applyMove(r, 'white', { index: 8 });
  assert.equal(r.game.status, 'finished');
  assert.equal(r.game.result.winner, null);
  assert.equal(r.game.result.reason, 'draw');
});