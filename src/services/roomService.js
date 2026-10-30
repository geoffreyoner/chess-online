const config = require('../config');
const logger = require('../utils/logger');
const { AppError } = require('../utils/errors');
const { generateRoomCode, generateToken, hashToken } = require('./tokenService');
const timer = require('./timerService');
const { getEngine } = require('../games');

const rooms = new Map();
const socketToRoom = new Map();
const tokenInfo = new Map();

function generateUniqueCode() {
  for (let i = 0; i < 30; i++) {
    const code = generateRoomCode();
    if (!rooms.has(code)) return code;
  }
  throw new AppError('CODE_GEN_FAILED', 'Could not generate unique room code');
}

function createRoom({ name, timeControl, gameType = 'chess', socketId }) {
  const code = generateUniqueCode();
  const token = generateToken();
  const tokenHash = hashToken(token);
  const engine = getEngine(gameType);

  const room = {
    code,
    gameType,
    createdAt: Date.now(),
    lastActivity: Date.now(),
    players: {
      white: { name, tokenHash, socketId, connected: true },
      black: null
    },
    spectators: new Map(),
    game: engine.create(),
    timeControl: { initial: timeControl.initial, increment: timeControl.increment },
    clocks: {
      white: timeControl.initial * 1000,
      black: timeControl.initial * 1000,
      activeSince: null,
      activeColor: null
    },
    rematchVotes: { white: false, black: false },
    disconnectTimers: {},
    moveRequests: new Map()
  };

  rooms.set(code, room);
  socketToRoom.set(socketId, code);
  tokenInfo.set(tokenHash, { roomCode: code, seat: 'white', name });

  return { room, token };
}

function joinRoom({ name, roomCode, socketId }) {
  const room = rooms.get(roomCode);
  if (!room) throw new AppError('ROOM_NOT_FOUND', 'Room not found');
  if (socketToRoom.has(socketId)) throw new AppError('ALREADY_IN_ROOM', 'Already in a room');

  let seat, token = null;

  if (!room.players.black) {
    seat = 'black';
    token = generateToken();
    const tokenHash = hashToken(token);
    room.players.black = { name, tokenHash, socketId, connected: true };
    tokenInfo.set(tokenHash, { roomCode: room.code, seat: 'black', name });
    if (room.players.white) {
      const engine = getEngine(room.gameType);
      engine.start(room);
    }
  } else {
    if (room.spectators.size >= 2) throw new AppError('ROOM_FULL', 'Room is full');
    seat = 'spectator';
    room.spectators.set(socketId, { name });
  }

  socketToRoom.set(socketId, room.code);
  room.lastActivity = Date.now();

  return { room, token, seat };
}

function reconnect({ token, roomCode, socketId }) {
  const tokenHash = hashToken(token);
  const info = tokenInfo.get(tokenHash);
  if (!info) throw new AppError('INVALID_TOKEN', 'Invalid reconnect token');
  if (info.roomCode !== roomCode) throw new AppError('INVALID_TOKEN', 'Token does not match room');

  const room = rooms.get(roomCode);
  if (!room) throw new AppError('ROOM_NOT_FOUND', 'Room not found');

  const player = room.players[info.seat];
  if (!player || player.tokenHash !== tokenHash) {
    throw new AppError('INVALID_TOKEN', 'Invalid reconnect token');
  }

  if (player.socketId && player.socketId !== socketId) {
    socketToRoom.delete(player.socketId);
  }

  player.socketId = socketId;
  player.connected = true;
  socketToRoom.set(socketId, room.code);
  room.lastActivity = Date.now();

  if (room.disconnectTimers[info.seat]) {
    clearTimeout(room.disconnectTimers[info.seat]);
    delete room.disconnectTimers[info.seat];
  }

  return { room, seat: info.seat };
}

function removeSocket(socketId) {
  const code = socketToRoom.get(socketId);
  if (!code) return null;
  socketToRoom.delete(socketId);
  const room = rooms.get(code);
  if (!room) return null;
  room.lastActivity = Date.now();

  for (const seat of ['white', 'black']) {
    const p = room.players[seat];
    if (p && p.socketId === socketId) {
      p.socketId = null;
      p.connected = false;
      if (room.timeControl.initial === 0 && room.game.status === 'active') {
        room.disconnectTimers[seat] = setTimeout(() => {
          if (room.game.status === 'active' && !room.players[seat].connected) {
            const engine = getEngine(room.gameType);
            engine.endGame(room, {
              winner: seat === 'white' ? 'b' : 'w',
              reason: 'abandonment'
            });
          }
        }, config.roomGraceMs);
      }
      return { room, seat };
    }
  }
  if (room.spectators.has(socketId)) {
    room.spectators.delete(socketId);
    return { room, seat: 'spectator' };
  }
  return { room, seat: null };
}

function getContext(socketId) {
  const code = socketToRoom.get(socketId);
  if (!code) return null;
  const room = rooms.get(code);
  if (!room) return null;
  let seat = null;
  if (room.players.white && room.players.white.socketId === socketId) seat = 'white';
  else if (room.players.black && room.players.black.socketId === socketId) seat = 'black';
  else if (room.spectators.has(socketId)) seat = 'spectator';
  return { room, seat };
}

function removeFromRoom(socketId) {
  return removeSocket(socketId);
}

function buildSnapshot(room, seat) {
  const clocks = timer.getCurrentClocks(room);
  const engine = getEngine(room.gameType);
  
  let canClaimDraw = false;
  if (engine.canClaimDraw) {
    canClaimDraw = engine.canClaimDraw(room);
  }

  return {
    roomCode: room.code,
    gameType: room.gameType,
    version: room.game.version,
    mySeat: seat,
    players: {
      white: room.players.white ? { name: room.players.white.name, connected: room.players.white.connected } : null,
      black: room.players.black ? { name: room.players.black.name, connected: room.players.black.connected } : null
    },
    spectators: Array.from(room.spectators.values()).map(s => ({ name: s.name })),
    game: {
      status: room.game.status,
      result: room.game.result,
      lastMove: room.game.lastMove,
      drawOffer: room.game.drawOffer,
      version: room.game.version,
      canClaimDraw,
      fen: room.game.chess ? room.game.chess.fen() : null,
      turn: room.game.chess ? room.game.chess.turn() : room.game.turn,
      history: room.game.history,
      check: room.game.chess ? room.game.chess.in_check() : false,
      checkmate: room.game.chess ? room.game.chess.in_checkmate() : false,
      stalemate: room.game.chess ? room.game.chess.in_stalemate() : false,
      board: room.game.board || null
    },
    timeControl: room.timeControl,
    clocks,
    rematchVotes: room.rematchVotes
  };
}

function broadcastState(io, room) {
  const emit = (socketId, seat) => {
    if (!socketId) return;
    const sock = io.sockets.sockets.get(socketId);
    if (sock) sock.emit('state:update', buildSnapshot(room, seat));
  };
  if (room.players.white) emit(room.players.white.socketId, 'white');
  if (room.players.black) emit(room.players.black.socketId, 'black');
  for (const [sid] of room.spectators) emit(sid, 'spectator');
}

function voteRematch(room, seat) {
  if (room.game.status !== 'finished') throw new AppError('GAME_NOT_FINISHED', 'Game is not finished');
  if (seat !== 'white' && seat !== 'black') throw new AppError('FORBIDDEN', 'Only players may vote');
  room.rematchVotes[seat] = true;
  room.game.version++;
  return room.rematchVotes.white && room.rematchVotes.black;
}

function declineRematch(room, seat) {
  if (room.game.status !== 'finished') return;
  room.rematchVotes = { white: false, black: false };
  room.game.version++;
}

function resetForRematch(room) {
  if (room.players.white && room.players.black) {
    const oldWhite = room.players.white;
    const oldBlack = room.players.black;
    room.players.white = oldBlack;
    room.players.black = oldWhite;

    const wHash = room.players.white.tokenHash;
    const bHash = room.players.black.tokenHash;
    if (tokenInfo.has(wHash)) tokenInfo.get(wHash).seat = 'white';
    if (tokenInfo.has(bHash)) tokenInfo.get(bHash).seat = 'black';
  }

  const engine = getEngine(room.gameType);
  engine.start(room);
}

function cleanup() {
  const now = Date.now();
  for (const [code, room] of rooms) {
    const hasActivePlayer =
      (room.players.white && room.players.white.connected) ||
      (room.players.black && room.players.black.connected);
    const hasSpectators = room.spectators.size > 0;
    if (!hasActivePlayer && !hasSpectators && now - room.lastActivity > config.emptyRoomTtlMs) {
      for (const seat of ['white', 'black']) {
        const p = room.players[seat];
        if (p && p.tokenHash) tokenInfo.delete(p.tokenHash);
      }
      for (const t of Object.values(room.disconnectTimers)) clearTimeout(t);
      rooms.delete(code);
      logger.info(`Cleaned up room ${code}`);
    }
  }
}

function checkTimeouts(io) {
  for (const room of rooms.values()) {
    if (room.game.status !== 'active') continue;
    if (timer.isTimedOut(room)) {
      const engine = getEngine(room.gameType);
      const ended = engine.handleTimeout(room);
      if (ended) broadcastState(io, room);
    }
  }
}

function _resetForTests() {
  rooms.clear();
  socketToRoom.clear();
  tokenInfo.clear();
}
function _getRoom(code) { return rooms.get(code); }

module.exports = {
  createRoom, joinRoom, reconnect, removeSocket, removeFromRoom,
  getContext, buildSnapshot, broadcastState,
  voteRematch, declineRematch, resetForRematch, cleanup, checkTimeouts,
  _resetForTests, _getRoom
};