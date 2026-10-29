const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const threshold = LEVELS[process.env.LOG_LEVEL || 'info'] || 20;

function log(level, ...args) {
  if ((LEVELS[level] || 0) < threshold) return;
  const ts = new Date().toISOString();
  const method = level === 'debug' ? 'log' : level;
  console[method](`[${ts}] [${level.toUpperCase()}]`, ...args);
}

module.exports = {
  debug: (...a) => log('debug', ...a),
  info: (...a) => log('info', ...a),
  warn: (...a) => log('warn', ...a),
  error: (...a) => log('error', ...a)
};