const SHAPES = {
  p: `
    <circle class="b" cx="22.5" cy="13" r="6"/>
    <path class="b" d="M22.5 20c-3.2 0-5.2 1.6-5.2 3.6 0 1.4 1 2.7 2.4 3.5C16.2 28.8 13 32.6 13 38h19c0-5.4-3.2-9.2-6.7-10.9 1.4-.8 2.4-2.1 2.4-3.5 0-2-2-3.6-5.2-3.6z"/>
    <rect class="b" x="10.5" y="37.5" width="24" height="3.5" rx="1.2"/>`,
  r: `
    <path class="b" d="M11 10.5h5v4h4v-4h5v4h4v-4h5v9l-3 3H14l-3-3z"/>
    <path class="b" d="M14 22.5h17l1.2 13H12.8z"/>
    <rect class="b" x="10" y="35.5" width="25" height="5" rx="1.2"/>
    <path class="d" d="M14.5 19.5h16"/>`,
  n: `
    <path class="b" d="M12.5 37.5c0-7.5 2-11.5 6.5-15.5-2.2-.6-5.2.4-8.2 3.6-.8-3.2.4-6.4 3-9.2l1.2-4.3c.4-1.4 1.8-1.9 3-1l2 1.5c3.4-2.4 8.6-2.4 12 1.8 3.8 4.8 4.4 14.6 1.6 23.1z"/>
    <circle class="e" cx="17.6" cy="15.6" r="1.25"/>
    <path class="d" d="M10.8 25.6l2.6-.8M24 14.5c3.2 2.2 5 6 5.2 11"/>
    <rect class="b" x="10.5" y="37.5" width="24" height="3.5" rx="1.2"/>`,
  b: `
    <circle class="b" cx="22.5" cy="7.8" r="2.6"/>
    <path class="b" d="M22.5 11c-5.4 3.2-8.2 7.2-8.2 11.4 0 2.6 1.6 4.6 3.8 5.7h8.8c2.2-1.1 3.8-3.1 3.8-5.7 0-4.2-2.8-8.2-8.2-11.4z"/>
    <path class="b" d="M16 28.5h13l2.6 7H13.4z"/>
    <rect class="b" x="10.5" y="35.5" width="24" height="5" rx="1.2"/>
    <path class="d" d="M22.5 14.8v6.4M19.3 18h6.4"/>`,
  q: `
    <path class="b" d="M12 35.5L9 17l7.2 8.6-.8-13.6 5.6 12.8 1.5-17 1.5 17 5.6-12.8-.8 13.6L36 17l-3 18.5z"/>
    <circle class="b" cx="9" cy="14.6" r="2.3"/>
    <circle class="b" cx="15.6" cy="9.6" r="2.3"/>
    <circle class="b" cx="22.5" cy="7.4" r="2.3"/>
    <circle class="b" cx="29.4" cy="9.6" r="2.3"/>
    <circle class="b" cx="36" cy="14.6" r="2.3"/>
    <rect class="b" x="10.5" y="35.5" width="24" height="5" rx="1.2"/>
    <path class="d" d="M13.2 31h18.6"/>`,
  k: `
    <path class="b" d="M22.5 13.5c-7 0-11.2 4.2-11.2 9.2 0 3.2 1.6 5.6 4.2 7.2l-1.9 5.6h17.8l-1.9-5.6c2.6-1.6 4.2-4 4.2-7.2 0-5-4.2-9.2-11.2-9.2z"/>
    <path class="b" d="M22.5 3.5v9.5M18.2 7.6h8.6" style="stroke-width:2.6;stroke-linecap:round"/>
    <rect class="b" x="10.5" y="35.5" width="24" height="5" rx="1.2"/>
    <path class="d" d="M16 29.5h13"/>`
};

export const PIECE_NAMES = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };

export function pieceSvg(type) {
  const key = type.toLowerCase();
  const color = type === type.toUpperCase() ? 'white' : 'black';
  return `<svg class="piece-svg ${color}" viewBox="0 0 45 45" aria-hidden="true" focusable="false">${SHAPES[key]}</svg>`;
}

export const PIECE_VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
