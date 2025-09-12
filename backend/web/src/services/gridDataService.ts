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
        
        // Calculate logical item index using database relationships instead of row.type
        let logicalItemIndex = 1;
        if (row.parentProductId) {
          // Sub-items identified by parentProductId - inherit parent's logical index
          for (let j = i - 1; j >= 0; j--) {
            const parentRow = gridRows[j];
            if (parentRow.isMainRow && parentRow.id === row.parentProductId) {
              // Found parent - calculate its logical index
              let parentLogicalIndex = 0;
              for (let k = 0; k <= j; k++) {
                const r = gridRows[k];
                if (r.isMainRow && !r.parentProductId) {
                  parentLogicalIndex++;
                }
              }
              logicalItemIndex = parentLogicalIndex;
              break;
            }
          }
        } else {
          // For main rows, count logical numberable rows up to this point
          let logicalCount = 0;
          for (let j = 0; j <= i; j++) {
            const r = gridRows[j];
            if (r.isMainRow && !r.parentProductId) {
              logicalCount++;
            }
          }
          logicalItemIndex = logicalCount;
        }

        // 🐛 DEBUG: Log row data to understand what's being saved
        if (row.data?.assemblyGroup !== undefined || row.assemblyId !== undefined) {
          console.log(`🔍 SAVE: Row ${row.id} productTypeId=${row.productTypeId}`, {
            assemblyId: row.assemblyId,
            dataAssemblyGroup: row.data?.assemblyGroup,
            allData: Object.keys(row.data || {}).length > 20 ? 'large_object' : row.data
          });
        }

        // Fix assembly ID mapping: frontend sends assemblyId as string, convert to number
        let assemblyGroupId = null;
        if (row.assemblyId !== undefined && row.assemblyId !== null) {
          const parsedAssemblyId = parseInt(row.assemblyId.toString());
          if (!isNaN(parsedAssemblyId)) {
            assemblyGroupId = parsedAssemblyId;
          }
        }
        // Fallback to data.assemblyGroup if direct assemblyId not available
        if (assemblyGroupId === null && row.data?.assemblyGroup !== undefined) {
          assemblyGroupId = row.data.assemblyGroup;
        }

        console.log(`🔍 SAVE: Final assemblyGroupId for row ${row.id}: ${assemblyGroupId}`);

        // Clean the row data before stringifying (remove fieldConfig to prevent large JSON)
        const cleanRowData = { ...row.data };
        delete cleanRowData.fieldConfig;
        
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

        // Handle product type requirements and prepare template data
        let productTypeId = row.productTypeId;
        let templateData = null;
        
        // Trust the productTypeId from frontend - no type-based overrides
        // All product logic is now database-driven via product_types table
        if (!productTypeId) {
          // Only skip rows that have no productTypeId at all
          continue;
        }

        // CONSOLIDATION: Embed template data for product rows with fieldConfig
        if (row.fieldConfig && Array.isArray(row.fieldConfig) && row.fieldConfig.length > 0) {
          try {
            // Capture the template data from frontend fieldConfig to prevent future orphaning
            templateData = JSON.stringify({
              product_type_id: productTypeId,
              product_type_name: row.productTypeName,
              field_config: row.fieldConfig,
              captured_at: new Date().toISOString()
            });
            console.log(`📦 CONSOLIDATION: Embedded template data for row ${row.id} (${row.productTypeName})`);
          } catch (templateError) {
            console.error('Failed to embed template data:', templateError);
            // Continue without template data rather than failing the save
          }
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
              input_data = ?,
              base_quantity = ?,
              unit_price = ?,
              extended_price = ?,
              customer_description = ?,
              internal_notes = ?,
              template_data = ?,
              updated_at = NOW()
            WHERE id = ?`,
            [
              assemblyGroupId,
              null, // Update without parent first
              productTypeId,
              row.productTypeName || row.data?.itemName || 'Unnamed Item',
              itemOrder,
              logicalItemIndex,
              JSON.stringify(cleanRowData || {}),
              JSON.stringify(cleanRowData || {}), // Keep legacy compatibility
              row.data?.quantity || null,
              row.data?.unit_price || null,
              row.data?.extended_price || null,
              row.data?.customerDescription || null,
              row.data?.internalNotes || null,
              templateData, // CONSOLIDATION: Embed template data
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
              input_data,
              base_quantity,
              unit_price,
              extended_price,
              customer_description,
              internal_notes,
              template_data,
              created_at,
              updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
            [
              estimateId,
              assemblyGroupId,
              null, // Insert without parent first
              productTypeId,
              row.productTypeName || row.data?.itemName || 'Unnamed Item',
              itemOrder,
              logicalItemIndex,
              JSON.stringify(cleanRowData || {}),
              JSON.stringify(cleanRowData || {}), // Keep legacy compatibility
              row.data?.quantity || null,
              row.data?.unit_price || null,
              row.data?.extended_price || null,
              row.data?.customerDescription || null,
              row.data?.internalNotes || null,
              templateData // CONSOLIDATION: Embed template data
            ]
          );
          dbId = result.insertId;
        }
        
        // Map frontend ID to database ID
        if (row.id) {
          idMapping.set(row.id, dbId);
        }

        // Track parent relationships for second pass
        if (row.parentProductId) {
          parentRelationships.push({
            childDbId: dbId,
            parentFrontendId: row.parentProductId
          });
        }
      }

      // CLEANUP: Remove items that are no longer present (beyond current grid length)
      if (existingItems.length > gridRows.length) {
        await connection.execute(
          'DELETE FROM job_estimate_items WHERE estimate_id = ? AND item_order > ?',
          [estimateId, gridRows.length]
        );
      }

      // SECOND PASS: Update parent relationships using database IDs
      for (const relationship of parentRelationships) {
        const parentDbId = idMapping.get(relationship.parentFrontendId);
        
        if (parentDbId) {
          await connection.execute(
            'UPDATE job_estimate_items SET parent_item_id = ? WHERE id = ?',
            [parentDbId, relationship.childDbId]
          );
        } else {
          // Parent not found in idMapping
        }
      }

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
          i.template_data,
          i.base_quantity,
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
        
        // CONSOLIDATION: Use embedded template data exclusively - no fallbacks
        let fieldConfig: any[] = [];
        
        if (item.template_data) {
          // CONSOLIDATED ITEMS: Use embedded template data
          const templateData = typeof item.template_data === 'string' 
            ? JSON.parse(item.template_data) 
            : item.template_data;
          
          if (!templateData.field_config || !Array.isArray(templateData.field_config)) {
            throw new Error(`CONSOLIDATION ERROR: Invalid embedded template data for item ${item.id}`);
          }
          
          fieldConfig = templateData.field_config;
          console.log(`📦 CONSOLIDATION: Using embedded template for item ${item.id} (${templateData.product_type_name})`);
          
        } else if (item.product_type_id) {
          // UNIFIED SYSTEM: All products use database templates
          const template = await dynamicTemplateService.getProductTemplate(item.product_type_id);
          if (!template || !template.rows) {
            throw new Error(`TEMPLATE ERROR: No template available for product type ${item.product_type_id}`);
          }
          fieldConfig = template.rows;
          console.log(`🔄 UNIFIED: Using database template for product type ${item.product_type_id}`);
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
            // Start with metadata fields first
            itemName: item.item_name,
            quantity: item.base_quantity,
            unitPrice: item.unit_price,
            extendedPrice: item.extended_price,
            customerDescription: item.customer_description,
            internalNotes: item.internal_notes,
            // ASSEMBLY FIX: Only use grid field data - database column is single source of truth
            // Removed assembly group duplication that was overriding user deselections
            ...gridData
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