// File Clean up Finished: Nov 14, 2025
// Status: No dead code found - legacy methods already removed (getEstimateGroups, createGroup)
// Migrated to query() helper: Nov 14, 2025
import { query } from '../config/database';
import { ResultSetHeader, RowDataPacket } from 'mysql2';

export interface EstimateFilters {
  status?: string;
  customer_id?: string;
  search?: string;
  limit?: number;
}

export interface EstimateData {
  customer_id?: number;
  estimate_name: string;
  status?: string;
  notes?: string;
}

export interface GroupData {
  estimate_id: number;
  group_name: string;
  assembly_cost?: number;
  assembly_description?: string;
}

export class JobEstimationRepository {
  
  async getEstimates(filters: EstimateFilters): Promise<RowDataPacket[]> {
    const { status, customer_id, search, limit = 50 } = filters;
    
    let sql = `
      SELECT * FROM job_estimate_summary
      WHERE 1=1
    `;
    
    const params: any[] = [];
    
    if (status) {
      sql += ` AND status = ?`;
      params.push(status);
    }
    
    if (customer_id) {
      sql += ` AND customer_id = ?`;
      params.push(customer_id);
    }
    
    if (search) {
      sql += ` AND (job_code LIKE ? OR estimate_name LIKE ? OR customer_name LIKE ?)`;
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }
    
    sql += ` ORDER BY updated_at DESC LIMIT ${parseInt(limit.toString())}`;

    const rows = await query(sql, params) as RowDataPacket[];
    return rows;
  }

  async getEstimateById(id: number): Promise<RowDataPacket | null> {
    const estimateRows = await query(
      `SELECT je.*, c.company_name as customer_name,
        COALESCE(tr.tax_percent, 1.0) as tax_rate
       FROM job_estimates je
       LEFT JOIN customers c ON je.customer_id = c.customer_id
       LEFT JOIN customer_addresses ca ON c.customer_id = ca.customer_id
         AND (ca.is_billing = 1 OR (ca.is_primary = 1 AND NOT EXISTS(
           SELECT 1 FROM customer_addresses ca2
           WHERE ca2.customer_id = c.customer_id AND ca2.is_billing = 1
         )))
       LEFT JOIN provinces_tax pt ON ca.province_state_short = pt.province_short AND pt.is_active = 1
       LEFT JOIN tax_rules tr ON pt.tax_name = tr.tax_name AND tr.is_active = 1
       WHERE je.id = ?`,
      [id]
    ) as RowDataPacket[];

    return estimateRows.length > 0 ? estimateRows[0] : null;
  }

  // Legacy getEstimateGroups method removed - Phase 4/5 uses grid-data endpoints instead

  async createEstimate(data: EstimateData, jobCode: string, userId: number): Promise<number> {
    // Fetch email template to initialize email_subject and email_body
    const templateRows = await query(
      `SELECT subject, body FROM email_templates WHERE template_key = 'estimate_send' AND is_active = 1`,
      []
    ) as RowDataPacket[];

    const emailSubject = templateRows.length > 0 ? templateRows[0].subject : '';
    const emailBody = templateRows.length > 0 ? templateRows[0].body : '';

    const result = await query(
      `INSERT INTO job_estimates
       (job_code, customer_id, estimate_name, email_subject, email_body, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [jobCode, data.customer_id, data.estimate_name, emailSubject, emailBody, userId, userId]
    ) as ResultSetHeader;

    return result.insertId;
  }

  async updateEstimate(id: number, data: EstimateData, userId: number): Promise<boolean> {
    const result = await query(
      `UPDATE job_estimates
       SET customer_id = ?, estimate_name = ?, status = ?, notes = ?, updated_by = ?
       WHERE id = ?`,
      [data.customer_id, data.estimate_name, data.status, data.notes, userId, id]
    ) as ResultSetHeader;

    return result.affectedRows > 0;
  }

  async deleteEstimate(id: number): Promise<boolean> {
    const result = await query(
      `DELETE FROM job_estimates WHERE id = ?`,
      [id]
    ) as ResultSetHeader;

    return result.affectedRows > 0;
  }

  // Legacy createGroup method removed - Phase 4/5 uses assembly_group_id in grid data instead

  async getProductTypes(category?: string): Promise<RowDataPacket[]> {
    let sql = `
      SELECT id, name, category, display_order, default_unit, is_active,
             input_template, pricing_rules, complexity_rules, material_rules,
             created_at, updated_at
      FROM product_types
      WHERE is_active = TRUE
    `;
    const params: any[] = [];

    if (category) {
      sql += ` AND category = ?`;
      params.push(category);
    }

    const rows = await query(sql, params) as RowDataPacket[];
    return rows;
  }


  async getJobCodeCount(dateStr: string): Promise<number> {
    const countResult = await query(
      `SELECT COUNT(*) as count FROM job_estimates WHERE job_code LIKE ?`,
      [`CH${dateStr}%`]
    ) as RowDataPacket[];
    return countResult[0].count;
  }
}