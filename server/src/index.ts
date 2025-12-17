import { Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import express from 'express';
import { createServer } from 'http';
import path from 'path';
import fs from 'fs';
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
const clientPath = path.resolve(__dirname, '../../client/dist');
console.log('📁 Serving static files from:', clientPath);

// Check if client build exists
const indexPath = path.join(clientPath, 'index.html');
const clientExists = fs.existsSync(indexPath);
console.log('📄 Index.html exists:', clientExists, indexPath);

if (clientExists) {
  app.use(express.static(clientPath));

  // SPA fallback - serve index.html for all non-API routes
  app.get('*', (req, res) => {
    res.sendFile(indexPath, (err) => {
      if (err) {
        console.error('Error serving index.html:', err);
        res.status(500).send('Error loading game');
      }
    });
  });
} else {
  console.log('⚠️ Client build not found at', clientPath);
  // Fallback route when no client build
  app.get('/', (_, res) => {
    res.send(`
      <h1>Republica del Vergazo</h1>
      <p>Server is running but client build not found.</p>
      <p>Path checked: ${indexPath}</p>
    `);
  });
}

// Error handler
app.use((err: any, _req: any, res: any, _next: any) => {
  console.error('Express error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

const httpServer = createServer(app);

const gameServer = new Server({
  transport: new WebSocketTransport({ server: httpServer }),
});

// Register game room
gameServer.define('game', GameRoom);

httpServer.listen(port, '0.0.0.0', () => {
  console.log(`🎮 Game server running on port ${port}`);
  console.log(`📡 WebSocket available`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});
