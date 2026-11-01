const roomService = require('../services/roomService');
const validation = require('../middleware/validation');
const rateLimit = require('../middleware/rateLimit');
const logger = require('../utils/logger');
const { AppError } = require('../utils/errors');
const { getEngine } = require('../games');

function sendErr(ack, err) {
  if (typeof ack === 'function') ack({ ok: false, error: err.message, code: err.code || 'ERROR' });
}

function toApp(err, map) {
  if (err.message && map[err.message]) throw new AppError(map[err.message][0], map[err.message][1]);
  throw err;
}

module.exports = function gameHandlers(io, socket) {
  socket.on('room:chat', (payload, ack) => {
    try {
      rateLimit.check(socket, 'room:chat');
      const ctx = roomService.getContext(socket.id);
      if (!ctx) throw new AppError('NOT_IN_ROOM', 'Not in a room');
      if (ctx.room.botSeat) throw new AppError('FORBIDDEN', 'Chat disabled in bot games');
      
      const text = payload && typeof payload.text === 'string' ? payload.text.trim() : '';
      if (!text || text.length > 100) throw new AppError('INVALID_MSG', 'Message must be 1-100 chars');

      let name = 'Unknown';
      if (ctx.seat === 'white') name = ctx.room.players.white.name;
      else if (ctx.seat === 'black') name = ctx.room.players.black.name;
      else if (ctx.seat === 'spectator') name = ctx.room.spectators.get(socket.id).name;

      io.to(ctx.room.code).emit('room:chatMessage', {
        name,
        seat: ctx.seat,
        text,
        time: Date.now()
      });

      if (typeof ack === 'function') ack({ ok: true });
    } catch (err) {
      if (err instanceof AppError) sendErr(ack, err);
      else { logger.error('room:chat failed', err); sendErr(ack, { message: 'Internal error' }); }
    }
  });

  socket.on('game:legalMoves', (payload, ack) => {
    try {
      rateLimit.check(socket, 'game:legalMoves');
      const ctx = roomService.getContext(socket.id);
      if (!ctx) throw new AppError('NOT_IN_ROOM', 'Not in a room');
      const { room, seat } = ctx;
      
      if (room.gameType !== 'chess') return ack({ ok: true, moves: [] });

      if (!payload || typeof payload.from !== 'string' || !/^[a-h][1-8]$/.test(payload.from)) {
        throw new AppError('INVALID_SQUARE', 'Invalid square');
      }
      
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
      const ctx = roomService.getContext(socket.id);
      if (!ctx) throw new AppError('NOT_IN_ROOM', 'Not in a room');
      const { room, seat } = ctx;
      if (seat === 'spectator') throw new AppError('FORBIDDEN', 'Spectators cannot move');
      if (room.game.status !== 'active') throw new AppError('GAME_NOT_ACTIVE', 'Game is not active');

      const engine = getEngine(room.gameType);
      
      let movePayload;
      if (room.gameType === 'chess') {
        movePayload = validation.validateMove(payload);
        if (room.moveRequests.has(movePayload.requestId)) {
          return ack({ ok: true, duplicate: true });
        }
        room.moveRequests.set(movePayload.requestId, Date.now());
        if (room.moveRequests.size > 200) {
          const cutoff = Date.now() - 60_000;
          for (const [k, t] of room.moveRequests) if (t < cutoff) room.moveRequests.delete(k);
        }
      } else if (room.gameType === 'tictactoe') {
        movePayload = { index: parseInt(payload.index, 10) };
        if (isNaN(movePayload.index)) throw new AppError('INVALID_MOVE', 'Invalid index');
      } else if (room.gameType === 'connectfour') {
        movePayload = { column: parseInt(payload.column, 10) };
        if (isNaN(movePayload.column)) throw new AppError('INVALID_MOVE', 'Invalid column');
      } else {
        throw new AppError('INVALID_GAME', 'Unknown game type');
      }

      try {
        engine.applyMove(room, seat, movePayload);
      } catch (e) {
        toApp(e, {
          ILLEGAL_MOVE: ['ILLEGAL_MOVE', 'Illegal move'],
          NOT_YOUR_TURN: ['NOT_YOUR_TURN', 'Not your turn'],
          GAME_NOT_ACTIVE: ['GAME_NOT_ACTIVE', 'Game is not active']
        });
      }

      roomService.broadcastState(io, room);
      if (typeof ack === 'function') ack({ ok: true });

      if (room.botSeat && room.game.status === 'active') {
        require('../services/botService').makeMove(io, room);
      }
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
      
      const engine = getEngine(ctx.room.gameType);
      try {
        engine.resign(ctx.room, ctx.seat);
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
      if (ctx.room.botSeat) throw new AppError('FORBIDDEN', 'Cannot offer draw to bot');
      
      const engine = getEngine(ctx.room.gameType);
      try {
        engine.offerDraw(ctx.room, ctx.seat);
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
      else sendErr(ack, { message: 'Internal error' });
    }
  });

  socket.on('game:respondDraw', (payload, ack) => {
    try {
      rateLimit.check(socket, 'default');
      const accept = payload && payload.accept === true;
      const ctx = roomService.getContext(socket.id);
      if (!ctx) throw new AppError('NOT_IN_ROOM', 'Not in a room');
      if (ctx.seat === 'spectator') throw new AppError('FORBIDDEN', 'Spectators cannot respond');
      
      const engine = getEngine(ctx.room.gameType);
      try {
        engine.respondDraw(ctx.room, ctx.seat, accept);
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
      else sendErr(ack, { message: 'Internal error' });
    }
  });

  socket.on('game:claimDraw', (_, ack) => {
    try {
      rateLimit.check(socket, 'default');
      const ctx = roomService.getContext(socket.id);
      if (!ctx) throw new AppError('NOT_IN_ROOM', 'Not in a room');
      if (ctx.seat === 'spectator') throw new AppError('FORBIDDEN', 'Spectators cannot claim');

      const engine = getEngine(ctx.room.gameType);
      let claimed;
      try {
        if (!engine.claimDraw) throw new Error('NO_CLAIM');
        claimed = engine.claimDraw(ctx.room, ctx.seat);
      } catch (e) {
        toApp(e, { GAME_NOT_ACTIVE: ['GAME_NOT_ACTIVE', 'Game is not active'] });
      }
      if (!claimed) throw new AppError('NO_CLAIM', 'No valid draw claim available');

      roomService.broadcastState(io, ctx.room);
      if (typeof ack === 'function') ack({ ok: true });
    } catch (err) {
      if (err instanceof AppError) sendErr(ack, err);
      else sendErr(ack, { message: 'Internal error' });
    }
  });

  socket.on('game:rematch', (_, ack) => {
    try {
      rateLimit.check(socket, 'game:rematch');
      const ctx = roomService.getContext(socket.id);
      if (!ctx) throw new AppError('NOT_IN_ROOM', 'Not in a room');
      if (ctx.seat === 'spectator') throw new AppError('FORBIDDEN', 'Spectators cannot rematch');
      if (ctx.room.botSeat) {
        roomService.resetForRematch(ctx.room);
        roomService.broadcastState(io, ctx.room);
        return ack({ ok: true, bothReady: true });
      }

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