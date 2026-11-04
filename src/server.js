import http from 'http';
import app from './app.js';
import { env } from './config/env.js';
import { database } from './config/database.js';
import { initSocket } from './config/socket.js';

let server;

async function startServer() {
  try {
    // Initialize Database
    await database.connect();

    // Start HTTP Server with Socket.io
    const httpServer = http.createServer(app);
    initSocket(httpServer);

    server = httpServer.listen(env.PORT, () => {
      console.log(`======================================================`);
      console.log(`Server is running in ${env.NODE_ENV} mode`);
      console.log(`URL: http://localhost:${env.PORT}`);
      console.log(`WebSocket: ws://localhost:${env.PORT}`);
      console.log(`Health Check: http://localhost:${env.PORT}/api/health`);
      console.log(`======================================================`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful Shutdown handling
const handleGracefulShutdown = async (signal) => {
  console.log(`\n[Server] Received ${signal}. Starting graceful shutdown...`);

  if (server) {
    server.close(async () => {
      console.log('[Server] HTTP server closed.');
      await database.disconnect();
      console.log('[Server] Process terminating cleanly.');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
};

process.on('SIGINT', () => handleGracefulShutdown('SIGINT'));
process.on('SIGTERM', () => handleGracefulShutdown('SIGTERM'));

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Process] Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('[Process] Uncaught Exception:', error);
  process.exit(1);
});

startServer();
