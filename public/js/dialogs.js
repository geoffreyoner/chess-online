import { getSocket } from './socket.js';
import { toast, copyText, confirm } from './utils.js';

export function initDialogs() {
  document.getElementById('draw-accept').addEventListener('click', () => {
    document.getElementById('modal-draw').hidden = true;
    getSocket().emit('game:respondDraw', { accept: true }, (res) => {
      if (!res || !res.ok) toast((res && res.error) || 'Failed', 'error');
    });
  });
  document.getElementById('draw-decline').addEventListener('click', () => {
    document.getElementById('modal-draw').hidden = true;
    getSocket().emit('game:respondDraw', { accept: false }, () => {});
  });
}

export { toast, copyText, confirm };