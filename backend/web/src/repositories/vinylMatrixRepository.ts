/**
 * Vinyl Application Matrix Repository
 * Database access layer for vinyl_application_matrix table
 */

import { query } from '../config/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

// =============================================================================
// Types
// =============================================================================

export interface VinylMatrixEntry {
  matrix_id: number;
  product_type: string;
  product_type_key: string;
  application: string;
  application_key: string;
  task_names: string[];
  is_active: boolean;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
  updated_by: number | null;
}

export interface VinylMatrixProductType {
  product_type: string;
  product_type_key: string;
}

// =============================================================================
// Repository
// =============================================================================

export const vinylMatrixRepository = {
  /**
   * Get all matrix entries for a specific product type
   */
  async getMatrixByProductType(productTypeKey: string): Promise<VinylMatrixEntry[]> {
    const rows = await query(
      'SELECT * FROM vinyl_application_matrix WHERE product_type_key = ? AND is_active = TRUE ORDER BY application',
      [productTypeKey]
    ) as RowDataPacket[];

    return rows.map(row => ({
      ...row,
      task_names: typeof row.task_names === 'string'
        ? JSON.parse(row.task_names)
        : row.task_names
    })) as VinylMatrixEntry[];
  },

  /**
   * Get a specific matrix entry by product type and application
   */
  async getMatrixEntry(productTypeKey: string, applicationKey: string): Promise<VinylMatrixEntry | null> {
    const rows = await query(
      'SELECT * FROM vinyl_application_matrix WHERE product_type_key = ? AND application_key = ? AND is_active = TRUE',
      [productTypeKey, applicationKey]
    ) as RowDataPacket[];

    if (!rows[0]) return null;

    return {
      ...rows[0],
      task_names: typeof rows[0].task_names === 'string'
        ? JSON.parse(rows[0].task_names)
        : rows[0].task_names
    } as VinylMatrixEntry;
  },

  /**
   * Get the default entry for an application (product_type_key = '_default')
   */
  async getDefaultEntry(applicationKey: string): Promise<VinylMatrixEntry | null> {
    return this.getMatrixEntry('_default', applicationKey);
  },

  /**
   * Get tasks for an application - checks specific product type first, then falls back to default
   */
  async getTasksForApplication(productTypeKey: string, applicationKey: string): Promise<string[] | null> {
    // First try product-specific entry
    let entry = await this.getMatrixEntry(productTypeKey, applicationKey);

    // Fall back to default if no product-specific entry
    if (!entry && productTypeKey !== '_default') {
      entry = await this.getDefaultEntry(applicationKey);
    }

    return entry?.task_names || null;
  },

  /**
   * Get all distinct product types in the matrix
   */
  async getAllProductTypes(): Promise<VinylMatrixProductType[]> {
    return await query(`
      SELECT DISTINCT product_type, product_type_key
      FROM vinyl_application_matrix
      WHERE is_active = TRUE
      ORDER BY
        CASE WHEN product_type_key = '_default' THEN 0 ELSE 1 END,
        product_type
    `) as VinylMatrixProductType[];
  },

  /**
   * Get all applications in the matrix (for a given product type or all)
   */
  async getAllApplications(productTypeKey?: string): Promise<Array<{ application: string; application_key: string }>> {
    if (productTypeKey) {
      return await query(`
        SELECT DISTINCT application, application_key
        FROM vinyl_application_matrix
        WHERE product_type_key = ? AND is_active = TRUE
        ORDER BY application
      `, [productTypeKey]) as Array<{ application: string; application_key: string }>;
    }

    return await query(`
      SELECT DISTINCT application, application_key
      FROM vinyl_application_matrix
      WHERE is_active = TRUE
      ORDER BY application
    `) as Array<{ application: string; application_key: string }>;
  },

  /**
   * Get matrix entry by ID
   */
  async getMatrixEntryById(matrixId: number): Promise<VinylMatrixEntry | null> {
    const rows = await query(
      'SELECT * FROM vinyl_application_matrix WHERE matrix_id = ?',
      [matrixId]
    ) as RowDataPacket[];

    if (!rows[0]) return null;

    return {
      ...rows[0],
      task_names: typeof rows[0].task_names === 'string'
        ? JSON.parse(rows[0].task_names)
        : rows[0].task_names
    } as VinylMatrixEntry;
  },

  /**
   * Create a new matrix entry
   */
  async createMatrixEntry(data: {
    product_type: string;
    product_type_key: string;
    application: string;
    application_key: string;
    task_names: string[];
    notes?: string;
    updated_by?: number;
  }): Promise<number> {
    const result = await query(
      `INSERT INTO vinyl_application_matrix
       (product_type, product_type_key, application, application_key, task_names, notes, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        data.product_type,
        data.product_type_key,
        data.application,
        data.application_key,
        JSON.stringify(data.task_names),
        data.notes || null,
        data.updated_by || null
      ]
    ) as ResultSetHeader;

    return result.insertId;
  },

  /**
   * Update matrix entry task names
   */
  async updateMatrixEntry(
    matrixId: number,
    taskNames: string[],
    updatedBy: number
  ): Promise<void> {
    await query(
      'UPDATE vinyl_application_matrix SET task_names = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE matrix_id = ?',
      [JSON.stringify(taskNames), updatedBy, matrixId]
    );
  },

  /**
   * Deactivate a matrix entry (soft delete)
   */
  async deactivateMatrixEntry(matrixId: number, updatedBy: number): Promise<void> {
    await query(
      'UPDATE vinyl_application_matrix SET is_active = FALSE, updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE matrix_id = ?',
      [updatedBy, matrixId]
    );
  },

  /**
   * Check if an entry exists for product type + application combination
   */
  async entryExists(productTypeKey: string, applicationKey: string): Promise<boolean> {
    const rows = await query(
      'SELECT 1 FROM vinyl_application_matrix WHERE product_type_key = ? AND application_key = ? AND is_active = TRUE LIMIT 1',
      [productTypeKey, applicationKey]
    ) as RowDataPacket[];

    return rows.length > 0;
  }
};

export default vinylMatrixRepository;
