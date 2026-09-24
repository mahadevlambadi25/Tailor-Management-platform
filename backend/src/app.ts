import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { config } from './config';
import { errorHandler } from './middleware/errorHandler';

// Route Imports
import authRoutes from './modules/auth/authRoutes';
import tenantsRoutes from './modules/tenants/tenantsRoutes';
import subscriptionsRoutes from './modules/subscriptions/subscriptionsRoutes';
import branchesRoutes from './modules/branches/branchesRoutes';
import usersRoutes from './modules/users/usersRoutes';
import customersRoutes from './modules/customers/customersRoutes';
import garmentsRoutes from './modules/garments/garmentsRoutes';
import measurementsRoutes from './modules/measurements/measurementsRoutes';
import stylesRoutes from './modules/styles/stylesRoutes';
import ordersRoutes from './modules/orders/ordersRoutes';
import paymentsRoutes from './modules/payments/paymentsRoutes';
import productionRoutes from './modules/production/productionRoutes';
import trialsRoutes from './modules/trials/trialsRoutes';
import alterationsRoutes from './modules/alterations/alterationsRoutes';
import appointmentsRoutes from './modules/appointments/appointmentsRoutes';
import reportsRoutes from './modules/reports/reportsRoutes';
import documentsRoutes from './modules/documents/documentsRoutes';
import customerPortalRoutes from './modules/customer-portal/customerPortalRoutes';
import importExportRoutes from './modules/import-export/importExportRoutes';

export const app = express();

// Global Middleware
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// Parse allowed CORS origins (support comma-separated list and strip trailing slashes)
const allowedOrigins = (config.corsOrigin || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim().replace(/\/+$/, ''))
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. mobile apps, curl, Render health checks)
    if (!origin) {
      return callback(null, true);
    }

    // In development mode, allow all origins
    if (config.nodeEnv !== 'production') {
      return callback(null, true);
    }

    // In production, match normalized origin against allowed origins list or wildcard
    const normalizedOrigin = origin.replace(/\/+$/, '');
    if (allowedOrigins.includes(normalizedOrigin) || allowedOrigins.includes('*')) {
      return callback(null, true);
    }

    return callback(new Error(`Origin ${origin} not allowed by CORS`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-tenant-slug', 'Accept']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static local storage provider route
app.use('/api/v1/storage', express.static(path.resolve(config.storageLocalDir)));

// System Health Checks (supporting Render root/health probes as well as API path)
const healthHandler = (req: express.Request, res: express.Response) => {
  res.status(200).json({
    status: 'ok',
    version: '1.0.0',
    system: 'Tailor Management System V1 SaaS',
    environment: config.nodeEnv,
    timestamp: new Date().toISOString()
  });
};

app.get('/health', healthHandler);
app.get('/api/v1/health', healthHandler);
app.get('/', healthHandler);

// Mount /api/v1/ Domain Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/auth', authRoutes);
app.use('/auth', authRoutes);
app.use('/api/v1/tenants', tenantsRoutes);
app.use('/api/v1/subscriptions', subscriptionsRoutes);
app.use('/api/v1/branches', branchesRoutes);
app.use('/api/v1/users', usersRoutes);
app.use('/api/v1/staff', usersRoutes);
app.use('/api/v1/customers', customersRoutes);
app.use('/api/v1/garments', garmentsRoutes);
app.use('/api/v1/measurements', measurementsRoutes);
app.use('/api/v1/styles', stylesRoutes);
app.use('/api/v1/orders', ordersRoutes);
app.use('/api/v1/payments', paymentsRoutes);
app.use('/api/v1/production', productionRoutes);
app.use('/api/v1/trials', trialsRoutes);
app.use('/api/v1/alterations', alterationsRoutes);
app.use('/api/v1/appointments', appointmentsRoutes);
app.use('/api/v1/reports', reportsRoutes);
app.use('/api/v1/documents', documentsRoutes);
app.use('/api/v1/portal', customerPortalRoutes);
app.use('/api/v1/customer-portal', customerPortalRoutes);
app.use('/api/v1/import-export', importExportRoutes);

// Catch-all 404 Handler for Unmatched Routes
app.use((req: express.Request, res: express.Response) => {
  res.status(404).json({
    success: false,
    error: {
      message: `Route ${req.method} ${req.originalUrl} not found`,
      code: 'ROUTE_NOT_FOUND'
    }
  });
});

// Centralized Error Handler
app.use(errorHandler);
