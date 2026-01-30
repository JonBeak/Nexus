/**
 * Repository Layer - Estimate Preparation Items
 * Handles all database operations for the preparation table
 * Created for Phase 4: Estimate Preparation Table feature
 */

import { query, pool } from '../config/database';
import { RowDataPacket, ResultSetHeader, PoolConnection } from 'mysql2/promise';

// ============================================================================
// Types
// ============================================================================

export interface EstimatePreparationItem {
  id: number;
  estimate_id: number;
  display_order: number;
  item_name: string;
  qb_description: string | null;
  calculation_display: string | null;
  quantity: number;
  unit_price: number;
  extended_price: number;
  is_description_only: boolean;
  qb_item_id: string | null;
  qb_item_name: string | null;
  source_row_id: string | null;
  source_product_type_id: number | null;
  is_parent: boolean | null;
  estimate_preview_display_number: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreatePreparationItemData {
  item_name: string;
  qb_description?: string | null;
  calculation_display?: string | null;
  quantity?: number;
  unit_price?: number;
  extended_price?: number;
  is_description_only?: boolean;
  qb_item_id?: string | null;
  qb_item_name?: string | null;
  source_row_id?: string | null;
  source_product_type_id?: number | null;
  is_parent?: boolean | null;
  estimate_preview_display_number?: string | null;
}

export interface UpdatePreparationItemData {
  item_name?: string;
  qb_description?: string | null;
  quantity?: number;
  unit_price?: number;
  extended_price?: number;
  is_description_only?: boolean;
  qb_item_id?: string | null;
  qb_item_name?: string | null;
}

export interface ImportSourceEstimate {
  id: number;
  job_id: number;
  job_name: string;
  customer_name: string;
  version_number: number;
  qb_doc_number: string | null;
  status: string;
}

export interface ImportInstruction {
  targetItemId?: number;      // If provided, update this existing item
  targetDisplayOrder?: number; // If no targetItemId, position for new item
  // Copyable fields (can update existing items)
  qb_item_id?: string | null;
  qb_item_name?: string | null;
  qb_description?: string | null;
  quantity?: number;
  unit_price?: number;
  // For new items only:
  item_name?: string;
  calculation_display?: string | null;
  is_description_only?: boolean;
}

// ============================================================================
// Repository Class
// ============================================================================

class EstimatePreparationRepository {
  /**
   * Get all preparation items for an estimate, ordered by display_order
   */
  async getItemsByEstimateId(
    estimateId: number,
    connection?: PoolConnection
  ): Promise<EstimatePreparationItem[]> {
    if (connection) {
      const [rows] = await connection.execute<RowDataPacket[]>(
        `SELECT id, estimate_id, display_order, item_name, qb_description,
                calculation_display, quantity, unit_price, extended_price, is_description_only,
                qb_item_id, qb_item_name, source_row_id, source_product_type_id,
                is_parent, estimate_preview_display_number,
                created_at, updated_at
         FROM estimate_preparation_items
         WHERE estimate_id = ?
         ORDER BY display_order`,
        [estimateId]
      );
      return rows as EstimatePreparationItem[];
    } else {
      const rows = await query(
        `SELECT id, estimate_id, display_order, item_name, qb_description,
                calculation_display, quantity, unit_price, extended_price, is_description_only,
                qb_item_id, qb_item_name, source_row_id, source_product_type_id,
                is_parent, estimate_preview_display_number,
                created_at, updated_at
         FROM estimate_preparation_items
         WHERE estimate_id = ?
         ORDER BY display_order`,
        [estimateId]
      ) as RowDataPacket[];
      return rows as EstimatePreparationItem[];
    }
  }

  /**
   * Get a single preparation item by ID
   */
  async getItemById(itemId: number): Promise<EstimatePreparationItem | null> {
    const rows = await query(
      `SELECT id, estimate_id, display_order, item_name, qb_description,
              calculation_display, quantity, unit_price, extended_price, is_description_only,
              qb_item_id, qb_item_name, source_row_id, source_product_type_id,
              is_parent, estimate_preview_display_number,
              created_at, updated_at
       FROM estimate_preparation_items
       WHERE id = ?`,
      [itemId]
    ) as RowDataPacket[];
    return rows.length > 0 ? rows[0] as EstimatePreparationItem : null;
  }

  /**
   * Create snapshot from estimate preview data
   * Called during prepareEstimateForSending()
   */
  async createSnapshot(
    estimateId: number,
    items: CreatePreparationItemData[],
    connection: PoolConnection
  ): Promise<number> {
    if (items.length === 0) return 0;

    // Build values for batch insert
    const values = items.map((item, index) => [
      estimateId,
      index + 1, // display_order starts at 1
      item.item_name,
      item.qb_description || null,
      item.calculation_display || null,
      item.quantity ?? 1,
      item.unit_price ?? 0,
      item.extended_price ?? 0,
      item.is_description_only ? 1 : 0,
      item.qb_item_id || null,
      item.qb_item_name || null,
      item.source_row_id || null,
      item.source_product_type_id || null,
      item.is_parent !== undefined ? (item.is_parent ? 1 : 0) : null,
      item.estimate_preview_display_number || null
    ]);

    const placeholders = items.map(() =>
      '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).join(', ');
    const flatValues = values.flat();

    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO estimate_preparation_items
         (estimate_id, display_order, item_name, qb_description, calculation_display,
          quantity, unit_price, extended_price, is_description_only,
          qb_item_id, qb_item_name, source_row_id, source_product_type_id,
          is_parent, estimate_preview_display_number)
       VALUES ${placeholders}`,
      flatValues
    );

    return result.affectedRows;
  }

  /**
   * Update a single preparation item
   */
  async updateItem(
    itemId: number,
    updates: UpdatePreparationItemData
  ): Promise<boolean> {
    const setClauses: string[] = [];
    const values: any[] = [];

    if (updates.item_name !== undefined) {
      setClauses.push('item_name = ?');
      values.push(updates.item_name);
    }
    if (updates.qb_description !== undefined) {
      setClauses.push('qb_description = ?');
      values.push(updates.qb_description);
    }
    if (updates.quantity !== undefined) {
      setClauses.push('quantity = ?');
      values.push(updates.quantity);
    }
    if (updates.unit_price !== undefined) {
      setClauses.push('unit_price = ?');
      values.push(updates.unit_price);
    }
    if (updates.extended_price !== undefined) {
      setClauses.push('extended_price = ?');
      values.push(updates.extended_price);
    }
    if (updates.is_description_only !== undefined) {
      setClauses.push('is_description_only = ?');
      values.push(updates.is_description_only ? 1 : 0);
    }
    if (updates.qb_item_id !== undefined) {
      setClauses.push('qb_item_id = ?');
      values.push(updates.qb_item_id);
    }
    if (updates.qb_item_name !== undefined) {
      setClauses.push('qb_item_name = ?');
      values.push(updates.qb_item_name);
    }

    if (setClauses.length === 0) return false;

    values.push(itemId);

    const result = await query(
      `UPDATE estimate_preparation_items
       SET ${setClauses.join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      values
    ) as ResultSetHeader;

    return result.affectedRows > 0;
  }

  /**
   * Add a new row to the preparation table
   * Inserts after the specified display_order, shifting subsequent rows
   */
  async addItem(
    estimateId: number,
    item: CreatePreparationItemData,
    afterDisplayOrder?: number
  ): Promise<number> {
    const conn = await pool.getConnection();

    try {
      await conn.beginTransaction();

      // Determine the new display_order
      let newOrder: number;
      if (afterDisplayOrder !== undefined) {
        // Shift all items after this position
        await conn.execute(
          `UPDATE estimate_preparation_items
           SET display_order = display_order + 1
           WHERE estimate_id = ? AND display_order > ?`,
          [estimateId, afterDisplayOrder]
        );
        newOrder = afterDisplayOrder + 1;
      } else {
        // Add at the end
        const [maxRows] = await conn.execute<RowDataPacket[]>(
          `SELECT COALESCE(MAX(display_order), 0) as max_order
           FROM estimate_preparation_items WHERE estimate_id = ?`,
          [estimateId]
        );
        newOrder = (maxRows[0].max_order || 0) + 1;
      }

      // Insert the new item
      const [result] = await conn.execute<ResultSetHeader>(
        `INSERT INTO estimate_preparation_items
           (estimate_id, display_order, item_name, qb_description, calculation_display,
            quantity, unit_price, extended_price, is_description_only,
            qb_item_id, qb_item_name, source_row_id, source_product_type_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          estimateId,
          newOrder,
          item.item_name,
          item.qb_description || null,
          item.calculation_display || null,
          item.quantity ?? 1,
          item.unit_price ?? 0,
          item.extended_price ?? 0,
          item.is_description_only ? 1 : 0,
          item.qb_item_id || null,
          item.qb_item_name || null,
          item.source_row_id || null,
          item.source_product_type_id || null
        ]
      );

      await conn.commit();
      return result.insertId;
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  }

  /**
   * Delete a preparation item and reorder remaining items
   */
  async deleteItem(itemId: number): Promise<boolean> {
    // Get item info before deleting
    const item = await this.getItemById(itemId);
    if (!item) return false;

    const conn = await pool.getConnection();

    try {
      await conn.beginTransaction();

      // Delete the item
      await conn.execute(
        `DELETE FROM estimate_preparation_items WHERE id = ?`,
        [itemId]
      );

      // Reorder remaining items to close the gap
      await conn.execute(
        `UPDATE estimate_preparation_items
         SET display_order = display_order - 1
         WHERE estimate_id = ? AND display_order > ?`,
        [item.estimate_id, item.display_order]
      );

      await conn.commit();
      return true;
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  }

  /**
   * Reorder items (for drag-and-drop)
   * Accepts array of item IDs in the new desired order
   */
  async reorderItems(
    estimateId: number,
    itemIds: number[]
  ): Promise<void> {
    if (itemIds.length === 0) return;

    const conn = await pool.getConnection();

    try {
      await conn.beginTransaction();

      // Update each item's display_order based on its position in the array
      for (let i = 0; i < itemIds.length; i++) {
        await conn.execute(
          `UPDATE estimate_preparation_items
           SET display_order = ?
           WHERE id = ? AND estimate_id = ?`,
          [i + 1, itemIds[i], estimateId]
        );
      }

      await conn.commit();
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  }

  /**
   * Toggle row type between regular and description-only
   */
  async toggleRowType(itemId: number): Promise<boolean> {
    const result = await query(
      `UPDATE estimate_preparation_items
       SET is_description_only = NOT is_description_only,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [itemId]
    ) as ResultSetHeader;

    return result.affectedRows > 0;
  }

  /**
   * Update QB item selection for a row
   */
  async updateQbItemSelection(
    itemId: number,
    qbItemId: string | null,
    qbItemName: string | null
  ): Promise<boolean> {
    const result = await query(
      `UPDATE estimate_preparation_items
       SET qb_item_id = ?, qb_item_name = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [qbItemId, qbItemName, itemId]
    ) as ResultSetHeader;

    return result.affectedRows > 0;
  }

  /**
   * Clear all preparation items for an estimate
   * Used when re-preparing an estimate
   */
  async clearByEstimateId(
    estimateId: number,
    connection?: PoolConnection
  ): Promise<void> {
    const conn = connection || pool;
    await conn.execute(
      `DELETE FROM estimate_preparation_items WHERE estimate_id = ?`,
      [estimateId]
    );
  }

  /**
   * Check if an estimate uses the preparation table
   */
  async usesPreparationTable(estimateId: number): Promise<boolean> {
    const rows = await query(
      `SELECT uses_preparation_table FROM job_estimates WHERE id = ?`,
      [estimateId]
    ) as RowDataPacket[];

    return rows.length > 0 && rows[0].uses_preparation_table === 1;
  }

  /**
   * Calculate totals from preparation items
   * Returns subtotal (sum of extended_price for non-description-only rows)
   */
  async calculateTotals(estimateId: number): Promise<{ subtotal: number }> {
    const rows = await query(
      `SELECT COALESCE(SUM(extended_price), 0) as subtotal
       FROM estimate_preparation_items
       WHERE estimate_id = ? AND is_description_only = FALSE`,
      [estimateId]
    ) as RowDataPacket[];

    return { subtotal: parseFloat(rows[0]?.subtotal || 0) };
  }

  /**
   * Get the estimate_id for a given item
   * Used for validation in controller
   */
  async getEstimateIdForItem(itemId: number): Promise<number | null> {
    const rows = await query(
      `SELECT estimate_id FROM estimate_preparation_items WHERE id = ?`,
      [itemId]
    ) as RowDataPacket[];

    return rows.length > 0 ? rows[0].estimate_id : null;
  }

  /**
   * Get estimates that can be used as import sources
   * Returns estimates that have preparation table data, prioritizing same-job versions
   */
  async getImportSources(
    currentEstimateId: number,
    currentJobId: number
  ): Promise<ImportSourceEstimate[]> {
    const rows = await query(
      `SELECT
        e.id,
        e.job_id,
        j.job_name,
        c.company_name as customer_name,
        e.version_number,
        e.qb_doc_number,
        e.status
      FROM job_estimates e
      JOIN jobs j ON e.job_id = j.job_id
      JOIN customers c ON j.customer_id = c.customer_id
      WHERE e.id != ?
        AND e.uses_preparation_table = 1
        AND e.is_active = 1
      ORDER BY
        CASE WHEN e.job_id = ? THEN 0 ELSE 1 END,
        e.updated_at DESC
      LIMIT 100`,
      [currentEstimateId, currentJobId]
    ) as RowDataPacket[];

    return rows as ImportSourceEstimate[];
  }

  /**
   * Batch import items into preparation table
   * Handles both updates to existing items and creation of new items
   */
  async batchImportItems(
    estimateId: number,
    imports: ImportInstruction[]
  ): Promise<{ updated: number; created: number }> {
    if (imports.length === 0) {
      return { updated: 0, created: 0 };
    }

    const conn = await pool.getConnection();
    let updated = 0;
    let created = 0;

    try {
      await conn.beginTransaction();

      // Get current max display_order for new items
      const [maxRows] = await conn.execute<RowDataPacket[]>(
        `SELECT COALESCE(MAX(display_order), 0) as max_order
         FROM estimate_preparation_items WHERE estimate_id = ?`,
        [estimateId]
      );
      let nextOrder = (maxRows[0].max_order || 0) + 1;

      for (const instruction of imports) {
        if (instruction.targetItemId) {
          // Update existing item
          const setClauses: string[] = [];
          const values: any[] = [];

          if (instruction.qb_item_id !== undefined) {
            setClauses.push('qb_item_id = ?');
            values.push(instruction.qb_item_id);
          }
          if (instruction.qb_item_name !== undefined) {
            setClauses.push('qb_item_name = ?');
            values.push(instruction.qb_item_name);
          }
          if (instruction.qb_description !== undefined) {
            setClauses.push('qb_description = ?');
            values.push(instruction.qb_description);
          }
          if (instruction.quantity !== undefined) {
            setClauses.push('quantity = ?');
            values.push(instruction.quantity);
          }
          if (instruction.unit_price !== undefined) {
            setClauses.push('unit_price = ?');
            values.push(instruction.unit_price);
          }

          // Auto-calculate extended_price
          if (instruction.quantity !== undefined || instruction.unit_price !== undefined) {
            // Get current values for calculation
            const [itemRows] = await conn.execute<RowDataPacket[]>(
              `SELECT quantity, unit_price FROM estimate_preparation_items WHERE id = ?`,
              [instruction.targetItemId]
            );
            if (itemRows.length > 0) {
              const qty = instruction.quantity ?? itemRows[0].quantity;
              const price = instruction.unit_price ?? itemRows[0].unit_price;
              setClauses.push('extended_price = ?');
              values.push(qty * price);
            }
          }

          if (setClauses.length > 0) {
            values.push(instruction.targetItemId);
            await conn.execute(
              `UPDATE estimate_preparation_items
               SET ${setClauses.join(', ')}, updated_at = CURRENT_TIMESTAMP
               WHERE id = ?`,
              values
            );
            updated++;
          }
        } else {
          // Create new item
          const extendedPrice = (instruction.quantity ?? 1) * (instruction.unit_price ?? 0);

          await conn.execute(
            `INSERT INTO estimate_preparation_items
               (estimate_id, display_order, item_name, qb_description, calculation_display,
                quantity, unit_price, extended_price, is_description_only,
                qb_item_id, qb_item_name, source_row_id, source_product_type_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)`,
            [
              estimateId,
              nextOrder++,
              instruction.item_name || 'Imported Item',
              instruction.qb_description || null,
              instruction.calculation_display || null,
              instruction.quantity ?? 1,
              instruction.unit_price ?? 0,
              extendedPrice,
              instruction.is_description_only ? 1 : 0,
              instruction.qb_item_id || null,
              instruction.qb_item_name || null
            ]
          );
          created++;
        }
      }

      await conn.commit();
      return { updated, created };
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  }

  /**
   * Get items from legacy tables for estimates without preparation table.
   * Used for importing QB descriptions from sent estimates that were sent
   * before the preparation table feature was added.
   *
   * Joins job_estimate_items with estimate_line_descriptions to get QB descriptions.
   * Note: line_index is 0-based, item_order is 1-based.
   */
  async getItemsFromLegacyTables(estimateId: number): Promise<EstimatePreparationItem[]> {
    const rows = await query(
      `SELECT
        jei.id,
        jei.estimate_id,
        jei.item_order as display_order,
        jei.item_name,
        eld.qb_description,
        NULL as calculation_display,
        1 as quantity,
        COALESCE(CAST(jei.unit_price AS DECIMAL(10,2)), 0) as unit_price,
        COALESCE(CAST(jei.extended_price AS DECIMAL(10,2)), 0) as extended_price,
        0 as is_description_only,
        NULL as qb_item_id,
        NULL as qb_item_name,
        NULL as source_row_id,
        NULL as source_product_type_id,
        jei.created_at,
        jei.updated_at
      FROM job_estimate_items jei
      LEFT JOIN estimate_line_descriptions eld
        ON jei.estimate_id = eld.estimate_id
        AND (jei.item_order - 1) = eld.line_index
      WHERE jei.estimate_id = ?
      ORDER BY jei.item_order`,
      [estimateId]
    ) as RowDataPacket[];
    return rows as EstimatePreparationItem[];
  }

  /**
   * Check if an estimate uses the preparation table
   */
  async checkUsesPreparationTable(estimateId: number): Promise<boolean> {
    const rows = await query(
      `SELECT uses_preparation_table FROM job_estimates WHERE id = ?`,
      [estimateId]
    ) as RowDataPacket[];
    return rows.length > 0 && rows[0].uses_preparation_table === 1;
  }
}

export const estimatePreparationRepository = new EstimatePreparationRepository();
