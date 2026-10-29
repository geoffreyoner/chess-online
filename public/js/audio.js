let audioCtx = null;

function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

function playTone(freq, type, duration, vol) {
  if (!audioCtx) return;
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
    playTone(400, 'triangle', 0.1, 0.15);
  },
  capture() {
    initAudio();
    playTone(300, 'sawtooth', 0.15, 0.2);
    playTone(200, 'square', 0.1, 0.15);
  },
  check() {
    initAudio();
    playTone(600, 'sine', 0.3, 0.2);
    playTone(800, 'sine', 0.3, 0.15);
  },
  end() {
    initAudio();
    playTone(400, 'triangle', 0.2, 0.2);
    setTimeout(() => playTone(300, 'triangle', 0.3, 0.2), 150);
    setTimeout(() => playTone(200, 'triangle', 0.5, 0.2), 300);
  },
  select() {
    initAudio();
    playTone(500, 'sine', 0.05, 0.08);
  }
};

window.addEventListener('pointerdown', () => {
  if (!audioCtx) initAudio();
  else if (audioCtx.state === 'suspended') audioCtx.resume();
}, { once: true });