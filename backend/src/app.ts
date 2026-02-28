import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { requestIdMiddleware } from './middleware/request-id';
import { requestLogger } from './middleware/logger';
import { errorHandler } from './middleware/error-handler';
import authRoutes from './modules/auth/auth.routes';
import timeRoutes from './modules/time/time.routes';
import adminRoutes from './modules/admin/admin.routes';
import buyerRfqRoutes from './modules/rfq/buyer-rfq.routes';
import buyerKpiRoutes from './modules/kpi/buyer-kpi.routes';
import supplierRfqRoutes from './modules/rfq/supplier-rfq.routes';
import buyerNegotiationRoutes from './modules/negotiation/buyer-negotiation.routes';
import supplierNegotiationRoutes from './modules/negotiation/supplier-negotiation.routes';

const app = express();

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: true,
    crossOriginEmbedderPolicy: true,
    frameguard: { action: 'deny' },
  }),
);

// CORS
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  }),
);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(compression());

// Request ID and logging
app.use(requestIdMiddleware);
app.use(requestLogger);

// Trust proxy for rate limiting behind reverse proxy
app.set('trust proxy', 1);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/time', timeRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/buyer/rfqs', buyerRfqRoutes);
app.use('/api/buyer', buyerKpiRoutes);
app.use('/api/supplier/rfqs', supplierRfqRoutes);
app.use('/api/buyer/negotiations', buyerNegotiationRoutes);
app.use('/api/supplier/negotiations', supplierNegotiationRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Swagger UI (development only)
if (process.env.NODE_ENV !== 'production') {
  // Lazy import to avoid loading in production
  import('./config/swagger').then(({ swaggerSpec }) => {
    import('swagger-ui-express').then((swaggerUi) => {
      app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
    });
  });
}

// Error handler (must be last)
app.use(errorHandler);

export default app;
