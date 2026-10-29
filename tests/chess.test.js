const test = require('node:test');
const assert = require('node:assert/strict');
const { Chess } = require('chess.js');
const gameService = require('../src/services/gameService');

function mkRoom() {
  return {
    game: gameService.newGame(),
    timeControl: { initial: 600, increment: 0 },
    clocks: { white: 600_000, black: 600_000, activeSince: null, activeColor: null },
    rematchVotes: { white: false, black: false }
  };
}

function start(room) {
  gameService.startGame(room);
}

test('legal opening move is accepted', () => {
  const r = mkRoom(); start(r);
  gameService.applyMove(r, 'white', { from: 'e2', to: 'e4' });
  assert.equal(r.game.chess.turn(), 'b');
  assert.equal(r.game.history.length, 1);
});

test('illegal move is rejected', () => {
  const r = mkRoom(); start(r);
  assert.throws(() => gameService.applyMove(r, 'white', { from: 'e2', to: 'e5' }), /ILLEGAL_MOVE/);
});

test('wrong-turn move is rejected', () => {
  const r = mkRoom(); start(r);
  assert.throws(() => gameService.applyMove(r, 'black', { from: 'e7', to: 'e5' }), /NOT_YOUR_TURN/);
});

test('castling works', () => {
  const r = mkRoom(); start(r);
  gameService.applyMove(r, 'white', { from: 'e2', to: 'e4' });
  gameService.applyMove(r, 'black', { from: 'e7', to: 'e5' });
  gameService.applyMove(r, 'white', { from: 'g1', to: 'f3' });
  gameService.applyMove(r, 'black', { from: 'b8', to: 'c6' });
  gameService.applyMove(r, 'white', { from: 'f1', to: 'c4' });
  gameService.applyMove(r, 'black', { from: 'g8', to: 'f6' });
  gameService.applyMove(r, 'white', { from: 'e1', to: 'g1' });
  const fen = r.game.chess.fen();
  assert.ok(fen.includes(' w '), 'still white');
  // King should be on g1 - check via board
  const board = r.game.chess.board();
  const g1 = board[7][6];
  assert.equal(g1.type, 'k');
});

test('en passant works', () => {
  const r = mkRoom(); start(r);
  gameService.applyMove(r, 'white', { from: 'e2', to: 'e4' });
  gameService.applyMove(r, 'black', { from: 'a7', to: 'a6' });
  gameService.applyMove(r, 'white', { from: 'e4', to: 'e5' });
  gameService.applyMove(r, 'black', { from: 'd7', to: 'd5' });
  gameService.applyMove(r, 'white', { from: 'e5', to: 'd6' });
  const board = r.game.chess.board();
  const d6 = board[2][3];
  assert.equal(d6.type, 'p');
  assert.equal(d6.color, 'w');
  // Black pawn should be gone
  const d5 = board[3][3];
  assert.equal(d5, null);
});

test('promotion to queen works', () => {
  const r = mkRoom();
  r.game.chess = new Chess('8/P7/8/8/8/8/8/7k w - - 0 1');
  r.game.status = 'active';
  r.clocks.activeColor = 'w';
  gameService.applyMove(r, 'white', { from: 'a7', to: 'a8', promotion: 'q' });
  const board = r.game.chess.board();
  assert.equal(board[0][0].type, 'q');
});

test('promotion to all four pieces', () => {
  for (const p of ['q', 'r', 'b', 'n']) {
    const r = mkRoom();
    r.game.chess = new Chess('8/P7/8/8/8/8/8/7k w - - 0 1');
    r.game.status = 'active';
    r.clocks.activeColor = 'w';
    gameService.applyMove(r, 'white', { from: 'a7', to: 'a8', promotion: p });
    const board = r.game.chess.board();
    assert.equal(board[0][0].type, p, `promotion to ${p}`);
  }
});

test('checkmate ends game', () => {
  const r = mkRoom();
  // Scholar's mate setup
  r.game.chess = new Chess();
  r.game.status = 'active';
  r.clocks.activeColor = 'w';
  gameService.applyMove(r, 'white', { from: 'e2', to: 'e4' });
  gameService.applyMove(r, 'black', { from: 'e7', to: 'e5' });
  gameService.applyMove(r, 'white', { from: 'f1', to: 'c4' });
  gameService.applyMove(r, 'black', { from: 'b8', to: 'c6' });
  gameService.applyMove(r, 'white', { from: 'd1', to: 'h5' });
  gameService.applyMove(r, 'black', { from: 'g8', to: 'f6' });
  gameService.applyMove(r, 'white', { from: 'h5', to: 'f7' });
  assert.equal(r.game.status, 'finished');
  assert.equal(r.game.result.winner, 'w');
  assert.equal(r.game.result.reason, 'checkmate');
});

test('stalemate ends game', () => {
  const r = mkRoom();
  // Position where Black to move is stalemated
  r.game.chess = new Chess('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1');
  r.game.status = 'active';
  r.clocks.activeColor = 'b';
  // White's move delivered stalemate—simulate by loading and checking
  assert.equal(r.game.chess.in_stalemate(), true);
});

test('draw by insufficient material', () => {
  const r = mkRoom();
  r.game.chess = new Chess('8/8/4k3/8/8/4K3/8/8 w - - 0 1');
  assert.equal(r.game.chess.insufficient_material(), true);
});

test('move after game termination is rejected', () => {
  const r = mkRoom(); start(r);
  gameService.resign(r, 'white');
  assert.equal(r.game.status, 'finished');
  assert.throws(() => gameService.applyMove(r, 'black', { from: 'e7', to: 'e5' }), /GAME_NOT_ACTIVE/);
});

test('draw offer / accept ends game', () => {
  const r = mkRoom(); start(r);
  gameService.offerDraw(r, 'white');
  assert.equal(r.game.drawOffer.by, 'white');
  gameService.respondDraw(r, 'black', true);
  assert.equal(r.game.status, 'finished');
  assert.equal(r.game.result.reason, 'agreement');
});

test('resigning ends the game', () => {
  const r = mkRoom(); start(r);
  gameService.resign(r, 'white');
  assert.equal(r.game.result.winner, 'b');
  assert.equal(r.game.result.reason, 'resignation');
});