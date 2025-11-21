// File Clean up Finished: 2025-11-21
// Created from extraction of snapshot methods from orderService.ts
// Methods: createPartSnapshot, finalizeOrder, getLatestSnapshot,
//          getSnapshotHistory, compareWithLatestSnapshot

/**
 * Order Snapshot Service
 * Business Logic for Order Part Snapshots and Versioning
 *
 * Handles:
 * - Creating part snapshots (manual and finalization)
 * - Order finalization with transactional snapshot creation
 * - Snapshot retrieval and history
 * - Comparing current state with snapshots
 *
 * Phase 1.5.c.3
 */

import { orderSnapshotRepository } from '../repositories/orderSnapshotRepository';
import { pool } from '../config/database';

export class OrderSnapshotService {

  /**
   * Create snapshot for a single order part
   * Phase 1.5.c.3
   */
  async createPartSnapshot(
    partId: number,
    userId: number,
    snapshotType: 'finalization' | 'manual' = 'finalization',
    notes?: string
  ): Promise<number> {
    // Get current part data
    const part = await orderSnapshotRepository.getPartForSnapshot(partId);

    if (!part) {
      throw new Error('Part not found');
    }

    // Get next version number for this part
    const versionNumber = await orderSnapshotRepository.getNextSnapshotVersion(partId);

    // Create snapshot using repository
    const snapshotId = await orderSnapshotRepository.createPartSnapshot({
      part_id: partId,
      version_number: versionNumber,
      specifications: part.specifications,
      invoice_description: part.invoice_description,
      quantity: part.quantity,
      unit_price: part.unit_price,
      extended_price: part.extended_price,
      production_notes: part.production_notes,
      snapshot_type: snapshotType,
      notes: notes || null,
      created_by: userId
    });

    return snapshotId;
  }

  /**
   * Finalize order - create snapshots for all parts and update order
   * Phase 1.5.c.3
   *
   * Note on pool usage:
   *   - Uses pool.getConnection() for transaction support
   *   - Transactions require BEGIN/COMMIT/ROLLBACK with dedicated connection
   *   - This is the CORRECT and ONLY valid use case for pool in services
   */
  async finalizeOrder(orderId: number, userId: number): Promise<void> {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // Get all parts for this order
      const parts = await orderSnapshotRepository.getAllPartsForOrder(orderId, connection);

      // Create snapshot for each part
      for (const part of parts) {
        await this.createPartSnapshot(part.part_id, userId, 'finalization', 'Order finalized');
      }

      // Update order with finalization info
      await orderSnapshotRepository.updateOrderFinalization(orderId, userId, connection);

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Get latest snapshot for a part
   * Phase 1.5.c.3
   */
  async getLatestSnapshot(partId: number): Promise<any | null> {
    return await orderSnapshotRepository.getLatestPartSnapshot(partId);
  }

  /**
   * Get all snapshots for a part (for version history viewer)
   * Phase 1.5.c.3
   */
  async getSnapshotHistory(partId: number): Promise<any[]> {
    return await orderSnapshotRepository.getPartSnapshotHistory(partId);
  }

  /**
   * Compare current part state with latest snapshot
   * Phase 1.5.c.3
   */
  async compareWithLatestSnapshot(partId: number): Promise<{
    hasSnapshot: boolean;
    isModified: boolean;
    latestSnapshot: any | null;
    currentState: any;
    modifications: any[];
  }> {
    // Get latest snapshot
    const latestSnapshot = await this.getLatestSnapshot(partId);

    // Get current part state
    const currentPart = await orderSnapshotRepository.getPartForSnapshot(partId);

    if (!currentPart) {
      throw new Error('Part not found');
    }

    const currentState = {
      specifications: currentPart.specifications,
      invoice_description: currentPart.invoice_description,
      quantity: currentPart.quantity,
      unit_price: currentPart.unit_price,
      extended_price: currentPart.extended_price,
      production_notes: currentPart.production_notes
    };

    if (!latestSnapshot) {
      return {
        hasSnapshot: false,
        isModified: false,
        latestSnapshot: null,
        currentState,
        modifications: []
      };
    }

    // Parse specifications
    const snapshotSpecs = typeof latestSnapshot.specifications === 'string'
      ? JSON.parse(latestSnapshot.specifications)
      : latestSnapshot.specifications;
    const currentSpecs = typeof currentState.specifications === 'string'
      ? JSON.parse(currentState.specifications)
      : currentState.specifications;

    // Detect modifications
    const modifications: any[] = [];

    // Check specifications
    if (JSON.stringify(snapshotSpecs) !== JSON.stringify(currentSpecs)) {
      modifications.push({
        type: 'specifications',
        snapshotValue: snapshotSpecs,
        currentValue: currentSpecs
      });
    }

    // Check invoice fields
    const invoiceFields: Array<keyof typeof currentState> = ['invoice_description', 'quantity', 'unit_price', 'extended_price'];
    for (const field of invoiceFields) {
      if ((latestSnapshot as any)[field] !== currentState[field]) {
        modifications.push({
          type: field,
          snapshotValue: (latestSnapshot as any)[field],
          currentValue: currentState[field]
        });
      }
    }

    // Check production notes
    if (latestSnapshot.production_notes !== currentState.production_notes) {
      modifications.push({
        type: 'production_notes',
        snapshotValue: latestSnapshot.production_notes,
        currentValue: currentState.production_notes
      });
    }

    return {
      hasSnapshot: true,
      isModified: modifications.length > 0,
      latestSnapshot,
      currentState,
      modifications
    };
  }
}

export const orderSnapshotService = new OrderSnapshotService();
