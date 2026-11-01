const crypto = require('crypto');

const ROOM_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O/1/I/L

function generateRoomCode() {
  const bytes = crypto.randomBytes(5);
  let out = '';
  for (let i = 0; i < 5; i++) out += ROOM_ALPHABET[bytes[i] % ROOM_ALPHABET.length];
  return out;
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

module.exports = { generateRoomCode, generateToken, hashToken };