/**
 * Order Parts Controller
 * HTTP Request Handlers for Order Part Operations
 *
 * Extracted from orderController.ts - 2025-11-21
 * Functions: updateOrderParts, updateSpecsDisplayName, toggleIsParent,
 *            updatePartSpecsQty, reorderParts, addPartRow, removePartRow
 */

import { Request, Response } from 'express';
import { orderPartsService } from '../../services/orderPartsService';
import { parseIntParam, sendErrorResponse } from '../../utils/controllerHelpers';
import { getOrderIdFromNumber } from './OrderCrudController';

/**
 * Update order parts in bulk (Phase 1.5.c)
 * PUT /api/orders/:orderNumber/parts
 * Permission: orders.update (Manager+ only)
 */
export const updateOrderParts = async (req: Request, res: Response) => {
  try {
    const { orderNumber } = req.params;
    const orderId = await getOrderIdFromNumber(orderNumber);

    if (!orderId) {
      return sendErrorResponse(res, 'Order not found', 'NOT_FOUND');
    }

    const { parts } = req.body;

    if (!Array.isArray(parts) || parts.length === 0) {
      return sendErrorResponse(res, 'Parts array is required', 'VALIDATION_ERROR');
    }

    await orderPartsService.updateOrderParts(orderId, parts);

    res.json({
      success: true,
      message: 'Order parts updated successfully'
    });
  } catch (error) {
    console.error('Error updating order parts:', error);
    return sendErrorResponse(res, error instanceof Error ? error.message : 'Failed to update order parts', 'INTERNAL_ERROR');
  }
};

/**
 * Update specs_display_name and regenerate specifications
 * PUT /api/orders/:orderNumber/parts/:partId/specs-display-name
 * Permission: orders.update (Manager+ only)
 *
 * This endpoint:
 * 1. Updates the specs_display_name field
 * 2. Calls the mapper to get spec types
 * 3. Regenerates the SPECIFICATIONS column (clears existing templates)
 */
export const updateSpecsDisplayName = async (req: Request, res: Response) => {
  try {
    const { orderNumber, partId } = req.params;
    const { specs_display_name } = req.body;

    // Validate inputs
    const orderId = await getOrderIdFromNumber(orderNumber);
    if (!orderId) {
      return sendErrorResponse(res, 'Order not found', 'NOT_FOUND');
    }

    const partIdNum = parseIntParam(partId, 'part ID');
    if (partIdNum === null) {
      return sendErrorResponse(res, 'Invalid part ID', 'VALIDATION_ERROR');
    }

    const updatedPart = await orderPartsService.updateSpecsDisplayName(partIdNum, specs_display_name);

    res.json({
      success: true,
      data: updatedPart
    });
  } catch (error) {
    console.error('Error updating specs display name:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to update specs display name';
    if (errorMessage.includes('not found')) {
      return sendErrorResponse(res, errorMessage, 'NOT_FOUND');
    }
    return sendErrorResponse(res, errorMessage, 'INTERNAL_ERROR');
  }
};

/**
 * Toggle is_parent status for an order part
 * PATCH /api/orders/:orderNumber/parts/:partId/toggle-parent
 */
export const toggleIsParent = async (req: Request, res: Response) => {
  try {
    const { orderNumber, partId } = req.params;

    // Validate inputs
    const orderId = await getOrderIdFromNumber(orderNumber);
    if (!orderId) {
      return sendErrorResponse(res, 'Order not found', 'NOT_FOUND');
    }

    const partIdNum = parseIntParam(partId, 'part ID');
    if (partIdNum === null) {
      return sendErrorResponse(res, 'Invalid part ID', 'VALIDATION_ERROR');
    }

    const updatedPart = await orderPartsService.toggleIsParent(partIdNum);

    res.json({
      success: true,
      data: updatedPart
    });
  } catch (error) {
    console.error('Error toggling is_parent:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to toggle is_parent';
    if (errorMessage.includes('not found')) {
      return sendErrorResponse(res, errorMessage, 'NOT_FOUND');
    }
    if (errorMessage.includes('Cannot promote')) {
      return sendErrorResponse(res, errorMessage, 'VALIDATION_ERROR');
    }
    return sendErrorResponse(res, errorMessage, 'INTERNAL_ERROR');
  }
};

/**
 * Update specs_qty for an order part
 * PATCH /api/orders/:orderNumber/parts/:partId/specs-qty
 * Permission: orders.update (Manager+ only)
 */
export const updatePartSpecsQty = async (req: Request, res: Response) => {
  try {
    const { partId } = req.params;
    const { specs_qty } = req.body;

    const partIdNum = parseIntParam(partId, 'part ID');

    if (partIdNum === null) {
      return sendErrorResponse(res, 'Invalid part ID', 'VALIDATION_ERROR');
    }

    if (specs_qty === undefined || specs_qty === null) {
      return sendErrorResponse(res, 'specs_qty is required', 'VALIDATION_ERROR');
    }

    const qtyNum = Number(specs_qty);
    if (isNaN(qtyNum)) {
      return sendErrorResponse(res, 'specs_qty must be a number', 'VALIDATION_ERROR');
    }

    const updatedPart = await orderPartsService.updatePartSpecsQty(partIdNum, qtyNum);

    res.json({
      success: true,
      data: updatedPart
    });
  } catch (error) {
    console.error('Error updating specs_qty:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to update specs_qty';
    if (errorMessage.includes('not found')) {
      return sendErrorResponse(res, errorMessage, 'NOT_FOUND');
    }
    if (errorMessage.includes('non-negative')) {
      return sendErrorResponse(res, errorMessage, 'VALIDATION_ERROR');
    }
    return sendErrorResponse(res, errorMessage, 'INTERNAL_ERROR');
  }
};

/**
 * Reorder parts in bulk (for drag-and-drop)
 * PATCH /api/orders/:orderNumber/parts/reorder
 * Body: { partIds: number[] } - ordered array of part IDs
 * Permission: orders.update (Manager+ only)
 */
export const reorderParts = async (req: Request, res: Response) => {
  try {
    const { orderNumber } = req.params;
    const { partIds } = req.body;

    // Validate inputs
    const orderId = await getOrderIdFromNumber(orderNumber);
    if (!orderId) {
      return sendErrorResponse(res, 'Order not found', 'NOT_FOUND');
    }

    if (!Array.isArray(partIds) || partIds.length === 0) {
      return sendErrorResponse(res, 'Invalid partIds array', 'VALIDATION_ERROR');
    }

    await orderPartsService.reorderParts(orderId, partIds);

    res.json({
      success: true,
      message: 'Parts reordered successfully'
    });
  } catch (error) {
    console.error('Error reordering parts:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to reorder parts';
    if (errorMessage.includes('Invalid part IDs') || errorMessage.includes('All parts must')) {
      return sendErrorResponse(res, errorMessage, 'VALIDATION_ERROR');
    }
    return sendErrorResponse(res, errorMessage, 'INTERNAL_ERROR');
  }
};

/**
 * Add a new part row to the order
 * POST /api/orders/:orderNumber/parts
 * Permission: orders.update (Manager+ only)
 */
export const addPartRow = async (req: Request, res: Response) => {
  try {
    const { orderNumber } = req.params;

    // Validate inputs
    const orderId = await getOrderIdFromNumber(orderNumber);
    if (!orderId) {
      return sendErrorResponse(res, 'Order not found', 'NOT_FOUND');
    }

    const partId = await orderPartsService.addPartRow(orderId);

    res.json({
      success: true,
      part_id: partId,
      message: 'Part row added successfully'
    });
  } catch (error) {
    console.error('Error adding part row:', error);
    return sendErrorResponse(res, error instanceof Error ? error.message : 'Failed to add part row', 'INTERNAL_ERROR');
  }
};

/**
 * Remove a part row from the order
 * DELETE /api/orders/:orderNumber/parts/:partId
 * Permission: orders.update (Manager+ only)
 */
export const removePartRow = async (req: Request, res: Response) => {
  try {
    const { orderNumber, partId } = req.params;

    // Validate inputs
    const orderId = await getOrderIdFromNumber(orderNumber);
    if (!orderId) {
      return sendErrorResponse(res, 'Order not found', 'NOT_FOUND');
    }

    const partIdNum = parseIntParam(partId, 'part ID');
    if (partIdNum === null) {
      return sendErrorResponse(res, 'Invalid part ID', 'VALIDATION_ERROR');
    }

    await orderPartsService.removePartRow(orderId, partIdNum);

    res.json({
      success: true,
      message: 'Part row removed successfully'
    });
  } catch (error) {
    console.error('Error removing part row:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to remove part row';
    if (errorMessage.includes('not found')) {
      return sendErrorResponse(res, errorMessage, 'NOT_FOUND');
    }
    if (errorMessage.includes('does not belong')) {
      return sendErrorResponse(res, errorMessage, 'VALIDATION_ERROR');
    }
    return sendErrorResponse(res, errorMessage, 'INTERNAL_ERROR');
  }
};

/**
 * Duplicate a part row with specified data mode
 * POST /api/orders/:orderNumber/parts/:partId/duplicate
 * Body: { mode: 'specs' | 'invoice' | 'both' }
 * Permission: orders.update (Manager+ only)
 */
export const duplicatePart = async (req: Request, res: Response) => {
  try {
    const { orderNumber, partId } = req.params;
    const { mode } = req.body;

    // Validate inputs
    const orderId = await getOrderIdFromNumber(orderNumber);
    if (!orderId) {
      return sendErrorResponse(res, 'Order not found', 'NOT_FOUND');
    }

    const partIdNum = parseIntParam(partId, 'part ID');
    if (partIdNum === null) {
      return sendErrorResponse(res, 'Invalid part ID', 'VALIDATION_ERROR');
    }

    // Validate mode
    if (!mode || !['specs', 'invoice', 'both'].includes(mode)) {
      return sendErrorResponse(res, 'Invalid mode. Must be one of: specs, invoice, both', 'VALIDATION_ERROR');
    }

    const newPartId = await orderPartsService.duplicatePart(orderId, partIdNum, mode);

    res.json({
      success: true,
      part_id: newPartId,
      message: 'Part duplicated successfully'
    });
  } catch (error) {
    console.error('Error duplicating part:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to duplicate part';
    if (errorMessage.includes('not found')) {
      return sendErrorResponse(res, errorMessage, 'NOT_FOUND');
    }
    if (errorMessage.includes('does not belong')) {
      return sendErrorResponse(res, errorMessage, 'VALIDATION_ERROR');
    }
    return sendErrorResponse(res, errorMessage, 'INTERNAL_ERROR');
  }
};
