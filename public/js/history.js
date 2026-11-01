import { reviewMove, isReviewing } from './board.js';

let lastState = null;
let currentPly = null;

function moveLabel(entry, gameType) {
  if (!entry) return '';
  if (gameType === 'chess') return entry.san || '';
  if (gameType === 'tictactoe') return `${entry.symbol || ''} · ${Number(entry.index) + 1}`;
  if (gameType === 'connectfour') return `${entry.symbol || ''} · col ${Number(entry.col) + 1}`;
  return '';
}

export function initHistory() {
  const el = document.getElementById('history');
  if (!el) return;

  el.addEventListener('click', (e) => {
    const btn = e.target.closest('button.move[data-ply]');
    if (!btn) return;
    reviewMove(Number(btn.dataset.ply));
  });

  window.addEventListener('board:review', (e) => {
    currentPly = e.detail.index;
    markCurrent();
  });

  document.addEventListener('keydown', (e) => {
    if (!lastState || lastState.gameType !== 'chess') return;
    if (document.getElementById('view-game')?.classList.contains('active') === false) return;
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    const n = (lastState.game.history || []).length;
    if (n === 0) return;
    const cur = isReviewing() ? currentPly : n - 1;
    let next = null;
    if (e.key === 'ArrowLeft') next = Math.max(-1, cur - 1);
    else if (e.key === 'ArrowRight') next = cur + 1;
    else if (e.key === 'Home') next = -1;
    else if (e.key === 'End') next = n - 1;
    else return;
    e.preventDefault();
    reviewMove(next >= n - 1 ? null : next);
  });
}

function markCurrent() {
  const el = document.getElementById('history');
  if (!el) return;
  el.querySelectorAll('.move.current').forEach(m => m.classList.remove('current'));
  let target = null;
  if (currentPly !== null && currentPly >= 0) {
    target = el.querySelector(`.move[data-ply="${currentPly}"]`);
  } else if (currentPly === null && lastState) {
    const n = (lastState.game.history || []).length;
    if (n > 0) target = el.querySelector(`.move[data-ply="${n - 1}"]`);
  }
  if (target) {
    target.classList.add('current');
    // Scroll hanya di dalam kotak riwayat (scrollIntoView akan ikut menggulung seluruh halaman)
    const cr = el.getBoundingClientRect();
    const tr = target.getBoundingClientRect();
    if (tr.top < cr.top) el.scrollTop -= (cr.top - tr.top) + 4;
    else if (tr.bottom > cr.bottom) el.scrollTop += (tr.bottom - cr.bottom) + 4;
  }
}

export function renderHistory(state) {
  const el = document.getElementById('history');
  if (!el) return;
  lastState = state;
  const hist = state.game.history || [];
  if (hist.length === 0) {
    currentPly = null;
    el.innerHTML = '<div class="empty">No moves yet</div>';
    return;
  }
  const clickable = state.gameType === 'chess';
  el.innerHTML = '';

  const makeMove = (entry, ply) => {
    const node = document.createElement(entry && clickable ? 'button' : 'span');
    node.className = 'move' + (entry ? '' : ' empty');
    if (entry) {
      node.textContent = moveLabel(entry, state.gameType);
      if (clickable) {
        node.type = 'button';
        node.dataset.ply = String(ply);
        node.setAttribute('aria-label', `Move ${Math.floor(ply / 2) + 1}${ply % 2 ? ' black' : ' white'}: ${node.textContent}`);
      }
    }
    return node;
  };

  for (let i = 0; i < hist.length; i += 2) {
    const row = document.createElement('div');
    row.className = 'history-row';
    const n = document.createElement('span');
    n.className = 'move-num';
    n.textContent = `${Math.floor(i / 2) + 1}.`;
    row.append(n, makeMove(hist[i], i), makeMove(hist[i + 1] || null, i + 1));
    el.appendChild(row);
  }
  markCurrent();
  if (currentPly === null) el.scrollTop = el.scrollHeight;
}

export function exportPgn(state) {
  if (!state || !state.game.history.length) return null;
  const tc = state.timeControl;
  const header = [
    `[Event "Chess Online"]`,
    `[Site "${location.origin}"]`,
    `[Date "${new Date().toISOString().slice(0, 10)}"]`,
    `[White "${state.players.white?.name || '?'}"]`,
    `[Black "${state.players.black?.name || '?'}"]`,
    tc.initial > 0 ? `[TimeControl "${tc.initial}+${tc.increment}"]` : `[TimeControl "-"]`,
    `[Result "${pgnResult(state.game.result)}"]`
  ].join('\n');

  const parts = [];
  const hist = state.game.history;
  for (let i = 0; i < hist.length; i += 2) {
    const n = Math.floor(i / 2) + 1;
    const w = hist[i].san;
    const b = hist[i + 1] ? hist[i + 1].san : '';
    parts.push(`${n}. ${w} ${b}`.trim());
  }
  return header + '\n\n' + parts.join(' ') + '\n';
}

function pgnResult(result) {
  if (!result) return '*';
  if (result.winner === null) return '1/2-1/2';
  return result.winner === 'w' ? '1-0' : '0-1';
}