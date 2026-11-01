import { getSocket } from './socket.js';
import { toast } from './utils.js';

let selectedTC = 600;
let selectedInc = 0;
let selectedGameType = 'chess';

const VALID_GAME_TYPES = ['chess', 'tictactoe', 'connectfour'];

function bindSegmented(group, onSelect) {
  if (!group) return;
  const initial = group.querySelector('button[data-value].active');
  if (initial) onSelect(initial.dataset.value);

  group.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-value]');
    if (!btn || !group.contains(btn)) return;
    group.querySelectorAll('button').forEach(b => {
      b.classList.remove('active');
      b.setAttribute('aria-pressed', 'false');
    });
    btn.classList.add('active');
    btn.setAttribute('aria-pressed', 'true');
    onSelect(btn.dataset.value);
  });
}

export function initLobby() {
  const formCreate = document.getElementById('form-create');
  if (!formCreate) return;

  bindSegmented(document.getElementById('game-type'), (v) => {
    selectedGameType = VALID_GAME_TYPES.includes(v) ? v : 'chess';
  });
  bindSegmented(document.getElementById('time-control'), (v) => {
    selectedTC = parseInt(v, 10);
  });
  bindSegmented(document.getElementById('increment'), (v) => {
    selectedInc = parseInt(v, 10);
  });

  formCreate.addEventListener('submit', handleCreate);
  document.getElementById('form-join')?.addEventListener('submit', handleJoin);

  const joinInput = document.getElementById('join-code');

  document.getElementById('btn-clear-code')?.addEventListener('click', () => {
    if (joinInput) {
      joinInput.value = '';
      joinInput.focus();
    }
  });

  document.getElementById('btn-paste-code')?.addEventListener('click', async () => {
    if (!joinInput) return;
    joinInput.focus();
    try {
      if (!navigator.clipboard) throw new Error('No clipboard API');
      const text = await navigator.clipboard.readText();
      const match = text.match(/[A-HJ-NP-Z2-9]{5}/i);
      const code = match ? match[0].toUpperCase() : text.trim().toUpperCase().slice(0, 5);

      if (code) joinInput.value = code;
    } catch (err) {
      toast('Browser blocks clipboard. Long-press box to paste.', 'warning', 3000);
    }
  });

  if (joinInput) {
    joinInput.addEventListener('paste', (e) => {
      const pastedText = (e.clipboardData || window.clipboardData).getData('text');
      const match = pastedText.match(/[A-HJ-NP-Z2-9]{5}/i);
      if (match) {
        e.preventDefault();
        joinInput.value = match[0].toUpperCase();
      }
    });
  }
}

function saveReconnect(res) {
  if (!res.token) return;
  try {
    sessionStorage.setItem('reconnect', JSON.stringify({
      roomCode: res.roomCode,
      token: res.token,
      gameType: res.gameType || null
    }));
  } catch (err) {
    console.warn('[Lobby] Could not save reconnect token:', err);
  }
}

function handleCreate(e) {
  e.preventDefault();

  const form = e.currentTarget;
  const nameInput = document.getElementById('create-name');
  const btn = form.querySelector('button[type="submit"]');
  const name = nameInput ? nameInput.value.trim() : '';

  if (!name) {
    toast('Please enter your name.', 'warning');
    if (nameInput) nameInput.focus();
    return;
  }

  const socket = getSocket();
  if (!socket || !socket.connected) {
    toast('Connecting to server. Please try again.', 'warning');
    return;
  }
  if (btn.disabled) return;

  const activeGame = document.querySelector('#game-type button.active');
  const gameType = VALID_GAME_TYPES.includes(activeGame?.dataset.value)
    ? activeGame.dataset.value
    : selectedGameType;

  const vsBotCheckbox = document.getElementById('create-vs-bot');
  const vsBot = vsBotCheckbox ? vsBotCheckbox.checked : false;

  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Creating…';

  let completed = false;
  const finish = () => {
    if (completed) return;
    completed = true;
    clearTimeout(timeout);
    btn.disabled = false;
    btn.textContent = originalText;
  };

  const timeout = setTimeout(() => {
    finish();
    toast('Server did not respond. Please try again.', 'error');
  }, 10000);

  const payload = {
    name,
    timeControl: { initial: selectedTC, increment: selectedInc },
    gameType,
    vsBot
  };

  console.log('[CreateRoom] Sending payload:', payload);

  try {
    socket.emit('room:create', payload, (res) => {
      finish();
      if (!res || !res.ok) {
        toast((res && res.error) || 'Failed to create room.', 'error');
        return;
      }
      saveReconnect(res);
      history.replaceState({}, '', `/?room=${encodeURIComponent(res.roomCode)}`);
    });
  } catch (err) {
    finish();
    console.error('[Lobby] Emit failed:', err);
    toast('Could not send room request.', 'error');
  }
}

function handleJoin(e) {
  e.preventDefault();
  const nameInput = document.getElementById('join-name');
  const codeInput = document.getElementById('join-code');
  const btn = e.currentTarget.querySelector('button[type=submit]');

  if (!nameInput || !codeInput || !btn) return;

  const name = nameInput.value.trim();
  const roomCode = codeInput.value.trim().toUpperCase();
  if (!name || !roomCode) return;

  btn.disabled = true;
  btn.textContent = 'Joining…';

  getSocket().emit('room:join', { name, roomCode }, (res) => {
    btn.disabled = false;
    btn.textContent = 'Join room';
    if (!res || !res.ok) {
      toast((res && res.error) || 'Failed to join room', 'error');
      return;
    }
    saveReconnect(res);
    history.replaceState({}, '', `/?room=${encodeURIComponent(res.roomCode)}`);
  });
}

export function showLobby() {
  document.getElementById('view-lobby')?.classList.add('active');
  document.getElementById('view-game')?.classList.remove('active');
}

export function showGame() {
  document.getElementById('view-lobby')?.classList.remove('active');
  document.getElementById('view-game')?.classList.add('active');
}