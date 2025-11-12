/**
 * Print Routes
 * Server-side printing endpoints
 */

import express from 'express';
import {
  getAvailablePrinters,
  printOrderForm,
  printOrderFormsBatch,
  cancelPrintJob,
  getPrintJobStatus
} from '../controllers/printController';
import { authenticateToken } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';

const router = express.Router();

// All print routes require authentication
router.use(authenticateToken);

/**
 * GET /api/print/printers
 * Get list of available printers
 */
router.get('/printers', requirePermission('orders.view'), getAvailablePrinters);

/**
 * POST /api/print/order-form/:orderNumber
 * Print an order form
 * Body: { printerName?: string, formType?: 'master' | 'customer' | 'shop' }
 */
router.post('/order-form/:orderNumber', requirePermission('orders.view'), printOrderForm);

/**
 * POST /api/print/order-forms-batch/:orderNumber
 * Print multiple forms with quantities
 * Body: { quantities: { master: number, estimate: number, shop: number, packing: number }, printerName?: string }
 */
router.post('/order-forms-batch/:orderNumber', requirePermission('orders.view'), printOrderFormsBatch);

/**
 * GET /api/print/job/:jobId
 * Get print job status
 */
router.get('/job/:jobId', requirePermission('orders.view'), getPrintJobStatus);

/**
 * DELETE /api/print/job/:jobId
 * Cancel a print job
 */
router.delete('/job/:jobId', requirePermission('orders.view'), cancelPrintJob);

export default router;
