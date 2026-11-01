import { connect, getSocket } from './socket.js';
import { initTheme } from './utils.js';
import { initLobby, showLobby } from './lobby.js';
import { initBoard } from './board.js';
import { initGame } from './game.js';
import { initDialogs } from './dialogs.js';
import { initHistory } from './history.js';
import { initTabs } from './ui.js';
import { toggleMute, getIsMuted } from './audio.js';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      reg.update();
    }).catch(err => {
      console.log('SW registration failed: ', err);
    });
  });
}

initTheme();

const muteBtn = document.getElementById('mute-toggle');
const iconOn = document.getElementById('icon-sound-on');
const iconOff = document.getElementById('icon-sound-off');

function updateMuteIcon() {
  if (getIsMuted()) {
    iconOn.style.display = 'none';
    iconOff.style.display = 'block';
  } else {
    iconOn.style.display = 'block';
    iconOff.style.display = 'none';
  }
}

updateMuteIcon();

muteBtn.addEventListener('click', () => {
  toggleMute();
  updateMuteIcon();
});

connect();
const socket = getSocket();

const countEl = document.getElementById('online-count');
let prevCount = -1;

socket.on('online:count', (count) => {
  if (!countEl) return;
  
  countEl.textContent = count;
  
  if (prevCount !== -1 && count !== prevCount) {
    countEl.classList.remove('pop');
    void countEl.offsetWidth;
    countEl.classList.add('pop');
    
    setTimeout(() => {
      countEl.classList.remove('pop');
    }, 300);
  }
  
  prevCount = count;
});

initLobby();
initBoard();
initDialogs();
initHistory();
initTabs();
initGame();

const params = new URLSearchParams(location.search);
if (params.has('room')) {
  const code = (params.get('room') || '').toUpperCase().slice(0, 5);
  const input = document.getElementById('join-code');
  if (input) input.value = code;
}

let hasSaved = false;
try { hasSaved = !!sessionStorage.getItem('reconnect'); } catch (_) {}
if (!hasSaved) showLobby();