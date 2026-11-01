const timer = require('../services/timerService');

function create() {
  return {
    status: 'waiting',
    board: Array(6).fill(null).map(() => Array(7).fill(null)),
    turn: 'R',
    history: [],
    result: null,
    lastMove: null,
    drawOffer: null,
    version: 0
  };
}

function start(room) {
  const prevVersion = room.game ? room.game.version : 0;
  room.game = create();
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

function checkWin(board, row, col, symbol) {
  const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (const [dr, dc] of dirs) {
    let count = 1;
    for (let i = 1; i <= 3; i++) {
      const r = row + dr * i, c = col + dc * i;
      if (r >= 0 && r < 6 && c >= 0 && c < 7 && board[r][c] === symbol) count++;
      else break;
    }
    for (let i = 1; i <= 3; i++) {
      const r = row - dr * i, c = col - dc * i;
      if (r >= 0 && r < 6 && c >= 0 && c < 7 && board[r][c] === symbol) count++;
      else break;
    }
    if (count >= 4) return true;
  }
  return false;
}

function applyMove(room, seat, { column }) {
  if (room.game.status !== 'active') throw new Error('GAME_NOT_ACTIVE');
  const mySymbol = seat === 'white' ? 'R' : 'Y';
  if (room.game.turn !== mySymbol) throw new Error('NOT_YOUR_TURN');
  if (!Number.isInteger(column) || column < 0 || column > 6) throw new Error('ILLEGAL_MOVE');

  let placedRow = -1;
  for (let r = 5; r >= 0; r--) {
    if (!room.game.board[r][column]) {
      room.game.board[r][column] = mySymbol;
      placedRow = r;
      break;
    }
  }
  
  if (placedRow === -1) throw new Error('ILLEGAL_MOVE');

  const myColor = seat === 'white' ? 'w' : 'b';
  timer.commitElapsed(room);
  timer.applyIncrement(room, myColor);

  room.game.lastMove = { row: placedRow, col: column, player: seat, symbol: mySymbol };
  room.game.history.push({ row: placedRow, col: column, player: seat, symbol: mySymbol });
  room.game.turn = mySymbol === 'R' ? 'Y' : 'R';
  room.game.drawOffer = null;
  room.game.version++;

  const isWin = checkWin(room.game.board, placedRow, column, mySymbol);
  const isDraw = room.game.board.every(row => row.every(cell => cell !== null));

  if (isWin) {
    endGame(room, { winner: myColor, reason: 'line' });
  } else if (isDraw) {
    endGame(room, { winner: null, reason: 'draw' });
  } else {
    timer.startClock(room, myColor === 'w' ? 'b' : 'w');
  }
}

function resign(room, seat) {
  if (room.game.status !== 'active') throw new Error('GAME_NOT_ACTIVE');
  endGame(room, { winner: seat === 'white' ? 'b' : 'w', reason: 'resignation' });
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

function claimDraw(room, seat) { return false; }
function canClaimDraw(room) { return false; }

function handleTimeout(room) {
  if (room.game.status !== 'active') return false;
  if (room.timeControl.initial === 0) return false;
  const color = room.clocks.activeColor;
  if (!color) return false;
  const timedOutSeat = color === 'w' ? 'white' : 'black';
  const opponent = timedOutSeat === 'white' ? 'b' : 'w';
  return endGame(room, { winner: opponent, reason: 'timeout' });
}

module.exports = {
  create, start, endGame, applyMove, resign,
  offerDraw, respondDraw, claimDraw, handleTimeout,
  canClaimDraw
};