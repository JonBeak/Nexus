// FINISHED: Migrated to ServiceResult<T> system - Completed 2025-11-15
// Changes:
// - Added imports: parseIntParam, sendErrorResponse from controllerHelpers
// - Replaced 7 instances of parseInt() with parseIntParam()
// - Replaced 18 instances of manual res.status().json() with sendErrorResponse()
// - All validation errors now use 'VALIDATION_ERROR' code
// - All 404 errors now use 'NOT_FOUND' code
// - All 401 errors now use 'UNAUTHORIZED' code
// - All internal errors now use 'INTERNAL_ERROR' code

// File Clean up Finished: Nov 14, 2025
// Changes:
//   - Added new getJobs() handler for /api/jobs endpoint
//   - Migrated from direct pool.execute() to use JobService/JobRepository pattern
//   - Removed pool import, now uses JobService exclusively

import { Request, Response } from 'express';
import { AuthRequest } from '../types';
import { EstimateVersioningService, JobData } from '../services/estimateVersioningService';
import { JobService } from '../services/jobService';
import { parseIntParam, sendErrorResponse } from '../utils/controllerHelpers';

const versioningService = new EstimateVersioningService();
const jobService = new JobService();

// =============================================
// JOB MANAGEMENT ENDPOINTS
// =============================================

/**
 * Get jobs with optional filtering
 * NEW HANDLER: Added Nov 14, 2025 for /api/jobs endpoint refactoring
 * Used by: Vinyl inventory, bulk operations, status change modals
 */
export const getJobs = async (req: Request, res: Response) => {
  try {
    const { search, status, customer_id, active_only, limit } = req.query;

    // Parse limit with proper default handling
    const limitNum = limit ? parseInt(limit as string) : 50;
    const validLimit = isNaN(limitNum) ? 50 : limitNum;

    const jobs = await jobService.getJobs({
      search: search as string | undefined,
      status: status as string | undefined,
      customer_id: customer_id ? parseInt(customer_id as string) : undefined,
      active_only: active_only === 'true',
      limit: validLimit
    });

    res.json(jobs);
  } catch (error) {
    console.error('Controller error fetching jobs:', error);
    return sendErrorResponse(res, error instanceof Error ? error.message : 'Failed to fetch jobs', 'INTERNAL_ERROR');
  }
};

export const getAllJobsWithRecentActivity = async (req: Request, res: Response) => {
  try {
    const jobs = await versioningService.getAllJobsWithRecentActivity();
    res.json({ success: true, data: jobs });
  } catch (error) {
    console.error('Controller error fetching all jobs with recent activity:', error);
    return sendErrorResponse(res, error instanceof Error ? error.message : 'Failed to fetch jobs with recent activity', 'INTERNAL_ERROR');
  }
};

export const getJobsByCustomer = async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const customerIdNum = parseIntParam(customerId, 'customer ID');

    if (customerIdNum === null) {
      return sendErrorResponse(res, 'Invalid customer ID', 'VALIDATION_ERROR');
    }

    const jobs = await versioningService.getJobsByCustomer(customerIdNum);
    res.json({ success: true, data: jobs });
  } catch (error) {
    console.error('Controller error fetching jobs by customer:', error);
    return sendErrorResponse(res, error instanceof Error ? error.message : 'Failed to fetch customer jobs', 'INTERNAL_ERROR');
  }
};

export const validateJobName = async (req: Request, res: Response) => {
  try {
    const { customer_id, job_name } = req.body;

    if (!customer_id || !job_name) {
      return sendErrorResponse(res, 'Customer ID and job name are required', 'VALIDATION_ERROR');
    }

    const customerIdNum = parseIntParam(customer_id.toString(), 'customer ID');
    const trimmedJobName = job_name.trim();

    if (customerIdNum === null) {
      return sendErrorResponse(res, 'Invalid customer ID', 'VALIDATION_ERROR');
    }
    
    try {
      const isValid = await versioningService.validateJobName(customerIdNum, trimmedJobName);
      
      if (isValid) {
        res.json({ 
          success: true,
          valid: true 
        });
      } else {
        res.json({ 
          success: true,
          valid: false, 
          message: 'A job with this name already exists for this customer',
          suggestion: `Try: ${trimmedJobName} - Location or ${trimmedJobName} - ${new Date().getFullYear()}`
        });
      }
    } catch (error) {
      console.error('Error validating job name:', error);
      res.json({ 
        success: true,
        valid: false, 
        message: 'Unable to validate job name at this time' 
      });
    }
  } catch (error) {
    console.error('Controller error validating job name:', error);
    return sendErrorResponse(res, error instanceof Error ? error.message : 'Failed to validate job name', 'INTERNAL_ERROR');
  }
};

export const updateJob = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    const { jobId } = req.params;
    const { job_name } = req.body;

    const jobIdNum = parseIntParam(jobId, 'job ID');

    if (jobIdNum === null) {
      return sendErrorResponse(res, 'Invalid job ID', 'VALIDATION_ERROR');
    }

    if (!job_name || !job_name.trim()) {
      return sendErrorResponse(res, 'Job name is required', 'VALIDATION_ERROR');
    }

    await versioningService.updateJobName(jobIdNum, job_name.trim(), user?.user_id!);

    res.json({
      success: true,
      message: 'Job name updated successfully'
    });
  } catch (error) {
    console.error('Controller error updating job:', error);
    return sendErrorResponse(res, error instanceof Error ? error.message : 'Failed to update job', 'INTERNAL_ERROR');
  }
};

export const createJob = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    const { customer_id, job_name } = req.body;

    if (!customer_id || !job_name) {
      return sendErrorResponse(res, 'Customer ID and job name are required', 'VALIDATION_ERROR');
    }

    const jobData: JobData = {
      customer_id: parseInt(customer_id),
      job_name: job_name.trim()
    };

    const jobId = await versioningService.createJob(jobData);

    res.json({
      success: true,
      data: { job_id: jobId }
    });
  } catch (error) {
    console.error('Controller error creating job:', error);
    return sendErrorResponse(res, error instanceof Error ? error.message : 'Failed to create job', 'INTERNAL_ERROR');
  }
};

export const getJobById = async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const jobIdNum = parseIntParam(jobId, 'job ID');

    if (jobIdNum === null) {
      return sendErrorResponse(res, 'Invalid job ID', 'VALIDATION_ERROR');
    }

    const job = await versioningService.getJobById(jobIdNum);

    if (!job) {
      return sendErrorResponse(res, 'Job not found', 'NOT_FOUND');
    }

    res.json({ success: true, data: job });
  } catch (error) {
    console.error('Controller error fetching job by ID:', error);
    return sendErrorResponse(res, error instanceof Error ? error.message : 'Failed to fetch job', 'INTERNAL_ERROR');
  }
};

export const checkExistingOrders = async (req: Request, res: Response) => {
  try {
    const jobId = parseIntParam(req.params.jobId, 'job ID');

    if (jobId === null) {
      return sendErrorResponse(res, 'Valid job ID is required', 'VALIDATION_ERROR');
    }

    const hasOrders = await versioningService.hasExistingOrders(jobId);

    res.json({
      success: true,
      data: { has_existing_orders: hasOrders }
    });
  } catch (error) {
    console.error('Controller error checking existing orders:', error);
    return sendErrorResponse(res, 'Failed to check existing orders', 'INTERNAL_ERROR');
  }
};

export const createAdditionalJobForOrder = async (req: Request, res: Response) => {
  try {
    const { original_job_id, estimate_id, new_job_name } = req.body;
    const userId = (req as any).user?.user_id;

    if (!original_job_id || !estimate_id || !new_job_name) {
      return sendErrorResponse(res, 'Original job ID, estimate ID, and new job name are required', 'VALIDATION_ERROR');
    }

    if (!userId) {
      return sendErrorResponse(res, 'User authentication required', 'UNAUTHORIZED');
    }

    const result = await versioningService.createAdditionalJobForOrder(
      original_job_id,
      estimate_id,
      new_job_name,
      userId
    );

    res.json({
      success: true,
      data: result,
      message: 'Additional job created and estimate ordered successfully'
    });
  } catch (error) {
    console.error('Controller error creating additional job:', error);
    return sendErrorResponse(res, 'Failed to create additional job for order', 'INTERNAL_ERROR');
  }
};

export const suggestJobNameSuffix = async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const { baseJobName } = req.body;

    if (!jobId || !baseJobName) {
      return sendErrorResponse(res, 'Job ID and base job name are required', 'VALIDATION_ERROR');
    }

    // Get job to extract customer ID - using JobService instead of direct pool.execute()
    const jobIdNum = parseIntParam(jobId, 'job ID');

    if (jobIdNum === null) {
      return sendErrorResponse(res, 'Invalid job ID', 'VALIDATION_ERROR');
    }

    const job = await jobService.getJobById(jobIdNum);

    if (!job) {
      return sendErrorResponse(res, 'Job not found', 'NOT_FOUND');
    }

    const customerId = job.customer_id;
    const suggestedName = await versioningService.generateJobNameSuffix(customerId, baseJobName);

    res.json({
      success: true,
      data: {
        suggestedJobName: suggestedName
      }
    });
  } catch (error) {
    console.error('Controller error suggesting job name suffix:', error);
    return sendErrorResponse(res, 'Failed to suggest job name suffix', 'INTERNAL_ERROR');
  }
};