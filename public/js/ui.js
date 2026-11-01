const TABS = ['moves', 'chat', 'info'];
let chatEnabled = true;

export function setActiveTab(name) {
  const panel = document.getElementById('side-panel');
  if (!panel || !TABS.includes(name)) return;
  if (name === 'chat' && !chatEnabled) name = 'moves';
  panel.dataset.activeTab = name;
  panel.querySelectorAll('.tab-btn').forEach((b) => {
    b.setAttribute('aria-selected', b.dataset.tabbtn === name ? 'true' : 'false');
  });
  if (name === 'chat') {
    document.getElementById('tabbtn-chat')?.classList.remove('unread');
    const box = document.getElementById('chat-messages');
    if (box) box.scrollTop = box.scrollHeight;
  }
}

export function getActiveTab() {
  return document.getElementById('side-panel')?.dataset.activeTab || 'moves';
}

export function markChatUnread() {
  if (getActiveTab() === 'chat') return;
  document.getElementById('tabbtn-chat')?.classList.add('unread');
}

export function setChatEnabled(enabled) {
  chatEnabled = enabled;
  const btn = document.getElementById('tabbtn-chat');
  if (btn) btn.hidden = !enabled;
  if (!enabled && getActiveTab() === 'chat') setActiveTab('moves');
}

export function initTabs() {
  const panel = document.getElementById('side-panel');
  if (!panel) return;
  panel.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => setActiveTab(btn.dataset.tabbtn));
  });
}

let hideTimer = null;
export function showConnBanner(text) {
  const el = document.getElementById('conn-banner');
  if (!el) return;
  clearTimeout(hideTimer);
  el.classList.remove('ok');
  el.querySelector('.spinner').hidden = false;
  document.getElementById('conn-banner-text').textContent = text;
  el.hidden = false;
}

export function hideConnBanner(okText) {
  const el = document.getElementById('conn-banner');
  if (!el || el.hidden) return;
  if (okText) {
    el.classList.add('ok');
    el.querySelector('.spinner').hidden = true;
    document.getElementById('conn-banner-text').textContent = okText;
    hideTimer = setTimeout(() => { el.hidden = true; }, 1500);
  } else {
    el.hidden = true;
  }
}
