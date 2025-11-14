/**
 * Vacation Repository
 * Data access layer for vacation period operations
 *
 * Created: Nov 13, 2025
 * Part of accounts route refactoring - Phase 2
 */

import { query } from '../config/database';
import { RowDataPacket } from 'mysql2';

export interface VacationFields {
  vacation_id: number;
  user_id: number;
  start_date: Date;
  end_date: Date;
  description: string | null;
  created_at: Date;
  first_name: string;
  last_name: string;
}

export class VacationRepository {
  /**
   * Get all vacation periods with user details
   * @returns Array of vacation period records with user details
   */
  async getAllVacations(): Promise<RowDataPacket[]> {
    const sql = `
      SELECT
        vp.vacation_id,
        vp.user_id,
        vp.start_date,
        vp.end_date,
        vp.description,
        vp.created_at,
        u.first_name,
        u.last_name
      FROM vacation_periods vp
      JOIN users u ON vp.user_id = u.user_id
      ORDER BY vp.start_date DESC
    `;

    const vacations = await query(sql) as RowDataPacket[];
    return vacations;
  }

  /**
   * Get vacation periods for a specific user
   * @param userId - User ID to fetch vacations for
   * @returns Array of vacation period records with user details
   */
  async getVacationsByUserId(userId: number): Promise<RowDataPacket[]> {
    const sql = `
      SELECT
        vp.vacation_id,
        vp.user_id,
        vp.start_date,
        vp.end_date,
        vp.description,
        vp.created_at,
        u.first_name,
        u.last_name
      FROM vacation_periods vp
      JOIN users u ON vp.user_id = u.user_id
      WHERE vp.user_id = ?
      ORDER BY vp.start_date DESC
    `;

    const vacations = await query(sql, [userId]) as RowDataPacket[];
    return vacations;
  }

  /**
   * Create a new vacation period
   * @param vacationData - Vacation period data to insert
   * @returns Inserted vacation ID
   */
  async createVacation(vacationData: {
    user_id: number;
    start_date: string;
    end_date: string;
    description?: string | null;
  }): Promise<number> {
    const result = await query(`
      INSERT INTO vacation_periods (user_id, start_date, end_date, description, created_at)
      VALUES (?, ?, ?, ?, NOW())
    `, [
      vacationData.user_id,
      vacationData.start_date,
      vacationData.end_date,
      vacationData.description || null
    ]) as any;

    return result.insertId;
  }

  /**
   * Delete a vacation period
   * @param vacationId - Vacation ID to delete
   */
  async deleteVacation(vacationId: number): Promise<void> {
    await query(
      'DELETE FROM vacation_periods WHERE vacation_id = ?',
      [vacationId]
    );
  }

  /**
   * Check if a vacation exists
   * @param vacationId - Vacation ID to check
   * @returns True if vacation exists
   */
  async vacationExists(vacationId: number): Promise<boolean> {
    const result = await query(
      'SELECT vacation_id FROM vacation_periods WHERE vacation_id = ?',
      [vacationId]
    ) as RowDataPacket[];

    return result.length > 0;
  }

  /**
   * Create audit trail entry
   * @param auditData - Audit data to insert
   */
  async createAuditEntry(auditData: {
    user_id: number;
    action: string;
    entity_type: string;
    entity_id: number | string;
    details: string;
  }): Promise<void> {
    await query(
      `INSERT INTO audit_trail (user_id, action, entity_type, entity_id, details)
       VALUES (?, ?, ?, ?, ?)`,
      [auditData.user_id, auditData.action, auditData.entity_type, auditData.entity_id, auditData.details]
    );
  }
}

// Export singleton instance
export const vacationRepository = new VacationRepository();
