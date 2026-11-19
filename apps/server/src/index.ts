import http from 'http';
import express, { Request, Response } from 'express';
import cors from 'cors';
import { Server } from 'socket.io';
import {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData
} from '@climb/shared';
import { CONFIG } from './config';
import { RoomManager } from './rooms/RoomManager';
import { registerSocketHandlers } from './socket/socketHandler';

const app = express();
const httpServer = http.createServer(app);

// Enable CORS and JSON parsing
app.use(
  cors({
    origin: CONFIG.CORS_ORIGIN,
    methods: ['GET', 'POST']
  })
);
app.use(express.json());

const roomManager = RoomManager.getInstance();

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: Date.now(),
    stats: {
      activeRooms: roomManager.getTotalRoomsCount(),
      activePlayers: roomManager.getTotalPlayersCount()
    }
  });
});

// Active rooms query
app.get('/api/rooms', (_req: Request, res: Response) => {
  res.status(200).json({
    rooms: roomManager.getActiveRoomsSummary()
  });
});

// Root welcome
app.get('/', (_req: Request, res: Response) => {
  res.status(200).json({
    name: 'Vertical Climbing Game Server',
    status: 'RUNNING',
    port: CONFIG.PORT
  });
});

// Initialize Socket.io with strict event typing
const io = new Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>(httpServer, {
  cors: {
    origin: CONFIG.CORS_ORIGIN,
    methods: ['GET', 'POST']
  },
  pingInterval: 10000,
  pingTimeout: 5000,
  transports: ['websocket', 'polling']
});

// Register real-time room handlers
registerSocketHandlers(io);

// Start server
httpServer.listen(CONFIG.PORT, () => {
  console.log(`===============================================`);
  console.log(`Climb Game Server running on port ${CONFIG.PORT}`);
  console.log(`WebSocket ready for 2-4 player lobbies`);
  console.log(`Health endpoint: http://localhost:${CONFIG.PORT}/health`);
  console.log(`===============================================`);
});

// Graceful shutdown handling
function handleShutdown(signal: string): void {
  console.log(`Received ${signal}. Shutting down server gracefully...`);
  httpServer.close(() => {
    console.log('HTTP and WebSocket server closed.');
    process.exit(0);
  });

  // Force close if graceful shutdown hangs
  setTimeout(() => {
    console.error('Forceful shutdown triggered after timeout.');
    process.exit(1);
  }, 5000);
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));
