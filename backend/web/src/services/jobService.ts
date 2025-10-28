/**
 * Job Service
 * 
 * Extracted from estimateVersioningService.ts during refactoring
 * Handles job lifecycle management, job number generation, and multi-job workflows
 * 
 * Responsibilities:
 * - Job CRUD operations
 * - Job name validation
 * - Job number generation and suffix handling
 * - Multiple job creation workflows
 */

import { pool } from '../config/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { JobData, MultipleJobResult } from '../interfaces/estimateTypes';

export class JobService {
  
  // =============================================
  // JOB MANAGEMENT
  // =============================================

  async validateJobName(customerId: number, jobName: string): Promise<boolean> {
    try {
      const [rows] = await pool.execute<RowDataPacket[]>(
        'SELECT job_id FROM jobs WHERE customer_id = ? AND LOWER(job_name) = LOWER(?)',
        [customerId, jobName.trim()]
      );
      
      return rows.length === 0;
    } catch (error) {
      console.error('Service error validating job name:', error);
      throw new Error('Failed to validate job name');
    }
  }

  async updateJobName(jobId: number, newName: string, userId: number): Promise<void> {
    try {
      // First validate the new name doesn't conflict
      const [jobRows] = await pool.execute<RowDataPacket[]>(
        'SELECT customer_id FROM jobs WHERE job_id = ?',
        [jobId]
      );
      
      if (jobRows.length === 0) {
        throw new Error('Job not found');
      }
      
      const customerId = jobRows[0].customer_id;
      const isValidName = await this.validateJobName(customerId, newName);
      
      if (!isValidName) {
        throw new Error('Job name already exists for this customer');
      }
      
      // Update the job name
      await pool.execute(
        'UPDATE jobs SET job_name = ?, updated_at = NOW() WHERE job_id = ?',
        [newName.trim(), jobId]
      );
      
    } catch (error) {
      console.error('Service error updating job name:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to update job name');
    }
  }

  async getAllJobsWithRecentActivity(): Promise<RowDataPacket[]> {
    try {
      const [rows] = await pool.execute<RowDataPacket[]>(
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
      );
      
      return rows;
    } catch (error) {
      console.error('Service error fetching all jobs with recent activity:', error);
      throw new Error('Failed to fetch jobs with recent activity');
    }
  }

  async getJobsByCustomer(customerId: number): Promise<RowDataPacket[]> {
    try {
      const [rows] = await pool.execute<RowDataPacket[]>(
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
      );
      
      return rows;
    } catch (error) {
      console.error('Service error fetching jobs by customer:', error);
      throw new Error('Failed to fetch customer jobs');
    }
  }

  async createJob(data: JobData): Promise<number> {
    try {
      // Generate unique job number
      const jobNumber = await this.generateJobNumber();
      
      const [result] = await pool.execute<ResultSetHeader>(
        `INSERT INTO jobs (job_number, customer_id, job_name, status, created_at) 
         VALUES (?, ?, ?, 'quote', NOW())`,
        [jobNumber, data.customer_id, data.job_name]
      );
      
      return result.insertId;
    } catch (error) {
      console.error('Service error creating job:', error);
      throw new Error('Failed to create job');
    }
  }

  async getJobById(jobId: number): Promise<RowDataPacket | null> {
    try {
      const [rows] = await pool.execute<RowDataPacket[]>(
        `SELECT j.*, c.company_name as customer_name
         FROM jobs j
         LEFT JOIN customers c ON j.customer_id = c.customer_id
         WHERE j.job_id = ?`,
        [jobId]
      );
      
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      console.error('Service error fetching job by ID:', error);
      throw new Error('Failed to fetch job');
    }
  }

  // =============================================
  // JOB NUMBER GENERATION
  // =============================================

  private async generateJobNumber(): Promise<string> {
    try {
      const today = new Date();
      const year = today.getFullYear();

      // Get the highest job number for this year
      const [rows] = await pool.execute<RowDataPacket[]>(
        `SELECT job_number FROM jobs
         WHERE job_number LIKE ?
         ORDER BY job_number DESC
         LIMIT 1`,
        [`${year}%`]
      );

      let counter = 1;
      if (rows.length > 0) {
        // Extract the numeric part from the job number (e.g., "2025008" -> 8)
        const lastNumber = parseInt(rows[0].job_number.substring(4));
        counter = lastNumber + 1;
      }

      return `${year}${counter.toString().padStart(3, '0')}`;
    } catch (error) {
      console.error('Error generating job number:', error);
      throw new Error('Failed to generate job number');
    }
  }

  private async generateJobSuffixCode(baseJobNumber: string): Promise<string> {
    try {
      // Find all jobs with the same base number (e.g., 2025001, 2025001B, 2025001C)
      const [rows] = await pool.execute<RowDataPacket[]>(
        'SELECT job_number FROM jobs WHERE job_number LIKE ? ORDER BY job_number',
        [`${baseJobNumber}%`]
      );
      
      // Find the next available suffix
      const suffixes = ['B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];
      const usedSuffixes = new Set(
        rows
          .map(row => row.job_number.replace(baseJobNumber, ''))
          .filter(suffix => suffix.length > 0)
      );
      
      for (const suffix of suffixes) {
        if (!usedSuffixes.has(suffix)) {
          return `${baseJobNumber}${suffix}`;
        }
      }
      
      throw new Error('No available job suffix codes remaining');
    } catch (error) {
      console.error('Error generating job suffix code:', error);
      throw new Error('Failed to generate job suffix code');
    }
  }

  async generateJobNameSuffix(customerId: number, baseJobName: string): Promise<string> {
    try {
      // Find all jobs with the same base name for this customer (e.g., "Project ABC", "Project ABC (B)", "Project ABC (C)")
      const [rows] = await pool.execute<RowDataPacket[]>(
        'SELECT job_name FROM jobs WHERE customer_id = ? AND job_name LIKE ? ORDER BY job_name',
        [customerId, `${baseJobName}%`]
      );
      
      // Find the next available suffix
      const suffixes = ['B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];
      const usedSuffixes = new Set();
      
      // Extract suffixes from existing job names
      rows.forEach(row => {
        const jobName = row.job_name;
        // Check if it matches the pattern "BaseJobName (X)" where X is a letter
        const match = jobName.match(new RegExp(`^${baseJobName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\(([A-Z])\\)$`));
        if (match) {
          usedSuffixes.add(match[1]);
        }
      });
      
      for (const suffix of suffixes) {
        if (!usedSuffixes.has(suffix)) {
          return `${baseJobName} (${suffix})`;
        }
      }
      
      throw new Error('No available job name suffix codes remaining');
    } catch (error) {
      console.error('Error generating job name suffix:', error);
      throw new Error('Failed to generate job name suffix');
    }
  }

  // =============================================
  // MULTIPLE JOB WORKFLOWS
  // =============================================

  async createAdditionalJobForOrder(
    originalJobId: number, 
    estimateIdToOrder: number, 
    newJobName: string, 
    userId: number
  ): Promise<MultipleJobResult> {
    const connection = await pool.getConnection();
    
    try {
      console.log('createAdditionalJobForOrder - Starting transaction');
      console.log('Parameters:', { originalJobId, estimateIdToOrder, newJobName, userId });
      
      await connection.beginTransaction();
      
      // Get original job info
      console.log('Getting original job info...');
      const [jobRows] = await connection.execute<RowDataPacket[]>(
        'SELECT job_number, customer_id FROM jobs WHERE job_id = ?',
        [originalJobId]
      );
      
      if (jobRows.length === 0) {
        console.log('Original job not found:', originalJobId);
        throw new Error('Original job not found');
      }
      console.log('Found original job:', jobRows[0]);
      
      const { job_number: baseJobNumber, customer_id } = jobRows[0];
      
      // Generate new job number with suffix
      console.log('Generating new job number...');
      const newJobNumber = await this.generateJobSuffixCode(baseJobNumber);
      console.log('Generated new job number:', newJobNumber);
      
      // Create new job
      console.log('Creating new job...');
      const [newJobResult] = await connection.execute<ResultSetHeader>(
        `INSERT INTO jobs (job_number, customer_id, job_name, status, created_at) 
         VALUES (?, ?, ?, 'active', NOW())`,
        [newJobNumber, customer_id, newJobName]
      );
      console.log('Created new job with ID:', newJobResult.insertId);
      
      const newJobId = newJobResult.insertId;
      
      // Note: The estimate duplication logic has been moved to EstimateService
      // This method now returns the IDs and EstimateService handles the duplication
      
      await connection.commit();
      return { 
        newJobId, 
        newEstimateId: 0  // Will be set by EstimateService
      };
      
    } catch (error) {
      await connection.rollback();
      console.error('Error creating additional job for order:', error);
      console.error('Error details:', error);
      throw error; // Re-throw original error for better debugging
    } finally {
      connection.release();
    }
  }

  async hasExistingOrders(jobId: number): Promise<boolean> {
    try {
      const [rows] = await pool.execute<RowDataPacket[]>(
        'SELECT COUNT(*) as count FROM job_estimates WHERE job_id = ? AND status = ?',
        [jobId, 'ordered']
      );
      
      return rows[0].count > 0;
    } catch (error) {
      console.error('Service error checking existing orders:', error);
      throw new Error('Failed to check existing orders');
    }
  }

  // =============================================
  // VALIDATION METHODS
  // =============================================

  async validateJobAccess(jobId: number, customerId?: number): Promise<boolean> {
    try {
      let query = 'SELECT job_id FROM jobs WHERE job_id = ?';
      let params: any[] = [jobId];
      
      if (customerId) {
        query += ' AND customer_id = ?';
        params.push(customerId);
      }
      
      const [rows] = await pool.execute<RowDataPacket[]>(query, params);
      return rows.length > 0;
    } catch (error) {
      console.error('Error validating job access:', error);
      return false;
    }
  }
}