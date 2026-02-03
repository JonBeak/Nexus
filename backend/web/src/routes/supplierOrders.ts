/**
 * Supplier Orders Routes
 * API endpoints for supplier order management
 * Created: 2026-02-02
 */

import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import * as controller from '../controllers/supplyChain/supplierOrderController';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// ============================================================================
// ORDER ROUTES
// ============================================================================

// GET /supplier-orders/status-counts - Get counts by status (must be before /:id)
router.get('/status-counts', controller.getStatusCounts);

// GET /supplier-orders - List all orders with filtering
router.get('/', controller.getOrders);

// GET /supplier-orders/:id - Get single order with items
router.get('/:id', controller.getOrder);

// POST /supplier-orders - Create new order
router.post('/', controller.createOrder);

// POST /supplier-orders/generate - Generate order from requirements
router.post('/generate', controller.generateOrder);

// PUT /supplier-orders/:id - Update order
router.put('/:id', controller.updateOrder);

// POST /supplier-orders/:id/submit - Submit order to supplier
router.post('/:id/submit', controller.submitOrder);

// PUT /supplier-orders/:id/status - Update order status
router.put('/:id/status', controller.updateStatus);

// POST /supplier-orders/:id/receive - Receive items
router.post('/:id/receive', controller.receiveItems);

// DELETE /supplier-orders/:id - Delete order (draft only)
router.delete('/:id', controller.deleteOrder);

// GET /supplier-orders/:id/history - Get status history
router.get('/:id/history', controller.getStatusHistory);

// ============================================================================
// ITEM ROUTES
// ============================================================================

// POST /supplier-orders/:id/items - Add item to order
router.post('/:id/items', controller.addItem);

// PUT /supplier-orders/:id/items/:itemId - Update item
router.put('/:id/items/:itemId', controller.updateItem);

// DELETE /supplier-orders/:id/items/:itemId - Remove item
router.delete('/:id/items/:itemId', controller.removeItem);

export default router;
