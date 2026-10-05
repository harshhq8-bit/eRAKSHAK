import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { ENV } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';

const frontendPath = path.resolve(__dirname, '../../frontend');

// Route imports
import authRoutes from './routes/auth.routes.js';
import devicesRoutes from './routes/devices.routes.js';
import mobileRoutes from './routes/mobile.routes.js';
import notificationsRoutes from './routes/notifications.routes.js';
import eventsRoutes from './routes/events.routes.js';

const app = express();

// Security and utility middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

app.use(cors({
  origin: '*', // Allow cloud dashboard & local ESP/mobile access
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-device-id', 'x-device-key', 'x-api-key'],
}));

app.use(morgan(ENV.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health Check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ONLINE',
    system: 'eRAKSHAK Smart Security Cloud Backend',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    timezone: 'Asia/Kolkata',
  });
});

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/devices', devicesRoutes);
app.use('/api/mobile', mobileRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/events', eventsRoutes);

// Serve static HTML frontend
app.use(express.static(frontendPath));

// Web page route fallback (non-API)
app.get('*', (req: Request, res: Response, next: NextFunction) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// 404 Handler for undefined API routes
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: `Endpoint not found: ${req.method} ${req.originalUrl}`,
  });
});

// Centralized Error Handler
app.use(errorHandler);

// Start Server
const server = app.listen(ENV.PORT, () => {
  console.log(`=======================================================`);
  console.log(`🛡️ eRAKSHAK Cloud Backend running on port ${ENV.PORT}`);
  console.log(`📡 Environment: ${ENV.NODE_ENV}`);
  console.log(`🔗 API Base: ${ENV.RENDER_API_URL || `http://localhost:${ENV.PORT}`}`);
  console.log(`=======================================================`);
});

process.on('uncaughtException', (err) => {
  console.error('[Uncaught Exception]:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Unhandled Rejection at]:', promise, 'reason:', reason);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});

export default app;
