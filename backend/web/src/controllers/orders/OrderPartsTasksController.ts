/**
 * Order Parts Tasks Controller
 * HTTP handlers for the Tasks Table endpoint
 * Phase 2.a - Tasks Table Feature
 */

import { Request, Response } from 'express';
import { orderPartsTasksService } from '../../services/orderPartsTasksService';
import { OrderStatus } from '../../types/orders';

/**
 * GET /api/orders/parts/with-tasks
 * Returns all parts with their tasks for the Tasks Table
 */
export const getPartsWithTasks = async (req: Request, res: Response) => {
  try {
    const {
      statuses,
      hideCompleted,
      search
    } = req.query;

    // Parse statuses - can be comma-separated string or array
    let statusesArray: OrderStatus[] | undefined;
    if (statuses) {
      if (typeof statuses === 'string') {
        statusesArray = statuses.split(',').filter(s => s.trim()) as OrderStatus[];
      } else if (Array.isArray(statuses)) {
        statusesArray = statuses as OrderStatus[];
      }
    }

    const params = {
      statuses: statusesArray,
      hideCompleted: hideCompleted === 'true',
      search: search as string | undefined
    };

    const result = await orderPartsTasksService.getPartsWithTasks(params);

    res.json({
      success: true,
      data: result.data,
      meta: result.meta
    });
  } catch (error) {
    console.error('Error fetching parts with tasks:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to fetch parts with tasks'
    });
  }
};
