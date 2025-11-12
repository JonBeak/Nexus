import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
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
import printRoutes from './routes/print';
// import categoriesRoutes from './routes/categories';
// import productStandardsRoutes from './routes/productStandards';

// QuickBooks utilities for startup
import { cleanupExpiredOAuthStates } from './utils/quickbooks/dbManager';
import { startQuickBooksCleanupJob } from './jobs/quickbooksCleanup';

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
app.use('/api/print', printRoutes);
// app.use('/api/categories', categoriesRoutes);
// app.use('/api/product-standards', productStandardsRoutes);

// =============================================
// STATIC FILE SERVING (Phase 1.5.g)
// =============================================

/**
 * Serve order images from SMB share
 * URL: /order-images/{folder_path}/{filename}
 * Examples:
 *   - /order-images/Orders/JobA ----- CompanyX/design.jpg (new orders)
 *   - /order-images/JobB ----- CompanyY/photo.png (legacy migrated orders)
 *   - /order-images/1Finished/JobC ----- CompanyZ/final.jpg (legacy finished)
 *   - /order-images/Orders/1Finished/JobD ----- CompanyW/done.jpg (new finished)
 *
 * CORS enabled for Canvas API access (auto-crop feature)
 */
app.use('/order-images', (req, res, next) => {
  // Add CORS headers to allow Canvas API to read pixel data
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}, express.static('/mnt/channelletter', {
  maxAge: '7d',         // 7-day browser caching for performance
  immutable: true,      // Images don't change (same filename = same content)
  fallthrough: false,   // Return 404 if file not found (don't continue to next middleware)
  dotfiles: 'deny'      // Security: don't serve hidden files
}));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// =============================================
// SERVER VERSION TRACKING
// =============================================

interface ServerVersionData {
  count: number;
  restarts: Array<{ version: number; timestamp: string }>;
}

const getServerVersion = () => {
  const versionFile = path.join('/tmp', 'signhouse-backend-version.json');
  let versionData: ServerVersionData = { count: 0, restarts: [] };

  try {
    if (fs.existsSync(versionFile)) {
      const fileContents = fs.readFileSync(versionFile, 'utf-8');
      versionData = JSON.parse(fileContents) as ServerVersionData;
    }
  } catch (error) {
    console.warn('⚠️  Could not read version file, starting fresh');
  }

  // Increment version count
  versionData.count += 1;
  const currentTimestamp = new Date().toISOString();
  versionData.restarts.push({
    version: versionData.count,
    timestamp: currentTimestamp,
  });

  // Keep only last 50 restarts to avoid file bloat
  if (versionData.restarts.length > 50) {
    versionData.restarts = versionData.restarts.slice(-50);
  }

  // Write updated version file
  try {
    fs.writeFileSync(versionFile, JSON.stringify(versionData, null, 2));
  } catch (error) {
    console.warn('⚠️  Could not write version file');
  }

  return {
    version: versionData.count,
    timestamp: currentTimestamp,
  };
};

// Start server
const startServer = async () => {
  try {
    // Get and log server version
    const serverVersion = getServerVersion();

    // Test database connection
    const dbConnected = await testConnection();
    if (!dbConnected) {
      console.error('Failed to connect to database. Exiting...');
      process.exit(1);
    }

    // Clean up expired OAuth state tokens on startup
    await cleanupExpiredOAuthStates();

    // Start QuickBooks cleanup job (runs daily at 2 AM)
    startQuickBooksCleanupJob();

    app.listen(PORT, '0.0.0.0', () => {
      console.log('\n' + '='.repeat(60));
      console.log(`✅ SIGNHOUSE BACKEND v${serverVersion.version} STARTED`);
      console.log(`⏰ Timestamp: ${serverVersion.timestamp}`);
      console.log('='.repeat(60));
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📍 Environment: ${process.env.NODE_ENV}`);
      console.log(`🌐 CORS Origin: ${process.env.CORS_ORIGIN}`);
      console.log(`🌍 Network access: http://192.168.2.14:${PORT}`);
      console.log('='.repeat(60) + '\n');
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
