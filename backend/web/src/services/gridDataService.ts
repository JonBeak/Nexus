// File Clean up Finished: Nov 14, 2025 (Phase 2: Architectural refactoring)
// Changes:
//   - Removed direct pool.execute() calls
//   - Extracted database queries to estimateRepository methods
//   - Maintained transaction support in saveGridData()
//   - loadGridData() now uses estimateRepository.getEstimateItemsWithProductTypes()
//   - Draft checks use estimateRepository.getEstimateWithDraftCheckInTransaction()
//
// Note on pool usage (Nov 14, 2025):
//   - Uses pool.getConnection() for transaction support in saveGridData()
//   - Transactions require BEGIN/COMMIT/ROLLBACK with dedicated connection
//   - This is the CORRECT and ONLY valid use case for pool in services
//   - Cannot use query() helper for transactional operations
/**
 * Grid Data Service
 *
 * Extracted from estimateVersioningService.ts during refactoring
 * Handles Phase 4 grid data persistence, assembly management, and field transformations
 *
 * Responsibilities:
 * - Grid data persistence (saveGridData/loadGridData)
 * - Assembly group restoration and management
 * - Frontend ↔ Database transformation logic
 * - Item index mapping for sequential references
 *
 * CRITICAL: This service contains the most complex Phase 4 logic
 * Test thoroughly with existing estimates containing grid data
 */

import { pool } from '../config/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { DynamicTemplateService } from './dynamicTemplateService';
import { estimateHistoryService } from './estimateHistoryService';
import { EstimateRepository } from '../repositories/estimateRepository';

export class GridDataService {
  private estimateRepository = new EstimateRepository();
  
  // =============================================
  // PHASE 4: GRID DATA PERSISTENCE
  // =============================================

  async saveGridData(estimateId: number, gridRows: any[], userId: number, total?: number): Promise<void> {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // Validate estimate exists
      if (!(await this.estimateRepository.estimateExists(estimateId))) {
        throw new Error('Estimate not found');
      }

      // First, check if estimate is still a draft
      const draftCheck = await this.estimateRepository.getEstimateWithDraftCheckInTransaction(estimateId, connection);

      if (!draftCheck) {
        throw new Error('Cannot save grid data - estimate is already finalized');
      }

      // CONSOLIDATION UPDATE: Replace DELETE+INSERT with UPDATE+INSERT pattern
      // This preserves database IDs and prevents assembly field orphaning

      // Get existing items with their current database IDs
      const existingItems = await this.estimateRepository.getExistingEstimateItems(estimateId, connection);

      // Create mapping of existing database IDs
      const existingIdsByOrder = new Map<number, number>();
      existingItems.forEach((item: any, index: number) => {
        existingIdsByOrder.set(index + 1, item.id); // item_order starts at 1
      });

      // ✅ SIMPLIFIED: No item_index mapping needed for database ID system
      // Assembly fields will store database IDs directly from frontend

      // Phase 4: No groups required - use direct estimate → items relationship
      // Create ID mapping: frontend string ID -> database integer ID
      const idMapping = new Map<string, number>();
      const parentRelationships: Array<{ childDbId: number; parentFrontendId: string }> = [];

      // FIRST PASS: UPDATE existing items or INSERT new ones (preserves database IDs)
      
      for (let i = 0; i < gridRows.length; i++) {
        const row = gridRows[i];
        const itemOrder = i + 1;
        
        // Simplified: Use row position as logical index (can be enhanced later)
        let logicalItemIndex = i + 1;

        // 🐛 DEBUG: Log row data to understand what's being saved
        console.log(`🔍 SAVE: Row ${i + 1} productTypeId=${row.productTypeId}`, {
          rowType: row.rowType,
          productTypeName: row.productTypeName,
          qty: row.qty,
          hasFields: !!(row.field1 || row.field2 || row.field3)
        });

        // Assembly ID not sent in simplified structure - set to null
        let assemblyGroupId = null;

        // Build data object from flat structure sent by frontend
        const cleanRowData: Record<string, any> = {
          quantity: row.qty || '',
          field1: row.field1 || '',
          field2: row.field2 || '',
          field3: row.field3 || '',
          field4: row.field4 || '',
          field5: row.field5 || '',
          field6: row.field6 || '',
          field7: row.field7 || '',
          field8: row.field8 || '',
          field9: row.field9 || '',
          field10: row.field10 || '',
          field11: row.field11 || '',
          field12: row.field12 || ''
        };
        
        // ✅ SIMPLIFIED: Assembly fields already contain database IDs from frontend
        // No conversion needed - store database IDs directly
        if (row.productTypeId === 14) {
          // Assembly rows: field values (item_1, item_2, etc.) are already database IDs
          // Frontend will handle conversion between database IDs and display row numbers
        }
        
        // 🐛 DEBUG: Log custom fields being saved
        const customFields = ['channel_letter_style', 'letters_data', 'vinyl_type'];
        const customData: any = customFields.reduce((obj: any, field) => {
          if (cleanRowData[field] !== undefined) obj[field] = cleanRowData[field];
          return obj;
        }, {});

        // Handle product type requirements
        let productTypeId = row.productTypeId;

        // Trust the productTypeId from frontend - no type-based overrides
        // All product logic is now database-driven via product_types table
        if (!productTypeId) {
          // Only skip rows that have no productTypeId at all
          continue;
        }

        // Check if we can reuse an existing database ID
        const existingDbId = existingIdsByOrder.get(itemOrder);
        let dbId: number;

        if (existingDbId) {
          // UPDATE existing item (preserves database ID)
          await connection.execute(
            `UPDATE job_estimate_items SET
              assembly_group_id = ?,
              parent_item_id = ?,
              product_type_id = ?,
              item_name = ?,
              item_order = ?,
              item_index = ?,
              grid_data = ?,
              unit_price = ?,
              extended_price = ?,
              customer_description = ?,
              internal_notes = ?,
              updated_at = NOW()
            WHERE id = ?`,
            [
              assemblyGroupId,
              null, // Update without parent first
              productTypeId,
              row.productTypeName || 'Unnamed Item',
              itemOrder,
              logicalItemIndex,
              JSON.stringify(cleanRowData || {}),
              null, // unit_price not sent in simplified structure
              null, // extended_price not sent in simplified structure
              row.customerDescription || null,
              row.internalNotes || null,
              existingDbId
            ]
          );
          dbId = existingDbId;
        } else {
          // INSERT new item
          const [result] = await connection.execute<ResultSetHeader>(
            `INSERT INTO job_estimate_items (
              estimate_id,
              assembly_group_id,
              parent_item_id,
              product_type_id,
              item_name,
              item_order,
              item_index,
              grid_data,
              unit_price,
              extended_price,
              customer_description,
              internal_notes,
              created_at,
              updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
            [
              estimateId,
              assemblyGroupId,
              null, // Insert without parent first
              productTypeId,
              row.productTypeName || 'Unnamed Item',
              itemOrder,
              logicalItemIndex,
              JSON.stringify(cleanRowData || {}),
              null, // unit_price not sent in simplified structure
              null, // extended_price not sent in simplified structure
              row.customerDescription || null,
              row.internalNotes || null
            ]
          );
          dbId = result.insertId;
        }
        
        // Frontend doesn't send IDs in simplified structure - use position
        idMapping.set(`row-${i + 1}`, dbId);

        // parentProductId not sent in simplified structure - no parent relationships to track
      }

      // CLEANUP: Remove items that are no longer present (beyond current grid length)
      if (existingItems.length > gridRows.length) {
        await connection.execute(
          'DELETE FROM job_estimate_items WHERE estimate_id = ? AND item_order > ?',
          [estimateId, gridRows.length]
        );
      }

      // No parent relationships to process in simplified structure

      // Update estimate timestamp and total_amount
      if (total !== undefined) {
        console.log(`💰 Updating total_amount to ${total} for estimate ${estimateId}`);
        await connection.execute(
          'UPDATE job_estimates SET updated_by = ?, updated_at = NOW(), total_amount = ? WHERE id = ?',
          [userId, total, estimateId]
        );
      } else {
        await connection.execute(
          'UPDATE job_estimates SET updated_by = ?, updated_at = NOW() WHERE id = ?',
          [userId, estimateId]
        );
      }

      // Get job_id for history logging using repository
      const jobId = await this.estimateRepository.getJobIdByEstimateId(estimateId);

      await connection.commit();

      // Log grid data save to history (after successful commit)
      if (jobId) {
        try {
          await estimateHistoryService.logAction({
            estimateId: estimateId,
            jobId: jobId,
            actionType: 'grid_data_saved',
            performedByUserId: userId,
            metadata: {
              rows_count: gridRows.length,
              items_saved: gridRows.filter(r => r.productTypeId && r.productTypeId !== 14).length,
              assemblies_saved: gridRows.filter(r => r.productTypeId === 14).length
            },
            notes: `Grid data saved: ${gridRows.length} rows processed`
          });
        } catch (historyError) {
          console.error('Failed to log grid data save to history:', historyError);
          // Don't throw - grid save was successful
        }
      }
    } catch (error) {
      await connection.rollback();
      console.error('Service error saving grid data:', error);
      throw new Error('Failed to save grid data');
    } finally {
      connection.release();
    }
  }

  async loadGridData(estimateId: number): Promise<any[]> {
    try {
      console.log('🔍 Loading grid data for estimate ID:', estimateId);
      const rows = await this.estimateRepository.getEstimateItemsWithProductTypes(estimateId);

      const dynamicTemplateService = new DynamicTemplateService();
      
      // Build mapping from database ID to item_index for parent relationships
      const dbIdToItemIndex = new Map<number, number>();
      rows.forEach((item: any) => {
        if (item.item_index) {
          dbIdToItemIndex.set(item.id, item.item_index);
        }
      });

      // Convert database items back to frontend grid rows
      const gridRows = await Promise.all(rows.map(async (item: any) => {
        let gridData = {};
        try {
          // Handle MySQL JSON column - comes back as object, not string
          if (typeof item.grid_data === 'object' && item.grid_data !== null) {
            gridData = item.grid_data; // Already parsed by MySQL driver
          } else if (typeof item.grid_data === 'string') {
            gridData = JSON.parse(item.grid_data); // Parse JSON string
          } else {
            gridData = {}; // Fallback for null/undefined
          }
          
          // 🐛 DEBUG: Check for custom fields in loaded data
          const customFields = ['channel_letter_style', 'letters_data', 'vinyl_type'];
          const loadedCustomData: any = customFields.reduce((obj: any, field) => {
            if ((gridData as any)[field] !== undefined) obj[field] = (gridData as any)[field];
            return obj;
          }, {});
        } catch (parseError) {
          console.error('Error parsing grid_data JSON for item', item.id, parseError);
        }
        
        // Use database templates exclusively (no embedded template_data)
        let fieldConfig: any[] = [];

        if (item.product_type_id) {
          // Load template from database
          const template = await dynamicTemplateService.getProductTemplate(item.product_type_id);
          if (!template || !template.rows) {
            throw new Error(`Invalid template for product type ${item.product_type_id}`);
          }

          fieldConfig = template.rows.flat();
          console.log(`🏗️ Using database template for item ${item.id} (product type ${item.product_type_id})`);
        }
        
        
        // Use database ID for unique frontend IDs to prevent React key conflicts
        // item_index is kept for logical numbering in assembly references
        const frontendId = `item-${item.id}`;
        
        // Debug sub-items during load
        
        return {
          id: frontendId,
          dbId: item.id,                // ✅ CRITICAL: Database ID for stable assembly references
          itemIndex: item.item_index,   // ✅ DISPLAY ROW NUMBER: Database-stored display number for assembly fields
          productTypeId: item.product_type_id,
          productTypeName: item.product_type_name || item.item_name,
          productTypeCategory: item.product_type_category, // ✅ CRITICAL: For rowType determination
          assemblyId: item.assembly_group_id !== null ? item.assembly_group_id.toString() : undefined,
          indent: 0,
          data: {
            // Start with gridData fields first (user-entered values take priority)
            ...gridData,
            // Then add metadata fields that don't conflict
            itemName: item.item_name,
            unitPrice: item.unit_price,
            extendedPrice: item.extended_price,
            customerDescription: item.customer_description,
            internalNotes: item.internal_notes
          },
          fieldConfig, // ✅ Critical for field rendering
          isMainRow: item.product_type_category !== 'sub_item' && !item.parent_item_id,
          parentProductId: item.parent_item_id ? `item-${item.parent_item_id}` : undefined
        };
      }));

      // Assembly groups are already loaded from the database (assembly_group_id column)
      // No need to reconstruct from assembly field references

      return gridRows;
    } catch (error) {
      console.error('Service error loading grid data:', error);
      throw new Error('Failed to load grid data');
    }
  }

  // =============================================
  // COPY ROWS FROM ANOTHER ESTIMATE
  // =============================================

  /**
   * Copy rows from a source estimate and append to target estimate
   * @param targetEstimateId - The estimate to copy rows TO
   * @param sourceEstimateId - The estimate to copy rows FROM
   * @param rowIds - Array of database IDs of rows to copy (from source estimate)
   * @param userId - User performing the copy
   * @returns Number of rows copied
   */
  async copyRowsToEstimate(
    targetEstimateId: number,
    sourceEstimateId: number,
    rowIds: number[],
    userId: number
  ): Promise<{ copiedCount: number }> {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // Validate target estimate exists and is a draft
      const draftCheck = await this.estimateRepository.getEstimateWithDraftCheckInTransaction(targetEstimateId, connection);
      if (!draftCheck) {
        throw new Error('Cannot copy rows - target estimate is already finalized');
      }

      // Get the current max item_order in target estimate
      const [maxOrderResult] = await connection.execute<RowDataPacket[]>(
        'SELECT COALESCE(MAX(item_order), 0) as max_order FROM job_estimate_items WHERE estimate_id = ?',
        [targetEstimateId]
      );
      let nextOrder = (maxOrderResult[0]?.max_order || 0) + 1;

      // Get the source rows to copy
      const [sourceRows] = await connection.execute<RowDataPacket[]>(
        `SELECT
          product_type_id,
          item_name,
          grid_data,
          unit_price,
          extended_price,
          customer_description,
          internal_notes
        FROM job_estimate_items
        WHERE estimate_id = ? AND id IN (${rowIds.map(() => '?').join(',')})
        ORDER BY item_order`,
        [sourceEstimateId, ...rowIds]
      );

      if (sourceRows.length === 0) {
        throw new Error('No valid rows found to copy');
      }

      // Insert copied rows into target estimate
      for (const row of sourceRows) {
        await connection.execute(
          `INSERT INTO job_estimate_items (
            estimate_id,
            assembly_group_id,
            parent_item_id,
            product_type_id,
            item_name,
            item_order,
            item_index,
            grid_data,
            unit_price,
            extended_price,
            customer_description,
            internal_notes,
            created_at,
            updated_at
          ) VALUES (?, NULL, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
          [
            targetEstimateId,
            row.product_type_id,
            row.item_name,
            nextOrder,
            nextOrder, // item_index matches item_order for copied rows
            row.grid_data,
            null, // Don't copy pricing - will be recalculated
            null,
            row.customer_description,
            row.internal_notes
          ]
        );
        nextOrder++;
      }

      // Update estimate timestamp
      await connection.execute(
        'UPDATE job_estimates SET updated_by = ?, updated_at = NOW() WHERE id = ?',
        [userId, targetEstimateId]
      );

      await connection.commit();

      console.log(`📋 Copied ${sourceRows.length} rows from estimate ${sourceEstimateId} to ${targetEstimateId}`);

      return { copiedCount: sourceRows.length };
    } catch (error) {
      await connection.rollback();
      console.error('Service error copying rows:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  // =============================================
  // VALIDATION METHODS
  // =============================================

  async validateEstimateAccess(estimateId: number, jobId?: number): Promise<boolean> {
    return this.estimateRepository.validateEstimateAccess(estimateId, jobId);
  }

  // =============================================
}