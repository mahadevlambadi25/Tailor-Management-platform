import { app } from './app';
import { config } from './config';
import { logger } from './core/logger';
import { prisma } from './core/prisma';
import { NudgeScheduler } from './modules/conversion/nudgeScheduler';

async function bootstrap() {
  try {
    if (!process.env.DATABASE_URL) {
      throw new Error('FATAL: DATABASE_URL environment variable is not defined. Please configure DATABASE_URL in your Render Web Service environment variables.');
    }

    logger.info('Connecting to PostgreSQL database...');
    await prisma.$connect();

    // Verify database responsiveness with a lightweight test query
    await prisma.$queryRaw`SELECT 1`;
    logger.info('Database connectivity and query execution verified successfully.');

    // Start conversion trial nudge scheduler (if enabled)
    NudgeScheduler.start();

    const port = process.env.PORT || 5000;

    const server = app.listen(Number(port), '0.0.0.0', () => {
      console.log(`Server listening on port ${port}`);
      logger.info(`Tailor Management System Backend running on 0.0.0.0:${port} [NODE_ENV=${config.nodeEnv}]`);
      logger.info(`Health check available at /health and /api/v1/health`);
    });

    // Configure connection timeouts for high-concurrency reverse proxy stability (Nginx/ALB/Render)
    server.keepAliveTimeout = 65000;
    server.headersTimeout = 66000;

    const shutdown = async () => {
      logger.info('Shutting down server gracefully...');
      NudgeScheduler.stop();
      server.close(async () => {
        await prisma.$disconnect();
        logger.info('Process terminated.');
        process.exit(0);
      });
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

    process.on('unhandledRejection', (reason: any) => {
      logger.error('Unhandled Promise Rejection at process level:', reason);
    });

    process.on('uncaughtException', (err: Error) => {
      logger.error('Uncaught Exception at process level:', err);
    });
  } catch (err: any) {
    logger.error('Failed to start server:', err?.message || err);
    if (err?.code === 'P1001') {
      logger.error('Diagnostic Note: Prisma P1001 means the database server cannot be reached. For Supabase on Render, use the connection pooler hostname (e.g. aws-0-[region].pooler.supabase.com) on port 6543 (transaction) or 5432 (session) rather than direct db.[ref].supabase.co (which resolves to IPv6 only).');
    }
    process.exit(1);
  }
}

bootstrap();
