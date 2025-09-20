import { pool } from '../config/database';
import { ResultSetHeader, RowDataPacket } from 'mysql2';

interface BulkEstimateData {
  estimate: {
    customer_id?: number;
    estimate_name: string;
  };
  groups: Array<{
    temp_id: string;
    group_name: string;
    assembly_cost: number;
    assembly_description?: string;
    items: Array<{
      temp_id: string;
      product_type_id: number;
      item_name: string;
      customer_description?: string;
      internal_notes?: string;
    }>;
  }>;
}

interface BulkCreationResult {
  estimate_id: number;
  job_code: string;
  group_mappings: Array<{ temp_id: string; actual_id: number }>;
  item_mappings: Array<{ temp_id: string; actual_id: number }>;
  // Addon system removed
}

export const createBulkEstimate = async (
  data: BulkEstimateData,
  userId: number
): Promise<BulkCreationResult> => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();

    // 1. Create the estimate
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    
    const [countResult] = await connection.execute<RowDataPacket[]>(
      `SELECT COUNT(*) as count FROM job_estimates WHERE job_code LIKE ?`,
      [`CH${dateStr}%`]
    );
    
    const counter = (countResult[0].count + 1).toString().padStart(3, '0');
    const jobCode = `CH${dateStr}${counter}`;
    
    const [estimateResult] = await connection.execute<ResultSetHeader>(
      `INSERT INTO job_estimates 
       (job_code, customer_id, estimate_name, status, created_by, updated_by) 
       VALUES (?, ?, ?, 'draft', ?, ?)`,
      [jobCode, data.estimate.customer_id, data.estimate.estimate_name, userId, userId]
    );

    const estimateId = estimateResult.insertId;
    const groupMappings: Array<{ temp_id: string; actual_id: number }> = [];
    const itemMappings: Array<{ temp_id: string; actual_id: number }> = [];
    // Addon system removed - no addon mappings needed

    // 2. Create all groups
    for (let i = 0; i < data.groups.length; i++) {
      const group = data.groups[i];
      const groupOrder = i + 1;
      
      const [groupResult] = await connection.execute<ResultSetHeader>(
        `INSERT INTO job_estimate_groups 
         (estimate_id, group_name, group_order, assembly_cost, assembly_description) 
         VALUES (?, ?, ?, ?, ?)`,
        [estimateId, group.group_name, groupOrder, group.assembly_cost, group.assembly_description]
      );

      const actualGroupId = groupResult.insertId;
      groupMappings.push({ temp_id: group.temp_id, actual_id: actualGroupId });

      // 3. Create all items for this group
      for (let j = 0; j < group.items.length; j++) {
        const item = group.items[j];
        const itemOrder = j + 1;

        // Basic pricing (will be enhanced in Phase 2)
        const baseQuantity = 1;
        const unitPrice = 45.00; // Temporary fixed price
        const extendedPrice = baseQuantity * unitPrice;

        const [itemResult] = await connection.execute<ResultSetHeader>(
          `INSERT INTO job_estimate_items
           (group_id, product_type_id, item_name, item_order,
            unit_price, extended_price, customer_description, internal_notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            actualGroupId,
            item.product_type_id,
            item.item_name,
            itemOrder,
            unitPrice,
            extendedPrice,
            item.customer_description,
            item.internal_notes
          ]
        );

        const actualItemId = itemResult.insertId;
        itemMappings.push({ temp_id: item.temp_id, actual_id: actualItemId });

        // Addon system removed - no addon creation needed
      }
    }

    // 5. Calculate and update totals (basic implementation)
    const totalItems = data.groups.reduce((total, group) => total + group.items.length, 0);
    const subtotal = (totalItems * 45.00) + data.groups.reduce((total, group) => total + group.assembly_cost, 0);
    const taxRate = 0.13; // Default tax rate - will be enhanced with customer-specific rates
    const taxAmount = subtotal * taxRate;
    const totalAmount = subtotal + taxAmount;

    await connection.execute(
      `UPDATE job_estimates 
       SET subtotal = ?, tax_rate = ?, tax_amount = ?, total_amount = ?
       WHERE id = ?`,
      [subtotal, taxRate, taxAmount, totalAmount, estimateId]
    );

    await connection.commit();

    return {
      estimate_id: estimateId,
      job_code: jobCode,
      group_mappings: groupMappings,
      item_mappings: itemMappings
      // Addon system removed
    };

  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};