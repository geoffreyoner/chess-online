import { formatTime } from './utils.js';
import { getOrientation } from './board.js';

let interval = null;
let getSnapshot = null;

export function startClockTicker(getter) {
  stopClockTicker();
  getSnapshot = getter;
  interval = setInterval(tick, 200);
  tick();
}

export function stopClockTicker() {
  if (interval) clearInterval(interval);
  interval = null;
  getSnapshot = null;
}

function tick() {
  if (!getSnapshot) return;
  const s = getSnapshot();
  if (!s) return;

  const clocks = s.clocks || {};
  if (s.timeControl && s.timeControl.initial === 0) {
    setText('#player-top [data-clock]', '∞');
    setText('#player-bottom [data-clock]', '∞');
    setActive(null, s);
    return;
  }

  let white = clocks.white ?? 0;
  let black = clocks.black ?? 0;
  let activeColor = null;

  if (clocks.activeSince && clocks.activeColor) {
    activeColor = clocks.activeColor;
    const elapsed = Date.now() - clocks.activeSince;
    if (activeColor === 'w') white = Math.max(0, white - elapsed);
    else black = Math.max(0, black - elapsed);
  }

  const bottomColor = bottomSeatColor(s);
  const topColor = bottomColor === 'white' ? 'black' : 'white';
  const topMs = topColor === 'white' ? white : black;
  const botMs = bottomColor === 'white' ? white : black;

  setText('#player-top [data-clock]', formatTime(topMs));
  setText('#player-bottom [data-clock]', formatTime(botMs));
  setLow('#player-top [data-clock]', topMs);
  setLow('#player-bottom [data-clock]', botMs);
  setActive(activeColor, s);
}

function bottomSeatColor(s) {
  const orient = getOrientation();
  if (s.mySeat === 'spectator') return orient === 'black' ? 'black' : 'white';
  return s.mySeat;
}
function topSeatColor(s) {
  return bottomSeatColor(s) === 'white' ? 'black' : 'white';
}

function setText(sel, text) {
  const el = document.querySelector(sel);
  if (el) el.textContent = text;
}
function setLow(sel, ms) {
  const el = document.querySelector(sel);
  if (!el) return;
  if (ms < 30_000) el.classList.add('low'); else el.classList.remove('low');
}
function setActive(activeColor, s) {
  const bottom = document.querySelector('#player-bottom [data-clock]');
  const top = document.querySelector('#player-top [data-clock]');
  if (!bottom || !top) return;
  bottom.classList.remove('active'); top.classList.remove('active');
  if (!activeColor) return;
  const bCol = bottomSeatColor(s) === 'white' ? 'w' : 'b';
  if (activeColor === bCol) bottom.classList.add('active');
  else top.classList.add('active');
}