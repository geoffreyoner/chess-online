import { getSocket } from './socket.js';
import { toast, copyText, confirm } from './utils.js';
import { setBoardState, getOrientation, exitReview } from './board.js';
import { renderHistory, exportPgn } from './history.js';
import { startClockTicker, stopClockTicker } from './timer.js';
import { showGame, showLobby } from './lobby.js';
import { sounds } from './audio.js';
import { pieceSvg, PIECE_VALUE } from './pieces.js';
import { setActiveTab, markChatUnread, setChatEnabled, showConnBanner, hideConnBanner } from './ui.js';

let current = null;
let localOrientation = 'white';
let lastStatus = null;
let resultTimer = null;
let resultDismissed = false;
let wasDisconnected = false;

export function initGame() {
  const socket = getSocket();

  socket.on('connect', handleConnect);
  socket.on('disconnect', handleDisconnect);
  socket.on('state:update', onStateUpdate);
  
  socket.on('room:chatMessage', (data) => {
    appendChat(data);
    sounds.chat();
    markChatUnread();
  });

  socket.on('room:sysMessage', (text) => {
    appendSysChat(text);
  });

  socket.on('game:drawOffered', () => {
    document.getElementById('modal-draw').hidden = false;
  });
  
  socket.on('room:closed', () => {
    toast('Room closed', 'info');
    leaveToLobby(false);
  });

  document.getElementById('btn-resign').addEventListener('click', handleResign);
  document.getElementById('btn-offer-draw').addEventListener('click', handleOfferDraw);
  document.getElementById('btn-rematch').addEventListener('click', handleRematch);
  document.getElementById('btn-export-pgn').addEventListener('click', handleExportPgn);
  document.getElementById('btn-claim-draw').addEventListener('click', handleClaimDraw);
  
  document.getElementById('copy-code').addEventListener('click', () => {
    if (current) copyText(current.roomCode);
  });
  document.getElementById('copy-link').addEventListener('click', () => {
    if (current) copyText(`${location.origin}/?room=${current.roomCode}`);
  });
  document.getElementById('leave-room').addEventListener('click', async () => {
    if (!current) return;
    const ok = await confirm('Leave room', 'Are you sure? If a game is active, you will forfeit.');
    if (!ok) return;
    socket.emit('room:leave', {}, () => {});
    leaveToLobby(true);
  });

  document.getElementById('wc-copy').addEventListener('click', () => {
    if (current) copyText(`${location.origin}/?room=${current.roomCode}`);
  });
  document.getElementById('wc-share').addEventListener('click', handleShareInvite);

  document.getElementById('result-close').addEventListener('click', () => {
    resultDismissed = true;
    document.getElementById('modal-result').hidden = true;
  });
  document.getElementById('result-rematch').addEventListener('click', handleRematch);
  document.getElementById('result-pgn').addEventListener('click', handleExportPgn);

  document.getElementById('rematch-accept').addEventListener('click', () => {
    document.getElementById('modal-rematch').hidden = true;
    handleRematch();
  });

  document.getElementById('rematch-decline').addEventListener('click', () => {
    document.getElementById('modal-rematch').hidden = true;
    getSocket().emit('game:declineRematch', {});
  });

  document.querySelectorAll('.quick-chat-grid button').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!current) { toast('Join a room first', 'warning', 1500); return; }
      if (current.players.white?.name === 'Computer' || current.players.black?.name === 'Computer') return;
      const text = btn.dataset.msg;
      if (!text) return;
      getSocket().emit('room:chat', { text }, (res) => {
        if (!res || !res.ok) toast((res && res.error) || 'Message failed', 'error');
      });
    });
  });

  const tttBoard = document.getElementById('board-tictactoe');
  if (tttBoard) tttBoard.addEventListener('click', onTicTacToeClick);

  const c4Board = document.getElementById('board-connectfour');
  if (c4Board) {
    c4Board.addEventListener('click', onConnectFourClick);
    c4Board.addEventListener('mouseover', onConnectFourHover);
    c4Board.addEventListener('mouseleave', clearColumnHighlight);
  }

  window.addEventListener('board:flip', () => {
    if (current) {
      localOrientation = getOrientation();
      updatePlayerBars();
    }
  });
}

function appendChat(data) {
  const box = document.getElementById('chat-messages');
  if (!box) return;
  const div = document.createElement('div');
  div.className = 'chat-msg';
  
  const nameSpan = document.createElement('span');
  nameSpan.className = `chat-name ${data.seat}`;
  nameSpan.textContent = data.name;
  
  const textSpan = document.createElement('span');
  textSpan.textContent = data.text;
  
  div.appendChild(nameSpan);
  div.appendChild(document.createTextNode(': '));
  div.appendChild(textSpan);
  box.appendChild(div);
  
  box.scrollTop = box.scrollHeight;
}

function appendSysChat(text) {
  const box = document.getElementById('chat-messages');
  if (!box) return;
  const div = document.createElement('div');
  div.className = 'chat-sys';
  div.textContent = text;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

function handleConnect() {
  if (wasDisconnected) {
    wasDisconnected = false;
    hideConnBanner('Back online');
  }
  let saved = null;
  try { saved = sessionStorage.getItem('reconnect'); } catch (_) {}
  if (!saved) return;
  try {
    const { roomCode, token } = JSON.parse(saved);
    if (!roomCode || !token) return;
    getSocket().emit('room:reconnect', { roomCode, token }, (res) => {
      if (!res || !res.ok) {
        try { sessionStorage.removeItem('reconnect'); } catch (_) {}
        return;
      }
      showGame();
    });
  } catch (_) {}
}

function handleDisconnect() {
  wasDisconnected = true;
  showConnBanner(current ? 'Connection lost. Reconnecting…' : 'Offline. Reconnecting…');
}

async function handleShareInvite() {
  if (!current) return;
  const url = `${location.origin}/?room=${current.roomCode}`;
  const names = { chess: 'chess', tictactoe: 'Tic-Tac-Toe', connectfour: 'Connect Four' };
  if (navigator.share) {
    try {
      await navigator.share({
        title: 'Games Online',
        text: `Join my ${names[current.gameType] || 'game'} room (code ${current.roomCode})`,
        url
      });
      return;
    } catch (err) {
      if (err && err.name === 'AbortError') return;
    }
  }
  copyText(url);
}

function onStateUpdate(snapshot) {
  if (current && snapshot.version < current.version) return;
  
  if (current) {
    if (current.mySeat !== snapshot.mySeat && snapshot.mySeat !== 'spectator') {
      let label = snapshot.mySeat === 'white' ? 'White' : 'Black';
      if (snapshot.gameType === 'tictactoe') label = snapshot.mySeat === 'white' ? 'X' : 'O';
      if (snapshot.gameType === 'connectfour') label = snapshot.mySeat === 'white' ? 'Red' : 'Yellow';
      toast(`Sides swapped! You are now ${label}`, 'info', 4000);
    }

    const prevLength = current.game.history.length;
    const newLength = snapshot.game.history.length;
    
    if (newLength > prevLength) {
      const lastMv = snapshot.game.history[newLength - 1];
      if (snapshot.game.status === 'finished') {
         sounds.end();
      } else if (snapshot.gameType !== 'chess') {
         sounds.select();
      } else if (snapshot.game.check) {
         sounds.check();
      } else if (lastMv && lastMv.captured) {
         sounds.capture();
      } else {
         sounds.move();
      }
    }
  }

  current = snapshot;
  localOrientation = getOrientation();
  showGame();
  renderAll();
  
  const chessBoard = document.getElementById('board-chess');
  const tttBoard = document.getElementById('board-tictactoe');
  const c4Board = document.getElementById('board-connectfour');
  const btnFlip = document.getElementById('btn-flip');

  if (chessBoard) chessBoard.style.display = 'none';
  if (tttBoard) tttBoard.style.display = 'none';
  if (c4Board) c4Board.style.display = 'none';

  if (snapshot.gameType === 'tictactoe') {
    if (tttBoard) tttBoard.style.display = 'grid';
    if (btnFlip) btnFlip.style.display = 'none';
    renderTicTacToe(snapshot);
  } else if (snapshot.gameType === 'connectfour') {
    if (c4Board) c4Board.style.display = 'grid';
    if (btnFlip) btnFlip.style.display = 'none';
    renderConnectFour(snapshot);
  } else {
    if (chessBoard) chessBoard.style.display = 'grid';
    if (btnFlip) btnFlip.style.display = 'block';
    setBoardState(snapshot);
  }

  updateWaitingCard(snapshot);
}

function updateWaitingCard(snapshot) {
  const card = document.getElementById('waiting-card');
  if (!card) return;
  const waiting = snapshot.game.status === 'waiting' && snapshot.mySeat !== 'spectator';
  card.hidden = !waiting;
  if (!waiting) return;
  document.getElementById('wc-code').textContent = snapshot.roomCode;
  const visible = ['board-chess', 'board-tictactoe', 'board-connectfour']
    .map(id => document.getElementById(id))
    .find(el => el && el.style.display !== 'none');
  if (visible) {
    const r = visible.getBoundingClientRect();
    if (r.width > 0) {
      card.style.width = r.width + 'px';
      card.style.height = r.height + 'px';
    }
  }
}

function renderTicTacToe(snapshot) {
  const container = document.getElementById('board-tictactoe');
  if (!container) return;
  
  if (snapshot.game.status === 'waiting') container.classList.add('waiting');
  else container.classList.remove('waiting');

  container.innerHTML = '';
  const board = snapshot.game.board || Array(9).fill(null);
  const last = snapshot.game.lastMove;

  board.forEach((cell, index) => {
    const div = document.createElement('div');
    div.className = 'ttt-cell';
    div.dataset.index = String(index);
    if (cell === 'X') div.classList.add('x');
    if (cell === 'O') div.classList.add('o');
    if (last && last.index === index) div.classList.add('last-move');
    div.textContent = cell || '';
    container.appendChild(div);
  });
}

function onTicTacToeClick(e) {
  const cellEl = e.target.closest('.ttt-cell');
  if (!cellEl || !current || current.gameType !== 'tictactoe') return;

  const g = current.game;
  if (g.status !== 'active') return;
  if (current.mySeat !== 'white' && current.mySeat !== 'black') return;

  const mySym = current.mySeat === 'white' ? 'X' : 'O';
  if (g.turn !== mySym) {
    toast("It's not your turn", 'warning', 1200);
    return;
  }

  const index = Number(cellEl.dataset.index);
  if (!Number.isInteger(index) || g.board[index] !== null) return;

  getSocket().emit('game:move', { index }, (res) => {
    if (!res || !res.ok) toast((res && res.error) || 'Move rejected', 'error');
  });
}

function renderConnectFour(snapshot) {
  const container = document.getElementById('board-connectfour');
  if (!container) return;

  if (snapshot.game.status === 'waiting') container.classList.add('waiting');
  else container.classList.remove('waiting');

  container.innerHTML = '';
  const board = snapshot.game.board || [];
  const last = snapshot.game.lastMove;

  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 7; c++) {
      const div = document.createElement('div');
      div.className = 'c4-cell';
      div.dataset.col = String(c);
      
      if (board[r] && board[r][c]) {
        const cell = board[r][c];
        if (cell === 'R') div.classList.add('r');
        if (cell === 'Y') div.classList.add('y');
        if (last && last.row === r && last.col === c) {
          div.classList.add('last-move');
          if (snapshot.game.history.length > 0) {
            div.classList.add('animate-drop');
          }
        }
      }
      container.appendChild(div);
    }
  }
}

function onConnectFourClick(e) {
  const cellEl = e.target.closest('.c4-cell');
  if (!cellEl || !current || current.gameType !== 'connectfour') return;

  const g = current.game;
  if (g.status !== 'active') return;
  if (current.mySeat !== 'white' && current.mySeat !== 'black') return;

  const mySym = current.mySeat === 'white' ? 'R' : 'Y';
  if (g.turn !== mySym) {
    toast("It's not your turn", 'warning', 1200);
    return;
  }

  const col = Number(cellEl.dataset.col);
  if (!Number.isInteger(col)) return;

  getSocket().emit('game:move', { column: col }, (res) => {
    if (!res || !res.ok) toast((res && res.error) || 'Move rejected', 'error');
  });
}

function onConnectFourHover(e) {
  const cellEl = e.target.closest('.c4-cell');
  if (!cellEl || !current || current.gameType !== 'connectfour' || current.game.status !== 'active') return;
  
  const col = Number(cellEl.dataset.col);
  if (!Number.isInteger(col)) return;

  document.querySelectorAll('.c4-cell').forEach(c => c.classList.remove('col-hover'));
  document.querySelectorAll(`.c4-cell[data-col="${col}"]`).forEach(c => {
    c.classList.add('col-hover');
  });
}

function clearColumnHighlight() {
  document.querySelectorAll('.c4-cell').forEach(c => c.classList.remove('col-hover'));
}

function renderAll() {
  if (!current) return;
  document.getElementById('room-code').textContent = current.roomCode;
  document.getElementById('invite-link').value = `${location.origin}/?room=${current.roomCode}`;
  updatePlayerBars();
  updateStatus();
  updateControls();
  renderHistory(current);
  startClockTicker(() => current);
  
  const specCount = current.spectators ? current.spectators.length : 0;
  const specEl = document.getElementById('spectator-count');
  if (specEl) {
    specEl.textContent = specCount > 0 ? `(${specCount} watching)` : '';
  }

  handleGameOverTransition();
  handleRematchPrompt();
}

const RESULT_ICONS = {
  win: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/></svg>',
  loss: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21V4M5 4h12l-2 4 2 4H5"/></svg>',
  draw: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 9h14M5 15h14"/></svg>'
};

function handleGameOverTransition() {
  const isFinished = current.game.status === 'finished';
  const modal = document.getElementById('modal-result');

  if (!isFinished) {
    clearTimeout(resultTimer);
    modal.hidden = true;
    resultDismissed = false;
    lastStatus = current.game.status;
    return;
  }

  if (lastStatus !== 'finished') {
    resultDismissed = false;
    clearTimeout(resultTimer);
    resultTimer = setTimeout(() => {
      if (current && current.game.status === 'finished' && !resultDismissed) renderResultModal();
    }, 700);
  } else if (!modal.hidden) {
    renderResultModal();
  }
  lastStatus = current.game.status;
}

function winReasonText(reason, gameType) {
  switch (reason) {
    case 'checkmate': return 'By checkmate';
    case 'resignation': return 'By resignation';
    case 'timeout': return 'On time';
    case 'abandonment': return 'Opponent abandoned the game';
    case 'line': return gameType === 'connectfour' ? 'Four in a row' : 'Three in a row';
    default: return 'Game over';
  }
}

function renderResultModal() {
  const s = current;
  const result = s.game.result;
  const content = document.getElementById('result-content');
  const isPlayer = s.mySeat === 'white' || s.mySeat === 'black';
  const myColor = s.mySeat === 'white' ? 'w' : 'b';

  let kind = 'draw';
  let title = 'Draw';
  if (result && result.winner) {
    if (isPlayer) {
      kind = result.winner === myColor ? 'win' : 'loss';
      title = kind === 'win' ? 'You won!' : 'You lost';
    } else {
      kind = 'draw';
      const w = result.winner === 'w' ? s.players.white?.name : s.players.black?.name;
      title = `${w || (result.winner === 'w' ? 'White' : 'Black')} wins`;
    }
  }
  content.className = 'modal-content result-content ' + kind;
  document.getElementById('result-badge').innerHTML = RESULT_ICONS[kind];
  document.getElementById('result-title').textContent = title;
  document.getElementById('result-sub').textContent =
    (isPlayer && result && result.winner) ? winReasonText(result.reason, s.gameType) : describeResult(result, s);

  const btnRematch = document.getElementById('result-rematch');
  const voted = !!(s.rematchVotes && s.rematchVotes[s.mySeat]);
  btnRematch.hidden = !isPlayer;
  btnRematch.disabled = voted;
  btnRematch.textContent = voted ? 'Waiting for opponent…' : 'Rematch';

  document.getElementById('result-pgn').hidden = s.gameType !== 'chess';
  document.getElementById('modal-result').hidden = false;
}

function handleRematchPrompt() {
  if (current.game.status !== 'finished') return;
  if (current.mySeat === 'spectator') return;

  const oppSeat = current.mySeat === 'white' ? 'black' : 'white';
  const myVote = current.rematchVotes[current.mySeat];
  const oppVote = current.rematchVotes[oppSeat];

  if (oppVote && !myVote) {
    document.getElementById('modal-rematch').hidden = false;
  } else {
    document.getElementById('modal-rematch').hidden = true;
  }
}

function bottomSeatColor() {
  if (current.mySeat === 'spectator') return localOrientation === 'black' ? 'black' : 'white';
  return current.mySeat;
}

function topSeatColor() {
  return bottomSeatColor() === 'white' ? 'black' : 'white';
}

function updatePlayerBars() {
  if (!current) return;
  const topColor = topSeatColor();
  const botColor = bottomSeatColor();
  setBar('player-top', current.players[topColor], topColor);
  setBar('player-bottom', current.players[botColor], botColor);
  renderCaptured();
}

function isTurnOf(color) {
  if (!current || current.game.status !== 'active') return false;
  const t = current.game.turn;
  if (current.gameType === 'tictactoe') return t === (color === 'white' ? 'X' : 'O');
  if (current.gameType === 'connectfour') return t === (color === 'white' ? 'R' : 'Y');
  return t === (color === 'white' ? 'w' : 'b');
}

const CAPTURE_ORDER = ['q', 'r', 'b', 'n', 'p'];

function renderCaptured() {
  const bars = [
    { id: 'player-top', color: topSeatColor() },
    { id: 'player-bottom', color: bottomSeatColor() }
  ];
  const hist = current.gameType === 'chess' ? (current.game.history || []) : [];
  const taken = { w: [], b: [] };
  for (const m of hist) {
    if (m.captured) taken[m.color].push(m.captured);
  }
  const score = (arr) => arr.reduce((n, t) => n + (PIECE_VALUE[t] || 0), 0);
  const diffW = score(taken.w) - score(taken.b);

  for (const { id, color } of bars) {
    const el = document.querySelector(`#${id} [data-captured]`);
    if (!el) continue;
    el.textContent = '';
    if (current.gameType !== 'chess') continue;
    const mine = color === 'white' ? 'w' : 'b';
    const oppCase = mine === 'w' ? (t) => t : (t) => t.toUpperCase();
    for (const type of CAPTURE_ORDER) {
      const n = taken[mine].filter(t => t === type).length;
      if (!n) continue;
      const group = document.createElement('span');
      group.className = 'cap-group';
      for (let i = 0; i < n; i++) {
        const piece = document.createElement('span');
        piece.className = 'cap-piece';
        piece.innerHTML = pieceSvg(oppCase(type));
        group.appendChild(piece);
      }
      el.appendChild(group);
    }
    const diff = mine === 'w' ? diffW : -diffW;
    if (diff > 0) {
      const d = document.createElement('span');
      d.className = 'cap-diff';
      d.textContent = `+${diff}`;
      el.appendChild(d);
    }
  }
}

function setBar(barId, player, color) {
  const bar = document.getElementById(barId);
  const nameEl = bar.querySelector('[data-name]');
  const seatEl = bar.querySelector('[data-seat]');
  const dot = bar.querySelector('.player-dot');
  
  if (player) {
    let displayName = player.name;
    if (player.name === 'Computer') displayName = 'Computer (Goomys)';
    nameEl.textContent = displayName;
  } else {
    nameEl.textContent = '—';
  }
  
  let seatText = color === 'white' ? 'White' : 'Black';
  if (current.gameType === 'tictactoe') seatText = color === 'white' ? 'X' : 'O';
  if (current.gameType === 'connectfour') seatText = color === 'white' ? 'Red' : 'Yellow';
  
  if (player && !player.connected) seatText += ' · offline';
  seatEl.textContent = seatText;
  dot.style.background = (player && player.connected) ? 'var(--success)' : 'var(--text-tertiary)';
  bar.classList.toggle('on-turn', isTurnOf(color));
}

function updateStatus() {
  const banner = document.getElementById('status-banner');
  const text = document.getElementById('status-text');
  if (!current) return;
  banner.className = 'status-banner';
  const g = current.game;
  let msg = '';

  if (g.status === 'waiting') {
    msg = `Waiting for opponent — code ${current.roomCode}`;
  } else if (g.status === 'active') {
    banner.classList.add('active');
    
    if (current.gameType === 'tictactoe') {
      const mySym = current.mySeat === 'white' ? 'X' : 'O';
      if (current.mySeat !== 'spectator' && g.turn === mySym) {
        msg = 'Your move';
        banner.classList.add('turn-me');
      } else if (current.mySeat === 'spectator') {
        msg = (g.turn === 'X' ? 'X' : 'O') + ' to move';
      } else {
        msg = "Opponent's move";
      }
    } else if (current.gameType === 'connectfour') {
      const mySym = current.mySeat === 'white' ? 'R' : 'Y';
      if (current.mySeat !== 'spectator' && g.turn === mySym) {
        msg = 'Your move — click a column';
        banner.classList.add('turn-me');
      } else if (current.mySeat === 'spectator') {
        msg = (g.turn === 'R' ? 'Red' : 'Yellow') + ' to move';
      } else {
        msg = "Opponent's move";
      }
    } else {
      const myColor = current.mySeat === 'white' ? 'w' : current.mySeat === 'black' ? 'b' : null;
      if (myColor && g.turn === myColor) {
        msg = g.check ? 'You are in check — your move' : 'Your move';
        banner.classList.add('turn-me');
      } else if (current.mySeat === 'spectator') {
        msg = (g.turn === 'w' ? 'White' : 'Black') + ' to move' + (g.check ? ' (in check)' : '');
      } else {
        msg = g.check ? 'Opponent in check' : "Opponent's move";
      }
    }
    
    if (g.drawOffer) {
      msg = (g.drawOffer.by === current.mySeat) ? 'Draw offer sent…' : 'Draw offer pending';
    }
  } else if (g.status === 'finished') {
    banner.classList.add('ended');
    msg = describeResult(g.result, current);
  }
  text.textContent = msg;
}

function describeResult(result, s) {
  if (!result) return 'Game over';
  const w = result.winner;
  const r = result.reason;
  
  if (s.gameType === 'tictactoe' || s.gameType === 'connectfour') {
    const isTTT = s.gameType === 'tictactoe';
    const sym1 = isTTT ? 'X' : 'Red';
    const sym2 = isTTT ? 'O' : 'Yellow';
    
    if (r === 'line') {
      const winnerSymbol = w === 'w' ? sym1 : sym2;
      const winnerName = w === 'w' ? s.players.white?.name : s.players.black?.name;
      return `${winnerName || winnerSymbol} wins!`;
    }
    if (r === 'draw') return 'Draw!';
    if (r === 'resignation') {
      const winnerName = w === 'w' ? s.players.white?.name : s.players.black?.name;
      return `${winnerName} wins by resignation`;
    }
    if (r === 'timeout') {
      const winnerName = w === 'w' ? s.players.white?.name : s.players.black?.name;
      return `${winnerName} wins on time`;
    }
    if (r === 'abandonment') {
      const winnerName = w === 'w' ? s.players.white?.name : s.players.black?.name;
      return `${winnerName} wins — opponent abandoned`;
    }
    if (r === 'agreement') return 'Draw by agreement';
    return 'Game over';
  }
  
  const winnerName = (w === 'w' ? s.players.white?.name : s.players.black?.name) || (w === 'w' ? 'White' : 'Black');
  switch (r) {
    case 'checkmate': return `${winnerName} wins by checkmate`;
    case 'resignation': return `${winnerName} wins by resignation`;
    case 'timeout': return `${winnerName} wins on time`;
    case 'abandonment': return `${winnerName} wins — opponent abandoned`;
    case 'stalemate': return 'Draw by stalemate';
    case 'agreement': return 'Draw by agreement';
    case 'insufficient_material': return 'Draw — insufficient material';
    case 'threefold_repetition': return 'Draw — threefold repetition';
    case 'fifty_move_rule': return 'Draw — fifty-move rule';
    case 'timeout_insufficient_material': return 'Draw on time (insufficient material)';
    default: return 'Game over';
  }
}

function updateControls() {
  if (!current) return;
  const isPlayer = current.mySeat === 'white' || current.mySeat === 'black';
  const isVsBot = current.players.white?.name === 'Computer' || current.players.black?.name === 'Computer';
  const active = current.game.status === 'active';
  const finished = current.game.status === 'finished';
  const btnResign = document.getElementById('btn-resign');
  const btnDraw = document.getElementById('btn-offer-draw');
  const btnRematch = document.getElementById('btn-rematch');
  const btnClaim = document.getElementById('btn-claim-draw');

  btnResign.disabled = !isPlayer || !active;
  btnDraw.hidden = isVsBot;
  btnDraw.disabled = !isPlayer || !active || !!current.game.drawOffer;
  
  btnRematch.hidden = !(isPlayer && finished);
  const bothVoted = current.rematchVotes && current.rematchVotes.white && current.rematchVotes.black;
  btnRematch.textContent = (current.rematchVotes && current.rematchVotes[current.mySeat])
    ? 'Waiting for opponent…'
    : 'Rematch';
  btnRematch.disabled = bothVoted || (current.rematchVotes && current.rematchVotes[current.mySeat]);
  
  btnClaim.hidden = !(isPlayer && active && current.game.canClaimDraw);
  btnClaim.disabled = false;

  const btnPgn = document.getElementById('btn-export-pgn');
  if (btnPgn) btnPgn.hidden = current.gameType !== 'chess';

  const offer = current.game.drawOffer;
  const drawModal = document.getElementById('modal-draw');
  if (drawModal) {
    drawModal.hidden = !(isPlayer && active && offer && offer.by !== current.mySeat);
  }

  const chatSection = document.querySelector('.chat-section');
  if (chatSection) chatSection.hidden = isVsBot;
  setChatEnabled(!isVsBot);
}

function handleResign() {
  if (!current) return;
  if (current.game.status !== 'active') return;
  confirm('Resign game', 'Are you sure you want to resign?').then(ok => {
    if (!ok) return;
    getSocket().emit('game:resign', {}, (res) => {
      if (!res || !res.ok) toast((res && res.error) || 'Failed', 'error');
    });
  });
}

function handleOfferDraw() {
  if (!current) return;
  if (current.game.status !== 'active') return;
  if (current.game.drawOffer) return;
  getSocket().emit('game:offerDraw', {}, (res) => {
    if (!res || !res.ok) toast((res && res.error) || 'Failed', 'error');
    else toast('Draw offered', 'info');
  });
}

function handleClaimDraw() {
  if (!current) return;
  if (current.game.status !== 'active') return;
  if (current.mySeat !== 'white' && current.mySeat !== 'black') return;
  if (!current.game.canClaimDraw) return;
  getSocket().emit('game:claimDraw', {}, (res) => {
    if (!res || !res.ok) toast((res && res.error) || 'No valid claim', 'error');
  });
}

function handleRematch() {
  if (!current) return;
  getSocket().emit('game:rematch', {}, (res) => {
    if (!res || !res.ok) toast((res && res.error) || 'Failed', 'error');
    else if (res.bothReady) toast('Rematch starting', 'success');
    else toast('Rematch requested', 'info');
  });
}

function handleExportPgn() {
  if (!current || current.gameType !== 'chess') return;
  const pgn = exportPgn(current);
  if (!pgn) { toast('No moves to export', 'info'); return; }
  const blob = new Blob([pgn], { type: 'application/x-chess-pgn' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${current.roomCode}.pgn`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function resetChat() {
  const box = document.getElementById('chat-messages');
  if (!box) return;
  box.textContent = '';
  appendSysChat('Welcome to the room!');
}

function leaveToLobby(removeToken) {
  stopClockTicker();
  resetChat();
  clearTimeout(resultTimer);
  resultDismissed = false;
  exitReview(true);
  setActiveTab('moves');
  for (const id of ['modal-result', 'modal-rematch', 'modal-draw', 'waiting-card']) {
    const el = document.getElementById(id);
    if (el) el.hidden = true;
  }
  if (removeToken) {
    try { sessionStorage.removeItem('reconnect'); } catch (_) {}
  }
  current = null;
  lastStatus = null;
  history.replaceState({}, '', '/');
  showLobby();
}