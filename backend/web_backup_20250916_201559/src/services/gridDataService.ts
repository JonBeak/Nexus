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
import { EstimateGridRow } from '../interfaces/estimateTypes';
import { DynamicTemplateService } from './dynamicTemplateService';
import { estimateHistoryService } from './estimateHistoryService';

export class GridDataService {
  
  // =============================================
  // PHASE 4: GRID DATA PERSISTENCE
  // =============================================

  async saveGridData(estimateId: number, gridRows: any[], userId: number): Promise<void> {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // First, check if estimate is still a draft
      const [draftCheck] = await connection.execute<RowDataPacket[]>(
        'SELECT is_draft FROM job_estimates WHERE id = ? AND is_draft = TRUE',
        [estimateId]
      );
      
      if (draftCheck.length === 0) {
        throw new Error('Cannot save grid data - estimate is already finalized');
      }

      // CONSOLIDATION UPDATE: Replace DELETE+INSERT with UPDATE+INSERT pattern
      // This preserves database IDs and prevents assembly field orphaning
      
      // Get existing items with their current database IDs
      const [existingItems] = await connection.execute<RowDataPacket[]>(
        'SELECT id, item_order FROM job_estimate_items WHERE estimate_id = ? ORDER BY item_order',
        [estimateId]
      );

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
        const cleanRowData = {
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

      // Update estimate timestamp
      await connection.execute(
        'UPDATE job_estimates SET updated_by = ?, updated_at = NOW() WHERE id = ?',
        [userId, estimateId]
      );

      // Get job_id for history logging
      const [jobRows] = await connection.execute<RowDataPacket[]>(
        'SELECT job_id FROM job_estimates WHERE id = ?',
        [estimateId]
      );
      const jobId = jobRows[0]?.job_id;

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
      const [rows] = await pool.execute<RowDataPacket[]>(
        `SELECT
          i.id,
          i.assembly_group_id,
          i.parent_item_id,
          i.product_type_id,
          pt.name as product_type_name,
          pt.category as product_type_category,
          i.item_name,
          i.item_order,
          i.item_index,
          i.grid_data,
          i.unit_price,
          i.extended_price,
          i.customer_description,
          i.internal_notes
        FROM job_estimate_items i
        LEFT JOIN product_types pt ON i.product_type_id = pt.id
        WHERE i.estimate_id = ?
        ORDER BY i.item_order`,
        [estimateId]
      );

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
            if (gridData[field] !== undefined) obj[field] = gridData[field];
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
  // VALIDATION METHODS
  // =============================================

  async validateEstimateAccess(estimateId: number, jobId?: number): Promise<boolean> {
    try {
      let query = 'SELECT id FROM job_estimates WHERE id = ?';
      let params: any[] = [estimateId];
      
      if (jobId) {
        query += ' AND job_id = ?';
        params.push(jobId);
      }
      
      const [rows] = await pool.execute<RowDataPacket[]>(query, params);
      return rows.length > 0;
    } catch (error) {
      console.error('Error validating estimate access:', error);
      return false;
    }
  }

  // =============================================
}