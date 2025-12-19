/**
 * Repository Layer - Estimate Line Descriptions
 * Handles all database operations for QB descriptions
 */

import { query, pool } from '../config/database';
import { RowDataPacket, ResultSetHeader, PoolConnection } from 'mysql2/promise';
import {
  EstimateLineDescription,
  CreateEstimateLineDescriptionData,
  BatchDescriptionUpdate
} from '../types/estimateLineDescription';

class EstimateLineDescriptionRepository {
  /**
   * Get all QB descriptions for an estimate
   */
  async getDescriptionsByEstimateId(
    estimateId: number,
    connection?: PoolConnection
  ): Promise<EstimateLineDescription[]> {
    // Use connection if in transaction, otherwise use query() helper
    if (connection) {
      const [rows] = await connection.execute<RowDataPacket[]>(
        `SELECT id, estimate_id, line_index, qb_description, is_auto_filled,
                created_at, updated_at
         FROM estimate_line_descriptions
         WHERE estimate_id = ?
         ORDER BY line_index`,
        [estimateId]
      );
      return rows as EstimateLineDescription[];
    } else {
      const rows = await query(
        `SELECT id, estimate_id, line_index, qb_description, is_auto_filled,
                created_at, updated_at
         FROM estimate_line_descriptions
         WHERE estimate_id = ?
         ORDER BY line_index`,
        [estimateId]
      ) as RowDataPacket[];
      return rows as EstimateLineDescription[];
    }
  }

  /**
   * Upsert a single line description
   * Uses ON DUPLICATE KEY UPDATE for efficiency
   */
  async upsertLineDescription(
    estimateId: number,
    lineIndex: number,
    qbDescription: string | null,
    isAutoFilled: boolean,
    connection?: PoolConnection
  ): Promise<number> {
    const conn = connection || pool;

    const [result] = await conn.execute<ResultSetHeader>(
      `INSERT INTO estimate_line_descriptions
         (estimate_id, line_index, qb_description, is_auto_filled)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         qb_description = VALUES(qb_description),
         is_auto_filled = VALUES(is_auto_filled),
         updated_at = CURRENT_TIMESTAMP`,
      [estimateId, lineIndex, qbDescription, isAutoFilled]
    );

    return result.insertId;
  }

  /**
   * Batch upsert descriptions (for auto-fill operation)
   * More efficient than individual upserts
   */
  async batchUpsertDescriptions(
    estimateId: number,
    descriptions: BatchDescriptionUpdate[],
    connection?: PoolConnection
  ): Promise<void> {
    if (descriptions.length === 0) return;

    const conn = connection || pool;

    // Build values array for batch insert
    const values = descriptions.map(d => [
      estimateId,
      d.lineIndex,
      d.qbDescription,
      d.isAutoFilled
    ]);

    // Single query with multiple value sets
    const placeholders = descriptions.map(() => '(?, ?, ?, ?)').join(', ');
    const flatValues = values.flat();

    await conn.execute(
      `INSERT INTO estimate_line_descriptions
         (estimate_id, line_index, qb_description, is_auto_filled)
       VALUES ${placeholders}
       ON DUPLICATE KEY UPDATE
         qb_description = VALUES(qb_description),
         is_auto_filled = VALUES(is_auto_filled),
         updated_at = CURRENT_TIMESTAMP`,
      flatValues
    );
  }

  /**
   * Delete all descriptions for an estimate
   * Used during estimate deletion (CASCADE handles this, but explicit method useful for testing)
   */
  async deleteByEstimateId(
    estimateId: number,
    connection?: PoolConnection
  ): Promise<void> {
    const conn = connection || pool;
    await conn.execute(
      `DELETE FROM estimate_line_descriptions WHERE estimate_id = ?`,
      [estimateId]
    );
  }

  /**
   * Copy descriptions from source estimate to target estimate
   * Used during estimate duplication
   */
  async copyDescriptions(
    sourceEstimateId: number,
    targetEstimateId: number,
    connection?: PoolConnection
  ): Promise<number> {
    const conn = connection || pool;

    const [result] = await conn.execute<ResultSetHeader>(
      `INSERT INTO estimate_line_descriptions
         (estimate_id, line_index, qb_description, is_auto_filled)
       SELECT ?, line_index, qb_description, is_auto_filled
       FROM estimate_line_descriptions
       WHERE estimate_id = ?`,
      [targetEstimateId, sourceEstimateId]
    );

    return result.affectedRows;
  }
}

export const estimateLineDescriptionRepository = new EstimateLineDescriptionRepository();
