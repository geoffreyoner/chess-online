const { AppError } = require('../utils/errors');
const config = require('../config');

const MAX_NAME = 20;
const NAME_RE = /^[\p{L}\p{N} _.\-']+$/u;
const ROOM_CODE_RE = /^[A-HJ-NP-Z2-9]{5}$/;
const SQUARE_RE = /^[a-h][1-8]$/;
const PROMO_RE = /^[qrbnQRBN]$/;

function validateName(name) {
  if (typeof name !== 'string') throw new AppError('INVALID_NAME', 'Name is required');
  const trimmed = name.trim();
  if (trimmed.length < 1 || trimmed.length > MAX_NAME) {
    throw new AppError('INVALID_NAME', `Name must be 1–${MAX_NAME} characters`);
  }
  if (!NAME_RE.test(trimmed)) {
    throw new AppError('INVALID_NAME', 'Name contains invalid characters');
  }
  return trimmed;
}

function validateRoomCode(code) {
  if (typeof code !== 'string') throw new AppError('INVALID_ROOM_CODE', 'Invalid room code');
  const normalized = code.trim().toUpperCase();
  if (!ROOM_CODE_RE.test(normalized)) {
    throw new AppError('INVALID_ROOM_CODE', 'Room codes are 5 characters (A–Z, 2–9)');
  }
  return normalized;
}

function validateTimeControl(tc) {
  const def = config.defaultTimeControl;
  const initial = tc && typeof tc.initial === 'number' ? tc.initial : def.initial;
  const increment = tc && typeof tc.increment === 'number' ? tc.increment : def.increment;
  if (!config.allowedTimeControls.includes(initial)) {
    throw new AppError('INVALID_TIME_CONTROL', 'Unsupported time control');
  }
  if (!config.allowedIncrements.includes(increment)) {
    throw new AppError('INVALID_TIME_CONTROL', 'Unsupported increment');
  }
  return { initial, increment };
}

function validateCreateRoom(payload) {
  if (!payload || typeof payload !== 'object') throw new AppError('INVALID_PAYLOAD', 'Invalid payload');
 
  const gameType = ['chess', 'tictactoe', 'connectfour'].includes(payload.gameType) 
    ? payload.gameType 
    : 'chess';
    
  return {
    name: validateName(payload.name),
    timeControl: validateTimeControl(payload.timeControl),
    gameType
  };
}

function validateJoinRoom(payload) {
  if (!payload || typeof payload !== 'object') throw new AppError('INVALID_PAYLOAD', 'Invalid payload');
  return {
    name: validateName(payload.name),
    roomCode: validateRoomCode(payload.roomCode)
  };
}

function validateReconnect(payload) {
  if (!payload || typeof payload !== 'object') throw new AppError('INVALID_PAYLOAD', 'Invalid payload');
  if (typeof payload.token !== 'string' || payload.token.length < 16 || payload.token.length > 256) {
    throw new AppError('INVALID_TOKEN', 'Invalid reconnect token');
  }
  return {
    roomCode: validateRoomCode(payload.roomCode),
    token: payload.token
  };
}

function validateMove(payload) {
  if (!payload || typeof payload !== 'object') throw new AppError('INVALID_PAYLOAD', 'Invalid payload');
  if (typeof payload.from !== 'string' || !SQUARE_RE.test(payload.from)) {
    throw new AppError('INVALID_MOVE', 'Invalid from-square');
  }
  if (typeof payload.to !== 'string' || !SQUARE_RE.test(payload.to)) {
    throw new AppError('INVALID_MOVE', 'Invalid to-square');
  }
  if (payload.promotion != null && !PROMO_RE.test(payload.promotion)) {
    throw new AppError('INVALID_MOVE', 'Invalid promotion piece');
  }
  if (typeof payload.requestId !== 'string' || payload.requestId.length < 4 || payload.requestId.length > 64) {
    throw new AppError('INVALID_MOVE', 'Missing requestId');
  }
  return {
    from: payload.from,
    to: payload.to,
    promotion: payload.promotion ? payload.promotion.toLowerCase() : undefined,
    requestId: payload.requestId
  };
}

module.exports = {
  validateName, validateRoomCode, validateTimeControl,
  validateCreateRoom, validateJoinRoom, validateReconnect, validateMove
};