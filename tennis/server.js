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
      rooms.set(code, { tv: ws, players: new Map(), n: 0, mode: message.mode || 'ai' });
      return;
    }

    if (message.type === 'join') {
      const code = String(message.code).toUpperCase();
      const room = rooms.get(code);
      if (!room || !room.tv || room.tv.readyState !== WebSocket.OPEN) {
        send(ws, { type: 'error', reason: 'Room not found or TV is disconnected' });
        return;
      }

      // Assign player 1 or 2
      let playerSlot = 1;
      if (room.players.has(1) && room.players.get(1).readyState === WebSocket.OPEN) {
        if (room.mode === 'pvp') {
          playerSlot = 2;
        } else {
          // In AI mode, replace stale slot 1
          const oldP1 = room.players.get(1);
          if (oldP1 && oldP1 !== ws) {
            try { oldP1.close(); } catch (_) {}
          }
          playerSlot = 1;
        }
      }

      ws.roomCode = code;
      ws.player = playerSlot;
      room.players.set(playerSlot, ws);
      const joined = { type: 'joined', player: ws.player, code: code, mode: room.mode };
      send(ws, joined);
      send(room.tv, joined);
      return;
    }

    if (message.type === 'set_name' && Number.isFinite(ws.player) && ws.roomCode) {
      const room = rooms.get(ws.roomCode);
      if (!room || !room.tv || room.tv.readyState !== WebSocket.OPEN) return;
      const cleanName = String(message.name || '').trim().slice(0, 20) || `Player ${ws.player}`;
      ws.playerName = cleanName;
      send(room.tv, {
        type: 'player_name',
        player: ws.player,
        name: cleanName
      });
      send(ws, {
        type: 'player_name',
        player: ws.player,
        name: cleanName
      });
      return;
    }

    if (message.type === 'ready' && Number.isFinite(ws.player) && ws.roomCode) {
      const room = rooms.get(ws.roomCode);
      if (!room || !room.tv || room.tv.readyState !== WebSocket.OPEN) return;
      ws.isReady = true;
      send(room.tv, {
        type: 'player_ready',
        player: ws.player,
        name: ws.playerName || message.name || `Player ${ws.player}`
      });
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
      return;
    }

    // Messages from TV (e.g. report, restart, mode_change) broadcast to all connected players
    if (ws.roomCode) {
      const room = rooms.get(ws.roomCode);
      if (room && room.tv === ws) {
        if (message.type === 'set_mode') {
          room.mode = message.mode;
        }
        for (const playerWs of room.players.values()) {
          send(playerWs, message);
        }
      }
    }
  });

  ws.on('close', () => {
    if (ws.roomCode) {
      const room = rooms.get(ws.roomCode);
      if (room) {
        if (room.tv === ws) {
          for (const playerWs of room.players.values()) {
            send(playerWs, { type: 'error', reason: 'TV Host disconnected' });
          }
          rooms.delete(ws.roomCode);
        } else if (ws.player) {
          room.players.delete(ws.player);
          send(room.tv, { type: 'player_left', player: ws.player });
        }
      }
    }
  });
});

const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log(`Tennis relay listening on port ${port}`);
});
