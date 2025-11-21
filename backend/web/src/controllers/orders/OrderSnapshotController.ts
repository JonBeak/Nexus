/**
 * Order Snapshot Controller
 * HTTP Request Handlers for Order Part Snapshots/Versioning
 *
 * Extracted from orderController.ts - 2025-11-21
 * Functions: finalizeOrder, getPartLatestSnapshot,
 *            getPartSnapshotHistory, comparePartWithSnapshot
 */

import { Request, Response } from 'express';
import { orderSnapshotService } from '../../services/orderSnapshotService';
import { parseIntParam, sendErrorResponse } from '../../utils/controllerHelpers';
import { getOrderIdFromNumber } from './OrderCrudController';

/**
 * Finalize order - create snapshots for all parts (Phase 1.5.c.3)
 * POST /api/orders/:orderNumber/finalize
 * Permission: orders.update (Manager+ only)
 */
export const finalizeOrder = async (req: Request, res: Response) => {
  try {
    const { orderNumber } = req.params;
    const userId = (req as any).user?.user_id;

    if (!userId) {
      return sendErrorResponse(res, 'User not authenticated', 'UNAUTHORIZED');
    }

    const orderId = await getOrderIdFromNumber(orderNumber);
    if (!orderId) {
      return sendErrorResponse(res, 'Order not found', 'NOT_FOUND');
    }

    // Create snapshots and finalize
    await orderSnapshotService.finalizeOrder(orderId, userId);

    res.json({
      success: true,
      message: 'Order finalized successfully'
    });
  } catch (error) {
    console.error('Error finalizing order:', error);
    return sendErrorResponse(res, error instanceof Error ? error.message : 'Failed to finalize order', 'INTERNAL_ERROR');
  }
};

/**
 * Get latest snapshot for a part (Phase 1.5.c.3)
 * GET /api/orders/parts/:partId/snapshot/latest
 * Permission: orders.view
 */
export const getPartLatestSnapshot = async (req: Request, res: Response) => {
  try {
    const { partId } = req.params;

    const snapshot = await orderSnapshotService.getLatestSnapshot(parseIntParam(partId, 'part ID')!);

    res.json({
      success: true,
      data: snapshot
    });
  } catch (error) {
    console.error('Error fetching latest snapshot:', error);
    return sendErrorResponse(res, error instanceof Error ? error.message : 'Failed to fetch snapshot', 'INTERNAL_ERROR');
  }
};

/**
 * Get snapshot history for a part (Phase 1.5.c.3)
 * GET /api/orders/parts/:partId/snapshots
 * Permission: orders.view
 */
export const getPartSnapshotHistory = async (req: Request, res: Response) => {
  try {
    const { partId } = req.params;

    const snapshots = await orderSnapshotService.getSnapshotHistory(parseIntParam(partId, 'part ID')!);

    res.json({
      success: true,
      data: snapshots
    });
  } catch (error) {
    console.error('Error fetching snapshot history:', error);
    return sendErrorResponse(res, error instanceof Error ? error.message : 'Failed to fetch snapshot history', 'INTERNAL_ERROR');
  }
};

/**
 * Compare part with latest snapshot (Phase 1.5.c.3)
 * GET /api/orders/parts/:partId/compare
 * Permission: orders.view
 */
export const comparePartWithSnapshot = async (req: Request, res: Response) => {
  try {
    const { partId } = req.params;

    const comparison = await orderSnapshotService.compareWithLatestSnapshot(parseIntParam(partId, 'part ID')!);

    res.json({
      success: true,
      data: comparison
    });
  } catch (error) {
    console.error('Error comparing with snapshot:', error);
    return sendErrorResponse(res, error instanceof Error ? error.message : 'Failed to compare with snapshot', 'INTERNAL_ERROR');
  }
};
