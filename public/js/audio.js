let audioCtx = null;
let isMuted = false;

try {
  isMuted = localStorage.getItem('chess-muted') === 'true';
} catch (_) {}

function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

function haptic(pattern) {
  if (isMuted) return;
  try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (_) {}
}

function playTone(freq, type, duration, vol) {
  if (isMuted || !audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
  gain.gain.setValueAtTime(vol, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + duration);
}

export const sounds = {
  move() {
    initAudio();
    haptic(8);
    playTone(400, 'triangle', 0.1, 0.15);
  },
  capture() {
    initAudio();
    haptic(18);
    playTone(300, 'sawtooth', 0.15, 0.2);
    playTone(200, 'square', 0.1, 0.15);
  },
  check() {
    initAudio();
    haptic([25, 40, 25]);
    playTone(600, 'sine', 0.3, 0.2);
    playTone(800, 'sine', 0.3, 0.15);
  },
  end() {
    initAudio();
    haptic([60, 50, 120]);
    playTone(400, 'triangle', 0.2, 0.2);
    setTimeout(() => playTone(300, 'triangle', 0.3, 0.2), 150);
    setTimeout(() => playTone(200, 'triangle', 0.5, 0.2), 300);
  },
  select() {
    initAudio();
    playTone(500, 'sine', 0.05, 0.08);
  },
  chat() {
    initAudio();
    playTone(800, 'sine', 0.08, 0.15);
    setTimeout(() => playTone(1000, 'sine', 0.1, 0.15), 80);
  }
};

export function toggleMute() {
  isMuted = !isMuted;
  try {
    localStorage.setItem('chess-muted', isMuted ? 'true' : 'false');
  } catch (_) {}
  return isMuted;
}

export function getIsMuted() {
  return isMuted;
}

window.addEventListener('pointerdown', () => {
  if (!audioCtx) initAudio();
  else if (audioCtx.state === 'suspended') audioCtx.resume();
}, { once: true });