export function renderHistory(state) {
  const el = document.getElementById('history');
  if (!el) return;
  const hist = state.game.history || [];
  if (hist.length === 0) {
    el.innerHTML = '<div class="empty">No moves yet</div>';
    return;
  }
  el.innerHTML = '';
  const pairs = [];
  for (let i = 0; i < hist.length; i += 2) {
    pairs.push({ n: Math.floor(i / 2) + 1, w: hist[i], b: hist[i + 1] || null });
  }
  for (const p of pairs) {
    const row = document.createElement('div');
    row.className = 'history-row';
    const n = document.createElement('span');
    n.className = 'move-num';
    n.textContent = `${p.n}.`;
    const w = document.createElement('span');
    w.className = 'move' + (p.w ? '' : ' empty');
    w.textContent = p.w ? p.w.san : '';
    const b = document.createElement('span');
    b.className = 'move' + (p.b ? '' : ' empty');
    b.textContent = p.b ? p.b.san : '';
    row.append(n, w, b);
    el.appendChild(row);
  }
  el.scrollTop = el.scrollHeight;
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