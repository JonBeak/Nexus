// File Clean up Finished: Nov 14, 2025
// Changes:
//   - Created new repository for order part snapshot data access
//   - Extracted from orderService.ts during Phase 2 architectural refactoring
//   - Uses query() helper for all non-transactional queries
//   - Supports transaction-aware methods with connection parameter
/**
 * Order Snapshot Repository
 * Data Access Layer for Order Part Snapshots (Phase 1.5.c.3)
 *
 * Handles snapshot versioning for order parts to track changes over time.
 * Supports finalization workflow where parts are versioned when orders are finalized.
 *
 * Related:
 * - orderService.ts: Business logic for snapshot creation and comparison
 * - order_part_snapshots table: Stores versioned snapshots of order parts
 */

import { query, pool } from '../config/database';
import { RowDataPacket, ResultSetHeader, PoolConnection } from 'mysql2/promise';

/**
 * Interface for part data retrieved for snapshot creation
 */
export interface PartSnapshotData {
  part_id: number;
  specifications: any;
  invoice_description: string | null;
  quantity: number;
  unit_price: number | null;
  extended_price: number | null;
  production_notes: string | null;
}

/**
 * Interface for creating a new snapshot
 */
export interface CreateSnapshotData {
  part_id: number;
  version_number: number;
  specifications: any;
  invoice_description: string | null;
  quantity: number;
  unit_price: number | null;
  extended_price: number | null;
  production_notes: string | null;
  snapshot_type: 'finalization' | 'manual';
  notes: string | null;
  created_by: number;
}

/**
 * Interface for snapshot record
 */
export interface SnapshotRecord {
  snapshot_id: number;
  part_id: number;
  version_number: number;
  specifications: any;
  invoice_description: string | null;
  quantity: number;
  unit_price: number | null;
  extended_price: number | null;
  production_notes: string | null;
  snapshot_type: string;
  notes: string | null;
  created_at: Date;
  created_by: number;
  created_by_username?: string;
}

/**
 * Interface for parts retrieved for order finalization
 */
export interface PartForSnapshot {
  part_id: number;
}

export class OrderSnapshotRepository {

  /**
   * Get current part data for snapshot creation
   */
  async getPartForSnapshot(partId: number): Promise<PartSnapshotData | null> {
    const rows = await query(
      `SELECT specifications, invoice_description, quantity,
              unit_price, extended_price, production_notes
       FROM order_parts
       WHERE part_id = ?`,
      [partId]
    ) as RowDataPacket[];

    if (rows.length === 0) {
      return null;
    }

    return {
      part_id: partId,
      ...rows[0]
    } as PartSnapshotData;
  }

  /**
   * Get next version number for a part
   * Returns next sequential version number (starts at 1)
   */
  async getNextSnapshotVersion(partId: number): Promise<number> {
    const rows = await query(
      `SELECT COALESCE(MAX(version_number), 0) + 1 as next_version
       FROM order_part_snapshots
       WHERE part_id = ?`,
      [partId]
    ) as RowDataPacket[];

    return rows[0].next_version;
  }

  /**
   * Create a new part snapshot
   * Returns the snapshot_id of the created record
   */
  async createPartSnapshot(data: CreateSnapshotData): Promise<number> {
    // Ensure specifications is a JSON string
    const specificationsJson = typeof data.specifications === 'string'
      ? data.specifications
      : JSON.stringify(data.specifications);

    const result = await query(
      `INSERT INTO order_part_snapshots (
        part_id, version_number, specifications, invoice_description,
        quantity, unit_price, extended_price, production_notes,
        snapshot_type, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.part_id,
        data.version_number,
        specificationsJson,
        data.invoice_description,
        data.quantity,
        data.unit_price,
        data.extended_price,
        data.production_notes,
        data.snapshot_type,
        data.notes,
        data.created_by
      ]
    ) as ResultSetHeader;

    return result.insertId;
  }

  /**
   * Get latest snapshot for a part
   * Returns most recent snapshot by version_number
   */
  async getLatestPartSnapshot(partId: number): Promise<SnapshotRecord | null> {
    const rows = await query(
      `SELECT snapshot_id, version_number, specifications, invoice_description,
              quantity, unit_price, extended_price, production_notes,
              snapshot_type, notes, created_at, created_by
       FROM order_part_snapshots
       WHERE part_id = ?
       ORDER BY version_number DESC
       LIMIT 1`,
      [partId]
    ) as RowDataPacket[];

    if (rows.length === 0) {
      return null;
    }

    return rows[0] as SnapshotRecord;
  }

  /**
   * Get full snapshot history for a part (ordered newest to oldest)
   * Includes username of user who created each snapshot
   */
  async getPartSnapshotHistory(partId: number): Promise<SnapshotRecord[]> {
    const rows = await query(
      `SELECT ops.snapshot_id, ops.version_number, ops.specifications,
              ops.invoice_description, ops.quantity, ops.unit_price,
              ops.extended_price, ops.production_notes, ops.snapshot_type,
              ops.notes, ops.created_at, ops.created_by,
              u.username as created_by_username
       FROM order_part_snapshots ops
       LEFT JOIN users u ON ops.created_by = u.user_id
       WHERE ops.part_id = ?
       ORDER BY ops.version_number DESC`,
      [partId]
    ) as RowDataPacket[];

    return rows as SnapshotRecord[];
  }

  /**
   * Get all part IDs for an order (used during finalization)
   * Returns array of objects with part_id only
   */
  async getAllPartsForOrder(orderId: number, connection?: PoolConnection): Promise<PartForSnapshot[]> {
    const conn = connection || pool;

    const [rows] = await conn.execute<RowDataPacket[]>(
      `SELECT part_id FROM order_parts WHERE order_id = ?`,
      [orderId]
    );

    return rows as PartForSnapshot[];
  }

  /**
   * Update order with finalization timestamp and flags
   * Must be called within a transaction
   */
  async updateOrderFinalization(
    orderId: number,
    userId: number,
    connection: PoolConnection
  ): Promise<void> {
    await connection.execute(
      `UPDATE orders
       SET finalized_at = NOW(),
           finalized_by = ?,
           modified_after_finalization = false
       WHERE order_id = ?`,
      [userId, orderId]
    );
  }
}

export const orderSnapshotRepository = new OrderSnapshotRepository();
