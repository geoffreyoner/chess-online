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

test('kingside castling works (short castle)', () => {
  const r = mkRoom();
  chess.start(r);
  
  chess.applyMove(r, 'white', { from: 'e2', to: 'e4' });
  chess.applyMove(r, 'black', { from: 'e7', to: 'e5' });
  chess.applyMove(r, 'white', { from: 'g1', to: 'f3' });
  chess.applyMove(r, 'black', { from: 'b8', to: 'c6' });
  chess.applyMove(r, 'white', { from: 'f1', to: 'c4' });
  chess.applyMove(r, 'black', { from: 'g8', to: 'f6' });
  chess.applyMove(r, 'white', { from: 'e1', to: 'g1' });
  
  const board = r.game.chess.board();
  assert.equal(board[7][6].type, 'k');
  assert.equal(board[7][6].color, 'w');
  assert.equal(board[7][5].type, 'r');
  assert.equal(board[7][5].color, 'w');
});

test('queenside castling works (long castle)', () => {
  const r = mkRoom();
  chess.start(r);
  
  chess.applyMove(r, 'white', { from: 'd2', to: 'd4' });
  chess.applyMove(r, 'black', { from: 'd7', to: 'd5' });
  chess.applyMove(r, 'white', { from: 'b1', to: 'c3' });
  chess.applyMove(r, 'black', { from: 'b8', to: 'c6' });
  chess.applyMove(r, 'white', { from: 'c1', to: 'f4' });
  chess.applyMove(r, 'black', { from: 'c8', to: 'f5' });
  chess.applyMove(r, 'white', { from: 'd1', to: 'd2' });
  chess.applyMove(r, 'black', { from: 'd8', to: 'd7' });
  chess.applyMove(r, 'white', { from: 'e1', to: 'c1' });
  
  const board = r.game.chess.board();
  assert.equal(board[7][2].type, 'k');
  assert.equal(board[7][2].color, 'w');
  assert.equal(board[7][3].type, 'r');
  assert.equal(board[7][3].color, 'w');
});

test('castling blocked by piece is rejected', () => {
  const r = mkRoom();
  chess.start(r);
  
  assert.throws(
    () => chess.applyMove(r, 'white', { from: 'e1', to: 'g1' }),
    /ILLEGAL_MOVE/
  );
});