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
   * Get a single estimate by ID with full context
   * Returns estimate details including job and customer info for breadcrumb navigation
   */
  async getEstimateById(estimateId: number): Promise<RowDataPacket | null> {
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
        CAST(e.is_prepared AS UNSIGNED) as is_prepared,
        CAST(e.is_active AS UNSIGNED) as is_active,
        CAST(e.is_valid AS UNSIGNED) as is_valid,
        e.status,
        e.finalized_at,
        fu.username as finalized_by_name,
        e.subtotal,
        e.tax_amount,
        e.total_amount,
        e.qb_estimate_id,
        e.qb_estimate_url,
        e.qb_doc_number,
        e.sent_to_qb_at,
        e.estimate_date,
        e.created_at,
        e.updated_at,
        e.notes,
        cu.username as created_by_name,
        CAST(e.is_sent AS UNSIGNED) as is_sent,
        CAST(e.is_approved AS UNSIGNED) as is_approved,
        CAST(e.is_retracted AS UNSIGNED) as is_retracted,
        CAST(e.uses_preparation_table AS UNSIGNED) as uses_preparation_table,
        e.email_subject,
        e.email_body,
        j.job_name,
        j.job_number,
        j.customer_job_number,
        c.company_name as customer_name
       FROM job_estimates e
       LEFT JOIN job_estimates pe ON e.parent_estimate_id = pe.id
       LEFT JOIN users fu ON e.finalized_by_user_id = fu.user_id
       LEFT JOIN users cu ON e.created_by = cu.user_id
       LEFT JOIN jobs j ON e.job_id = j.job_id
       LEFT JOIN customers c ON j.customer_id = c.customer_id
       WHERE e.id = ?`,
      [estimateId]
    ) as RowDataPacket[];

    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Get all estimate versions for a job with full details
   * Includes parent version reference, finalization info, and customer data
   * For preparation table estimates, totals are calculated from preparation items
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
        CAST(e.is_prepared AS UNSIGNED) as is_prepared,
        CAST(e.is_active AS UNSIGNED) as is_active,
        CAST(e.is_valid AS UNSIGNED) as is_valid,
        e.status,
        e.finalized_at,
        fu.username as finalized_by_name,
        -- Use preparation items totals if uses_preparation_table, otherwise use stored totals
        CASE
          WHEN e.uses_preparation_table = 1 THEN COALESCE(prep.prep_subtotal, 0)
          ELSE e.subtotal
        END as subtotal,
        CASE
          WHEN e.uses_preparation_table = 1 THEN ROUND(COALESCE(prep.prep_subtotal, 0) * COALESCE(tr.tax_percent, e.tax_rate, 0), 2)
          ELSE e.tax_amount
        END as tax_amount,
        CASE
          WHEN e.uses_preparation_table = 1 THEN ROUND(COALESCE(prep.prep_subtotal, 0) * (1 + COALESCE(tr.tax_percent, e.tax_rate, 0)), 2)
          ELSE e.total_amount
        END as total_amount,
        e.qb_estimate_id,
        e.qb_estimate_url,
        e.qb_doc_number,
        e.sent_to_qb_at,
        e.estimate_date,
        e.created_at,
        e.updated_at,
        e.notes,
        cu.username as created_by_name,
        CAST(e.is_sent AS UNSIGNED) as is_sent,
        CAST(e.is_approved AS UNSIGNED) as is_approved,
        CAST(e.is_retracted AS UNSIGNED) as is_retracted,
        CAST(e.uses_preparation_table AS UNSIGNED) as uses_preparation_table,
        CASE
          WHEN e.uses_preparation_table = 1 THEN
            (SELECT COUNT(*) > 0 FROM estimate_preparation_items epi WHERE epi.estimate_id = e.id)
          ELSE
            (SELECT COUNT(*) > 0 FROM estimate_line_descriptions eld WHERE eld.estimate_id = e.id)
        END as has_qb_data,
        j.job_name,
        j.job_number,
        j.customer_job_number,
        c.company_name as customer_name
       FROM job_estimates e
       LEFT JOIN job_estimates pe ON e.parent_estimate_id = pe.id
       LEFT JOIN users fu ON e.finalized_by_user_id = fu.user_id
       LEFT JOIN users cu ON e.created_by = cu.user_id
       LEFT JOIN jobs j ON e.job_id = j.job_id
       LEFT JOIN customers c ON j.customer_id = c.customer_id
       -- Join for preparation items subtotal
       LEFT JOIN (
         SELECT estimate_id, SUM(extended_price) as prep_subtotal
         FROM estimate_preparation_items
         WHERE is_description_only = 0
         GROUP BY estimate_id
       ) prep ON prep.estimate_id = e.id
       -- Join for tax rate from customer's billing address
       LEFT JOIN customer_addresses ca ON c.customer_id = ca.customer_id
         AND (ca.is_billing = 1 OR (ca.is_primary = 1 AND NOT EXISTS(
           SELECT 1 FROM customer_addresses ca2
           WHERE ca2.customer_id = c.customer_id AND ca2.is_billing = 1
         )))
       LEFT JOIN provinces_tax pt ON ca.province_state_short = pt.province_short AND pt.is_active = 1
       LEFT JOIN tax_rules tr ON pt.tax_name = tr.tax_name AND tr.is_active = 1
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
    // Fetch email template to initialize email_subject and email_body
    const [templateRows] = await connection.execute<RowDataPacket[]>(
      `SELECT subject, body FROM email_templates WHERE template_key = 'estimate_send' AND is_active = 1`
    );
    const emailSubject = templateRows.length > 0 ? templateRows[0].subject : null;
    const emailBody = templateRows.length > 0 ? templateRows[0].body : null;

    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO job_estimates (
        job_code, job_id, customer_id, version_number,
        is_draft, created_by, updated_by, notes, email_subject, email_body
       )
       SELECT ?, ?, customer_id, ?, TRUE, ?, ?, ?, ?, ?
       FROM jobs WHERE job_id = ?`,
      [jobCode, jobId, nextVersion, userId, userId, notes || null, emailSubject, emailBody, jobId]
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

  // =============================================
  // ESTIMATE WORKFLOW METHODS (Phase 4c)
  // =============================================

  /**
   * Prepare estimate for sending
   * Sets is_prepared=true, is_draft=false (locks the estimate)
   */
  async prepareEstimate(
    estimateId: number,
    userId: number,
    emailSubject?: string | null,
    emailBody?: string | null
  ): Promise<void> {
    await query(
      `UPDATE job_estimates
       SET is_prepared = TRUE,
           is_draft = FALSE,
           email_subject = ?,
           email_body = ?,
           updated_by = ?,
           updated_at = NOW()
       WHERE id = ?`,
      [emailSubject || null, emailBody || null, userId, estimateId]
    );
  }

  /**
   * Check if estimate is prepared (locked but not yet sent)
   */
  async checkEstimateIsPrepared(estimateId: number): Promise<boolean> {
    const rows = await query(
      'SELECT is_prepared FROM job_estimates WHERE id = ? AND is_prepared = TRUE',
      [estimateId]
    ) as RowDataPacket[];

    return rows.length > 0;
  }

  /**
   * Get estimate with prepared check
   * Returns null if not prepared or doesn't exist
   */
  async getEstimateWithPreparedCheck(estimateId: number): Promise<RowDataPacket | null> {
    const rows = await query(
      `SELECT id, is_draft, is_prepared, is_sent, email_subject, email_body,
              qb_estimate_id, qb_estimate_url, qb_doc_number
       FROM job_estimates
       WHERE id = ? AND (is_prepared = TRUE OR is_sent = TRUE)`,
      [estimateId]
    ) as RowDataPacket[];

    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Update email content for an estimate
   */
  async updateEmailContent(
    estimateId: number,
    subject: string | null,
    beginning: string | null,
    end: string | null,
    summaryConfig: any | null,
    userId: number
  ): Promise<void> {
    await query(
      `UPDATE job_estimates
       SET email_subject = ?,
           email_beginning = ?,
           email_end = ?,
           email_summary_config = ?,
           updated_by = ?,
           updated_at = NOW()
       WHERE id = ?`,
      [subject, beginning, end, summaryConfig ? JSON.stringify(summaryConfig) : null, userId, estimateId]
    );
  }

  /**
   * Get estimate email content (3-part structure)
   */
  async getEstimateEmailContent(estimateId: number): Promise<{
    email_subject: string | null;
    email_beginning: string | null;
    email_end: string | null;
    email_summary_config: any | null;
  } | null> {
    const rows = await query(
      `SELECT email_subject, email_beginning, email_end, email_summary_config
       FROM job_estimates WHERE id = ?`,
      [estimateId]
    ) as RowDataPacket[];

    if (rows.length === 0) return null;

    const row = rows[0];
    return {
      email_subject: row.email_subject,
      email_beginning: row.email_beginning,
      email_end: row.email_end,
      email_summary_config: row.email_summary_config
        ? (typeof row.email_summary_config === 'string'
            ? JSON.parse(row.email_summary_config)
            : row.email_summary_config)
        : null
    };
  }

  /**
   * Mark estimate as sent (after QB creation and email)
   * This is the ONLY place that should set is_sent=TRUE
   * Called after both QB estimate creation AND email sending succeed
   */
  async markEstimateAsSent(
    estimateId: number,
    userId: number,
    qbEstimateId?: string,
    qbEstimateUrl?: string,
    qbDocNumber?: string
  ): Promise<void> {
    await query(
      `UPDATE job_estimates
       SET is_sent = TRUE,
           is_prepared = FALSE,
           status = 'sent',
           qb_estimate_id = COALESCE(?, qb_estimate_id),
           qb_estimate_url = COALESCE(?, qb_estimate_url),
           qb_doc_number = COALESCE(?, qb_doc_number),
           updated_by = ?,
           updated_at = NOW()
       WHERE id = ?`,
      [qbEstimateId || null, qbEstimateUrl || null, qbDocNumber || null, userId, estimateId]
    );
  }

  // =============================================
  // ESTIMATE LOOKUP METHODS (Copy Rows Feature)
  // =============================================

  /**
   * Look up estimate by QB document number (e.g., "EST-00001")
   * Returns basic estimate info with job/customer context for display
   */
  async getEstimateByQbDocNumber(qbDocNumber: string): Promise<RowDataPacket | null> {
    const rows = await query(
      `SELECT
        e.id,
        e.job_id,
        e.version_number,
        e.qb_doc_number,
        e.status,
        e.total_amount,
        j.job_name,
        j.job_number,
        c.company_name as customer_name
       FROM job_estimates e
       JOIN jobs j ON e.job_id = j.job_id
       JOIN customers c ON j.customer_id = c.customer_id
       WHERE e.qb_doc_number = ?`,
      [qbDocNumber]
    ) as RowDataPacket[];

    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Get estimate summary for copy rows modal display
   * Returns lightweight info for selection UI
   */
  async getEstimateSummaryById(estimateId: number): Promise<RowDataPacket | null> {
    const rows = await query(
      `SELECT
        e.id,
        e.job_id,
        e.version_number,
        e.qb_doc_number,
        e.status,
        e.total_amount,
        j.job_name,
        j.job_number,
        c.company_name as customer_name
       FROM job_estimates e
       JOIN jobs j ON e.job_id = j.job_id
       JOIN customers c ON j.customer_id = c.customer_id
       WHERE e.id = ?`,
      [estimateId]
    ) as RowDataPacket[];

    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Get estimate for sending (includes all needed data)
   * For estimates with uses_preparation_table=1, calculates totals from preparation items
   * Tax rate is determined from customer's billing address province
   */
  async getEstimateForSending(estimateId: number): Promise<RowDataPacket | null> {
    const rows = await query(
      `SELECT
        e.id,
        e.job_id,
        e.job_code,
        e.customer_id,
        e.is_draft,
        e.is_prepared,
        e.is_sent,
        e.uses_preparation_table,
        e.email_subject,
        e.email_beginning,
        e.email_end,
        e.email_summary_config,
        -- Get tax rate from customer's billing address province (already decimal, e.g., 0.13 for 13%)
        COALESCE(tr.tax_percent, e.tax_rate, 0) as tax_rate,
        -- Use preparation items totals if uses_preparation_table, otherwise use stored totals
        CASE
          WHEN e.uses_preparation_table = 1 THEN COALESCE(prep.prep_subtotal, 0)
          ELSE e.subtotal
        END as subtotal,
        CASE
          WHEN e.uses_preparation_table = 1 THEN ROUND(COALESCE(prep.prep_subtotal, 0) * COALESCE(tr.tax_percent, e.tax_rate, 0), 2)
          ELSE e.tax_amount
        END as tax_amount,
        CASE
          WHEN e.uses_preparation_table = 1 THEN ROUND(COALESCE(prep.prep_subtotal, 0) * (1 + COALESCE(tr.tax_percent, e.tax_rate, 0)), 2)
          ELSE e.total_amount
        END as total_amount,
        e.qb_estimate_id,
        e.qb_estimate_url,
        e.qb_doc_number,
        e.sent_to_qb_at,
        e.status,
        e.estimate_date,
        j.job_name,
        j.job_number,
        j.customer_job_number,
        e.notes as version_description,
        c.company_name as customer_name,
        c.quickbooks_name
       FROM job_estimates e
       JOIN jobs j ON e.job_id = j.job_id
       JOIN customers c ON e.customer_id = c.customer_id
       -- Join for preparation items subtotal
       LEFT JOIN (
         SELECT estimate_id, SUM(extended_price) as prep_subtotal
         FROM estimate_preparation_items
         WHERE is_description_only = 0
         GROUP BY estimate_id
       ) prep ON prep.estimate_id = e.id
       -- Join for tax rate from customer's billing address
       LEFT JOIN customer_addresses ca ON c.customer_id = ca.customer_id
         AND (ca.is_billing = 1 OR (ca.is_primary = 1 AND NOT EXISTS(
           SELECT 1 FROM customer_addresses ca2
           WHERE ca2.customer_id = c.customer_id AND ca2.is_billing = 1
         )))
       LEFT JOIN provinces_tax pt ON ca.province_state_short = pt.province_short AND pt.is_active = 1
       LEFT JOIN tax_rules tr ON pt.tax_name = tr.tax_name AND tr.is_active = 1
       WHERE e.id = ?`,
      [estimateId]
    ) as RowDataPacket[];

    return rows.length > 0 ? rows[0] : null;
  }

  // =============================================
  // ESTIMATE VALIDITY METHODS
  // =============================================

  /**
   * Mark estimate as invalid
   * Sets is_valid = FALSE for visual indication in version list
   * @param estimateId - The estimate ID
   * @param userId - User performing the action
   * @returns True if update successful
   */
  async markEstimateInvalid(estimateId: number, userId: number): Promise<boolean> {
    const result = await query(
      'UPDATE job_estimates SET is_valid = FALSE, updated_by = ?, updated_at = NOW() WHERE id = ?',
      [userId, estimateId]
    ) as ResultSetHeader;

    return result.affectedRows > 0;
  }

  /**
   * Mark estimate as valid
   * Sets is_valid = TRUE for visual indication in version list
   * @param estimateId - The estimate ID
   * @param userId - User performing the action
   * @returns True if update successful
   */
  async markEstimateValid(estimateId: number, userId: number): Promise<boolean> {
    const result = await query(
      'UPDATE job_estimates SET is_valid = TRUE, updated_by = ?, updated_at = NOW() WHERE id = ?',
      [userId, estimateId]
    ) as ResultSetHeader;

    return result.affectedRows > 0;
  }
}
