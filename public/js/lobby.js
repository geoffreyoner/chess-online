import { getSocket } from './socket.js';
import { toast } from './utils.js';

let selectedTC = 600;
let selectedInc = 0;
let selectedGameType = 'chess';

export function initLobby() {
  console.log('[Lobby] Initializing...');
  const formCreate = document.getElementById('form-create');
  console.log('[Lobby] Create form:', formCreate);

  if (!formCreate) return;

  const tcGroup = document.getElementById('time-control');
  const incGroup = document.getElementById('increment');
  const gtGroup = document.getElementById('game-type');

  if (gtGroup) {
    gtGroup.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-value]');
      if (!btn) return;
      gtGroup.querySelectorAll('button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedGameType = btn.dataset.value;
    });
  }

  if (tcGroup) {
    tcGroup.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-value]');
      if (!btn) return;
      tcGroup.querySelectorAll('button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedTC = parseInt(btn.dataset.value, 10);
    });
  }
  
  if (incGroup) {
    incGroup.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-value]');
      if (!btn) return;
      incGroup.querySelectorAll('button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedInc = parseInt(btn.dataset.value, 10);
    });
  }

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

function handleCreate(e) {
  e.preventDefault();
  console.log('[Lobby] Create form submitted');

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
    console.error('[CreateRoom] Socket is not connected:', socket);
    return;
  }

  if (btn.disabled) return;

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
    console.error('[CreateRoom] Socket acknowledgement timed out.');
  }, 10000);

  const payload = {
    name,
    timeControl: { initial: selectedTC, increment: selectedInc },
    gameType: selectedGameType
  };

  console.log('[CreateRoom] Sending payload:', payload);

  try {
    socket.emit('room:create', payload, (res) => {
      finish();
      console.log('[CreateRoom] Server response:', res);

      if (!res || !res.ok) {
        toast((res && res.error) || 'Failed to create room.', 'error');
        return;
      }

      try {
        sessionStorage.setItem('reconnect', JSON.stringify({ roomCode: res.roomCode, token: res.token }));
      } catch (err) {
        console.warn('[CreateRoom] Could not save reconnect token:', err);
      }

      history.replaceState({}, '', `/?room=${encodeURIComponent(res.roomCode)}`);
    });
  } catch (err) {
    finish();
    console.error('[CreateRoom] Emit failed:', err);
    toast('Could not send room request.', 'error');
  }
}

function handleJoin(e) {
  e.preventDefault();
  const nameInput = document.getElementById('join-name');
  const codeInput = document.getElementById('join-code');
  const btn = e.currentTarget.querySelector('button[type=submit]');
  
  if (!nameInput || !codeInput) return;

  const name = nameInput.value.trim();
  const roomCode = codeInput.value.trim().toUpperCase();
  if (!name || !roomCode) return;

  btn.disabled = true; btn.textContent = 'Joining…';

  getSocket().emit('room:join', { name, roomCode }, (res) => {
    btn.disabled = false; btn.textContent = 'Join room';
    if (!res || !res.ok) { toast((res && res.error) || 'Failed to join room', 'error'); return; }
    if (res.token) {
      try { sessionStorage.setItem('reconnect', JSON.stringify({ roomCode: res.roomCode, token: res.token })); } catch {}
    }
    history.replaceState({}, '', `/?room=${res.roomCode}`);
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