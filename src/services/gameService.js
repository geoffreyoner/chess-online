const { Chess } = require('chess.js');
const timer = require('./timerService');

function newGame() {
  return {
    status: 'waiting',
    chess: new Chess(),
    history: [],
    result: null,
    lastMove: null,
    drawOffer: null,
    version: 0
  };
}

function startGame(room) {
  const prevVersion = room.game ? room.game.version : 0;
  
  room.game = newGame();
  room.game.status = 'active';
  room.game.version = prevVersion + 1; 
  
  room.clocks.white = room.timeControl.initial * 1000;
  room.clocks.black = room.timeControl.initial * 1000;
  room.clocks.activeSince = null;
  room.clocks.activeColor = null;
  room.rematchVotes = { white: false, black: false };
  timer.startClock(room, 'w');
}

function endGame(room, { winner, reason }) {
  if (room.game.status === 'finished') return false;
  timer.commitElapsed(room);
  room.game.status = 'finished';
  room.game.result = { winner, reason };
  room.game.drawOffer = null;
  room.game.version++;
  return true;
}

function applyMove(room, seat, { from, to, promotion }) {
  if (room.game.status !== 'active') throw new Error('GAME_NOT_ACTIVE');
  const myColor = seat === 'white' ? 'w' : 'b';
  if (room.game.chess.turn() !== myColor) throw new Error('NOT_YOUR_TURN');

  timer.commitElapsed(room);

  let move;
  try {
    move = room.game.chess.move({ from, to, promotion });
  } catch (_) {
    move = null;
  }
  if (!move) {
    timer.startClock(room, myColor);
    throw new Error('ILLEGAL_MOVE');
  }

  timer.applyIncrement(room, myColor);
  room.game.lastMove = { from: move.from, to: move.to, san: move.san, color: move.color };
  room.game.history.push({
    from: move.from,
    to: move.to,
    san: move.san,
    color: move.color,
    piece: move.piece,
    captured: move.captured || null,
    promotion: move.promotion || null,
    fen: room.game.chess.fen()
  });
  room.game.drawOffer = null;
  room.game.version++;

  const chess = room.game.chess;
  if (chess.in_checkmate()) {
    endGame(room, { winner: myColor, reason: 'checkmate' });
  } else if (chess.in_stalemate()) {
    endGame(room, { winner: null, reason: 'stalemate' });
  } else if (chess.insufficient_material()) {
    endGame(room, { winner: null, reason: 'insufficient_material' });
  } else {
    timer.startClock(room, chess.turn());
  }
  return move;
}

function resign(room, seat) {
  if (room.game.status !== 'active') throw new Error('GAME_NOT_ACTIVE');
  const winner = seat === 'white' ? 'b' : 'w';
  endGame(room, { winner, reason: 'resignation' });
}

function offerDraw(room, seat) {
  if (room.game.status !== 'active') throw new Error('GAME_NOT_ACTIVE');
  if (room.game.drawOffer && room.game.drawOffer.by === seat) return;
  room.game.drawOffer = { by: seat };
  room.game.version++;
}

function respondDraw(room, seat, accept) {
  if (!room.game.drawOffer) throw new Error('NO_DRAW_OFFER');
  if (room.game.drawOffer.by === seat) throw new Error('CANNOT_RESPOND_TO_OWN_OFFER');
  if (accept) {
    endGame(room, { winner: null, reason: 'agreement' });
  } else {
    room.game.drawOffer = null;
    room.game.version++;
  }
}

function claimDraw(room, seat) {
  if (room.game.status !== 'active') throw new Error('GAME_NOT_ACTIVE');
  const chess = room.game.chess;
  if (chess.in_threefold_repetition()) {
    endGame(room, { winner: null, reason: 'threefold_repetition' });
    return true;
  }
  const half = parseInt(chess.fen().split(' ')[4], 10);
  if (half >= 100) {
    endGame(room, { winner: null, reason: 'fifty_move_rule' });
    return true;
  }
  return false;
}

function canClaimDraw(room) {
  if (room.game.status !== 'active') return false;
  const chess = room.game.chess;
  if (chess.in_threefold_repetition()) return true;
  const half = parseInt(chess.fen().split(' ')[4], 10);
  return half >= 100;
}

function handleTimeout(room) {
  if (room.game.status !== 'active') return false;
  const color = room.clocks.activeColor;
  if (!color) return false;
  const timedOutSeat = color === 'w' ? 'white' : 'black';
  const opponent = timedOutSeat === 'white' ? 'b' : 'w';
  if (room.game.chess.insufficient_material()) {
    return endGame(room, { winner: null, reason: 'timeout_insufficient_material' });
  }
  return endGame(room, { winner: opponent, reason: 'timeout' });
}

module.exports = {
  newGame, startGame, endGame, applyMove, resign,
  offerDraw, respondDraw, claimDraw, handleTimeout,
  canClaimDraw
};