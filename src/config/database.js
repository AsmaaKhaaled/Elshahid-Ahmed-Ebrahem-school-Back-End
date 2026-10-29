import { PrismaClient } from '@prisma/client';
import { env } from './env.js';

export const prisma = new PrismaClient({
  log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

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
    } catch (error) {
      console.error('[Database] Neon PostgreSQL connection failed:', error.message);
      this.isConnected = false;
      throw error;
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
