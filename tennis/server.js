const path = require('path');
const express = require('express');
const http = require('http');
const { WebSocketServer, WebSocket } = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const rooms = new Map();

app.use(express.static(path.join(__dirname, 'public')));

function send(ws, message) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

wss.on('connection', (ws) => {
  ws.on('message', (data) => {
    let message;
    try {
      message = JSON.parse(data.toString());
    } catch (_error) {
      return;
    }

    if (!message || typeof message !== 'object') return;

    if (message.type === 'host') {
      const code = String(message.code).toUpperCase();
      const oldRoom = rooms.get(ws.roomCode);
      if (oldRoom && oldRoom.tv === ws) rooms.delete(ws.roomCode);
      const previous = rooms.get(code);
      if (previous && previous.tv !== ws) previous.tv.close();
      ws.roomCode = code;
      rooms.set(code, { tv: ws, n: 0 });
      return;
    }

    if (message.type === 'join') {
      const code = String(message.code).toUpperCase();
      const room = rooms.get(code);
      if (!room || room.tv.readyState !== WebSocket.OPEN) {
        send(ws, { type: 'error' });
        return;
      }

      room.n += 1;
      ws.roomCode = code;
      ws.player = room.n;
      const joined = { type: 'joined', player: ws.player };
      send(ws, joined);
      send(room.tv, joined);
      return;
    }

    if (message.type === 'swing' && Number.isFinite(ws.player) && ws.roomCode) {
      const room = rooms.get(ws.roomCode);
      if (!room || room.tv.readyState !== WebSocket.OPEN) return;
      send(room.tv, {
        type: 'swing',
        power: message.power,
        dir: message.dir,
        player: ws.player,
      });
    }
  });

  ws.on('close', () => {
    if (ws.roomCode && rooms.get(ws.roomCode)?.tv === ws) {
      rooms.delete(ws.roomCode);
    }
  });
});

const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log(`Tennis relay listening on port ${port}`);
});
