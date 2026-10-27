import { PrismaClient } from '@prisma/client';
import { config } from '../config';

export const prisma = new PrismaClient({
  log: config.nodeEnv === 'development' ? ['warn', 'error'] : ['error'],
  datasources: config.databaseUrl
    ? { db: { url: config.databaseUrl } }
    : undefined
});
