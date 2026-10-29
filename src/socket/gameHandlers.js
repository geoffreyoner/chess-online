const roomService = require('../services/roomService');
const gameService = require('../services/gameService');
const validation = require('../middleware/validation');
const rateLimit = require('../middleware/rateLimit');
const logger = require('../utils/logger');
const { AppError } = require('../utils/errors');

function sendErr(ack, err) {
  if (typeof ack === 'function') ack({ ok: false, error: err.message, code: err.code || 'ERROR' });
}

function toApp(err, map) {
  if (err.message && map[err.message]) throw new AppError(map[err.message][0], map[err.message][1]);
  throw err;
}

module.exports = function gameHandlers(io, socket) {
  socket.on('game:legalMoves', (payload, ack) => {
    try {
      rateLimit.check(socket, 'game:legalMoves');
      if (!payload || typeof payload.from !== 'string' || !/^[a-h][1-8]$/.test(payload.from)) {
        throw new AppError('INVALID_SQUARE', 'Invalid square');
      }
      const ctx = roomService.getContext(socket.id);
      if (!ctx) throw new AppError('NOT_IN_ROOM', 'Not in a room');
      const { room, seat } = ctx;
      if (seat === 'spectator' || room.game.status !== 'active') {
        return ack({ ok: true, moves: [] });
      }
      const myColor = seat === 'white' ? 'w' : 'b';
      if (room.game.chess.turn() !== myColor) return ack({ ok: true, moves: [] });
      const moves = room.game.chess.moves({ square: payload.from, verbose: true });
      ack({ ok: true, moves: moves.map(m => m.to) });
    } catch (err) {
      if (err instanceof AppError) sendErr(ack, err);
      else sendErr(ack, { message: 'Internal error' });
    }
  });

  socket.on('game:move', (payload, ack) => {
    try {
      rateLimit.check(socket, 'game:move');
      const move = validation.validateMove(payload);
      const ctx = roomService.getContext(socket.id);
      if (!ctx) throw new AppError('NOT_IN_ROOM', 'Not in a room');
      const { room, seat } = ctx;
      if (seat === 'spectator') throw new AppError('FORBIDDEN', 'Spectators cannot move');
      if (room.game.status !== 'active') throw new AppError('GAME_NOT_ACTIVE', 'Game is not active');

      if (room.moveRequests.has(move.requestId)) {
        return ack({ ok: true, duplicate: true });
      }
      room.moveRequests.set(move.requestId, Date.now());
      if (room.moveRequests.size > 200) {
        const cutoff = Date.now() - 60_000;
        for (const [k, t] of room.moveRequests) if (t < cutoff) room.moveRequests.delete(k);
      }

      try {
        gameService.applyMove(room, seat, move);
      } catch (e) {
        toApp(e, {
          ILLEGAL_MOVE: ['ILLEGAL_MOVE', 'Illegal move'],
          NOT_YOUR_TURN: ['NOT_YOUR_TURN', 'Not your turn'],
          GAME_NOT_ACTIVE: ['GAME_NOT_ACTIVE', 'Game is not active']
        });
      }

      roomService.broadcastState(io, room);
      ack({ ok: true });
    } catch (err) {
      if (err instanceof AppError) sendErr(ack, err);
      else { logger.error('game:move failed', err); sendErr(ack, { message: 'Internal error' }); }
    }
  });

  socket.on('game:resign', (_, ack) => {
    try {
      rateLimit.check(socket, 'game:resign');
      const ctx = roomService.getContext(socket.id);
      if (!ctx) throw new AppError('NOT_IN_ROOM', 'Not in a room');
      if (ctx.seat === 'spectator') throw new AppError('FORBIDDEN', 'Spectators cannot resign');
      try {
        gameService.resign(ctx.room, ctx.seat);
      } catch (e) {
        toApp(e, { GAME_NOT_ACTIVE: ['GAME_NOT_ACTIVE', 'Game is not active'] });
      }
      roomService.broadcastState(io, ctx.room);
      if (typeof ack === 'function') ack({ ok: true });
    } catch (err) {
      if (err instanceof AppError) sendErr(ack, err);
      else { logger.error('game:resign failed', err); sendErr(ack, { message: 'Internal error' }); }
    }
  });

  socket.on('game:offerDraw', (_, ack) => {
    try {
      rateLimit.check(socket, 'game:offerDraw');
      const ctx = roomService.getContext(socket.id);
      if (!ctx) throw new AppError('NOT_IN_ROOM', 'Not in a room');
      if (ctx.seat === 'spectator') throw new AppError('FORBIDDEN', 'Spectators cannot offer a draw');
      try {
        gameService.offerDraw(ctx.room, ctx.seat);
      } catch (e) {
        toApp(e, { GAME_NOT_ACTIVE: ['GAME_NOT_ACTIVE', 'Game is not active'] });
      }
      roomService.broadcastState(io, ctx.room);
      const opponentSeat = ctx.seat === 'white' ? 'black' : 'white';
      const opp = ctx.room.players[opponentSeat];
      if (opp && opp.socketId) {
        const s = io.sockets.sockets.get(opp.socketId);
        if (s) s.emit('game:drawOffered', { by: ctx.seat });
      }
      if (typeof ack === 'function') ack({ ok: true });
    } catch (err) {
      if (err instanceof AppError) sendErr(ack, err);
      else { logger.error('game:offerDraw failed', err); sendErr(ack, { message: 'Internal error' }); }
    }
  });

  socket.on('game:respondDraw', (payload, ack) => {
    try {
      rateLimit.check(socket, 'default');
      const accept = payload && payload.accept === true;
      const ctx = roomService.getContext(socket.id);
      if (!ctx) throw new AppError('NOT_IN_ROOM', 'Not in a room');
      if (ctx.seat === 'spectator') throw new AppError('FORBIDDEN', 'Spectators cannot respond');
      try {
        gameService.respondDraw(ctx.room, ctx.seat, accept);
      } catch (e) {
        toApp(e, {
          NO_DRAW_OFFER: ['NO_DRAW_OFFER', 'No draw offer pending'],
          CANNOT_RESPOND_TO_OWN_OFFER: ['FORBIDDEN', 'Cannot respond to your own offer']
        });
      }
      roomService.broadcastState(io, ctx.room);
      if (typeof ack === 'function') ack({ ok: true });
    } catch (err) {
      if (err instanceof AppError) sendErr(ack, err);
      else { logger.error('game:respondDraw failed', err); sendErr(ack, { message: 'Internal error' }); }
    }
  });

  socket.on('game:claimDraw', (_, ack) => {
    try {
      rateLimit.check(socket, 'default');
      const ctx = roomService.getContext(socket.id);
      if (!ctx) throw new AppError('NOT_IN_ROOM', 'Not in a room');
      if (ctx.seat === 'spectator') throw new AppError('FORBIDDEN', 'Spectators cannot claim');

      let claimed;
      try {
        claimed = gameService.claimDraw(ctx.room, ctx.seat);
      } catch (e) {
        toApp(e, { GAME_NOT_ACTIVE: ['GAME_NOT_ACTIVE', 'Game is not active'] });
      }
      if (!claimed) throw new AppError('NO_CLAIM', 'No valid draw claim available');

      roomService.broadcastState(io, ctx.room);
      if (typeof ack === 'function') ack({ ok: true });
    } catch (err) {
      if (err instanceof AppError) sendErr(ack, err);
      else { logger.error('game:claimDraw failed', err); sendErr(ack, { message: 'Internal error' }); }
    }
  });

  socket.on('game:rematch', (_, ack) => {
    try {
      rateLimit.check(socket, 'game:rematch');
      const ctx = roomService.getContext(socket.id);
      if (!ctx) throw new AppError('NOT_IN_ROOM', 'Not in a room');
      if (ctx.seat === 'spectator') throw new AppError('FORBIDDEN', 'Spectators cannot rematch');
      const bothReady = roomService.voteRematch(ctx.room, ctx.seat);
      if (bothReady) {
        roomService.resetForRematch(ctx.room);
      }
      roomService.broadcastState(io, ctx.room);
      if (typeof ack === 'function') ack({ ok: true, bothReady });
    } catch (err) {
      if (err instanceof AppError) sendErr(ack, err);
      else { logger.error('game:rematch failed', err); sendErr(ack, { message: 'Internal error' }); }
    }
  });

  socket.on('game:declineRematch', (_, ack) => {
    try {
      rateLimit.check(socket, 'default');
      const ctx = roomService.getContext(socket.id);
      if (!ctx) throw new AppError('NOT_IN_ROOM', 'Not in a room');
      roomService.declineRematch(ctx.room, ctx.seat);
      roomService.broadcastState(io, ctx.room);
      if (typeof ack === 'function') ack({ ok: true });
    } catch (err) {
      if (err instanceof AppError) sendErr(ack, err);
      else { logger.error('game:declineRematch failed', err); sendErr(ack, { message: 'Internal error' }); }
    }
  });
};