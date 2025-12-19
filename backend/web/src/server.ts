/**
 * File Clean up Finished: Nov 13, 2025
 * Changes: Removed commented-out imports and route registrations for old/unused routes
 *          (old vinyl routes, categories, productStandards)
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { testConnection, startPoolHealthMonitoring } from './config/database';
import authRoutes from './routes/auth';
import customersRoutes from './routes/customers';
import timeTrackingRoutes from './routes/timeTracking';
// Time management sub-routers (mounted directly instead of via aggregator)
import timeEntriesRoutes from './routes/timeEntries';
import timeAnalyticsRoutes from './routes/timeAnalytics';
import timeSchedulingRoutes from './routes/timeScheduling';
import timeExportingRoutes from './routes/timeExporting';
import wagesRoutes from './routes/wages';
import accountsRoutes from './routes/accounts';
import usersRoutes from './routes/users';  // New properly-architected users endpoint
import loginLogsRoutes from './routes/loginLogs';  // New properly-architected login logs endpoint (Nov 13, 2025)
import vacationsRoutes from './routes/vacations';  // New properly-architected vacations endpoint (Nov 13, 2025)
import vinylRoutes from './routes/vinyl';
import vinylProductsRoutes from './routes/vinylProducts';
import suppliersRoutes from './routes/suppliers';
import productTypesRoutes from './routes/productTypes';  // Phase 4.b: Product Types Catalog (Dec 18, 2025)
import supplierProductsRoutes from './routes/supplierProducts';  // Phase 4.c: Supplier Products + Pricing (Dec 19, 2025)
import jobsRoutes from './routes/jobs';
// supplyChainSimple routes removed Nov 21, 2025 - dead code, ideas preserved in docs/ideas/SUPPLY_CHAIN_ROUTES_IDEAS.md
import jobEstimationRoutes from './routes/jobEstimation';
import pricingCalculationRoutes from './routes/pricingCalculation';
import locksRoutes from './routes/locks';
import quickbooksRoutes from './routes/quickbooks';
import quickbooksTestRoutes from './routes/quickbooksTest';
import credentialsRoutes from './routes/credentials';
import ordersRoutes from './routes/orders';
import orderPreparationRoutes from './routes/orderPreparation';
import ledsRoutes from './routes/leds';
import powerSuppliesRoutes from './routes/powerSupplies';
import printRoutes from './routes/print';
import systemRoutes from './routes/system';
import settingsRoutes from './routes/settings';  // Phase 3: Settings & Templates UI (Dec 15, 2025)
import paymentsRoutes from './routes/payments';  // Multi-invoice payment system (Dec 17, 2025)
import invoicesRoutes from './routes/invoices';  // Invoices listing page (Dec 17, 2025)
import dashboardPanelsRoutes from './routes/dashboardPanels';  // Customizable Orders Dashboard panels (Dec 17, 2025)

// QuickBooks utilities for startup
import { quickbooksOAuthRepository } from './repositories/quickbooksOAuthRepository';
import { startQuickBooksCleanupJob } from './jobs/quickbooksCleanup';
import { startScheduledEmailJob } from './jobs/scheduledEmailJob';

// SMB path configuration
import { SMB_ROOT } from './config/paths';

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
// Time management - 4 routers mounted at same base path (replaced aggregator)
app.use('/api/time-management', timeEntriesRoutes);
app.use('/api/time-management', timeAnalyticsRoutes);
app.use('/api/time-management', timeSchedulingRoutes);
app.use('/api/time-management', timeExportingRoutes);
app.use('/api/wages', wagesRoutes);
app.use('/api/accounts', accountsRoutes);
app.use('/api/users', usersRoutes);  // New properly-architected users endpoint (Nov 13, 2025)
app.use('/api/login-logs', loginLogsRoutes);  // New properly-architected login logs endpoint (Nov 13, 2025)
app.use('/api/vacations', vacationsRoutes);  // New properly-architected vacations endpoint (Nov 13, 2025)
// Vinyl management (refactored with proper 3-layer architecture)
app.use('/api/vinyl', vinylRoutes);
app.use('/api/vinyl-products', vinylProductsRoutes);
app.use('/api/suppliers', suppliersRoutes);
app.use('/api/product-types', productTypesRoutes);  // Phase 4.b: Product Types Catalog (Dec 18, 2025)
app.use('/api/supplier-products', supplierProductsRoutes);  // Phase 4.c: Supplier Products + Pricing (Dec 19, 2025)
app.use('/api/jobs', jobsRoutes);
// /api/supply-chain routes removed Nov 21, 2025 - see docs/ideas/SUPPLY_CHAIN_ROUTES_IDEAS.md
app.use('/api/job-estimation', jobEstimationRoutes);
app.use('/api/pricing', pricingCalculationRoutes);
app.use('/api/locks', locksRoutes);
app.use('/api/quickbooks', quickbooksRoutes);
app.use('/api/quickbooks-test', quickbooksTestRoutes);
app.use('/api/credentials', credentialsRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/order-preparation', orderPreparationRoutes);
app.use('/api/leds', ledsRoutes);
app.use('/api/power-supplies', powerSuppliesRoutes);
app.use('/api/print', printRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/settings', settingsRoutes);  // Phase 3: Settings & Templates UI (Dec 15, 2025)
app.use('/api/payments', paymentsRoutes);  // Multi-invoice payment system (Dec 17, 2025)
app.use('/api/invoices', invoicesRoutes);  // Invoices listing page (Dec 17, 2025)
app.use('/api/dashboard-panels', dashboardPanelsRoutes);  // Customizable Orders Dashboard panels (Dec 17, 2025)

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
}, express.static(SMB_ROOT, {
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

    // Start connection pool health monitoring
    startPoolHealthMonitoring();

    // Clean up expired OAuth state tokens on startup
    await quickbooksOAuthRepository.cleanupExpiredOAuthStates();

    // Start QuickBooks cleanup job (runs daily at 2 AM)
    startQuickBooksCleanupJob();

    // Start scheduled email job (runs every 5 minutes)
    startScheduledEmailJob();

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

// Export app for testing
export { app };

// Only start server if not in test environment
if (process.env.NODE_ENV !== 'test') {
  startServer();
}
