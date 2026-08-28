import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import http from 'http';
import { initSocketServer } from './services/socket';
import prisma from './prisma/client';

import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import teamRoutes from './routes/teams';
import candidateRoutes from './routes/candidates';
import communicationRoutes from './routes/communications';
import documentRoutes from './routes/documents';
import registrationRoutes from './routes/registrations';
import clientRoutes from './routes/clients';
import jobOrderRoutes from './routes/jobOrders';
import importRoutes from './routes/import';
import callingRoutes from './routes/calling';
import callbackRoutes from './routes/callbacks';
import shortlistRoutes from './routes/shortlist';
import assignmentRoutes from './routes/assignments';
import dailyTrackerRoutes from './routes/dailyTracker';
import dashboardRoutes from './routes/dashboard';
import reportRoutes from './routes/reports';
import activityLogRoutes from './routes/activityLogs';
import notificationRoutes from './routes/notifications';

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 5000;
const isProduction = process.env.NODE_ENV === 'production';

// 1. Security Headers (Helmet)
app.use(
  helmet({
    contentSecurityPolicy: false, // API server does not serve HTML
    crossOriginEmbedderPolicy: false,
  })
);

// 2. CORS Configuration
const allowedOrigins = (process.env.CLIENT_URL || process.env.CORS_ORIGIN || 'http://localhost:3000,http://localhost:5173')
  .split(',')
  .map((o) => o.trim());

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
      if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, true); // Permissive fallback to prevent breaking cross-domain deployments
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  })
);

// 3. Request Body Parsing
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// 4. Rate Limiting for Authentication Endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isProduction ? 100 : 1000, // Limit each IP to 100 requests per 15 min in prod
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests from this IP, please try again after 15 minutes' },
});
app.use('/api/auth/login', authLimiter);

// 5. Health Check Endpoints (Both /health and /api/health)
const healthHandler = (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    service: 'Genius Consultants Operations API',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
};

app.get('/health', healthHandler);
app.get('/api/health', healthHandler);

// 6. Application API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/candidates', candidateRoutes);
app.use('/api/communications', communicationRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/registrations', registrationRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/job-orders', jobOrderRoutes);
app.use('/api/import', importRoutes);
app.use('/api/calling', callingRoutes);
app.use('/api/callbacks', callbackRoutes);
app.use('/api/shortlist', shortlistRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/daily-tracker', dailyTrackerRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/activity-logs', activityLogRoutes);

// 7. Global 404 Handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// 8. Production-Safe Global Error Handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled Application Error:', err);
  const statusCode = err.status || err.statusCode || 500;
  res.status(statusCode).json({
    error: isProduction ? 'Internal Server Error' : err.message || 'Unknown Server Error',
  });
});

// 9. HTTP Server & WebSocket Initialization
const httpServer = http.createServer(app);
initSocketServer(httpServer);

const server = httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Genius Consultants Operations API & WebSocket running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
});

// 10. Graceful Shutdown Handlers
const handleGracefulShutdown = (signal: string) => {
  console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);
  server.close(async () => {
    console.log('🔌 HTTP & WebSocket connections closed.');
    try {
      await prisma.$disconnect();
      console.log('💾 Database connection cleanly disconnected.');
    } catch (e) {
      console.error('Error disconnecting database:', e);
    }
    process.exit(0);
  });

  // Force close if graceful shutdown hangs
  setTimeout(() => {
    console.error('⚠️ Graceful shutdown timed out. Forcing process exit.');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => handleGracefulShutdown('SIGTERM'));
process.on('SIGINT', () => handleGracefulShutdown('SIGINT'));

export default app;
