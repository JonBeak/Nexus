/**
 * Estimate Template Service
 *
 * Extracted from estimateService.ts during refactoring
 * Handles template creation and item management for estimates
 *
 * Responsibilities:
 * - Default template creation for new estimates
 * - Item clearing and resetting operations
 * - Template section management
 */

import { pool } from '../../config/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { estimateHistoryService } from '../estimateHistoryService';
import { DynamicTemplateService } from '../dynamicTemplateService';

export class EstimateTemplateService {

  // =============================================
  // TEMPLATE CREATION FOR NEW ESTIMATES
  // =============================================

  /**
   * Creates default template rows in job_estimate_items for a new estimate
   * This ensures new estimates have proper field configurations and dropdown options
   *
   * ✅ FIXED: Now uses DynamicTemplateService to populate dropdown options consistently
   * with manual product selection, resolving Reset button sub-item dropdown issue
   */
  async createDefaultTemplateRows(connection: any, estimateId: number, userId: number): Promise<void> {
    const dynamicTemplateService = new DynamicTemplateService();

    const templateRows = [
      // Channel Letters + sub-item products
      { productTypeId: 1, productTypeName: 'Channel Letters', order: 1, isMain: true },
      { productTypeId: 16, productTypeName: '↳ Vinyl', order: 2, isMain: false, parentRef: 1 },
      { productTypeId: 17, productTypeName: '↳ Painting', order: 3, isMain: false, parentRef: 1 },

      // Substrate Cut + sub-item products
      { productTypeId: 3, productTypeName: 'Substrate Cut', order: 4, isMain: true },
      { productTypeId: 16, productTypeName: '↳ Vinyl', order: 5, isMain: false, parentRef: 4 },
      { productTypeId: 17, productTypeName: '↳ Painting', order: 6, isMain: false, parentRef: 4 },

      // Backer + sub-item products
      { productTypeId: 4, productTypeName: 'Backer', order: 7, isMain: true },
      { productTypeId: 16, productTypeName: '↳ Vinyl', order: 8, isMain: false, parentRef: 7 },
      { productTypeId: 17, productTypeName: '↳ Painting', order: 9, isMain: false, parentRef: 7 },

      // Assembly
      { productTypeId: 14, productTypeName: 'Assembly', order: 10, isMain: true },

      // Push Thru + empty sub-item
      { productTypeId: 5, productTypeName: 'Push Thru', order: 11, isMain: true },
      { productTypeId: 16, productTypeName: '↳ Vinyl', order: 12, isMain: false, parentRef: 11 },

      // Blade Sign + empty sub-item
      { productTypeId: 6, productTypeName: 'Blade Sign', order: 13, isMain: true },
      { productTypeId: 16, productTypeName: '↳ Vinyl', order: 14, isMain: false, parentRef: 13 },

      // LED Neon
      { productTypeId: 7, productTypeName: 'LED Neon', order: 15, isMain: true },

      // Custom
      { productTypeId: 9, productTypeName: 'Custom', order: 16, isMain: true },

      // Multiplier
      { productTypeId: 23, productTypeName: 'Multiplier', order: 17, isMain: true },

      // Discount/Fee
      { productTypeId: 22, productTypeName: 'Discount/Fee', order: 18, isMain: true },

      // UL
      { productTypeId: 12, productTypeName: 'UL', order: 19, isMain: true },

      // Shipping
      { productTypeId: 13, productTypeName: 'Shipping', order: 20, isMain: true }
    ];

    // Track parent IDs for sub-items
    const parentIdMap = new Map();

    // Insert template rows with fully populated templates
    for (const templateRow of templateRows) {
      try {
        // ✅ FIX: Use DynamicTemplateService to get fully populated template with dropdown options
        const productTemplate = await dynamicTemplateService.getProductTemplate(templateRow.productTypeId);

        // Create grid_data with empty field values (consistent with existing pattern)
        const gridData = {
          field1: '',
          field2: '',
          field3: '',
          field4: '',
          field5: '',
          field6: '',
          field7: '',
          field8: '',
          field9: '',
          field10: '',
          field11: '',
          field12: '',
          fieldConfig: productTemplate.rows, // Use populated field config
          isMainRow: templateRow.isMain
        };

        // Get parent_item_id for sub-items
        let parentItemId = null;
        if (templateRow.parentRef && parentIdMap.has(templateRow.parentRef)) {
          parentItemId = parentIdMap.get(templateRow.parentRef);
        }

        // Insert without template_data (uses database templates only)
        const [result] = await connection.execute(
          `INSERT INTO job_estimate_items (
            estimate_id, product_type_id, item_name,
            item_order, grid_data, parent_item_id
          ) VALUES (?, ?, ?, ?, ?, ?)`,
          [
            estimateId,
            templateRow.productTypeId,
            templateRow.productTypeName,
            templateRow.order,
            JSON.stringify(gridData),
            parentItemId
          ]) as [ResultSetHeader];

        // Store parent ID for sub-items
        if (templateRow.isMain) {
          parentIdMap.set(templateRow.order, result.insertId);
        }

      } catch (error) {
        console.error(`Error creating template row for product type ${templateRow.productTypeId}:`, error);
        // Continue with other rows even if one fails
        continue;
      }
    }
  }

  /**
   * Add default template section to the end of an estimate
   */
  async addTemplateSection(estimateId: number, userId: number): Promise<void> {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // Get the current max sequence order
      const [maxOrderRows] = await connection.execute<RowDataPacket[]>(
        'SELECT COALESCE(MAX(item_order), 0) as max_order FROM job_estimate_items WHERE estimate_id = ?',
        [estimateId]
      );

      const startingOrder = (maxOrderRows[0]?.max_order || 0) + 1;

      // Add template rows starting from the new order position
      await this.createDefaultTemplateRowsWithOffset(connection, estimateId, userId, startingOrder);

      // Update the estimate's updated_at timestamp
      await connection.execute(
        'UPDATE job_estimates SET updated_by = ?, updated_at = NOW() WHERE id = ?',
        [userId, estimateId]
      );

      await connection.commit();

    } catch (error) {
      await connection.rollback();
      console.error('Service error adding template section:', error);
      throw new Error('Failed to add template section');
    } finally {
      connection.release();
    }
  }

  // =============================================
  // ITEM CLEARING AND RESETTING
  // =============================================

  /**
   * Clear all items from an estimate and recreate default template
   */
  async resetEstimateItems(estimateId: number, userId: number): Promise<void> {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // Delete all existing items for this estimate
      await connection.execute(
        'DELETE FROM job_estimate_items WHERE estimate_id = ?',
        [estimateId]
      );

      // Recreate default template rows
      await this.createDefaultTemplateRows(connection, estimateId, userId);

      // Update the estimate's updated_at timestamp
      await connection.execute(
        'UPDATE job_estimates SET updated_by = ?, updated_at = NOW() WHERE id = ?',
        [userId, estimateId]
      );

      await connection.commit();

    } catch (error) {
      await connection.rollback();
      console.error('Service error clearing estimate items:', error);
      throw new Error('Failed to clear estimate items');
    } finally {
      connection.release();
    }
  }

  /**
   * Delete all items from an estimate (clear all rows)
   */
  async clearAllEstimateItems(estimateId: number, userId: number): Promise<void> {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // Delete all existing items for this estimate
      await connection.execute(
        'DELETE FROM job_estimate_items WHERE estimate_id = ?',
        [estimateId]
      );

      // Create a single channel letters row (empty fields)
      await connection.execute(
        `INSERT INTO job_estimate_items (
          estimate_id, product_type_id, item_order, item_index
        ) VALUES (?, 1, 1, 1)`,
        [estimateId]
      );

      // Update the estimate's updated_at timestamp
      await connection.execute(
        'UPDATE job_estimates SET updated_by = ?, updated_at = NOW() WHERE id = ?',
        [userId, estimateId]
      );

      await connection.commit();

    } catch (error) {
      await connection.rollback();
      console.error('Service error clearing all estimate items:', error);
      throw new Error('Failed to clear all estimate items');
    } finally {
      connection.release();
    }
  }

  /**
   * Remove empty rows from an estimate (keep only rows with data)
   */
  async clearEmptyItems(estimateId: number, userId: number): Promise<void> {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // Get all items for this estimate
      const [items] = await connection.execute<RowDataPacket[]>(
        'SELECT * FROM job_estimate_items WHERE estimate_id = ? ORDER BY item_order',
        [estimateId]
      );

      // Filter out empty rows - keep rows that have any input field data (excluding QTY)
      const itemsToKeep = (items as any[]).filter(item => {
        // 🔍 DEBUG: Log what we're checking (remove after testing)
        console.log(`🔍 CLEAR EMPTY: Checking item ${item.id} (product_type_id: ${item.product_type_id}):`);

        // ALWAYS preserve Subtotal and Divider items regardless of content
        const isSpecialStructuralItem = item.product_type_id === 21 || item.product_type_id === 25; // Subtotal || Divider

        if (isSpecialStructuralItem) {
          console.log(`   Preserving structural item: ${item.product_type_id === 21 ? 'Subtotal' : 'Divider'}`);
          return true;
        }

        // Check if any grid data fields have content (excluding system fields)
        let hasInputData = false;
        if (item.grid_data) {
          let gridData: Record<string, any> = {};
          try {
            // 🐛 FIX: Handle MySQL JSON column - comes back as object, not string
            if (typeof item.grid_data === 'object' && item.grid_data !== null) {
              gridData = item.grid_data; // Already parsed by MySQL driver
            } else if (typeof item.grid_data === 'string') {
              gridData = JSON.parse(item.grid_data); // Parse JSON string
            } else {
              gridData = {}; // Fallback for null/undefined
            }

            console.log(`   Grid data type: ${typeof item.grid_data}, keys:`, Object.keys(gridData));

            // System fields to exclude when checking for empty rows
            const systemFields = [
              'qty', 'quantity', 'isMainRow', 'fieldConfig',
              'id', 'dbId', 'type', 'productTypeId', 'productTypeName',
              'indent', 'assemblyId', 'parentProductId'
            ];

            hasInputData = Object.keys(gridData).some(key => {
              // Skip system fields
              if (systemFields.includes(key)) {
                return false;
              }

              const value = gridData[key];
              // 🐛 FIX: Don't exclude valid falsy values like 0, false
              const isValueMeaningful = value != null && value.toString().trim() !== '';

              if (isValueMeaningful) {
                console.log(`   Found meaningful data in field '${key}':`, value);
              }

              return isValueMeaningful;
            });
          } catch (error) {
            console.error(`⚠️  CLEAR EMPTY: Error parsing grid_data for item ${item.id}:`, error);
            console.error('   Grid data value:', item.grid_data);
            console.error('   Grid data type:', typeof item.grid_data);
            hasInputData = false;
          }
        }

        // Also check customer description and internal notes
        const hasOtherData = (item.customer_description && item.customer_description.trim() !== '') ||
                           (item.internal_notes && item.internal_notes.trim() !== '');

        const willKeep = hasInputData || hasOtherData;
        console.log(`   Result: hasInputData=${hasInputData}, hasOtherData=${hasOtherData}, willKeep=${willKeep}`);

        return willKeep;
      });

      // 🔍 DEBUG: Log filtering results
      console.log(`🔍 CLEAR EMPTY SUMMARY: Found ${items.length} total items, keeping ${itemsToKeep.length}`);

      // Safeguard: Never delete everything if we can't determine emptiness reliably
      if (items.length > 0 && itemsToKeep.length === 0) {
        console.warn(`⚠️  CLEAR EMPTY: All ${items.length} rows detected as empty - investigating...`);
        // Log first few items for analysis
        items.slice(0, 3).forEach((item, i) => {
          console.warn(`   Sample item ${i + 1}:`, {
            id: item.id,
            productTypeId: item.product_type_id,
            gridDataType: typeof item.grid_data,
            gridDataSample: typeof item.grid_data === 'object' ? Object.keys(item.grid_data || {}) : item.grid_data
          });
        });
      }

      // Delete all items first
      await connection.execute(
        'DELETE FROM job_estimate_items WHERE estimate_id = ?',
        [estimateId]
      );

      // If no items to keep, create one empty row
      if (itemsToKeep.length === 0) {
        console.log('🔍 CLEAR EMPTY: Creating single Channel Letters row (no items had data)');
        await connection.execute(
          `INSERT INTO job_estimate_items (
            estimate_id, product_type_id, item_order, item_index
          ) VALUES (?, 1, 1, 1)`,
          [estimateId]
        );
      } else {
        console.log(`🔍 CLEAR EMPTY: Recreating ${itemsToKeep.length} items with data`);
        // Recreate the kept items with new order
        for (let i = 0; i < itemsToKeep.length; i++) {
          const item = itemsToKeep[i];
          await connection.execute(
            `INSERT INTO job_estimate_items (
              estimate_id, assembly_group_id, parent_item_id,
              product_type_id, item_name, item_order, item_index, grid_data,
              complexity_score, unit_price, extended_price,
              customer_description, internal_notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              estimateId, item.assembly_group_id,
              item.parent_item_id, item.product_type_id, item.item_name,
              i + 1, i + 1, item.grid_data,
              item.complexity_score,
              item.unit_price, item.extended_price,
              item.customer_description, item.internal_notes
            ]
          );
        }
      }

      // Update the estimate's updated_at timestamp
      await connection.execute(
        'UPDATE job_estimates SET updated_by = ?, updated_at = NOW() WHERE id = ?',
        [userId, estimateId]
      );

      await connection.commit();

      // ✅ SIMPLIFIED: Use existing audit system for Clear Empty logging
      // Get job_id for history logging
      const [jobRows] = await pool.execute<RowDataPacket[]>(
        'SELECT job_id FROM job_estimates WHERE id = ?',
        [estimateId]
      );
      const jobId = jobRows[0]?.job_id;

      if (jobId) {
        try {
          await estimateHistoryService.logAction({
            estimateId: estimateId,
            jobId: jobId,
            actionType: 'cleared',
            performedByUserId: userId,
            metadata: {
              empty_rows_removed: items.length - itemsToKeep.length,
              rows_remaining: itemsToKeep.length
            },
            notes: `Cleared ${items.length - itemsToKeep.length} empty rows, ${itemsToKeep.length} rows remaining`
          });
        } catch (historyError) {
          console.error('Failed to log clear empty to history:', historyError);
          // Don't throw - clear operation was successful
        }
      }

    } catch (error) {
      await connection.rollback();
      console.error('Service error clearing empty items:', error);
      throw new Error('Failed to clear empty items');
    } finally {
      connection.release();
    }
  }

  // =============================================
  // PRIVATE HELPER METHODS
  // =============================================

  /**
   * Creates default template rows with a starting order offset
   */
  private async createDefaultTemplateRowsWithOffset(connection: any, estimateId: number, userId: number, startingOrder: number): Promise<void> {
    const templateRows = [
      // Channel Letters + sub-item products
      { productTypeId: 1, productTypeName: 'Channel Letters', order: startingOrder, isMain: true },
      { productTypeId: 16, productTypeName: '↳ Vinyl', order: startingOrder + 1, isMain: false, parentRef: startingOrder },
      { productTypeId: 17, productTypeName: '↳ Painting', order: startingOrder + 2, isMain: false, parentRef: startingOrder },

      // Substrate Cut + sub-item products
      { productTypeId: 3, productTypeName: 'Substrate Cut', order: startingOrder + 3, isMain: true },
      { productTypeId: 16, productTypeName: '↳ Vinyl', order: startingOrder + 4, isMain: false, parentRef: startingOrder + 3 },
      { productTypeId: 17, productTypeName: '↳ Painting', order: startingOrder + 5, isMain: false, parentRef: startingOrder + 3 },

      // Backer + sub-item products
      { productTypeId: 4, productTypeName: 'Backer', order: startingOrder + 6, isMain: true },
      { productTypeId: 16, productTypeName: '↳ Vinyl', order: startingOrder + 7, isMain: false, parentRef: startingOrder + 6 },
      { productTypeId: 17, productTypeName: '↳ Painting', order: startingOrder + 8, isMain: false, parentRef: startingOrder + 6 },

      // Assembly
      { productTypeId: 14, productTypeName: 'Assembly', order: startingOrder + 9, isMain: true },

      // Push Thru + empty sub-item
      { productTypeId: 5, productTypeName: 'Push Thru', order: startingOrder + 10, isMain: true },
      { productTypeId: 16, productTypeName: '↳ Vinyl', order: startingOrder + 11, isMain: false, parentRef: startingOrder + 10 },

      // Blade Sign + empty sub-item
      { productTypeId: 6, productTypeName: 'Blade Sign', order: startingOrder + 12, isMain: true },
      { productTypeId: 16, productTypeName: '↳ Vinyl', order: startingOrder + 13, isMain: false, parentRef: startingOrder + 12 },

      // LED Neon
      { productTypeId: 7, productTypeName: 'LED Neon', order: startingOrder + 14, isMain: true },

      // Custom
      { productTypeId: 9, productTypeName: 'Custom', order: startingOrder + 15, isMain: true },

      // Multiplier
      { productTypeId: 23, productTypeName: 'Multiplier', order: startingOrder + 16, isMain: true },

      // Discount/Fee
      { productTypeId: 22, productTypeName: 'Discount/Fee', order: startingOrder + 17, isMain: true },

      // UL
      { productTypeId: 12, productTypeName: 'UL', order: startingOrder + 18, isMain: true },

      // Shipping
      { productTypeId: 13, productTypeName: 'Shipping', order: startingOrder + 19, isMain: true }
    ];

    for (const row of templateRows) {
      // Create a basic grid data structure
      const gridData = {
        productTypeId: row.productTypeId,
        productTypeName: row.productTypeName,
        quantity: '1',
        field1: '',
        field2: '',
        field3: '',
        field4: '',
        field5: '',
        field6: '',
        field7: '',
        field8: '',
        field9: '',
        field10: '',
        field11: '',
        field12: ''
      };

      await connection.execute(
        `INSERT INTO job_estimate_items (
          estimate_id, product_type_id, item_order, item_index,
          grid_data
        ) VALUES (?, ?, ?, ?, ?)`,
        [
          estimateId,
          row.productTypeId,
          row.order,
          row.order,
          JSON.stringify(gridData)
        ]
      );
    }
  }
}
