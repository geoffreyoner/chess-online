import { getSocket } from './socket.js';
import { toast, generateRequestId } from './utils.js';
import { sounds } from './audio.js';

const PIECES = {
  K: '♚', Q: '♛', R: '♜', B: '♝', N: '♞', P: '♟',
  k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟'
};

let boardEl, squaresLayer, piecesLayer;
let currentFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
let orientation = 'white';
let mySeat = 'spectator';
let selectedSquare = null;
let legalTargets = [];
let lastMove = null;
let isCheck = false;
let interactive = false;
let initialized = false;

let pieceElements = {}; 

export function getOrientation() { return orientation; }

export function initBoard() {
  boardEl = document.getElementById('board-chess');
  if (!boardEl) {
    console.error('Elemen #board-chess tidak ditemukan!');
    return;
  }
  
  boardEl.innerHTML = '';
  
  squaresLayer = document.createElement('div');
  squaresLayer.className = 'squares-layer';
  boardEl.appendChild(squaresLayer);
  
  piecesLayer = document.createElement('div');
  piecesLayer.className = 'pieces-layer';
  boardEl.appendChild(piecesLayer);
  
  squaresLayer.addEventListener('click', handleClick);
  
  const btnFlip = document.getElementById('btn-flip');
  if (btnFlip) btnFlip.addEventListener('click', flipBoard);
}

export function setBoardState(snapshot) {
  const newFen = snapshot.game.fen;
  const newSeat = snapshot.mySeat;
  const isNewGame = snapshot.game.history.length === 0;
  
  selectedSquare = null;
  legalTargets = [];

  if (!initialized) {
    if (newSeat === 'black') orientation = 'black';
    initialized = true;
  } else if (mySeat !== newSeat || isNewGame) {
    if (mySeat !== newSeat && newSeat !== 'spectator') {
      orientation = newSeat;
    }
    piecesLayer.innerHTML = '';
    pieceElements = {};
    window.dispatchEvent(new CustomEvent('board:flip'));
  }

  currentFen = newFen;
  mySeat = newSeat;
  lastMove = snapshot.game.lastMove;
  isCheck = snapshot.game.check;
  interactive = snapshot.game.status === 'active';
  
  renderSquares();
  renderPieces();
}

function flipBoard() {
  orientation = orientation === 'white' ? 'black' : 'white';
  renderSquares();
  for (const sq in pieceElements) {
    updatePiecePos(pieceElements[sq], sq, true);
  }
  window.dispatchEvent(new CustomEvent('board:flip'));
}

function parseFen(fen) {
  const position = fen.split(' ')[0];
  const ranks = position.split('/');
  const board = [];
  for (const rank of ranks) {
    const row = [];
    for (const ch of rank) {
      if (/\d/.test(ch)) for (let i = 0; i < +ch; i++) row.push(null);
      else row.push(ch);
    }
    board.push(row);
  }
  return board;
}

function squareToCoord(sq) {
  return { file: sq.charCodeAt(0) - 97, rank: 8 - parseInt(sq[1], 10) };
}
function coordToSquare(file, rank) {
  return String.fromCharCode(97 + file) + (8 - rank);
}
function colorOf(piece) {
  if (!piece) return null;
  return piece === piece.toUpperCase() ? 'w' : 'b';
}

function renderSquares() {
  squaresLayer.innerHTML = '';
  const boardArr = parseFen(currentFen);
  const turn = currentFen.split(' ')[1];
  
  const rankOrder = orientation === 'white' ? [0,1,2,3,4,5,6,7] : [7,6,5,4,3,2,1,0];
  const fileOrder = orientation === 'white' ? [0,1,2,3,4,5,6,7] : [7,6,5,4,3,2,1,0];

  for (const r of rankOrder) {
    for (const f of fileOrder) {
      const square = coordToSquare(f, r);
      const piece = boardArr[r][f];
      const color = colorOf(piece);

      const sq = document.createElement('div');
      sq.className = 'square ' + ((r + f) % 2 === 0 ? 'light' : 'dark');
      sq.dataset.square = square;
      sq.setAttribute('role', 'gridcell');

      if (lastMove && (lastMove.from === square || lastMove.to === square)) sq.classList.add('last-move');
      if (isCheck && piece && piece.toLowerCase() === 'k' && color === turn) sq.classList.add('in-check');
      if (selectedSquare === square) sq.classList.add('selected');
      
      if (legalTargets.includes(square)) {
        sq.classList.add(piece ? 'capture-target' : 'move-target');
      }

      if (r === 7) {
        const fl = document.createElement('span');
        fl.className = 'coord file';
        fl.textContent = String.fromCharCode(97 + f);
        sq.appendChild(fl);
      }
      if (f === 0) {
        const rl = document.createElement('span');
        rl.className = 'coord rank';
        rl.textContent = (8 - r);
        sq.appendChild(rl);
      }

      squaresLayer.appendChild(sq);
    }
  }
}

function renderPieces() {
  const boardArr = parseFen(currentFen);
  const isNewGame = !lastMove || Object.keys(pieceElements).length === 0;
  
  if (!isNewGame && lastMove) {
    const movingEl = pieceElements[lastMove.from];
    
    if (movingEl) {
      const capturedEl = pieceElements[lastMove.to];
      if (capturedEl) {
        fadeOutPiece(capturedEl);
        delete pieceElements[lastMove.to];
      }
      
      const isPawn = movingEl.textContent === PIECES['P'] || movingEl.textContent === PIECES['p'];
      if (isPawn && lastMove.from[0] !== lastMove.to[0] && !capturedEl) {
        const epSquare = lastMove.to[0] + lastMove.from[1];
        if (pieceElements[epSquare]) {
          fadeOutPiece(pieceElements[epSquare]);
          delete pieceElements[epSquare];
        }
      }
      
      const isKing = movingEl.textContent === PIECES['K'] || movingEl.textContent === PIECES['k'];
      if (isKing) {
        const fromFile = lastMove.from.charCodeAt(0);
        const toFile = lastMove.to.charCodeAt(0);
        if (Math.abs(fromFile - toFile) === 2) {
          const isKingside = toFile > fromFile;
          const rFrom = (isKingside ? 'h' : 'a') + lastMove.from[1];
          const rTo = (isKingside ? 'f' : 'd') + lastMove.from[1];
          const rookEl = pieceElements[rFrom];
          if (rookEl) {
            pieceElements[rTo] = rookEl;
            delete pieceElements[rFrom];
            updatePiecePos(rookEl, rTo);
          }
        }
      }
      
      pieceElements[lastMove.to] = movingEl;
      delete pieceElements[lastMove.from];
      updatePiecePos(movingEl, lastMove.to);
    }
  }
  
  const newPieceElements = {};
  
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const sq = coordToSquare(f, r);
      const type = boardArr[r][f];
      
      if (type) {
        const existingEl = pieceElements[sq];
        const isWhite = type === type.toUpperCase();
        const pieceChar = PIECES[type];
        
        if (existingEl) {
          if (existingEl.textContent !== pieceChar) {
            existingEl.textContent = pieceChar;
            existingEl.className = 'piece ' + (isWhite ? 'white' : 'black');
          }
          newPieceElements[sq] = existingEl;
          delete pieceElements[sq];
        } else {
          const el = document.createElement('div');
          el.className = 'piece ' + (isWhite ? 'white' : 'black');
          el.textContent = pieceChar;
          piecesLayer.appendChild(el);
          updatePiecePos(el, sq, true);
          newPieceElements[sq] = el;
        }
      }
    }
  }
  
  for (const sq in pieceElements) {
    fadeOutPiece(pieceElements[sq]);
  }
  
  pieceElements = newPieceElements;
}

function updatePiecePos(el, sq, instant = false) {
  const { file, rank } = squareToCoord(sq);
  let f = file, r = rank;
  if (orientation === 'black') {
    f = 7 - file;
    r = 7 - rank;
  }
  if (instant) el.style.transition = 'none';
  el.style.transform = `translate(${f * 100}%, ${r * 100}%)`;
  if (instant) {
    void el.offsetWidth;
    el.style.transition = 'transform 0.2s ease-out, opacity 0.2s ease-out';
  }
}

function fadeOutPiece(el) {
  el.style.opacity = '0';
  el.style.zIndex = '1';
  setTimeout(() => el.remove(), 200);
}

function handleClick(e) {
  const sq = e.target.closest('.square');
  if (!sq) return;
  const square = sq.dataset.square;
  if (!interactive) return;
  if (mySeat === 'spectator') return;

  if (selectedSquare && legalTargets.includes(square)) {
    const from = selectedSquare;
    const to = square;
    
    selectedSquare = null;
    legalTargets = [];
    renderSquares();

    const board = parseFen(currentFen);
    const { file, rank } = squareToCoord(from);
    const piece = board[rank][file];
    const targetRank = parseInt(to[1], 10);
    const isPawn = piece && piece.toLowerCase() === 'p';
    const isPromotion = isPawn && (
      (piece === 'P' && targetRank === 8) || (piece === 'p' && targetRank === 1)
    );
    
    if (isPromotion) {
      showPromotionDialog(from, to);
      return;
    }
    makeMove(from, to);
    return;
  }

  const board = parseFen(currentFen);
  const { file, rank } = squareToCoord(square);
  const piece = board[rank][file];
  const color = colorOf(piece);
  const turn = currentFen.split(' ')[1];
  const myColor = mySeat === 'white' ? 'w' : mySeat === 'black' ? 'b' : null;

  if (!myColor || !piece || color !== myColor || turn !== myColor) {
    selectedSquare = null;
    legalTargets = [];
    renderSquares();
    return;
  }

  selectedSquare = square;
  legalTargets = [];
  renderSquares();
  sounds.select();

  getSocket().emit('game:legalMoves', { from: square }, (res) => {
    if (res && res.ok && selectedSquare === square) {
      legalTargets = res.moves;
      renderSquares();
    }
  });
}

function showPromotionDialog(from, to) {
  const modal = document.getElementById('modal-promotion');
  const choices = document.getElementById('promotion-choices');
  choices.innerHTML = '';
  const myColor = mySeat === 'white' ? 'w' : 'b';
  for (const p of ['q', 'r', 'b', 'n']) {
    const btn = document.createElement('button');
    btn.className = 'promotion-choice';
    btn.type = 'button';
    btn.textContent = PIECES[myColor === 'w' ? p.toUpperCase() : p];
    btn.addEventListener('click', () => {
      modal.hidden = true;
      makeMove(from, to, p);
    });
    choices.appendChild(btn);
  }
  modal.hidden = false;
}

function makeMove(from, to, promotion) {
  const requestId = generateRequestId();
  getSocket().emit('game:move', { from, to, promotion, requestId }, (res) => {
    if (!res || !res.ok) {
      toast((res && res.error) || 'Move rejected', 'error');
    }
  });
}