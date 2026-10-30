import { getSocket } from './socket.js';
import { toast, copyText, confirm } from './utils.js';
import { setBoardState, getOrientation } from './board.js';
import { renderHistory, exportPgn } from './history.js';
import { startClockTicker, stopClockTicker } from './timer.js';
import { showGame, showLobby } from './lobby.js';
import { sounds } from './audio.js';

let current = null;
let localOrientation = 'white';
let lastStatus = null;
let overlayTimeout = null;

export function initGame() {
  const socket = getSocket();

  socket.on('connect', handleConnect);
  socket.on('disconnect', handleDisconnect);
  socket.on('state:update', onStateUpdate);
  
  socket.on('room:chatMessage', (data) => {
    appendChat(data);
    sounds.chat();
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
      const msg = btn.dataset.msg;
      getSocket().emit('room:chat', { text: msg });
    });
  });

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
  if (current) toast('Disconnected. Reconnecting…', 'warning', 2500);
}

function onStateUpdate(snapshot) {
  if (current && snapshot.version < current.version) return;
  
  if (current) {
    if (current.mySeat !== snapshot.mySeat && snapshot.mySeat !== 'spectator') {
      let label = snapshot.mySeat === 'white' ? 'White' : 'Black';
      if (snapshot.gameType === 'tictactoe') {
        label = snapshot.mySeat === 'white' ? 'X' : 'O';
      }
      toast(`Sides swapped! You are now ${label}`, 'info', 4000);
    }

    const prevLength = current.game.history.length;
    const newLength = snapshot.game.history.length;
    
    if (newLength > prevLength) {
      const lastMv = snapshot.game.history[newLength - 1];
      if (snapshot.game.status === 'finished') {
         sounds.end();
      } else if (snapshot.gameType === 'tictactoe') {
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
  const btnFlip = document.getElementById('btn-flip');

  if (snapshot.gameType === 'tictactoe') {
    if (chessBoard) chessBoard.style.display = 'none';
    if (tttBoard) tttBoard.style.display = 'grid';
    if (btnFlip) btnFlip.style.display = 'none';
    renderTicTacToe(snapshot);
  } else {
    if (chessBoard) chessBoard.style.display = 'grid';
    if (tttBoard) tttBoard.style.display = 'none';
    if (btnFlip) btnFlip.style.display = 'block';
    setBoardState(snapshot);
  }
}

function renderTicTacToe(snapshot) {
  const container = document.getElementById('board-tictactoe');
  if (!container) return;
  container.innerHTML = '';
  const board = snapshot.game.board || Array(9).fill(null);
  
  board.forEach((cell, index) => {
    const div = document.createElement('div');
    div.className = 'ttt-cell';
    if (cell === 'X') div.classList.add('x');
    if (cell === 'O') div.classList.add('o');
    if (snapshot.game.lastMove && snapshot.game.lastMove.index === index) div.classList.add('last-move');
    div.textContent = cell || '';
    
    div.addEventListener('click', () => {
      if (snapshot.game.status !== 'active') return;
      if (snapshot.mySeat === 'spectator') return;
      
      const mySym = snapshot.mySeat === 'white' ? 'X' : 'O';
      if (snapshot.game.turn !== mySym) return;
      if (cell !== null) return;
      
      getSocket().emit('game:move', { index }, (res) => {
        if (!res || !res.ok) {
          toast((res && res.error) || 'Move rejected', 'error');
        }
      });
    });
    
    container.appendChild(div);
  });
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

function handleGameOverTransition() {
  const isFinished = current.game.status === 'finished';
  
  if (isFinished && lastStatus !== 'finished') {
    const resultText = describeResult(current.game.result, current);
    const overlay = document.getElementById('game-over-overlay');
    document.getElementById('overlay-result').textContent = resultText;
    
    overlay.classList.add('show');
    if (overlayTimeout) clearTimeout(overlayTimeout);
    overlayTimeout = setTimeout(() => {
      overlay.classList.remove('show');
    }, 3000);
  }
  lastStatus = current.game.status;
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
}

function setBar(barId, player, color) {
  const bar = document.getElementById(barId);
  const nameEl = bar.querySelector('[data-name]');
  const seatEl = bar.querySelector('[data-seat]');
  const dot = bar.querySelector('.player-dot');
  nameEl.textContent = player ? player.name : '—';
  let seatText = color === 'white' ? 'White' : 'Black';
  if (current.gameType === 'tictactoe') seatText = color === 'white' ? 'X' : 'O';
  
  if (player && !player.connected) seatText += ' · offline';
  seatEl.textContent = seatText;
  dot.style.background = (player && player.connected) ? 'var(--success)' : 'var(--text-tertiary)';
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
    
    if (current.drawOffer) {
      msg = (current.drawOffer.by === current.mySeat) ? 'Draw offer sent…' : 'Draw offer pending';
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
  
  if (s.gameType === 'tictactoe') {
    if (r === 'line') {
      const winnerSymbol = w === 'w' ? 'X' : 'O';
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
  const active = current.game.status === 'active';
  const finished = current.game.status === 'finished';
  const btnResign = document.getElementById('btn-resign');
  const btnDraw = document.getElementById('btn-offer-draw');
  const btnRematch = document.getElementById('btn-rematch');
  const btnClaim = document.getElementById('btn-claim-draw');

  btnResign.disabled = !isPlayer || !active;
  btnDraw.disabled = !isPlayer || !active || !!current.game.drawOffer;
  
  btnRematch.hidden = !(isPlayer && finished);
  const bothVoted = current.rematchVotes && current.rematchVotes.white && current.rematchVotes.black;
  btnRematch.textContent = (current.rematchVotes && current.rematchVotes[current.mySeat])
    ? 'Waiting for opponent…'
    : 'Rematch';
  btnRematch.disabled = bothVoted || (current.rematchVotes && current.rematchVotes[current.mySeat]);
  
  btnClaim.hidden = !(isPlayer && active && current.game.canClaimDraw);
  btnClaim.disabled = false;
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

function leaveToLobby(removeToken) {
  stopClockTicker();
  if (removeToken) {
    try { sessionStorage.removeItem('reconnect'); } catch (_) {}
  }
  current = null;
  lastStatus = null;
  history.replaceState({}, '', '/');
  showLobby();
}