let socket = null;

export function connect() {
  if (socket) return socket;
  socket = window.io({
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 800,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: Infinity
  });
  return socket;
}

export function getSocket() {
  if (!socket) connect();
  return socket;
}