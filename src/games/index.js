const chess = require('./chess');
const tictactoe = require('./tictactoe');

const engines = { chess, tictactoe };

function getEngine(gameType) {
  return engines[gameType] || engines.chess;
}

module.exports = { getEngine };