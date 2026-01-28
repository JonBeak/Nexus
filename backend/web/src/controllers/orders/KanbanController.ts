/**
 * Kanban Controller
 * HTTP Request Handler for Kanban Board Data
 *
 * Created: 2025-01-28
 * Provides optimized endpoint for Kanban board that returns pre-grouped,
 * pre-sorted data with computed fields to reduce frontend processing.
 */

import { Request, Response } from 'express';
import { orderService } from '../../services/orderService';
import { sendErrorResponse } from '../../utils/controllerHelpers';

/**
 * Get Kanban board data
 * GET /api/orders/kanban
 * Permission: orders.view
 *
 * Query params:
 * - showAllCompleted: boolean - Show all completed orders (default: false, shows last 2 weeks)
 * - showAllCancelled: boolean - Show all cancelled orders (default: false, shows last 2 weeks)
 *
 * Returns:
 * - columns: Record<status, KanbanOrder[]> - Orders grouped by status, sorted by due_date
 * - painting: KanbanOrder[] - Cross-status painting task orders
 * - totalCounts: { completed: number, cancelled: number } - For "show all" button counts
 */
export const getKanbanData = async (req: Request, res: Response) => {
  try {
    const showAllCompleted = req.query.showAllCompleted === 'true';
    const showAllCancelled = req.query.showAllCancelled === 'true';

    const data = await orderService.getKanbanData({
      showAllCompleted,
      showAllCancelled
    });

    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Error fetching Kanban data:', error);
    return sendErrorResponse(res, error instanceof Error ? error.message : 'Failed to fetch Kanban data', 'INTERNAL_ERROR');
  }
};
