import { Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import express from 'express';
import { createServer } from 'http';
import path from 'path';
import { GameRoom } from './rooms/GameRoom';

const port = Number(process.env.PORT) || 3001;

const app = express();
app.use(express.json());

// CORS for cross-origin requests
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Health check endpoint
app.get('/health', (_, res) => {
  res.json({ status: 'ok' });
});

// Serve static client files in production
const clientPath = path.join(__dirname, '../../client/dist');
app.use(express.static(clientPath));

// SPA fallback - serve index.html for all non-API routes
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/colyseus') || req.path === '/health') {
    return next();
  }
  res.sendFile(path.join(clientPath, 'index.html'));
});

const httpServer = createServer(app);

const gameServer = new Server({
  transport: new WebSocketTransport({ server: httpServer }),
});

// Register game room
gameServer.define('game', GameRoom);

httpServer.listen(port, () => {
  console.log(`🎮 Game server running on http://localhost:${port}`);
  console.log(`📡 WebSocket available at ws://localhost:${port}`);
});
