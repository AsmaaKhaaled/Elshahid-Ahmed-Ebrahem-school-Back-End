import { PrismaClient } from '@prisma/client';
import { env } from './env.js';

// Neon suspends an idle database; waking it can take longer than Prisma's default 10s wait for a connection
const POOL_TIMEOUT_SECONDS = 30;

const withPoolTimeout = (url) =>
  !url || /[?&]pool_timeout=/.test(url) ? url : `${url}${url.includes('?') ? '&' : '?'}pool_timeout=${POOL_TIMEOUT_SECONDS}`;

export const prisma = new PrismaClient({
  datasourceUrl: withPoolTimeout(env.DATABASE_URL_POOLED),
  log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

// Enough for a page's first burst of requests; Prisma's default pool holds (physical CPU cores × 2 + 1)
const WARM_CONNECTIONS = 5;

class Database {
  constructor() {
    this.isConnected = false;
  }

  async connect() {
    try {
      console.log('[Database] Connecting to Neon PostgreSQL via Prisma...');
      await prisma.$connect();
      this.isConnected = true;
      console.log('[Database] Neon PostgreSQL connected successfully.');
      await this.warmUp();
    } catch (error) {
      console.error('[Database] Neon PostgreSQL connection failed:', error.message);
      this.isConnected = false;
      throw error;
    }
  }

  /**
   * Opens several pool connections up front. Each new connection to Neon costs ~0.7s (TLS + auth),
   * which the first page load (several requests, each with parallel queries) would otherwise pay.
   */
  async warmUp(connections = WARM_CONNECTIONS) {
    try {
      await Promise.all(Array.from({ length: connections }, () => prisma.$queryRaw`SELECT 1`));
    } catch (error) {
      console.warn('[Database] Connection warm-up failed:', error.message);
    }
  }

  async disconnect() {
    if (this.isConnected) {
      console.log('[Database] Disconnecting from database...');
      await prisma.$disconnect();
      this.isConnected = false;
      console.log('[Database] Disconnected successfully.');
    }
  }
}

export const database = new Database();
export default database;
