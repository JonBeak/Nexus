/**
 * Estimate Row Management Service
 * Handles row operations for estimate items (insertion, cleanup, reordering)
 *
 * Extracted from estimateWorkflowService.ts during Phase 4.d refactoring
 * Responsibilities:
 * - Job header row insertion/detection
 * - Empty row cleanup (preserves structural rows)
 * - Item reordering after mutations
 * - Structural row type handling
 */

import { RowDataPacket } from 'mysql2';

/**
 * Structural row types that should never be deleted during cleanup
 */
export const STRUCTURAL_ROW_TYPES = {
  SUBTOTAL: 21,       // Subtotal calculation row
  DIVIDER: 25,        // Visual divider row (if exists)
  EMPTY_ROW: 27       // Empty Row (spacer/note)
} as const;

// Array form for iteration (typed as number[] for includes() compatibility)
export const STRUCTURAL_ROW_TYPE_IDS: number[] = [
  STRUCTURAL_ROW_TYPES.SUBTOTAL,
  STRUCTURAL_ROW_TYPES.EMPTY_ROW
  // Add STRUCTURAL_ROW_TYPES.DIVIDER if divider type is used
];

/**
 * Result from job header insertion
 */
export interface JobHeaderResult {
  headerText: string;
  wasInserted: boolean;
}

/**
 * Result from empty row cleanup
 */
export interface CleanupResult {
  deletedCount: number;
  remainingCount: number;
}

export class EstimateRowManagementService {
  /**
   * Insert a job header row at position 1
   * Contains the job name and optionally the customer reference number
   * Format: "Job Name" or "Job Name - Customer Ref #"
   * Returns null if no job found, or object with headerText and wasInserted flag
   */
  async insertJobHeaderRow(
    estimateId: number,
    connection: any
  ): Promise<JobHeaderResult | null> {
    try {
      // 1. Get job info via estimate
      const [jobRows] = await connection.execute(
        `SELECT j.job_name, j.customer_job_number
         FROM jobs j
         JOIN job_estimates e ON j.job_id = e.job_id
         WHERE e.id = ?`,
        [estimateId]
      ) as [RowDataPacket[], any];

      if (jobRows.length === 0) {
        console.warn(`[Insert Job Header] Could not find job for estimate ${estimateId}`);
        return null;
      }

      const { job_name, customer_job_number } = jobRows[0];

      // 2. Build the header text: "Job Name" or "Job Name - Customer Ref #"
      let headerText = job_name || 'Untitled Job';
      if (customer_job_number && customer_job_number.trim()) {
        headerText += ` - ${customer_job_number.trim()}`;
      }

      // 3. Check if first row is already an Empty Row with matching job name
      const [existingFirst] = await connection.execute(
        `SELECT product_type_id, grid_data
         FROM job_estimate_items
         WHERE estimate_id = ? AND item_order = 1`,
        [estimateId]
      ) as [RowDataPacket[], any];

      if (existingFirst.length > 0) {
        const firstRow = existingFirst[0];
        // Product type 27 = Empty Row
        if (firstRow.product_type_id === STRUCTURAL_ROW_TYPES.EMPTY_ROW) {
          const existingGridData = typeof firstRow.grid_data === 'string'
            ? JSON.parse(firstRow.grid_data)
            : firstRow.grid_data;
          // Check if field1 (Note) contains the job name
          if (existingGridData?.field1 && existingGridData.field1.includes(job_name)) {
            console.log(`[Insert Job Header] First row already contains job name "${job_name}", skipping insertion`);
            return { headerText: existingGridData.field1, wasInserted: false };
          }
        }
      }

      console.log(`[Insert Job Header] Adding header row: "${headerText}"`);

      // 4. Shift all existing item_order values by +1
      await connection.execute(
        `UPDATE job_estimate_items
         SET item_order = item_order + 1,
             item_index = item_index + 1
         WHERE estimate_id = ?`,
        [estimateId]
      );

      // 5. Insert the new header row at position 1
      // Product type 27 = Empty Row, field1 = "Label" (the description field)
      const gridData = JSON.stringify({
        quantity: '',
        field1: headerText,
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
      });

      await connection.execute(
        `INSERT INTO job_estimate_items (
          estimate_id,
          product_type_id,
          item_name,
          item_order,
          item_index,
          grid_data,
          created_at,
          updated_at
        ) VALUES (?, 27, 'Job Header', 1, 1, ?, NOW(), NOW())`,
        [estimateId, gridData]
      );

      console.log(`[Insert Job Header] ✓ Header row inserted successfully`);
      return { headerText, wasInserted: true };
    } catch (error) {
      console.error('[Insert Job Header] Error:', error);
      throw error;
    }
  }

  /**
   * Clean empty rows from an estimate
   * Keeps:
   * - Structural rows (Empty Row, Subtotal, Divider)
   * - Rows with a product type selected
   * - Rows with data in field1-field10 or qty
   *
   * Deletes:
   * - Rows with no product type and no field data
   */
  async cleanEmptyRows(
    estimateId: number,
    connection: any
  ): Promise<CleanupResult> {
    // Get all estimate items
    const [rows] = await connection.execute(
      `SELECT id, product_type_id, grid_data
       FROM job_estimate_items
       WHERE estimate_id = ?
       ORDER BY item_order`,
      [estimateId]
    ) as [RowDataPacket[], any];

    const rowsToDelete: number[] = [];

    for (const row of rows) {
      const productTypeId = row.product_type_id;

      // Keep structural rows (Empty Row, Subtotal, etc.)
      if (STRUCTURAL_ROW_TYPE_IDS.includes(productTypeId)) {
        continue;
      }

      // Keep rows with a product type selected (even if no field data)
      if (productTypeId && productTypeId > 0) {
        continue;
      }

      // Check if row has any field data
      let hasFieldData = false;
      if (row.grid_data) {
        try {
          const gridData = typeof row.grid_data === 'string'
            ? JSON.parse(row.grid_data)
            : row.grid_data;

          // Check for quantity
          if (gridData.quantity && String(gridData.quantity).trim()) {
            hasFieldData = true;
          }

          // Check field1-field12
          for (let i = 1; i <= 12; i++) {
            const fieldValue = gridData[`field${i}`];
            if (fieldValue && String(fieldValue).trim()) {
              hasFieldData = true;
              break;
            }
          }
        } catch (e) {
          // If we can't parse grid_data, keep the row to be safe
          hasFieldData = true;
        }
      }

      // No product type and no field data = delete this row
      if (!hasFieldData) {
        rowsToDelete.push(row.id);
      }
    }

    // Delete empty rows
    if (rowsToDelete.length > 0) {
      await connection.execute(
        `DELETE FROM job_estimate_items WHERE id IN (${rowsToDelete.join(',')})`,
        []
      );

      // Reorder remaining items
      await this.reorderEstimateItems(estimateId, connection);
    }

    return {
      deletedCount: rowsToDelete.length,
      remainingCount: rows.length - rowsToDelete.length
    };
  }

  /**
   * Reorder estimate items after deletion to maintain sequential item_order
   */
  async reorderEstimateItems(estimateId: number, connection: any): Promise<void> {
    // Get remaining items in order
    const [rows] = await connection.execute(
      `SELECT id FROM job_estimate_items WHERE estimate_id = ? ORDER BY item_order`,
      [estimateId]
    ) as [RowDataPacket[], any];

    // Update item_order for each row
    for (let i = 0; i < rows.length; i++) {
      await connection.execute(
        `UPDATE job_estimate_items SET item_order = ? WHERE id = ?`,
        [i + 1, rows[i].id]
      );
    }
  }

  /**
   * Check if a product type is a structural row
   * Structural rows are kept during cleanup and have special handling
   */
  isStructuralRow(productTypeId: number): boolean {
    return STRUCTURAL_ROW_TYPE_IDS.includes(productTypeId);
  }
}

export const estimateRowManagementService = new EstimateRowManagementService();
