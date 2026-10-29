import { connect } from './socket.js';
import { initTheme } from './utils.js';
import { initLobby, showLobby } from './lobby.js';
import { initBoard } from './board.js';
import { initGame } from './game.js';
import { initDialogs } from './dialogs.js';

initTheme();
connect();
initLobby();
initBoard();
initDialogs();
initGame();

// Prefill join code from URL
const params = new URLSearchParams(location.search);
if (params.has('room')) {
  const code = (params.get('room') || '').toUpperCase().slice(0, 5);
  const input = document.getElementById('join-code');
  if (input) input.value = code;
}

// Try to reconnect if a saved token exists, otherwise show lobby
let hasSaved = false;
try { hasSaved = !!sessionStorage.getItem('reconnect'); } catch {}
if (!hasSaved) showLobby();