import { app } from './app';
import { config } from './config';
import { logger } from './core/logger';
import { prisma } from './core/prisma';

async function bootstrap() {
  try {
    if (!process.env.DATABASE_URL) {
      throw new Error('FATAL: DATABASE_URL environment variable is not defined. Please configure DATABASE_URL in your Render Web Service environment variables.');
    }

    await prisma.$connect();
    logger.info('Database connected successfully.');

    const port = process.env.PORT || 5000;

    const server = app.listen(Number(port), '0.0.0.0', () => {
      console.log(`Server listening on port ${port}`);
      logger.info(`Tailor Management System Backend running on 0.0.0.0:${port} [NODE_ENV=${config.nodeEnv}]`);
      logger.info(`Health check available at /health and /api/v1/health`);
    });

    // Configure connection timeouts for high-concurrency reverse proxy stability (Nginx/ALB)
    server.keepAliveTimeout = 65000;
    server.headersTimeout = 66000;

    const shutdown = async () => {
      logger.info('Shutting down server gracefully...');
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
    logger.error('Failed to start server:', err);
    process.exit(1);
  }
}

bootstrap();
