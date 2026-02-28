import dotenv from 'dotenv';
import path from 'path';

// Load environment variables before anything else
const envFile = process.env.NODE_ENV === 'test' ? '.env.test' : '.env';
dotenv.config({ path: path.resolve(__dirname, '../', envFile) });

import { createServer } from 'http';
import app from './app';
import { getDb } from './config/database';
import { connectRedis, closeRedis, closeRedisSubscriber } from './config/redis';
import { initializeWebSocket } from './modules/websocket/index';
import { initBidCloseScheduler } from './modules/scheduler/bid-close.scheduler';
import { initBidOpenScheduler } from './modules/scheduler/bid-open.scheduler';
import { logger } from './config/logger';

const PORT = parseInt(process.env.PORT || '3000', 10);

async function start(): Promise<void> {
  try {
    // Test database connection
    const db = getDb();
    await db.raw('SELECT 1');
    logger.info('Database connection established');

    // Connect to Redis
    await connectRedis();
    logger.info('Redis connection established');

    // Create HTTP server from Express app
    const httpServer = createServer(app);

    // Initialize WebSocket (Socket.io) on the HTTP server
    initializeWebSocket(httpServer);
    logger.info('WebSocket server initialized');

    // Initialize bid close scheduler (cron)
    initBidCloseScheduler();

    // Initialize bid open scheduler (cron)
    initBidOpenScheduler();

    // Start server
    httpServer.listen(PORT, () => {
      logger.info(`Server started on port ${PORT}`, {
        environment: process.env.NODE_ENV,
        port: PORT,
      });
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`${signal} received. Starting graceful shutdown...`);

      httpServer.close(async () => {
        logger.info('HTTP server closed');

        try {
          await db.destroy();
          logger.info('Database connection closed');

          await closeRedis();
          logger.info('Redis connection closed');

          await closeRedisSubscriber();
          logger.info('Redis subscriber connection closed');

          process.exit(0);
        } catch (err) {
          logger.error('Error during shutdown', { error: err });
          process.exit(1);
        }
      });

      // Force close after 10 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (err) {
    logger.error('Failed to start server', { error: err });
    process.exit(1);
  }
}

start();
