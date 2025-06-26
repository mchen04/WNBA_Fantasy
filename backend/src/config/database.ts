import { PrismaClient } from '@prisma/client';
import { config } from './env';
import { logger } from '../utils/logger';

// Create a single instance of Prisma Client
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: config.isDevelopment
      ? ['query', 'error', 'warn']
      : ['error'],
    errorFormat: 'pretty',
  });

if (config.env !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Log database queries in development
if (config.isDevelopment) {
  prisma.$use(async (params: any, next: any) => {
    const before = Date.now();
    const result = await next(params);
    const after = Date.now();
    
    logger.debug(`Query ${params.model}.${params.action} took ${after - before}ms`);
    
    return result;
  });
}

// Handle connection errors
prisma.$connect().catch((error: any) => {
  logger.error('Failed to connect to database:', error);
  process.exit(1);
});