// File Clean up Finished: 2025-11-21
// Created from extraction of part management methods from orderService.ts
// Methods: recalculatePartDisplayNumbers, getOrderPartById, updateSpecsDisplayName,
//          toggleIsParent, updatePartSpecsQty, reorderParts, addPartRow,
//          removePartRow, updateOrderParts

/**
 * Order Parts Service
 * Business Logic for Order Part Management
 *
 * Handles:
 * - Part CRUD operations (add, remove, update)
 * - Part reordering and display number calculation
 * - Specifications management (display name, qty)
 * - Parent/child hierarchy (is_parent toggle)
 * - Batch part updates
 *
 * Phase 2.1 - 5.1
 */

import { orderPartRepository } from '../repositories/orderPartRepository';
import { orderRepository } from '../repositories/orderRepository';
import { customerRepository } from '../repositories/customerRepository';
import { mapSpecsDisplayNameToTypes } from '../utils/specsTypeMapper';
import { mapQBItemNameToSpecsDisplayName } from '../utils/qbItemNameMapper';
import { autoFillSpecifications } from './specsAutoFill';

export class OrderPartsService {

  // =====================================================
  // PART DISPLAY NUMBER MANAGEMENT (Phase 2.1)
  // =====================================================

  /**
   * Recalculate display_number for all parts in an order
   * Also recalculates is_parent based on position (first part is always parent)
   *
   * Display number logic:
   * - Parents get numeric display_number (1, 2, 3...)
   * - Children get parent number + letter (1a, 1b, 2a...)
   * - First part is always a parent
   */
  async recalculatePartDisplayNumbers(orderId: number): Promise<void> {
    // Get all parts for this order, ordered by part_number
    const parts = await orderPartRepository.getOrderParts(orderId);

    if (parts.length === 0) return;

    // Sort by part_number to ensure correct ordering
    parts.sort((a, b) => a.part_number - b.part_number);

    // First part is always a parent
    let currentParentNumber = 1;
    let currentChildLetter = 'a';

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      let newIsParent = part.is_parent;
      let newDisplayNumber = '';

      // First part is always a parent
      if (i === 0) {
        newIsParent = true;
        newDisplayNumber = String(currentParentNumber);
        currentParentNumber++;
        currentChildLetter = 'a';
      } else if (part.is_parent) {
        // This part is marked as a parent
        newDisplayNumber = String(currentParentNumber);
        currentParentNumber++;
        currentChildLetter = 'a';
      } else {
        // This part is a child - assign parent number + letter
        newDisplayNumber = `${currentParentNumber - 1}${currentChildLetter}`;
        // Increment letter for next child
        currentChildLetter = String.fromCharCode(currentChildLetter.charCodeAt(0) + 1);
      }

      // Update part if display_number or is_parent changed
      if (part.display_number !== newDisplayNumber || part.is_parent !== newIsParent) {
        await orderPartRepository.updateOrderPart(part.part_id, {
          display_number: newDisplayNumber,
          is_parent: newIsParent
        });
      }
    }
  }

  // =====================================================
  // PART SPECIFICATIONS MANAGEMENT (Phase 3.1-3.3)
  // =====================================================

  /**
   * Get order part by ID
   * Helper method for other service methods
   */
  async getOrderPartById(partId: number): Promise<any | null> {
    return await orderPartRepository.getOrderPartById(partId);
  }

  /**
   * Update specs display name and regenerate specifications
   * Phase 3.1
   *
   * This method:
   * 1. Gets the part to determine if parent or regular row
   * 2. Maps specs_display_name to spec types
   * 3. Regenerates the SPECIFICATIONS column (clears existing templates)
   * 4. Auto-fills static defaults (always) and dynamic values (if qb_item_name matches)
   * 5. Auto-demotes to sub-item if specs_display_name is cleared
   */
  async updateSpecsDisplayName(
    partId: number,
    specsDisplayName: string | null
  ): Promise<any> {
    // Get the part to check if it's parent or regular row
    const part = await orderPartRepository.getOrderPartById(partId);
    if (!part) {
      throw new Error('Part not found');
    }

    // Determine if this is a parent or regular row
    const displayNumber = part.display_number || '';
    const isSubItem = /[a-zA-Z]/.test(displayNumber);
    const isParentOrRegular = part.is_parent || !isSubItem;

    // Call mapper to get spec types
    const specTypes = mapSpecsDisplayNameToTypes(specsDisplayName, isParentOrRegular);

    // Build new specifications object
    // Clear all existing template fields and create new ones based on mapper
    const newSpecifications: any = {};

    // Populate template fields based on mapped spec types
    specTypes.forEach((specType, index) => {
      const rowNum = index + 1;
      newSpecifications[`_template_${rowNum}`] = specType.name;
    });

    // Auto-fill specifications if we have a specs display name
    let finalSpecifications = newSpecifications;
    if (specsDisplayName) {
      try {
        // Check if qb_item_name maps to the selected specsDisplayName
        // If match → run both static defaults AND dynamic parsing
        // If no match → run static defaults only (by passing empty qbItemName/calculationDisplay)
        const mappedFromQB = mapQBItemNameToSpecsDisplayName(part.qb_item_name);
        const qbMatchesSelection = mappedFromQB === specsDisplayName;

        // Get customer preferences for drain holes default
        let customerPreferences: { drain_holes_yes_or_no?: boolean } | undefined;
        try {
          const order = await orderRepository.getOrderById(part.order_id);
          if (order?.customer_id) {
            const customer = await customerRepository.getCustomerById(order.customer_id);
            if (customer) {
              customerPreferences = {
                drain_holes_yes_or_no: customer.drain_holes_yes_or_no === 1
              };
            }
          }
        } catch (e) {
          console.warn('[updateSpecsDisplayName] Could not fetch customer preferences:', e);
        }

        // Call auto-fill with appropriate data
        const autoFillResult = await autoFillSpecifications({
          // Only pass QB data if it maps to the selected Item Name
          qbItemName: qbMatchesSelection ? (part.qb_item_name || '') : '',
          specsDisplayName: specsDisplayName,
          // invoice_description contains the calculationDisplay from estimate
          calculationDisplay: qbMatchesSelection ? (part.invoice_description || '') : '',
          currentSpecifications: newSpecifications,
          isParentOrRegular,
          customerPreferences
        });

        finalSpecifications = autoFillResult.specifications;
        console.log('[updateSpecsDisplayName] Auto-fill result:', {
          qbMatchesSelection,
          mappedFromQB,
          specsDisplayName,
          filledFields: autoFillResult.autoFilledFields,
          warnings: autoFillResult.warnings
        });
      } catch (autoFillError) {
        console.error('[updateSpecsDisplayName] Auto-fill error:', autoFillError);
        // Continue with empty specs if auto-fill fails
      }
    }

    // Prepare update data
    const updateData: any = {
      specs_display_name: specsDisplayName,
      specifications: finalSpecifications
    };

    // Auto-demote to sub-item if specs_display_name is being cleared
    if (!specsDisplayName && part.is_parent) {
      updateData.is_parent = false;
    }

    // Update the order part
    await orderPartRepository.updateOrderPart(partId, updateData);

    // Fetch and return updated part
    const updatedPart = await orderPartRepository.getOrderPartById(partId);
    if (!updatedPart) {
      throw new Error('Failed to fetch updated part');
    }

    return updatedPart;
  }

  /**
   * Toggle is_parent status for an order part
   * Phase 3.2
   *
   * Validation: Cannot promote to parent without specs_display_name
   * When converting to parent for the first time, sets quantity to 1 if currently 0/null
   */
  async toggleIsParent(partId: number): Promise<any> {
    const part = await orderPartRepository.getOrderPartById(partId);
    if (!part) {
      throw new Error('Part not found');
    }

    const newIsParent = !part.is_parent;

    // Validation: Cannot set as parent if no specs_display_name
    if (newIsParent && !part.specs_display_name) {
      throw new Error('Cannot promote to Base Item: Please select an Item Name first.');
    }

    // When promoting to parent, default quantity to 1 if currently 0 or null
    const updates: any = { is_parent: newIsParent };
    if (newIsParent && (!part.quantity || part.quantity === 0)) {
      updates.quantity = 1;
    }

    await orderPartRepository.updateOrderPart(partId, updates);

    const updatedPart = await orderPartRepository.getOrderPartById(partId);
    if (!updatedPart) {
      throw new Error('Failed to fetch updated part');
    }

    return updatedPart;
  }

  /**
   * Update specs_qty for an order part
   * Phase 3.3
   *
   * Validates specs_qty is a non-negative number
   */
  async updatePartSpecsQty(partId: number, specsQty: number): Promise<any> {
    if (specsQty < 0) {
      throw new Error('specs_qty must be a non-negative number');
    }

    const part = await orderPartRepository.getOrderPartById(partId);
    if (!part) {
      throw new Error('Part not found');
    }

    await orderPartRepository.updateOrderPart(partId, { specs_qty: specsQty });

    const updatedPart = await orderPartRepository.getOrderPartById(partId);
    if (!updatedPart) {
      throw new Error('Failed to fetch updated part');
    }

    return updatedPart;
  }

  // =====================================================
  // PART MANAGEMENT (Phase 4.1-4.3)
  // =====================================================

  /**
   * Reorder parts in bulk (for drag-and-drop)
   * Phase 4.1
   *
   * Validates all partIds belong to order and all parts included
   */
  async reorderParts(orderId: number, partIds: number[]): Promise<void> {
    const allParts = await orderPartRepository.getOrderParts(orderId);

    // Validate all partIds belong to this order
    const validPartIds = new Set(allParts.map(p => p.part_id));
    const invalidParts = partIds.filter(id => !validPartIds.has(id));

    if (invalidParts.length > 0) {
      throw new Error(`Invalid part IDs: ${invalidParts.join(', ')}`);
    }

    // Validate all parts included
    if (partIds.length !== allParts.length) {
      throw new Error('All parts must be included in the reorder');
    }

    // Update part_number for each part based on new order (1-indexed)
    for (let i = 0; i < partIds.length; i++) {
      await orderPartRepository.updateOrderPart(partIds[i], { part_number: i + 1 });
    }

    // Recalculate display numbers and is_parent for all parts
    await this.recalculatePartDisplayNumbers(orderId);
  }

  /**
   * Add a new part row to the order
   * Phase 4.2
   *
   * Creates new part with default values and recalculates display numbers
   */
  async addPartRow(orderId: number): Promise<number> {
    // Get all existing parts to determine next part_number
    const allParts = await orderPartRepository.getOrderParts(orderId);
    const maxPartNumber = allParts.length > 0
      ? Math.max(...allParts.map(p => p.part_number))
      : 0;

    // Create new part with default values
    const partId = await orderPartRepository.createOrderPart({
      order_id: orderId,
      part_number: maxPartNumber + 1,
      product_type: 'New Part',
      product_type_id: 'custom',
      is_parent: false,
      quantity: null,
      specifications: {}
    });

    // Recalculate display numbers for all parts
    await this.recalculatePartDisplayNumbers(orderId);

    return partId;
  }

  /**
   * Remove a part row from the order
   * Phase 4.3
   *
   * Validates ownership, deletes part, and renumbers remaining parts
   */
  async removePartRow(orderId: number, partId: number): Promise<void> {
    // Get the part to verify it exists and belongs to this order
    const part = await orderPartRepository.getOrderPartById(partId);
    if (!part) {
      throw new Error('Part not found');
    }
    if (part.order_id !== orderId) {
      throw new Error('Part does not belong to this order');
    }

    // Delete the part (cascade will handle related tasks)
    await orderPartRepository.deleteOrderPart(partId);

    // Get remaining parts and renumber them sequentially
    const remainingParts = await orderPartRepository.getOrderParts(orderId);
    remainingParts.sort((a, b) => a.part_number - b.part_number);

    // Renumber parts sequentially
    for (let i = 0; i < remainingParts.length; i++) {
      const expectedPartNumber = i + 1;
      if (remainingParts[i].part_number !== expectedPartNumber) {
        await orderPartRepository.updateOrderPart(remainingParts[i].part_id, {
          part_number: expectedPartNumber
        });
      }
    }

    // Recalculate display numbers for all remaining parts
    await this.recalculatePartDisplayNumbers(orderId);
  }

  // =====================================================
  // BATCH OPERATIONS (Phase 5.1)
  // =====================================================

  /**
   * Update order parts in bulk
   * Phase 5.1
   *
   * Updates multiple parts at once (for grid editing)
   */
  async updateOrderParts(orderId: number, parts: any[]): Promise<void> {
    for (const part of parts) {
      if (!part.part_id) {
        continue;
      }

      await orderPartRepository.updateOrderPart(part.part_id, {
        product_type: part.product_type,
        part_scope: part.part_scope,
        qb_item_name: part.qb_item_name,
        qb_description: part.qb_description,
        specifications: part.specifications,
        invoice_description: part.invoice_description,
        quantity: part.quantity,
        unit_price: part.unit_price,
        extended_price: part.extended_price,
        production_notes: part.production_notes
      });
    }
  }

  /**
   * Duplicate a part row with specified data mode
   * Phase 1.5.e - Row Operations Polish
   *
   * @param orderId - The order ID
   * @param partId - The source part ID to duplicate
   * @param mode - 'specs' | 'invoice' | 'both' - which data to copy
   * @returns The new part ID
   */
  async duplicatePart(
    orderId: number,
    partId: number,
    mode: 'specs' | 'invoice' | 'both'
  ): Promise<number> {
    // Get the source part
    const sourcePart = await orderPartRepository.getOrderPartById(partId);
    if (!sourcePart) {
      throw new Error('Part not found');
    }
    if (sourcePart.order_id !== orderId) {
      throw new Error('Part does not belong to this order');
    }

    // Get all parts to determine insertion position
    const allParts = await orderPartRepository.getOrderParts(orderId);
    allParts.sort((a, b) => a.part_number - b.part_number);

    // Find the source part's position
    const sourceIndex = allParts.findIndex(p => p.part_id === partId);
    if (sourceIndex === -1) {
      throw new Error('Part not found in order');
    }

    // Shift all parts after the source part by incrementing their part_number
    for (let i = sourceIndex + 1; i < allParts.length; i++) {
      await orderPartRepository.updateOrderPart(allParts[i].part_id, {
        part_number: allParts[i].part_number + 1
      });
    }

    // Build new part data based on mode
    const newPartData: any = {
      order_id: orderId,
      part_number: sourcePart.part_number + 1, // Insert right after source
      product_type: 'New Part',
      product_type_id: 'custom',
      is_parent: false,
      quantity: null,
      specifications: {}
    };

    // Copy specs data if mode is 'specs' or 'both'
    if (mode === 'specs' || mode === 'both') {
      newPartData.product_type = sourcePart.product_type;
      newPartData.part_scope = sourcePart.part_scope;
      newPartData.specs_display_name = sourcePart.specs_display_name;
      newPartData.specs_qty = sourcePart.specs_qty;
      newPartData.specifications = sourcePart.specifications || {};
      newPartData.is_parent = sourcePart.is_parent;
    }

    // Copy invoice data if mode is 'invoice' or 'both'
    if (mode === 'invoice' || mode === 'both') {
      newPartData.qb_item_name = sourcePart.qb_item_name;
      newPartData.qb_description = sourcePart.qb_description;
      newPartData.invoice_description = sourcePart.invoice_description;
      newPartData.quantity = sourcePart.quantity;
      newPartData.unit_price = sourcePart.unit_price;
      newPartData.extended_price = sourcePart.extended_price;
    }

    // Create the new part
    const newPartId = await orderPartRepository.createOrderPart(newPartData);

    // Recalculate display numbers for all parts
    await this.recalculatePartDisplayNumbers(orderId);

    return newPartId;
  }

  // =====================================================
  // IMPORT FROM ESTIMATE (QB Description Import)
  // =====================================================

  /**
   * Import QB descriptions from estimate preparation items to order parts
   * Batch updates specified fields on target parts
   *
   * @param orderId - The order ID
   * @param imports - Array of import instructions
   * @returns Object with count of updated parts
   */
  async importFromEstimate(
    orderId: number,
    imports: Array<{
      targetPartId: number;
      qb_item_name?: string | null;
      qb_description?: string | null;
      quantity?: number;
      unit_price?: number;
    }>
  ): Promise<{ updated: number }> {
    return orderPartRepository.batchImportToOrderParts(orderId, imports);
  }
}

export const orderPartsService = new OrderPartsService();
