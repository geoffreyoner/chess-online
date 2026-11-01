function create() {
  return {
    status: 'waiting',
    board: Array(9).fill(null),
    turn: 'X',
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
  
  if (room.timeControl.initial > 0) {
    room.clocks.activeColor = 'w';
    room.clocks.activeSince = Date.now();
  }
}

function endGame(room, { winner, reason }) {
  if (room.game.status === 'finished') return false;
  room.game.status = 'finished';
  room.game.result = { winner, reason };
  room.game.version++;
  return true;
}

function applyMove(room, seat, { index }) {
  if (room.game.status !== 'active') throw new Error('GAME_NOT_ACTIVE');
  
  const mySymbol = seat === 'white' ? 'X' : 'O';
  if (room.game.turn !== mySymbol) throw new Error('NOT_YOUR_TURN');
  if (index < 0 || index > 8 || room.game.board[index] !== null) throw new Error('ILLEGAL_MOVE');

  room.game.board[index] = mySymbol;
  room.game.lastMove = { index, player: seat };
  room.game.history.push({ index, player: seat, symbol: mySymbol });
  room.game.turn = mySymbol === 'X' ? 'O' : 'X';
  room.game.version++;

  const winPatterns = [
    [0,1,2], [3,4,5], [6,7,8],
    [0,3,6], [1,4,7], [2,5,8],
    [0,4,8], [2,4,6]
  ];
  
  let winner = null;
  for (const pattern of winPatterns) {
    if (room.game.board[pattern[0]] && 
        room.game.board[pattern[0]] === room.game.board[pattern[1]] && 
        room.game.board[pattern[0]] === room.game.board[pattern[2]]) {
      winner = room.game.board[pattern[0]];
      break;
    }
  }

  if (winner) {
    endGame(room, { winner: winner === 'X' ? 'w' : 'b', reason: 'line' });
  } else if (room.game.board.every(cell => cell !== null)) {
    endGame(room, { winner: null, reason: 'draw' });
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