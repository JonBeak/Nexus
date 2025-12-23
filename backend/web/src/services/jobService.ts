// File Clean up Finished: Nov 14, 2025
// Changes:
// - Removed broken transaction from createAdditionalJobForOrder (transaction didn't work - repository used query() helper)
// - Removed unused imports: ResultSetHeader, pool
// - Removed 9 debug console.log statements
// - Updated documentation to accurately reflect architecture
// - Transaction management now properly handled at orchestration layer (EstimateVersioningService)
/**
 * Job Service
 *
 * Extracted from estimateVersioningService.ts during refactoring
 * Handles job lifecycle management, job number generation, and multi-job workflows
 *
 * All database queries use JobRepository with query() helper pattern
 * Transaction management handled at orchestration layer (EstimateVersioningService)
 *
 * Responsibilities:
 * - Job CRUD operations
 * - Job name validation
 * - Job number generation and suffix handling
 * - Multiple job creation workflows
 */

import { RowDataPacket } from 'mysql2';
import { JobData, MultipleJobResult } from '../interfaces/estimateTypes';
import { JobRepository } from '../repositories/jobRepository';

export class JobService {
  private jobRepository: JobRepository;

  constructor() {
    this.jobRepository = new JobRepository();
  }

  // =============================================
  // JOB MANAGEMENT
  // =============================================

  /**
   * Get jobs with optional filtering
   * NEW METHOD: Added Nov 14, 2025 for /api/jobs endpoint refactoring
   */
  async getJobs(params: {
    search?: string;
    status?: string;
    customer_id?: number;
    active_only?: boolean;
    limit?: number;
  }): Promise<RowDataPacket[]> {
    try {
      return await this.jobRepository.getJobs(params);
    } catch (error) {
      console.error('Service error fetching jobs:', error);
      throw new Error('Failed to fetch jobs');
    }
  }

  async validateJobName(customerId: number, jobName: string, excludeJobId?: number): Promise<boolean> {
    try {
      const exists = await this.jobRepository.jobNameExists(customerId, jobName, excludeJobId);
      return !exists; // Return true if name is valid (doesn't exist)
    } catch (error) {
      console.error('Service error validating job name:', error);
      throw new Error('Failed to validate job name');
    }
  }

  async updateJobName(jobId: number, newName: string, userId: number, customerJobNumber?: string): Promise<void> {
    try {
      // First validate the new name doesn't conflict
      const job = await this.jobRepository.getJobById(jobId);

      if (!job) {
        throw new Error('Job not found');
      }

      const customerId = job.customer_id;

      // Only validate name if it's different from current
      if (job.job_name !== newName) {
        // Exclude current job from duplicate check
        const isValidName = await this.validateJobName(customerId, newName, jobId);
        if (!isValidName) {
          throw new Error('Job name already exists for this customer');
        }
      }

      // Update the job name and customer job number
      await this.jobRepository.updateJobName(jobId, newName, customerJobNumber);

    } catch (error) {
      console.error('Service error updating job name:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to update job name');
    }
  }

  async getAllJobsWithRecentActivity(): Promise<RowDataPacket[]> {
    try {
      return await this.jobRepository.getAllJobsWithRecentActivity();
    } catch (error) {
      console.error('Service error fetching all jobs with recent activity:', error);
      throw new Error('Failed to fetch jobs with recent activity');
    }
  }

  async getJobsByCustomer(customerId: number): Promise<RowDataPacket[]> {
    try {
      return await this.jobRepository.getJobsByCustomer(customerId);
    } catch (error) {
      console.error('Service error fetching jobs by customer:', error);
      throw new Error('Failed to fetch customer jobs');
    }
  }

  async createJob(data: JobData): Promise<number> {
    try {
      // Generate unique job number
      const jobNumber = await this.generateJobNumber();

      return await this.jobRepository.createJob(
        jobNumber,
        data.customer_id,
        data.job_name,
        data.customer_job_number
      );
    } catch (error) {
      console.error('Service error creating job:', error);
      throw new Error('Failed to create job');
    }
  }

  async getJobById(jobId: number): Promise<RowDataPacket | null> {
    try {
      return await this.jobRepository.getJobById(jobId);
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
      const highestJobNumber = await this.jobRepository.getHighestJobNumberForYear(year);

      let counter = 1;
      if (highestJobNumber) {
        // Extract the numeric part from the job number (e.g., "2025008" -> 8)
        const lastNumber = parseInt(highestJobNumber.substring(4));
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
      const rows = await this.jobRepository.getJobsWithBaseNumber(baseJobNumber);

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
      const rows = await this.jobRepository.getJobsWithBaseName(customerId, baseJobName);

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
    try {
      // Get original job info
      const job = await this.jobRepository.getJobById(originalJobId);

      if (!job) {
        throw new Error('Original job not found');
      }

      const { job_number: baseJobNumber, customer_id } = job;

      // Generate new job number with suffix
      const newJobNumber = await this.generateJobSuffixCode(baseJobNumber);

      // Create new job using repository
      const newJobId = await this.jobRepository.createJob(newJobNumber, customer_id, newJobName);

      // Note: The estimate duplication logic is handled by EstimateService
      // in the outer transaction managed by EstimateVersioningService
      return {
        newJobId,
        newEstimateId: 0  // Will be set by EstimateService
      };

    } catch (error) {
      console.error('Error creating additional job for order:', error);
      throw error;
    }
  }

  async hasExistingOrders(jobId: number): Promise<boolean> {
    try {
      return await this.jobRepository.hasExistingOrders(jobId);
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
      return await this.jobRepository.validateJobAccess(jobId, customerId);
    } catch (error) {
      console.error('Error validating job access:', error);
      return false;
    }
  }
}