/**
 * Estimate Point Person Repository
 * Phase 4c - Estimate Workflow Redesign
 *
 * Handles database operations for estimate point persons
 */

import { query } from '../config/database';
import { pool } from '../config/database';
import { RowDataPacket, ResultSetHeader, PoolConnection } from 'mysql2/promise';
import {
  EstimatePointPerson,
  CreateEstimatePointPersonData,
  EstimatePointPersonInput
} from '../types/estimatePointPerson';

class EstimatePointPersonRepository {
  /**
   * Get all point persons for an estimate
   */
  async getPointPersonsByEstimateId(estimateId: number): Promise<EstimatePointPerson[]> {
    const rows = await query(
      `SELECT id, estimate_id, contact_id, contact_email, contact_name,
              contact_phone, contact_role, display_order, created_at
       FROM estimate_point_persons
       WHERE estimate_id = ?
       ORDER BY display_order`,
      [estimateId]
    ) as RowDataPacket[];

    return rows as EstimatePointPerson[];
  }

  /**
   * Create a single point person entry
   */
  async createPointPerson(
    data: CreateEstimatePointPersonData,
    connection?: PoolConnection
  ): Promise<number> {
    const conn = connection || pool;

    const [result] = await conn.execute<ResultSetHeader>(
      `INSERT INTO estimate_point_persons (
        estimate_id, contact_id, contact_email, contact_name,
        contact_phone, contact_role, display_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        data.estimate_id,
        data.contact_id || null,
        data.contact_email,
        data.contact_name || null,
        data.contact_phone || null,
        data.contact_role || null,
        data.display_order
      ]
    );

    return result.insertId;
  }

  /**
   * Update all point persons for an estimate (delete and recreate)
   */
  async updatePointPersons(
    estimateId: number,
    pointPersons: EstimatePointPersonInput[],
    connection?: PoolConnection
  ): Promise<void> {
    const conn = connection || pool;

    // Delete existing point persons
    await conn.execute(
      `DELETE FROM estimate_point_persons WHERE estimate_id = ?`,
      [estimateId]
    );

    // Create new ones
    for (let i = 0; i < pointPersons.length; i++) {
      const person = pointPersons[i];
      if (person.contact_email) {
        await this.createPointPerson({
          estimate_id: estimateId,
          contact_id: person.contact_id,
          contact_email: person.contact_email,
          contact_name: person.contact_name,
          contact_phone: person.contact_phone,
          contact_role: person.contact_role,
          display_order: i
        }, conn as PoolConnection);
      }
    }
  }

  /**
   * Delete all point persons for an estimate
   */
  async deletePointPersonsByEstimateId(
    estimateId: number,
    connection?: PoolConnection
  ): Promise<void> {
    const conn = connection || pool;

    await conn.execute(
      `DELETE FROM estimate_point_persons WHERE estimate_id = ?`,
      [estimateId]
    );
  }

  /**
   * Copy point persons from estimate to order
   * Used during order conversion to pre-populate order point persons
   */
  async copyPointPersonsToOrder(
    estimateId: number,
    orderId: number,
    connection?: PoolConnection
  ): Promise<number> {
    const conn = connection || pool;

    // Get estimate point persons
    const estimatePersons = await this.getPointPersonsByEstimateId(estimateId);

    if (estimatePersons.length === 0) {
      return 0;
    }

    // Insert into order_point_persons
    for (const person of estimatePersons) {
      await conn.execute<ResultSetHeader>(
        `INSERT INTO order_point_persons (
          order_id, contact_id, contact_email, contact_name,
          contact_phone, contact_role, display_order
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          orderId,
          person.contact_id || null,
          person.contact_email,
          person.contact_name || null,
          person.contact_phone || null,
          person.contact_role || null,
          person.display_order
        ]
      );
    }

    return estimatePersons.length;
  }
}

export const estimatePointPersonRepository = new EstimatePointPersonRepository();
