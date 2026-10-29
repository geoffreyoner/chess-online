const { AppError } = require('../utils/errors');

const LIMITS = {
  'room:create': { max: 5, windowMs: 60_000 },
  'room:join': { max: 12, windowMs: 60_000 },
  'room:reconnect': { max: 10, windowMs: 60_000 },
  'game:move': { max: 60, windowMs: 60_000 },
  'game:legalMoves': { max: 120, windowMs: 60_000 },
  'game:resign': { max: 3, windowMs: 60_000 },
  'game:offerDraw': { max: 5, windowMs: 60_000 },
  'game:rematch': { max: 5, windowMs: 60_000 },
  'default': { max: 120, windowMs: 60_000 }
};

function check(socket, event) {
  const limit = LIMITS[event] || LIMITS.default;
  const now = Date.now();
  if (!socket.data.rl) socket.data.rl = {};
  if (!socket.data.rl[event]) socket.data.rl[event] = [];
  const stamps = socket.data.rl[event];
  while (stamps.length && now - stamps[0] > limit.windowMs) stamps.shift();
  if (stamps.length >= limit.max) {
    throw new AppError('RATE_LIMITED', 'Too many requests. Please slow down.');
  }
  stamps.push(now);
}

module.exports = { check };