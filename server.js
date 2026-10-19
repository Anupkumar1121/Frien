// ============================================================================
// PHASE 5: NODE.JS + EXPRESS + SOCKET.IO MULTIPLAYER SERVER (server.js)
// Run via terminal: npm init -y && npm install express socket.io && node server.js
// ============================================================================
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(express.static(path.join(__dirname)));

io.on('connection', (socket) => {
  socket.on('chess_move', (payload) => socket.broadcast.emit('chess_move', payload));
  socket.on('match_invite', (payload) => socket.broadcast.emit('match_invite', payload));
  socket.on('chat_message', (payload) => socket.broadcast.emit('chat_message', payload));
  socket.on('music_sync', (payload) => socket.broadcast.emit('music_sync', payload));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`frien. NIT Agartala Server live at http://localhost:${PORT}`);
});