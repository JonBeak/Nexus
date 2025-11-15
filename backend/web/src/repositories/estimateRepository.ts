// File Clean up Finished: Nov 13, 2025
// File Clean up Finished: Nov 14, 2025 (updated during estimateVersioningService cleanup)
// File Extended: Nov 14, 2025 (Phase 2: Architectural refactoring)
// Changes:
//   - Enhanced estimateExists() documentation with usage patterns
//   - Added TODO comment about redundant status tracking system
//   - Kept estimateExists() method (previously considered dead code)
//   - Method now used by EstimateStatusService for clearer errors
//   - Added setEstimateToDraft() for transaction-aware draft status updates
//   - Added version management methods (extracted from estimateVersionService)
//   - Added grid data persistence methods (extracted from gridDataService)
import { query, pool } from '../config/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { PoolConnection } from 'mysql2/promise';

/**
 * Estimate Repository
 *
 * Handles database access for job_estimates table following 3-layer architecture.
 * Part of the estimate versioning system refactoring.
 *
 * Related:
 * - EstimateService: Business logic layer
 * - estimateController: HTTP request handling
 *
 * TODO (Technical Debt): Migrate redundant status tracking system
 * The job_estimates table currently has BOTH:
 * - status ENUM ('draft', 'sent', 'approved', 'retracted', 'deactivated')
 * - Boolean flags (is_draft, is_sent, is_approved, is_retracted)
 *
 * This duplication adds complexity and risk of inconsistency.
 * Future migration should consolidate to single status enum pattern.
 * Affects: ~15+ service files, controllers, and frontend components
 *
 * Note: 'ordered' status removed (2025-11-15) - order conversion tracked via orders.estimate_id foreign key
 */
export class EstimateRepository {

  /**
   * Update estimate notes
   * @param estimateId - The estimate ID
   * @param notes - New notes content (null to clear)
   * @param userId - User making the update
   * @returns True if update successful
   */
  async updateEstimateNotes(estimateId: number, notes: string | null, userId: number): Promise<boolean> {
    const rows = await query(
      'UPDATE job_estimates SET notes = ?, updated_by = ?, updated_at = NOW() WHERE id = ?',
      [notes, userId, estimateId]
    ) as ResultSetHeader;

    return rows.affectedRows > 0;
  }

  /**
   * Get job ID associated with an estimate
   * @param estimateId - The estimate ID to lookup
   * @returns Job ID or null if estimate not found
   */
  async getJobIdByEstimateId(estimateId: number): Promise<number | null> {
    const rows = await query(
      'SELECT job_id FROM job_estimates WHERE id = ?',
      [estimateId]
    ) as RowDataPacket[];

    return rows.length > 0 ? rows[0].job_id : null;
  }

  /**
   * Check if estimate exists
   *
   * PURPOSE: Use this for input validation to provide clear, specific error messages.
   *
   * PATTERN: Separate "not found" errors from "invalid state" errors:
   *
   * ✅ GOOD PATTERN:
   * if (!(await estimateRepository.estimateExists(estimateId))) {
   *   throw new Error('Estimate not found');  // 404 - clear error
   * }
   *
   * const estimate = await getEstimateWithConditions(estimateId);
   * if (!estimate) {
   *   throw new Error('Estimate is in draft mode');  // 400 - clear error
   * }
   *
   * ❌ BAD PATTERN (currently used in 15+ places):
   * const estimate = await getEstimateWithConditions(estimateId);
   * if (!estimate) {
   *   throw new Error('Estimate not found or is in draft');  // Ambiguous!
   * }
   *
   * @param estimateId - The estimate ID to check
   * @returns True if estimate exists in database (regardless of status/state)
   */
  async estimateExists(estimateId: number): Promise<boolean> {
    const rows = await query(
      'SELECT id FROM job_estimates WHERE id = ?',
      [estimateId]
    ) as RowDataPacket[];

    return rows.length > 0;
  }

  /**
   * Validate estimate access with optional job ownership verification
   *
   * This method consolidates validation logic previously duplicated across services.
   *
   * @param estimateId - The estimate ID to validate
   * @param jobId - Optional job ID to verify estimate belongs to that job
   * @returns True if estimate exists (and belongs to job if specified)
   */
  async validateEstimateAccess(estimateId: number, jobId?: number): Promise<boolean> {
    // If no job_id specified, just check existence
    if (!jobId) {
      return this.estimateExists(estimateId);
    }

    // If job_id specified, verify estimate belongs to that job
    const actualJobId = await this.getJobIdByEstimateId(estimateId);
    return actualJobId === jobId;
  }

  /**
   * Set estimate to draft status (transaction-aware)
   *
   * Used during estimate duplication workflows where a newly created estimate
   * needs to be set to draft mode within an existing transaction.
   *
   * @param connection - Database connection (for transaction support)
   * @param estimateId - The estimate ID to update
   * @param userId - User performing the operation
   */
  async setEstimateToDraft(
    connection: PoolConnection,
    estimateId: number,
    userId: number
  ): Promise<void> {
    await connection.execute(
      `UPDATE job_estimates
       SET status = 'draft', is_draft = TRUE, created_by = ?, updated_by = ?
       WHERE id = ?`,
      [userId, userId, estimateId]
    );
  }

  // =============================================
  // VERSION MANAGEMENT METHODS
  // =============================================

  /**
   * Get all estimate versions for a job with full details
   * Includes parent version reference, finalization info, and customer data
   */
  async getEstimateVersionsByJobId(jobId: number): Promise<RowDataPacket[]> {
    const rows = await query(
      `SELECT
        e.id,
        e.job_id,
        j.customer_id AS customer_id,
        e.job_code,
        e.version_number,
        e.parent_estimate_id,
        pe.version_number as parent_version,
        CAST(e.is_draft AS UNSIGNED) as is_draft,
        CAST(e.is_active AS UNSIGNED) as is_active,
        e.status,
        e.finalized_at,
        fu.username as finalized_by_name,
        e.subtotal,
        e.tax_amount,
        e.total_amount,
        e.qb_estimate_id,
        e.sent_to_qb_at,
        e.created_at,
        e.updated_at,
        e.notes,
        cu.username as created_by_name,
        CAST(e.is_sent AS UNSIGNED) as is_sent,
        CAST(e.is_approved AS UNSIGNED) as is_approved,
        CAST(e.is_retracted AS UNSIGNED) as is_retracted,
        j.job_name,
        j.job_number,
        c.company_name as customer_name
       FROM job_estimates e
       LEFT JOIN job_estimates pe ON e.parent_estimate_id = pe.id
       LEFT JOIN users fu ON e.finalized_by_user_id = fu.user_id
       LEFT JOIN users cu ON e.created_by = cu.user_id
       LEFT JOIN jobs j ON e.job_id = j.job_id
       LEFT JOIN customers c ON j.customer_id = c.customer_id
       WHERE e.job_id = ?
       ORDER BY e.version_number ASC`,
      [jobId]
    ) as RowDataPacket[];

    return rows;
  }

  /**
   * Get next version number for a job (transaction-aware)
   * Returns COALESCE(MAX(version_number), 0) + 1
   */
  async getNextVersionNumber(jobId: number, connection: PoolConnection): Promise<number> {
    const [rows] = await connection.execute<RowDataPacket[]>(
      'SELECT COALESCE(MAX(version_number), 0) + 1 as next_version FROM job_estimates WHERE job_id = ?',
      [jobId]
    );

    return rows[0].next_version;
  }

  /**
   * Check if estimate is currently in draft mode
   * Returns true if estimate exists AND is_draft = TRUE
   */
  async checkEstimateIsDraft(estimateId: number): Promise<boolean> {
    const rows = await query(
      'SELECT is_draft FROM job_estimates WHERE id = ? AND is_draft = TRUE',
      [estimateId]
    ) as RowDataPacket[];

    return rows.length > 0;
  }

  /**
   * Get estimate with draft check (returns null if not draft)
   * Used by services that need to verify draft status before operations
   */
  async getEstimateWithDraftCheck(estimateId: number): Promise<RowDataPacket | null> {
    const rows = await query(
      'SELECT id, is_draft FROM job_estimates WHERE id = ? AND is_draft = TRUE',
      [estimateId]
    ) as RowDataPacket[];

    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Get estimate with draft check (transaction-aware)
   * Used within transactions during grid data save
   */
  async getEstimateWithDraftCheckInTransaction(
    estimateId: number,
    connection: PoolConnection
  ): Promise<RowDataPacket | null> {
    const [rows] = await connection.execute<RowDataPacket[]>(
      'SELECT id, is_draft FROM job_estimates WHERE id = ? AND is_draft = TRUE',
      [estimateId]
    );

    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Update estimate draft timestamp (used when saving drafts)
   * Updates updated_by and updated_at to reflect save operation
   */
  async updateEstimateDraftTimestamp(estimateId: number, userId: number): Promise<void> {
    await query(
      'UPDATE job_estimates SET updated_by = ?, updated_at = NOW() WHERE id = ?',
      [userId, estimateId]
    );
  }

  /**
   * Finalize estimate with status and flags
   * Updates is_draft, status, finalization timestamp, and conditional flags (is_sent, is_approved)
   */
  async updateEstimateFinalization(
    estimateId: number,
    status: string,
    userId: number,
    statusFlags: { is_sent?: boolean; is_approved?: boolean }
  ): Promise<void> {
    const updates: string[] = [
      'status = ?',
      'is_draft = FALSE',
      'finalized_at = NOW()',
      'finalized_by_user_id = ?',
      'updated_by = ?'
    ];
    const params: any[] = [status, userId, userId];

    if (statusFlags.is_sent !== undefined) {
      updates.push('is_sent = ?');
      params.push(statusFlags.is_sent ? 1 : 0);
    }

    if (statusFlags.is_approved !== undefined) {
      updates.push('is_approved = ?');
      params.push(statusFlags.is_approved ? 1 : 0);
    }

    params.push(estimateId);

    await query(
      `UPDATE job_estimates SET ${updates.join(', ')} WHERE id = ?`,
      params
    );
  }

  /**
   * Update job status based on estimate finalization
   * Used when estimate is approved or ordered to update parent job status
   */
  async updateJobStatusByEstimate(estimateId: number, jobStatus: string): Promise<void> {
    await query(
      `UPDATE jobs j
       JOIN job_estimates e ON j.job_id = e.job_id
       SET j.status = ?
       WHERE e.id = ?`,
      [jobStatus, estimateId]
    );
  }

  /**
   * Get estimate with job_id (used for job ownership checks)
   * Returns estimate record with job_id and is_draft status
   */
  async getEstimateWithJobId(estimateId: number): Promise<{ id: number; is_draft: number; job_id: number } | null> {
    const rows = await query(
      'SELECT e.id, e.is_draft, e.job_id FROM job_estimates e WHERE e.id = ? AND e.is_draft = TRUE',
      [estimateId]
    ) as RowDataPacket[];

    return rows.length > 0 ? rows[0] as any : null;
  }

  // =============================================
  // ESTIMATE CREATION METHODS (Transaction-aware)
  // =============================================

  /**
   * Create new estimate version (brand new, not duplicated)
   * Used when creating a version without parent/duplication source
   */
  async createNewEstimateVersion(
    connection: PoolConnection,
    jobCode: string,
    jobId: number,
    nextVersion: number,
    userId: number,
    notes?: string | null
  ): Promise<number> {
    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO job_estimates (
        job_code, job_id, customer_id, version_number,
        is_draft, created_by, updated_by, notes
       )
       SELECT ?, ?, customer_id, ?, TRUE, ?, ?, ?
       FROM jobs WHERE job_id = ?`,
      [jobCode, jobId, nextVersion, userId, userId, notes || null, jobId]
    );

    return result.insertId;
  }

  /**
   * Get source estimate data for duplication
   * Returns full estimate record for copying
   */
  async getSourceEstimateForDuplication(
    connection: PoolConnection,
    sourceEstimateId: number
  ): Promise<RowDataPacket | null> {
    const [rows] = await connection.execute<RowDataPacket[]>(
      `SELECT * FROM job_estimates WHERE id = ?`,
      [sourceEstimateId]
    );

    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Create duplicate estimate in a different job
   * Used for cross-job estimate copying
   */
  async createDuplicateEstimateToNewJob(
    connection: PoolConnection,
    newJobCode: string,
    targetJobId: number,
    targetVersion: number,
    sourceCustomerId: number,
    subtotal: number,
    taxRate: number,
    taxAmount: number,
    totalAmount: number,
    notes: string | null,
    userId: number
  ): Promise<number> {
    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO job_estimates (
        job_code, job_id, customer_id, version_number, parent_estimate_id,
        subtotal, tax_rate, tax_amount, total_amount, notes,
        created_by, updated_by, is_draft
       )
       VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, TRUE)`,
      [
        newJobCode, targetJobId, sourceCustomerId, targetVersion,
        subtotal, taxRate, taxAmount, totalAmount, notes,
        userId, userId
      ]
    );

    return result.insertId;
  }

  /**
   * Create duplicate estimate within same job
   * Uses SELECT to copy data from source estimate
   */
  async createDuplicateEstimate(
    connection: PoolConnection,
    jobCode: string,
    jobId: number,
    version: number,
    sourceEstimateId: number,
    notes: string | null,
    userId: number
  ): Promise<number> {
    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO job_estimates (
        job_code, job_id, customer_id, version_number, parent_estimate_id,
        subtotal, tax_rate, tax_amount, total_amount, notes,
        created_by, updated_by, is_draft
       )
       SELECT ?, ?, customer_id, ?, ?, subtotal, tax_rate, tax_amount, total_amount, ?, ?, ?, TRUE
       FROM job_estimates
       WHERE id = ?`,
      [jobCode, jobId, version, sourceEstimateId, notes || null, userId, userId, sourceEstimateId]
    );

    return result.insertId;
  }

  /**
   * Duplicate all estimate items from source to new estimate
   * Copies grid-based data structure (Phase 4+)
   */
  async duplicateEstimateItems(
    connection: PoolConnection,
    sourceEstimateId: number,
    newEstimateId: number
  ): Promise<void> {
    await connection.execute(
      `INSERT INTO job_estimate_items (
        estimate_id, assembly_group_id, parent_item_id,
        product_type_id, item_name, item_order, item_index, grid_data,
        unit_price, extended_price, customer_description, internal_notes
       )
       SELECT
        ?, assembly_group_id, parent_item_id,
        product_type_id, item_name, item_order, item_index, grid_data,
        unit_price, extended_price, customer_description, internal_notes
       FROM job_estimate_items
       WHERE estimate_id = ?
       ORDER BY item_order`,
      [newEstimateId, sourceEstimateId]
    );
  }

  // =============================================
  // GRID DATA PERSISTENCE METHODS
  // =============================================

  /**
   * Get estimate items with product type information for grid load
   * Joins with product_types to get category and name
   */
  async getEstimateItemsWithProductTypes(estimateId: number): Promise<RowDataPacket[]> {
    const rows = await query(
      `SELECT
        i.id,
        i.assembly_group_id,
        i.parent_item_id,
        i.product_type_id,
        pt.name as product_type_name,
        pt.category as product_type_category,
        i.item_name,
        i.item_order,
        i.item_index,
        i.grid_data,
        i.unit_price,
        i.extended_price,
        i.customer_description,
        i.internal_notes
      FROM job_estimate_items i
      LEFT JOIN product_types pt ON i.product_type_id = pt.id
      WHERE i.estimate_id = ?
      ORDER BY i.item_order`,
      [estimateId]
    ) as RowDataPacket[];

    return rows;
  }

  /**
   * Get existing estimate items for update/insert logic (transaction-aware)
   * Returns items with their current database IDs and item_order
   */
  async getExistingEstimateItems(
    estimateId: number,
    connection: PoolConnection
  ): Promise<RowDataPacket[]> {
    const [rows] = await connection.execute<RowDataPacket[]>(
      'SELECT id, item_order FROM job_estimate_items WHERE estimate_id = ? ORDER BY item_order',
      [estimateId]
    );

    return rows;
  }

  /**
   * Get next sequence number for job code generation
   * Ensures transaction-safe, collision-free sequence generation
   *
   * Format: Extracts sequence from job_code pattern SH-YYYYMMDD-XXX-vN
   * where XXX is the 3-digit sequence we're incrementing
   *
   * @param connection - Database connection (for transaction safety)
   * @param dateStr - Date string in YYYYMMDD format
   * @returns Next available sequence number (1 if no codes exist for this date)
   */
  async getNextSequenceForDate(
    connection: PoolConnection,
    dateStr: string
  ): Promise<number> {
    const [rows] = await connection.execute<RowDataPacket[]>(
      `SELECT COALESCE(
        MAX(
          CAST(
            SUBSTRING(job_code, LOCATE('-', job_code, LOCATE('-', job_code) + 1) + 1, 3)
            AS UNSIGNED
          )
        ),
        0
      ) + 1 AS next_sequence
      FROM job_estimates
      WHERE job_code LIKE ?`,
      [`SH-${dateStr}-%`]
    );

    return rows[0]?.next_sequence || 1;
  }
}
