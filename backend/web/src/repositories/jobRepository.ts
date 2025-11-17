// File Clean up Finished: Nov 14, 2025

import { query } from '../config/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

/**
 * JobRepository
 *
 * Repository layer for jobs table
 * Handles all database access for job management
 *
 * Created: Nov 14, 2025 during routes/jobs.ts refactoring
 * Part of 3-layer architecture: Route → Controller → Service → Repository → Database
 */
export class JobRepository {

  /**
   * Get jobs with optional filtering
   * Used by: /api/jobs endpoint for vinyl inventory and bulk operations
   */
  async getJobs(params: {
    search?: string;
    status?: string;
    customer_id?: number;
    active_only?: boolean;
    limit?: number;
  }): Promise<RowDataPacket[]> {
    let sql = `
      SELECT
        j.job_id,
        j.job_number,
        j.job_name,
        j.status,
        j.created_at,
        j.updated_at,
        c.company_name as customer_name
      FROM jobs j
      LEFT JOIN customers c ON j.customer_id = c.customer_id
      WHERE 1=1
    `;

    const queryParams: any[] = [];

    // Active customers only filter
    if (params.active_only) {
      sql += ` AND c.active = TRUE`;
    }

    // Search filter
    if (params.search) {
      sql += ` AND (j.job_number LIKE ? OR j.job_name LIKE ? OR c.company_name LIKE ?)`;
      const searchTerm = `%${params.search}%`;
      queryParams.push(searchTerm, searchTerm, searchTerm);
    }

    // Status filter
    if (params.status) {
      sql += ` AND j.status = ?`;
      queryParams.push(params.status);
    }

    // Customer filter
    if (params.customer_id) {
      sql += ` AND j.customer_id = ?`;
      queryParams.push(params.customer_id);
    }

    // Order and limit
    sql += ` ORDER BY j.created_at DESC`;

    // NOTE: Using literal value for LIMIT instead of placeholder
    // MySQL prepared statements with LIMIT ? don't work reliably in all contexts
    if (params.limit) {
      const limit = parseInt(String(params.limit));
      if (isNaN(limit) || limit < 0) {
        throw new Error('Invalid limit value');
      }
      sql += ` LIMIT ${limit}`;
    }

    const rows = await query(sql, queryParams) as RowDataPacket[];
    return rows;
  }

  /**
   * Get all jobs with recent activity and estimate counts
   * Used by: Job Estimation Dashboard
   */
  async getAllJobsWithRecentActivity(): Promise<RowDataPacket[]> {
    const rows = await query(
      `SELECT
        j.job_id,
        j.job_number,
        j.job_name,
        j.customer_id,
        c.company_name as customer_name,
        j.status as job_status,
        COUNT(DISTINCT e.id) as estimate_count,
        COUNT(DISTINCT CASE WHEN e.is_draft = TRUE THEN e.id END) as draft_count,
        COUNT(DISTINCT CASE WHEN e.is_draft = FALSE THEN e.id END) as finalized_count,
        MAX(e.version_number) as latest_version,
        COALESCE(
          MAX(GREATEST(
            COALESCE(e.created_at, '1970-01-01'),
            COALESCE(e.updated_at, '1970-01-01'),
            COALESCE(e.finalized_at, '1970-01-01')
          )),
          j.created_at
        ) as last_activity,
        j.created_at as job_created_at
      FROM jobs j
      INNER JOIN customers c ON j.customer_id = c.customer_id
      LEFT JOIN job_estimates e ON j.job_id = e.job_id
      WHERE c.active = TRUE
      GROUP BY j.job_id, j.job_number, j.job_name, j.customer_id,
               c.company_name, j.status, j.created_at
      ORDER BY last_activity DESC`
    ) as RowDataPacket[];

    return rows;
  }

  /**
   * Get jobs by customer
   * Used by: Job Estimation Dashboard - customer drill-down
   */
  async getJobsByCustomer(customerId: number): Promise<RowDataPacket[]> {
    const rows = await query(
      `SELECT
        j.job_id,
        j.job_number,
        j.job_name,
        j.customer_id,
        j.status as job_status,
        COUNT(e.id) as estimate_count,
        COUNT(CASE WHEN e.is_draft = TRUE THEN 1 END) as draft_count,
        MAX(e.version_number) as latest_version,
        MAX(e.updated_at) as last_activity
       FROM jobs j
       LEFT JOIN job_estimates e ON j.job_id = e.job_id
       WHERE j.customer_id = ?
       GROUP BY j.job_id, j.job_number, j.job_name, j.customer_id, j.status
       ORDER BY j.created_at DESC`,
      [customerId]
    ) as RowDataPacket[];

    return rows;
  }

  /**
   * Get job by ID
   */
  async getJobById(jobId: number): Promise<RowDataPacket | null> {
    const rows = await query(
      `SELECT j.*, c.company_name as customer_name
       FROM jobs j
       LEFT JOIN customers c ON j.customer_id = c.customer_id
       WHERE j.job_id = ?`,
      [jobId]
    ) as RowDataPacket[];

    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Get customer ID for a job
   * Used by: job name suffix generation
   */
  async getCustomerIdByJobId(jobId: number): Promise<number | null> {
    const rows = await query(
      'SELECT customer_id FROM jobs WHERE job_id = ?',
      [jobId]
    ) as RowDataPacket[];

    return rows.length > 0 ? rows[0].customer_id : null;
  }

  /**
   * Check if job name exists for customer
   */
  async jobNameExists(customerId: number, jobName: string): Promise<boolean> {
    const rows = await query(
      'SELECT job_id FROM jobs WHERE customer_id = ? AND LOWER(job_name) = LOWER(?)',
      [customerId, jobName.trim()]
    ) as RowDataPacket[];

    return rows.length > 0;
  }

  /**
   * Create a new job
   */
  async createJob(jobNumber: string, customerId: number, jobName: string): Promise<number> {
    const result = await query(
      `INSERT INTO jobs (job_number, customer_id, job_name, status, created_at)
       VALUES (?, ?, ?, 'draft', NOW())`,
      [jobNumber, customerId, jobName]
    ) as ResultSetHeader;

    return result.insertId;
  }

  /**
   * Update job name
   */
  async updateJobName(jobId: number, newName: string): Promise<void> {
    await query(
      'UPDATE jobs SET job_name = ?, updated_at = NOW() WHERE job_id = ?',
      [newName.trim(), jobId]
    );
  }

  /**
   * Get highest job number for a year
   */
  async getHighestJobNumberForYear(year: number): Promise<string | null> {
    const rows = await query(
      `SELECT job_number FROM jobs
       WHERE job_number LIKE ?
       ORDER BY job_number DESC
       LIMIT 1`,
      [`${year}%`]
    ) as RowDataPacket[];

    return rows.length > 0 ? rows[0].job_number : null;
  }

  /**
   * Get jobs with matching base number (for suffix generation)
   */
  async getJobsWithBaseNumber(baseJobNumber: string): Promise<RowDataPacket[]> {
    const rows = await query(
      'SELECT job_number FROM jobs WHERE job_number LIKE ? ORDER BY job_number',
      [`${baseJobNumber}%`]
    ) as RowDataPacket[];

    return rows;
  }

  /**
   * Get jobs with matching base name for customer (for name suffix generation)
   */
  async getJobsWithBaseName(customerId: number, baseJobName: string): Promise<RowDataPacket[]> {
    const rows = await query(
      'SELECT job_name FROM jobs WHERE customer_id = ? AND job_name LIKE ? ORDER BY job_name',
      [customerId, `${baseJobName}%`]
    ) as RowDataPacket[];

    return rows;
  }

  /**
   * Check if job has ordered estimates
   */
  async hasExistingOrders(jobId: number): Promise<boolean> {
    const rows = await query(
      'SELECT COUNT(*) as count FROM job_estimates WHERE job_id = ? AND status = ?',
      [jobId, 'ordered']
    ) as RowDataPacket[];

    return rows[0].count > 0;
  }

  /**
   * Validate job access (optionally by customer)
   */
  async validateJobAccess(jobId: number, customerId?: number): Promise<boolean> {
    let sql = 'SELECT job_id FROM jobs WHERE job_id = ?';
    const params: any[] = [jobId];

    if (customerId) {
      sql += ' AND customer_id = ?';
      params.push(customerId);
    }

    const rows = await query(sql, params) as RowDataPacket[];
    return rows.length > 0;
  }
}
