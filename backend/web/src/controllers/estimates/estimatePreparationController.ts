/**
 * Estimate Preparation Controller
 *
 * Handles CRUD operations for estimate preparation items.
 * These are editable rows created after "Prepare to Send" that get sent 1:1 to QuickBooks.
 */

import { Response } from 'express';
import { AuthRequest } from '../../types';
import {
  estimatePreparationRepository,
  UpdatePreparationItemData,
  CreatePreparationItemData
} from '../../repositories/estimatePreparationRepository';

/**
 * Validate estimate ID parameter
 */
function validateEstimateId(param: string, res: Response): { isValid: boolean; value?: number } {
  const estimateId = parseInt(param, 10);
  if (isNaN(estimateId) || estimateId <= 0) {
    res.status(400).json({ success: false, message: 'Invalid estimate ID' });
    return { isValid: false };
  }
  return { isValid: true, value: estimateId };
}

/**
 * Validate item ID parameter
 */
function validateItemId(param: string, res: Response): { isValid: boolean; value?: number } {
  const itemId = parseInt(param, 10);
  if (isNaN(itemId) || itemId <= 0) {
    res.status(400).json({ success: false, message: 'Invalid item ID' });
    return { isValid: false };
  }
  return { isValid: true, value: itemId };
}

// =============================================
// PREPARATION ITEM ENDPOINTS
// =============================================

/**
 * Get all preparation items for an estimate
 * @route GET /estimates/:estimateId/preparation-items
 */
export const getPreparationItems = async (req: AuthRequest, res: Response) => {
  try {
    const validation = validateEstimateId(req.params.estimateId, res);
    if (!validation.isValid) return;
    const estimateId = validation.value!;

    const items = await estimatePreparationRepository.getItemsByEstimateId(estimateId);

    res.json({ success: true, data: items });
  } catch (error) {
    console.error('Error fetching preparation items:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to fetch preparation items'
    });
  }
};

/**
 * Update a single preparation item
 * @route PUT /estimates/:estimateId/preparation-items/:itemId
 */
export const updatePreparationItem = async (req: AuthRequest, res: Response) => {
  try {
    const estimateValidation = validateEstimateId(req.params.estimateId, res);
    if (!estimateValidation.isValid) return;
    const estimateId = estimateValidation.value!;

    const itemValidation = validateItemId(req.params.itemId, res);
    if (!itemValidation.isValid) return;
    const itemId = itemValidation.value!;

    // Verify item belongs to this estimate
    const itemEstimateId = await estimatePreparationRepository.getEstimateIdForItem(itemId);
    if (itemEstimateId !== estimateId) {
      return res.status(404).json({
        success: false,
        message: 'Item not found in this estimate'
      });
    }

    // Extract update fields from body
    const updates: UpdatePreparationItemData = {};
    const body = req.body;

    if (body.item_name !== undefined) updates.item_name = body.item_name;
    if (body.qb_description !== undefined) updates.qb_description = body.qb_description;
    if (body.quantity !== undefined) updates.quantity = parseFloat(body.quantity) || 0;
    if (body.unit_price !== undefined) updates.unit_price = parseFloat(body.unit_price) || 0;
    if (body.extended_price !== undefined) updates.extended_price = parseFloat(body.extended_price) || 0;
    if (body.is_description_only !== undefined) updates.is_description_only = Boolean(body.is_description_only);
    if (body.qb_item_id !== undefined) updates.qb_item_id = body.qb_item_id || null;
    if (body.qb_item_name !== undefined) updates.qb_item_name = body.qb_item_name || null;

    // Auto-calculate extended_price if qty or unit_price changed
    if ((updates.quantity !== undefined || updates.unit_price !== undefined) && updates.extended_price === undefined) {
      const item = await estimatePreparationRepository.getItemById(itemId);
      if (item) {
        const qty = updates.quantity ?? item.quantity;
        const price = updates.unit_price ?? item.unit_price;
        updates.extended_price = qty * price;
      }
    }

    const success = await estimatePreparationRepository.updateItem(itemId, updates);

    if (success) {
      // Return updated item
      const updatedItem = await estimatePreparationRepository.getItemById(itemId);
      res.json({ success: true, data: updatedItem });
    } else {
      res.status(400).json({ success: false, message: 'No changes applied' });
    }
  } catch (error) {
    console.error('Error updating preparation item:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to update preparation item'
    });
  }
};

/**
 * Add a new preparation item
 * @route POST /estimates/:estimateId/preparation-items
 */
export const addPreparationItem = async (req: AuthRequest, res: Response) => {
  try {
    const validation = validateEstimateId(req.params.estimateId, res);
    if (!validation.isValid) return;
    const estimateId = validation.value!;

    const body = req.body;

    // Validate required field
    if (typeof body.item_name !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'item_name is required'
      });
    }

    const newItem: CreatePreparationItemData = {
      item_name: body.item_name,
      qb_description: body.qb_description || null,
      quantity: parseFloat(body.quantity) || 1,
      unit_price: parseFloat(body.unit_price) || 0,
      extended_price: parseFloat(body.extended_price) || 0,
      is_description_only: Boolean(body.is_description_only),
      qb_item_id: body.qb_item_id || null,
      qb_item_name: body.qb_item_name || null,
      source_row_id: null,
      source_product_type_id: null
    };

    // Auto-calculate extended_price if not provided
    if (!body.extended_price && newItem.quantity && newItem.unit_price) {
      newItem.extended_price = newItem.quantity * newItem.unit_price;
    }

    // afterDisplayOrder is optional - if not provided, item is added at end
    const afterDisplayOrder = body.afterDisplayOrder !== undefined
      ? parseInt(body.afterDisplayOrder, 10)
      : undefined;

    const newId = await estimatePreparationRepository.addItem(
      estimateId,
      newItem,
      afterDisplayOrder
    );

    // Return the new item
    const createdItem = await estimatePreparationRepository.getItemById(newId);
    res.status(201).json({ success: true, data: createdItem });
  } catch (error) {
    console.error('Error adding preparation item:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to add preparation item'
    });
  }
};

/**
 * Delete a preparation item
 * @route DELETE /estimates/:estimateId/preparation-items/:itemId
 */
export const deletePreparationItem = async (req: AuthRequest, res: Response) => {
  try {
    const estimateValidation = validateEstimateId(req.params.estimateId, res);
    if (!estimateValidation.isValid) return;
    const estimateId = estimateValidation.value!;

    const itemValidation = validateItemId(req.params.itemId, res);
    if (!itemValidation.isValid) return;
    const itemId = itemValidation.value!;

    // Verify item belongs to this estimate
    const itemEstimateId = await estimatePreparationRepository.getEstimateIdForItem(itemId);
    if (itemEstimateId !== estimateId) {
      return res.status(404).json({
        success: false,
        message: 'Item not found in this estimate'
      });
    }

    const success = await estimatePreparationRepository.deleteItem(itemId);

    if (success) {
      res.json({ success: true, message: 'Item deleted' });
    } else {
      res.status(404).json({ success: false, message: 'Item not found' });
    }
  } catch (error) {
    console.error('Error deleting preparation item:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to delete preparation item'
    });
  }
};

/**
 * Reorder preparation items (for drag-and-drop)
 * @route POST /estimates/:estimateId/preparation-items/reorder
 */
export const reorderPreparationItems = async (req: AuthRequest, res: Response) => {
  try {
    const validation = validateEstimateId(req.params.estimateId, res);
    if (!validation.isValid) return;
    const estimateId = validation.value!;

    const { itemIds } = req.body;

    if (!Array.isArray(itemIds) || itemIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'itemIds array is required'
      });
    }

    // Validate all IDs are numbers
    const numericIds = itemIds.map((id: any) => parseInt(id, 10));
    if (numericIds.some(isNaN)) {
      return res.status(400).json({
        success: false,
        message: 'All item IDs must be valid numbers'
      });
    }

    await estimatePreparationRepository.reorderItems(estimateId, numericIds);

    res.json({ success: true, message: 'Items reordered' });
  } catch (error) {
    console.error('Error reordering preparation items:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to reorder preparation items'
    });
  }
};

/**
 * Toggle row type between regular and description-only
 * @route POST /estimates/:estimateId/preparation-items/:itemId/toggle-type
 */
export const togglePreparationItemType = async (req: AuthRequest, res: Response) => {
  try {
    const estimateValidation = validateEstimateId(req.params.estimateId, res);
    if (!estimateValidation.isValid) return;
    const estimateId = estimateValidation.value!;

    const itemValidation = validateItemId(req.params.itemId, res);
    if (!itemValidation.isValid) return;
    const itemId = itemValidation.value!;

    // Verify item belongs to this estimate
    const itemEstimateId = await estimatePreparationRepository.getEstimateIdForItem(itemId);
    if (itemEstimateId !== estimateId) {
      return res.status(404).json({
        success: false,
        message: 'Item not found in this estimate'
      });
    }

    const success = await estimatePreparationRepository.toggleRowType(itemId);

    if (success) {
      // Get the updated item
      const item = await estimatePreparationRepository.getItemById(itemId);

      // If switching to description-only, clear the QB item
      if (item?.is_description_only) {
        await estimatePreparationRepository.updateQbItemSelection(itemId, null, null);
      }

      const updatedItem = await estimatePreparationRepository.getItemById(itemId);
      res.json({ success: true, data: updatedItem });
    } else {
      res.status(404).json({ success: false, message: 'Item not found' });
    }
  } catch (error) {
    console.error('Error toggling preparation item type:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to toggle item type'
    });
  }
};

/**
 * Calculate totals from preparation items
 * @route GET /estimates/:estimateId/preparation-items/totals
 */
export const getPreparationTotals = async (req: AuthRequest, res: Response) => {
  try {
    const validation = validateEstimateId(req.params.estimateId, res);
    if (!validation.isValid) return;
    const estimateId = validation.value!;

    const totals = await estimatePreparationRepository.calculateTotals(estimateId);

    res.json({ success: true, data: totals });
  } catch (error) {
    console.error('Error calculating preparation totals:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to calculate totals'
    });
  }
};
