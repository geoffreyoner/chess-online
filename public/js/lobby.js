import { getSocket } from './socket.js';
import { toast } from './utils.js';

let selectedTC = 600;
let selectedInc = 0;

export function initLobby() {
  const tcGroup = document.getElementById('time-control');
  const incGroup = document.getElementById('increment');

  tcGroup.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-value]');
    if (!btn) return;
    tcGroup.querySelectorAll('button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedTC = parseInt(btn.dataset.value, 10);
  });
  
  incGroup.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-value]');
    if (!btn) return;
    incGroup.querySelectorAll('button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedInc = parseInt(btn.dataset.value, 10);
  });

  document.getElementById('form-create').addEventListener('submit', handleCreate);
  document.getElementById('form-join').addEventListener('submit', handleJoin);

  const joinInput = document.getElementById('join-code');

  document.getElementById('btn-clear-code').addEventListener('click', () => {
    joinInput.value = '';
    joinInput.focus();
  });

  document.getElementById('btn-paste-code').addEventListener('click', async () => {
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

  joinInput.addEventListener('paste', (e) => {
    const pastedText = (e.clipboardData || window.clipboardData).getData('text');
    
    const match = pastedText.match(/[A-HJ-NP-Z2-9]{5}/i);
    if (match) {
      e.preventDefault();
      joinInput.value = match[0].toUpperCase();
    }
  });
}

function handleCreate(e) {
  e.preventDefault();
  const name = document.getElementById('create-name').value.trim();
  if (!name) return;
  const btn = e.currentTarget.querySelector('button[type=submit]');
  btn.disabled = true; btn.textContent = 'Creating…';

  getSocket().emit('room:create', {
    name,
    timeControl: { initial: selectedTC, increment: selectedInc }
  }, (res) => {
    btn.disabled = false; btn.textContent = 'Create room';
    if (!res || !res.ok) { toast((res && res.error) || 'Failed to create room', 'error'); return; }
    try {
      sessionStorage.setItem('reconnect', JSON.stringify({ roomCode: res.roomCode, token: res.token }));
    } catch {}
    history.replaceState({}, '', `/?room=${res.roomCode}`);
  });
}

function handleJoin(e) {
  e.preventDefault();
  const name = document.getElementById('join-name').value.trim();
  const roomCode = document.getElementById('join-code').value.trim().toUpperCase();
  if (!name || !roomCode) return;
  const btn = e.currentTarget.querySelector('button[type=submit]');
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
  document.getElementById('view-lobby').classList.add('active');
  document.getElementById('view-game').classList.remove('active');
}

export function showGame() {
  document.getElementById('view-lobby').classList.remove('active');
  document.getElementById('view-game').classList.add('active');
}