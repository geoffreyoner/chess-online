const { Game: ChessGame } = require('js-chess-engine');

function getTicTacToeMove(board, botSymbol) {
  let bestScore = -Infinity;
  let bestMove = null;
  const oppSymbol = botSymbol === 'X' ? 'O' : 'X';

  for (let i = 0; i < 9; i++) {
    if (board[i] === null) {
      board[i] = botSymbol;
      let score = minimaxTTT(board, 0, false, botSymbol, oppSymbol);
      board[i] = null;
      if (score > bestScore) {
        bestScore = score;
        bestMove = i;
      }
    }
  }
  return bestMove;
}

function minimaxTTT(board, depth, isMaximizing, bot, opp) {
  const win = checkTTTWin(board);
  if (win === bot) return 10 - depth;
  if (win === opp) return depth - 10;
  if (board.every(c => c !== null)) return 0;

  if (isMaximizing) {
    let best = -Infinity;
    for (let i = 0; i < 9; i++) {
      if (board[i] === null) {
        board[i] = bot;
        best = Math.max(best, minimaxTTT(board, depth + 1, false, bot, opp));
        board[i] = null;
      }
    }
    return best;
  } else {
    let best = Infinity;
    for (let i = 0; i < 9; i++) {
      if (board[i] === null) {
        board[i] = opp;
        best = Math.min(best, minimaxTTT(board, depth + 1, true, bot, opp));
        board[i] = null;
      }
    }
    return best;
  }
}

function checkTTTWin(b) {
  const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  for (let [a, c, d] of lines) {
    if (b[a] && b[a] === b[c] && b[a] === b[d]) return b[a];
  }
  return null;
}

function getConnectFourMove(board, botSymbol) {
  const cols = [3, 2, 4, 1, 5, 0, 6];
  const validMoves = cols.filter(c => board[0][c] === null);
  if (validMoves.length === 0) return null;

  for (let c of validMoves) {
    const row = getLowestRow(board, c);
    board[row][c] = botSymbol;
    if (checkC4Win(board, row, c, botSymbol)) { board[row][c] = null; return c; }
    board[row][c] = null;
  }

  const oppSymbol = botSymbol === 'R' ? 'Y' : 'R';
  for (let c of validMoves) {
    const row = getLowestRow(board, c);
    board[row][c] = oppSymbol;
    if (checkC4Win(board, row, c, oppSymbol)) { board[row][c] = null; return c; }
    board[row][c] = null;
  }

  return validMoves[Math.floor(Math.random() * validMoves.length)];
}

function getLowestRow(board, col) {
  for (let r = 5; r >= 0; r--) if (board[r][col] === null) return r;
  return -1;
}

function checkC4Win(board, row, col, sym) {
  const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (const [dr, dc] of dirs) {
    let count = 1;
    for (let i = 1; i <= 3; i++) {
      const r = row + dr * i, c = col + dc * i;
      if (r >= 0 && r < 6 && c >= 0 && c < 7 && board[r][c] === sym) count++; else break;
    }
    for (let i = 1; i <= 3; i++) {
      const r = row - dr * i, c = col - dc * i;
      if (r >= 0 && r < 6 && c >= 0 && c < 7 && board[r][c] === sym) count++; else break;
    }
    if (count >= 4) return true;
  }
  return false;
}

function makeMove(io, room) {
  if (room.game.status !== 'active' || !room.botSeat) return;
  
  const botColor = room.botSeat === 'white' ? 'w' : 'b';
  const botTurn = room.gameType === 'chess' ? room.game.chess.turn() : 
                  room.gameType === 'tictactoe' ? room.game.turn : 
                  room.game.turn;

  if (botTurn !== botColor) return;

  const engine = require('../games/' + room.gameType);

  setTimeout(() => {
    if (room.game.status !== 'active') return;
    try {
      if (room.gameType === 'chess') {
        const game = new ChessGame(room.game.chess.fen());
        const aiMove = game.aiMove(2);
        const from = Object.keys(aiMove)[0].toLowerCase();
        const to = aiMove[Object.keys(aiMove)[0]].toLowerCase();
        engine.applyMove(room, room.botSeat, { from, to });
      } else if (room.gameType === 'tictactoe') {
        const symbol = room.botSeat === 'white' ? 'X' : 'O';
        const index = getTicTacToeMove(room.game.board, symbol);
        if (index !== null) engine.applyMove(room, room.botSeat, { index });
      } else if (room.gameType === 'connectfour') {
        const symbol = room.botSeat === 'white' ? 'R' : 'Y';
        const column = getConnectFourMove(room.game.board, symbol);
        if (column !== null) engine.applyMove(room, room.botSeat, { column });
      }
      
      require('./roomService').broadcastState(io, room);
    } catch (e) {
      console.error('Bot failed to move:', e);
    }
  }, 1000);
}

module.exports = { makeMove };