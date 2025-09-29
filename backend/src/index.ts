import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

// Import routes
import authRoutes from './routes/auth';
import clientsRoutes from './routes/clients';
import sectorsRoutes from './routes/sectors';
import bedsRoutes from './routes/beds';
import linenItemsRoutes from './routes/linenItems';
import ordersRoutes from './routes/orders';
import cagesRoutes from './routes/cages';
import weighingRoutes from './routes/weighing';
import distributionRoutes from './routes/distribution';

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 4000;

// Initialize Prisma
export const prisma = new PrismaClient();

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true
}));
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/ping', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// API Routes
app.use('/auth', authRoutes);
app.use('/clients', clientsRoutes);
app.use('/sectors', sectorsRoutes);
app.use('/beds', bedsRoutes);
app.use('/items', linenItemsRoutes);
app.use('/orders', ordersRoutes);
app.use('/gaiolas', cagesRoutes);
app.use('/controles', weighingRoutes);
app.use('/pesagens', weighingRoutes);
app.use('/distributed-items', distributionRoutes);

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`
  });
});

// Start server
app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
  console.log(`📊 Health check: http://localhost:${port}/ping`);
  console.log(`🔗 API Base URL: http://localhost:${port}`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('🛑 Shutting down server...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('🛑 Shutting down server...');
  await prisma.$disconnect();
  process.exit(0);
});

