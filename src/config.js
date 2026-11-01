require('dotenv').config();

module.exports = {
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || '0.0.0.0',
  origin: process.env.ALLOWED_ORIGINS === '*' || !process.env.ALLOWED_ORIGINS
    ? true
    : process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim()).filter(Boolean),
  nodeEnv: process.env.NODE_ENV || 'development',
  roomGraceMs: 60 * 1000,
  emptyRoomTtlMs: 5 * 60 * 1000,
  allowedTimeControls: [180, 300, 600, 0],
  allowedIncrements: [0, 2, 5],
  defaultTimeControl: { initial: 600, increment: 0 }
};