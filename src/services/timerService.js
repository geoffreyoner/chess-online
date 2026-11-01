function getCurrentClocks(room) {
  const { white, black, activeSince, activeColor } = room.clocks;
  if (activeSince == null || !activeColor) {
    return { white, black, activeColor: null, activeSince: null };
  }
  const elapsed = Math.max(0, Date.now() - activeSince);
  return {
    white: activeColor === 'w' ? Math.max(0, white - elapsed) : white,
    black: activeColor === 'b' ? Math.max(0, black - elapsed) : black,
    activeColor,
    activeSince
  };
}

function commitElapsed(room) {
  if (room.clocks.activeSince == null || !room.clocks.activeColor) return;
  const elapsed = Math.max(0, Date.now() - room.clocks.activeSince);
  if (room.clocks.activeColor === 'w') {
    room.clocks.white = Math.max(0, room.clocks.white - elapsed);
  } else {
    room.clocks.black = Math.max(0, room.clocks.black - elapsed);
  }
  room.clocks.activeSince = null;
  room.clocks.activeColor = null;
}

function startClock(room, color) {
  if (room.timeControl.initial === 0) return;
  room.clocks.activeColor = color;
  room.clocks.activeSince = Date.now();
}

function applyIncrement(room, color) {
  if (!room.timeControl.increment) return;
  const inc = room.timeControl.increment * 1000;
  if (color === 'w') room.clocks.white += inc;
  else room.clocks.black += inc;
}

function isTimedOut(room) {
  if (room.timeControl.initial === 0) return false;
  if (room.game.status !== 'active') return false;
  if (room.clocks.activeSince == null) return false;
  const c = getCurrentClocks(room);
  if (room.clocks.activeColor === 'w') return c.white <= 0;
  if (room.clocks.activeColor === 'b') return c.black <= 0;
  return false;
}

module.exports = {
  getCurrentClocks, commitElapsed, startClock, applyIncrement, isTimedOut
};