import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { testConnection } from './config/database';
import authRoutes from './routes/auth';
import customersRoutes from './routes/customers';
import timeTrackingRoutes from './routes/timeTracking';
import timeManagementRoutes from './routes/timeManagement';
import wagesRoutes from './routes/wages';
import accountsRoutes from './routes/accounts';
// Old vinyl routes (backup)
// import vinylRoutes from './routes/vinyl';
// import vinylProductsRoutes from './routes/vinylProducts';

// New vinyl routes (refactored architecture)
import vinylRoutes from './routes/vinylNew';
import vinylProductsRoutes from './routes/vinylProductsNew';
import suppliersRoutes from './routes/suppliers';
import jobsRoutes from './routes/jobs';
import supplyChainRoutes from './routes/supplyChainSimple';
import jobEstimationRoutes from './routes/jobEstimation';
import pricingCalculationRoutes from './routes/pricingCalculation';
import locksRoutes from './routes/locks';
import quickbooksRoutes from './routes/quickbooks';
import quickbooksTestRoutes from './routes/quickbooksTest';
import credentialsRoutes from './routes/credentials';
import ordersRoutes from './routes/orders';
import toolsRoutes from './routes/toolsRoutes';
import ledsRoutes from './routes/leds';
import powerSuppliesRoutes from './routes/powerSupplies';
import materialsRoutes from './routes/materials';
// import categoriesRoutes from './routes/categories';
// import productStandardsRoutes from './routes/productStandards';

// QuickBooks utilities for startup
import { cleanupExpiredOAuthStates } from './utils/quickbooks/dbManager';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3001;

// Middleware - Allow multiple origins for development and production
const allowedOrigins = [
  'https://nexuswebapp.duckdns.org',  // Production
  'http://192.168.2.14:5173',          // LAN development
  'http://localhost:5173',             // Local development
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, Postman, curl)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`⚠️  CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Debug middleware - log all requests
app.use((req, res, next) => {
  console.log(`📥 ${req.method} ${req.url}`);
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/time', timeTrackingRoutes);
app.use('/api/time-management', timeManagementRoutes);
app.use('/api/wages', wagesRoutes);
app.use('/api/accounts', accountsRoutes);
// Vinyl management (refactored with proper 3-layer architecture)
app.use('/api/vinyl', vinylRoutes);
app.use('/api/vinyl-products', vinylProductsRoutes);
app.use('/api/suppliers', suppliersRoutes);
app.use('/api/jobs', jobsRoutes);
app.use('/api/supply-chain', supplyChainRoutes);
app.use('/api/job-estimation', jobEstimationRoutes);
app.use('/api/pricing', pricingCalculationRoutes);
app.use('/api/locks', locksRoutes);
app.use('/api/quickbooks', quickbooksRoutes);
app.use('/api/quickbooks-test', quickbooksTestRoutes);
app.use('/api/credentials', credentialsRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/tools', toolsRoutes);
app.use('/api/leds', ledsRoutes);
app.use('/api/power-supplies', powerSuppliesRoutes);
app.use('/api/materials', materialsRoutes);
// app.use('/api/categories', categoriesRoutes);
// app.use('/api/product-standards', productStandardsRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Start server
const startServer = async () => {
  try {
    // Test database connection
    const dbConnected = await testConnection();
    if (!dbConnected) {
      console.error('Failed to connect to database. Exiting...');
      process.exit(1);
    }

    // Clean up expired OAuth state tokens on startup
    await cleanupExpiredOAuthStates();

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📍 Environment: ${process.env.NODE_ENV}`);
      console.log(`🌐 CORS Origin: ${process.env.CORS_ORIGIN}`);
      console.log(`🌍 Network access: http://192.168.2.14:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
