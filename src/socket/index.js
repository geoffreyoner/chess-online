const roomHandlers = require('./roomHandlers');
const gameHandlers = require('./gameHandlers');

module.exports = function setupSocket(io) {
  io.on('connection', (socket) => {
    socket.data.rl = {};
    roomHandlers(io, socket);
    gameHandlers(io, socket);
  });
};