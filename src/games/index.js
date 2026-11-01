const chess = require('./chess');
const tictactoe = require('./tictactoe');
const connectfour = require('./connectfour');

const engines = { chess, tictactoe, connectfour };

function getEngine(gameType) {
  return engines[gameType] || engines.chess;
}

module.exports = { getEngine };