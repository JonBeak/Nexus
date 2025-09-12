/**
 * Estimate Service
 * 
 * Extracted from estimateVersioningService.ts during refactoring
 * Handles estimate version management, draft/final workflows, and status updates
 * 
 * Responsibilities:
 * - Estimate version CRUD operations
 * - Draft/final workflow management
 * - Status updates (sent, approved, ordered, etc.)
 * - Estimate duplication logic
 */

import { pool } from '../config/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { EstimateVersionData, EstimateFinalizationData, OrderConversionResult, MultipleJobResult } from '../interfaces/estimateTypes';
import { JobCodeGenerator } from '../utils/jobCodeGenerator';
import { estimateHistoryService } from './estimateHistoryService';
import { DynamicTemplateService } from './dynamicTemplateService';

export class EstimateService {
  
  // =============================================
  // ESTIMATE VERSION MANAGEMENT
  // =============================================

  async getEstimateVersionsByJob(jobId: number): Promise<RowDataPacket[]> {
    try {
      const [rows] = await pool.execute<RowDataPacket[]>(
        `SELECT 
          e.id,
          e.job_id,
          e.job_code,
          e.version_number,
          e.parent_estimate_id,
          pe.version_number as parent_version,
          e.is_draft,
          e.status,
          e.finalized_at,
          fu.username as finalized_by_name,
          e.subtotal,
          e.tax_amount,
          e.total_amount,
          e.created_at,
          e.updated_at,
          cu.username as created_by_name,
          e.is_sent,
          e.is_approved,
          e.is_retracted,
          j.job_name,
          j.job_number,
          c.company_name as customer_name
         FROM job_estimates e
         LEFT JOIN job_estimates pe ON e.parent_estimate_id = pe.id
         LEFT JOIN users fu ON e.finalized_by_user_id = fu.user_id
         LEFT JOIN users cu ON e.created_by = cu.user_id
         LEFT JOIN jobs j ON e.job_id = j.job_id
         LEFT JOIN customers c ON j.customer_id = c.customer_id
         WHERE e.job_id = ?
         ORDER BY e.version_number ASC`,
        [jobId]
      );
      
      return rows;
    } catch (error) {
      console.error('Service error fetching estimate versions:', error);
      throw new Error('Failed to fetch estimate versions');
    }
  }

  async createNewEstimateVersion(data: EstimateVersionData, userId: number): Promise<number> {
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();
      
      // Get next version number for this job
      const [versionRows] = await connection.execute<RowDataPacket[]>(
        'SELECT COALESCE(MAX(version_number), 0) + 1 as next_version FROM job_estimates WHERE job_id = ?',
        [data.job_id]
      );
      const nextVersion = versionRows[0].next_version;
      
      // Generate new job code with version
      const jobCode = JobCodeGenerator.generateVersionedJobCode(nextVersion);
      
      if (data.parent_estimate_id) {
        // Create version by duplicating existing estimate
        const newEstimateId = await this.duplicateEstimate(
          connection, 
          data.parent_estimate_id, 
          data.job_id, 
          nextVersion, 
          jobCode, 
          userId
        );
        
        // Create default template rows for the duplicated estimate
        await this.createDefaultTemplateRows(connection, newEstimateId, userId);
        
        await connection.commit();
        return newEstimateId;
      } else {
        // Create brand new estimate version
        const [result] = await connection.execute<ResultSetHeader>(
          `INSERT INTO job_estimates (
            job_code, job_id, customer_id, version_number, 
            is_draft, created_by, updated_by, notes
           ) 
           SELECT ?, ?, customer_id, ?, TRUE, ?, ?, ?
           FROM jobs WHERE job_id = ?`,
          [jobCode, data.job_id, nextVersion, userId, userId, data.notes || null, data.job_id]
        );
        
        // Create default template rows for the new estimate
        await this.createDefaultTemplateRows(connection, result.insertId, userId);
        
        await connection.commit();
        return result.insertId;
      }
    } catch (error) {
      await connection.rollback();
      console.error('Service error creating estimate version:', error);
      throw new Error('Failed to create estimate version');
    } finally {
      connection.release();
    }
  }

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
  private async createDefaultTemplateRows(connection: any, estimateId: number, userId: number): Promise<void> {
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
      
      // UL
      { productTypeId: 12, productTypeName: 'UL', order: 17, isMain: true },
      
      // Shipping
      { productTypeId: 13, productTypeName: 'Shipping', order: 18, isMain: true }
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

        // ✅ FIX: Create template_data with populated dropdown options (same as manual selection)
        const templateData = {
          product_type_id: templateRow.productTypeId,
          product_type_name: templateRow.productTypeName,
          field_config: productTemplate.rows, // Fully populated with dropdown options
          created_at: new Date().toISOString()
        };

        // Get parent_item_id for sub-items
        let parentItemId = null;
        if (templateRow.parentRef && parentIdMap.has(templateRow.parentRef)) {
          parentItemId = parentIdMap.get(templateRow.parentRef);
        }

        // ✅ FIX: Insert with both grid_data AND template_data (consistent with manual selection)
        const [result] = await connection.execute<ResultSetHeader>(
          `INSERT INTO job_estimate_items (
            estimate_id, product_type_id, item_name, 
            item_order, grid_data, template_data, parent_item_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            estimateId,
            templateRow.productTypeId,
            templateRow.productTypeName,
            templateRow.order,
            JSON.stringify(gridData),
            JSON.stringify(templateData), // ✅ FIX: Store populated template data
            parentItemId
          ]
        );

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
        
        // Check if any grid data fields have content (excluding system fields)
        let hasInputData = false;
        if (item.grid_data) {
          let gridData = {};
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
              
              // Sub-items logic removed - now handled by specific product types
              
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
              product_type_id, item_name, item_order, item_index, grid_data, input_data,
              complexity_score, base_quantity, unit_price, extended_price,
              customer_description, internal_notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              estimateId, item.assembly_group_id, 
              item.parent_item_id, item.product_type_id, item.item_name,
              i + 1, i + 1, item.grid_data, item.input_data,
              item.complexity_score, item.base_quantity,
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
  // DRAFT/FINAL WORKFLOW
  // =============================================

  async saveDraft(estimateId: number, userId: number): Promise<void> {
    try {
      // Check if estimate is still a draft
      const [rows] = await pool.execute<RowDataPacket[]>(
        'SELECT is_draft FROM job_estimates WHERE id = ? AND is_draft = TRUE',
        [estimateId]
      );
      
      if (rows.length === 0) {
        throw new Error('Cannot save - estimate is already finalized');
      }
      
      // Update timestamp to show it was saved
      await pool.execute(
        'UPDATE job_estimates SET updated_by = ?, updated_at = NOW() WHERE id = ?',
        [userId, estimateId]
      );
      
    } catch (error) {
      console.error('Service error saving draft:', error);
      throw new Error('Failed to save draft');
    }
  }

  async finalizEstimate(estimateId: number, finalizationData: EstimateFinalizationData, userId: number, hasExistingOrdersCheck?: (jobId: number) => Promise<boolean>): Promise<void> {
    try {
      // Check if estimate is still a draft and get job info for multiple orders check
      const [rows] = await pool.execute<RowDataPacket[]>(
        'SELECT e.id, e.is_draft, e.job_id FROM job_estimates e WHERE e.id = ? AND e.is_draft = TRUE',
        [estimateId]
      );
      
      if (rows.length === 0) {
        throw new Error('Cannot finalize - estimate is already finalized or does not exist');
      }

      const jobId = rows[0].job_id;
      
      // Check for multiple orders scenario when finalizing as ordered
      if (finalizationData.status === 'ordered' && hasExistingOrdersCheck) {
        const hasExisting = await hasExistingOrdersCheck(jobId);
        if (hasExisting) {
          throw new Error('This job already has ordered estimates. Please use the multiple orders workflow to create a new job.');
        }
      }
      
      // Prepare status flag updates based on finalization type
      let statusUpdates = '';
      
      switch (finalizationData.status) {
        case 'sent':
          statusUpdates = ', is_sent = 1';
          break;
        case 'approved':
          statusUpdates = ', is_approved = 1';
          break;
        case 'ordered':
          statusUpdates = '';  // No additional flags for ordered
          break;
        case 'deactivated':
          statusUpdates = '';  // No additional flags for deactivated
          break;
      }
      
      // Finalize the estimate (make it immutable) with proper boolean flags
      await pool.execute(
        `UPDATE job_estimates 
         SET status = ?, 
             is_draft = FALSE, 
             finalized_at = NOW(), 
             finalized_by_user_id = ?,
             updated_by = ?
             ${statusUpdates}
         WHERE id = ?`,
        [finalizationData.status, userId, userId, estimateId]
      );
      
      // Update job status based on estimate status
      if (finalizationData.status === 'approved') {
        await pool.execute(
          `UPDATE jobs j
           JOIN job_estimates e ON j.job_id = e.job_id
           SET j.status = 'active'
           WHERE e.id = ?`,
          [estimateId]
        );
      } else if (finalizationData.status === 'ordered') {
        await pool.execute(
          `UPDATE jobs j
           JOIN job_estimates e ON j.job_id = e.job_id
           SET j.status = 'production'
           WHERE e.id = ?`,
          [estimateId]
        );
      }
      
    } catch (error) {
      console.error('Service error finalizing estimate:', error);
      throw new Error('Failed to finalize estimate');
    }
  }

  async canEditEstimate(estimateId: number): Promise<boolean> {
    try {
      const [rows] = await pool.execute<RowDataPacket[]>(
        'SELECT is_draft FROM job_estimates WHERE id = ?',
        [estimateId]
      );
      
      return rows.length > 0 && rows[0].is_draft === 1;
    } catch (error) {
      console.error('Service error checking edit permission:', error);
      return false;
    }
  }

  // =============================================
  // STATUS UPDATE METHODS
  // =============================================

  async sendEstimate(estimateId: number, userId: number): Promise<void> {
    try {
      // Get estimate info for history logging
      const [estimateRows] = await pool.execute<RowDataPacket[]>(
        'SELECT id, job_id, status FROM job_estimates WHERE id = ? AND is_draft = 0',
        [estimateId]
      );

      if (estimateRows.length === 0) {
        throw new Error('Estimate not found or is still in draft');
      }

      const estimate = estimateRows[0];
      
      // Get current sent count from history
      const currentSentCount = await estimateHistoryService.getSentCount(estimateId);
      const newSentCount = currentSentCount + 1;

      const [result] = await pool.execute<ResultSetHeader>(
        `UPDATE job_estimates 
         SET is_sent = 1, 
             updated_by = ?
         WHERE id = ? AND is_draft = 0`,
        [userId, estimateId]
      );

      if (result.affectedRows === 0) {
        throw new Error('Estimate not found or is still in draft');
      }

      // Log to history
      await estimateHistoryService.logAction({
        estimateId: estimateId,
        jobId: estimate.job_id,
        actionType: 'sent',
        performedByUserId: userId,
        metadata: {
          sent_count: newSentCount,
          total_sent_count: newSentCount
        },
        notes: `Estimate sent (${newSentCount} time${newSentCount > 1 ? 's' : ''})`
      });

    } catch (error) {
      console.error('Error sending estimate:', error);
      throw new Error('Failed to send estimate');
    }
  }

  async approveEstimate(estimateId: number, userId: number): Promise<void> {
    try {
      // Get estimate info for history logging
      const [estimateRows] = await pool.execute<RowDataPacket[]>(
        'SELECT id, job_id, status FROM job_estimates WHERE id = ? AND is_draft = 0 AND is_sent = 1',
        [estimateId]
      );

      if (estimateRows.length === 0) {
        throw new Error('Estimate not found, is draft, or not sent yet');
      }

      const estimate = estimateRows[0];

      const [result] = await pool.execute<ResultSetHeader>(
        `UPDATE job_estimates 
         SET is_approved = 1, 
             updated_by = ?
         WHERE id = ? AND is_draft = 0 AND is_sent = 1`,
        [userId, estimateId]
      );

      if (result.affectedRows === 0) {
        throw new Error('Estimate not found, is draft, or not sent yet');
      }

      // Log to history
      await estimateHistoryService.logAction({
        estimateId: estimateId,
        jobId: estimate.job_id,
        actionType: 'approved',
        performedByUserId: userId,
        oldStatus: estimate.status,
        newStatus: 'approved',
        notes: 'Estimate approved by customer'
      });

    } catch (error) {
      console.error('Error approving estimate:', error);
      throw new Error('Failed to approve estimate');
    }
  }

  async markNotApproved(estimateId: number, userId: number): Promise<void> {
    try {
      // Get estimate info for history logging
      const [estimateRows] = await pool.execute<RowDataPacket[]>(
        'SELECT id, job_id, status FROM job_estimates WHERE id = ? AND is_draft = 0',
        [estimateId]
      );

      if (estimateRows.length === 0) {
        throw new Error('Estimate not found or is still in draft');
      }

      const estimate = estimateRows[0];

      const [result] = await pool.execute<ResultSetHeader>(
        `UPDATE job_estimates 
         SET is_approved = 0, 
             updated_by = ?
         WHERE id = ? AND is_draft = 0`,
        [userId, estimateId]
      );

      if (result.affectedRows === 0) {
        throw new Error('Estimate not found or is still in draft');
      }

      // Log to history
      await estimateHistoryService.logAction({
        estimateId: estimateId,
        jobId: estimate.job_id,
        actionType: 'not_approved',
        performedByUserId: userId,
        oldStatus: estimate.status,
        newStatus: 'sent',
        notes: 'Estimate marked as not approved'
      });

    } catch (error) {
      console.error('Error marking estimate not approved:', error);
      throw new Error('Failed to mark estimate not approved');
    }
  }

  async retractEstimate(estimateId: number, userId: number): Promise<void> {
    try {
      // Get estimate info for history logging
      const [estimateRows] = await pool.execute<RowDataPacket[]>(
        'SELECT id, job_id, status FROM job_estimates WHERE id = ? AND is_draft = 0',
        [estimateId]
      );

      if (estimateRows.length === 0) {
        throw new Error('Estimate not found or is still in draft');
      }

      const estimate = estimateRows[0];

      const [result] = await pool.execute<ResultSetHeader>(
        `UPDATE job_estimates 
         SET is_retracted = 1, 
             updated_by = ?
         WHERE id = ? AND is_draft = 0`,
        [userId, estimateId]
      );

      if (result.affectedRows === 0) {
        throw new Error('Estimate not found or is still in draft');
      }

      // Log to history
      await estimateHistoryService.logAction({
        estimateId: estimateId,
        jobId: estimate.job_id,
        actionType: 'retracted',
        performedByUserId: userId,
        oldStatus: estimate.status,
        newStatus: 'retracted',
        notes: 'Estimate retracted'
      });

    } catch (error) {
      console.error('Error retracting estimate:', error);
      throw new Error('Failed to retract estimate');
    }
  }

  async convertToOrder(estimateId: number, userId: number, hasExistingOrdersCheck?: (jobId: number) => Promise<boolean>): Promise<OrderConversionResult> {
    try {
      // Get estimate info and check if it's approved
      const [estimateRows] = await pool.execute<RowDataPacket[]>(
        'SELECT id, job_id, is_approved FROM job_estimates WHERE id = ? AND is_approved = 1',
        [estimateId]
      );

      if (estimateRows.length === 0) {
        throw new Error('Estimate not found or not approved yet');
      }

      const jobId = estimateRows[0].job_id;
      
      // Check for existing orders in this job
      if (hasExistingOrdersCheck) {
        const hasExisting = await hasExistingOrdersCheck(jobId);
        if (hasExisting) {
          throw new Error('This job already has ordered estimates. Please use the multiple orders workflow to create a new job.');
        }
      }
      
      const [result] = await pool.execute<ResultSetHeader>(
        `UPDATE job_estimates 
         SET status = 'ordered',
             is_draft = 0,
             finalized_at = COALESCE(finalized_at, NOW()),
             finalized_by_user_id = COALESCE(finalized_by_user_id, ?),
             updated_by = ?
         WHERE id = ?`,
        [userId, userId, estimateId]
      );

      if (result.affectedRows === 0) {
        throw new Error('Failed to update estimate status');
      }

      // Update job status to production when estimate is ordered
      await pool.execute(
        `UPDATE jobs j
         JOIN job_estimates e ON j.job_id = e.job_id
         SET j.status = 'production'
         WHERE e.id = ?`,
        [estimateId]
      );

      // Log to history
      await estimateHistoryService.logAction({
        estimateId: estimateId,
        jobId: jobId,
        actionType: 'converted_to_order',
        performedByUserId: userId,
        oldStatus: 'approved',
        newStatus: 'ordered',
        metadata: {
          order_id: estimateId,
          job_status_updated: 'production'
        },
        notes: 'Estimate converted to order - job moved to production'
      });

      // Return order_id (using estimate id as order reference for now)
      return { order_id: estimateId };
    } catch (error) {
      console.error('Error converting estimate to order:', error);
      throw new Error('Failed to convert estimate to order');
    }
  }

  // =============================================
  // ESTIMATE DUPLICATION METHODS
  // =============================================

  async duplicateEstimateToNewJob(
    connection: any,
    sourceEstimateId: number,
    targetJobId: number,
    targetVersion: number,
    userId: number
  ): Promise<number> {
    // Get source estimate data
    const [sourceRows]: any = await connection.execute<RowDataPacket[]>(
      `SELECT * FROM job_estimates WHERE id = ?`,
      [sourceEstimateId]
    );
    
    if (sourceRows.length === 0) {
      throw new Error('Source estimate not found');
    }
    
    const source = sourceRows[0];
    
    // Generate new job code for the target version
    const newJobCode = JobCodeGenerator.generateVersionedJobCode(targetVersion);
    
    // Create new estimate in target job
    const [newEstimateResult] = await connection.execute<ResultSetHeader>(
      `INSERT INTO job_estimates (
        job_code, job_id, customer_id, version_number, parent_estimate_id,
        subtotal, tax_rate, tax_amount, total_amount, notes,
        created_by, updated_by, is_draft
       )
       VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, TRUE)`,
      [
        newJobCode, targetJobId, source.customer_id, targetVersion,
        source.subtotal, source.tax_rate, source.tax_amount, source.total_amount, source.notes,
        userId, userId
      ]
    );
    
    const newEstimateId = newEstimateResult.insertId;
    
    // Duplicate groups
    const [groups]: any = await connection.execute<RowDataPacket[]>(
      'SELECT * FROM job_estimate_groups WHERE estimate_id = ? ORDER BY group_order',
      [sourceEstimateId]
    );
    
    for (const group of groups) {
      const [groupResult] = await connection.execute<ResultSetHeader>(
        `INSERT INTO job_estimate_groups (
          estimate_id, group_name, group_order, assembly_cost, notes
        ) VALUES (?, ?, ?, ?, ?)`,
        [newEstimateId, group.group_name, group.group_order, group.assembly_cost, group.notes]
      );
      
      const newGroupId = groupResult.insertId;
      
      // Duplicate items for this group
      const [items]: any = await connection.execute<RowDataPacket[]>(
        'SELECT * FROM job_estimate_items WHERE group_id = ? ORDER BY item_order',
        [group.id]
      );
      
      for (const item of items) {
        const [itemResult] = await connection.execute<ResultSetHeader>(
          `INSERT INTO job_estimate_items (
            group_id, estimate_id, item_order, product_type, product_code, description,
            width, height, square_feet, quantity, unit_cost, total_cost, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            newGroupId, newEstimateId, item.item_order, item.product_type, item.product_code,
            item.description, item.width, item.height, item.square_feet, item.quantity,
            item.unit_cost, item.total_cost, item.notes
          ]
        );
        
        const newItemId = itemResult.insertId;
        
        // Duplicate addons for this item
        const [addons]: any = await connection.execute<RowDataPacket[]>(
          'SELECT * FROM job_estimate_item_addons WHERE item_id = ?',
          [item.id]
        );
        
        for (const addon of addons) {
          await connection.execute(
            `INSERT INTO job_estimate_item_addons (
              item_id, addon_type, addon_description, addon_cost
            ) VALUES (?, ?, ?, ?)`,
            [newItemId, addon.addon_type, addon.addon_description, addon.addon_cost]
          );
        }
      }
    }
    
    return newEstimateId;
  }

  private async duplicateEstimate(
    connection: any, 
    sourceEstimateId: number, 
    jobId: number, 
    version: number, 
    jobCode: string, 
    userId: number
  ): Promise<number> {
    try {
      // Create new estimate record
      const [result] = await connection.execute<ResultSetHeader>(
        `INSERT INTO job_estimates (
          job_code, job_id, customer_id, version_number, parent_estimate_id,
          subtotal, tax_rate, tax_amount, total_amount, notes,
          created_by, updated_by, is_draft
         )
         SELECT ?, ?, customer_id, ?, ?, subtotal, tax_rate, tax_amount, total_amount, notes, ?, ?, TRUE
         FROM job_estimates 
         WHERE id = ?`,
        [jobCode, jobId, version, sourceEstimateId, userId, userId, sourceEstimateId]
      );
      
      const newEstimateId = result.insertId;
      
      // Check if source estimate has Phase 4 grid data (job_estimate_items with estimate_id)
      const [phase4Items]: any = await connection.execute<RowDataPacket[]>(
        `SELECT COUNT(*) as count FROM job_estimate_items WHERE estimate_id = ?`,
        [sourceEstimateId]
      );
      
      if (phase4Items[0].count > 0) {
        // NEW: Phase 4 duplication - copy items directly with preserved item_index
        await connection.execute(
          `INSERT INTO job_estimate_items (
            estimate_id, assembly_group_id, parent_item_id,
            product_type_id, item_name, item_order, item_index, grid_data, input_data,
            base_quantity, unit_price, extended_price, customer_description, internal_notes
           )
           SELECT 
            ?, assembly_group_id, parent_item_id,
            product_type_id, item_name, item_order, item_index, grid_data, input_data,
            base_quantity, unit_price, extended_price, customer_description, internal_notes
           FROM job_estimate_items
           WHERE estimate_id = ?
           ORDER BY item_order`,
          [newEstimateId, sourceEstimateId]
        );
      } else {
        // Legacy duplication for old estimates with groups
        // Duplicate groups
        await connection.execute(
          `INSERT INTO job_estimate_groups (estimate_id, group_name, assembly_cost, assembly_description, group_order)
           SELECT ?, group_name, assembly_cost, assembly_description, group_order
           FROM job_estimate_groups 
           WHERE estimate_id = ?`,
          [newEstimateId, sourceEstimateId]
        );
        
        // Duplicate items (legacy group-based approach)
        await connection.execute(
          `INSERT INTO job_estimate_items (
            group_id, product_type_id, item_name, input_data, customer_description,
            internal_notes, base_quantity, unit_price, extended_price, item_order
           )
           SELECT 
            ng.id, i.product_type_id, i.item_name, i.input_data, i.customer_description,
            i.internal_notes, i.base_quantity, i.unit_price, i.extended_price, i.item_order
           FROM job_estimate_items i
           JOIN job_estimate_groups og ON i.group_id = og.id
           JOIN job_estimate_groups ng ON ng.estimate_id = ? AND ng.group_order = og.group_order
           WHERE og.estimate_id = ?`,
          [newEstimateId, sourceEstimateId]
        );
      }
      
      // Duplicate addons
      await connection.execute(
        `INSERT INTO job_item_addons (
          item_id, addon_type_id, input_data, customer_description, 
          unit_price, extended_price, addon_order
         )
         SELECT 
          ni.id, a.addon_type_id, a.input_data, a.customer_description,
          a.unit_price, a.extended_price, a.addon_order
         FROM job_item_addons a
         JOIN job_estimate_items oi ON a.item_id = oi.id
         JOIN job_estimate_groups og ON oi.group_id = og.id
         JOIN job_estimate_groups ng ON ng.estimate_id = ? AND ng.group_order = og.group_order
         JOIN job_estimate_items ni ON ni.group_id = ng.id AND ni.item_order = oi.item_order
         WHERE og.estimate_id = ?`,
        [newEstimateId, sourceEstimateId]
      );
      
      return newEstimateId;
    } catch (error) {
      console.error('Error duplicating estimate:', error);
      throw new Error('Failed to duplicate estimate');
    }
  }
}