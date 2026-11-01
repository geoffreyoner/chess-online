const roomService = require('../services/roomService');
const validation = require('../middleware/validation');
const rateLimit = require('../middleware/rateLimit');
const logger = require('../utils/logger');
const { AppError } = require('../utils/errors');
const { getEngine } = require('../games');

function sendErr(ack, err) {
  if (typeof ack === 'function') ack({ ok: false, error: err.message, code: err.code || 'ERROR' });
}

module.exports = function roomHandlers(io, socket) {
  socket.on('room:create', (payload, ack) => {
    try {
      rateLimit.check(socket, 'room:create');
      const { name, timeControl, gameType, vsBot } = validation.validateCreateRoom(payload);
      const { room, token } = roomService.createRoom({ name, timeControl, gameType, vsBot, socketId: socket.id });      
      socket.join(room.code);
      roomService.broadcastState(io, room);
      if (typeof ack === 'function') {
        ack({ ok: true, roomCode: room.code, token, seat: 'white', gameType: room.gameType });
      }
    } catch (err) {
      if (err instanceof AppError) sendErr(ack, err);
      else { logger.error('room:create failed', err); sendErr(ack, { message: 'Internal error' }); }
    }
  });

  socket.on('room:join', (payload, ack) => {
    try {
      rateLimit.check(socket, 'room:join');
      const { name, roomCode } = validation.validateJoinRoom(payload);
      const { room, token, seat } = roomService.joinRoom({ name, roomCode, socketId: socket.id });
      socket.join(room.code);
      
      io.to(room.code).emit('room:sysMessage', `${name} joined as ${seat}.`);
      
      roomService.broadcastState(io, room);
      ack({ ok: true, roomCode: room.code, token, seat });
    } catch (err) {
      if (err instanceof AppError) sendErr(ack, err);
      else { logger.error('room:join failed', err); sendErr(ack, { message: 'Internal error' }); }
    }
  });

  socket.on('room:reconnect', (payload, ack) => {
    try {
      rateLimit.check(socket, 'room:reconnect');
      const { roomCode, token } = validation.validateReconnect(payload);
      const { room, seat } = roomService.reconnect({ roomCode, token, socketId: socket.id });
      socket.join(room.code);
      
      const player = seat === 'white' ? room.players.white : room.players.black;
      if (player) io.to(room.code).emit('room:sysMessage', `${player.name} reconnected.`);

      roomService.broadcastState(io, room);
      ack({ ok: true, seat, snapshot: roomService.buildSnapshot(room, seat) });
    } catch (err) {
      if (err instanceof AppError) sendErr(ack, err);
      else { logger.error('room:reconnect failed', err); sendErr(ack, { message: 'Internal error' }); }
    }
  });

  socket.on('room:leave', (_, ack) => {
    try {
      const ctx = roomService.getContext(socket.id);
      if (ctx) {
        if ((ctx.seat === 'white' || ctx.seat === 'black') && ctx.room.game.status === 'active') {
          const engine = getEngine(ctx.room.gameType);
          engine.endGame(ctx.room, {
            winner: ctx.seat === 'white' ? 'b' : 'w',
            reason: 'abandonment'
          });
        }
        socket.leave(ctx.room.code);
        roomService.removeFromRoom(socket.id);
        roomService.broadcastState(io, ctx.room);
      }
      if (typeof ack === 'function') ack({ ok: true });
    } catch (err) {
      logger.error('room:leave failed', err);
      if (typeof ack === 'function') ack({ ok: false, error: 'Internal error' });
    }
  });

  socket.on('disconnect', () => {
    const result = roomService.removeSocket(socket.id);
    if (result && result.room) {
      roomService.broadcastState(io, result.room);
    }
  });
};