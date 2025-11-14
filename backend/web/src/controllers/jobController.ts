import { Request, Response } from 'express';
import { AuthRequest } from '../types';
import { EstimateVersioningService, JobData } from '../services/estimateVersioningService';
import { pool } from '../config/database';
import { RowDataPacket } from 'mysql2';

const versioningService = new EstimateVersioningService();

// =============================================
// JOB MANAGEMENT ENDPOINTS
// =============================================

export const getAllJobsWithRecentActivity = async (req: Request, res: Response) => {
  try {
    const jobs = await versioningService.getAllJobsWithRecentActivity();
    res.json({ success: true, data: jobs });
  } catch (error) {
    console.error('Controller error fetching all jobs with recent activity:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to fetch jobs with recent activity'
    });
  }
};

export const getJobsByCustomer = async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const customerIdNum = parseInt(customerId);
    
    if (isNaN(customerIdNum)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid customer ID'
      });
    }
    
    const jobs = await versioningService.getJobsByCustomer(customerIdNum);
    res.json({ success: true, data: jobs });
  } catch (error) {
    console.error('Controller error fetching jobs by customer:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to fetch customer jobs'
    });
  }
};

export const validateJobName = async (req: Request, res: Response) => {
  try {
    const { customer_id, job_name } = req.body;
    
    if (!customer_id || !job_name) {
      return res.status(400).json({
        success: false,
        message: 'Customer ID and job name are required'
      });
    }
    
    const customerIdNum = parseInt(customer_id);
    const trimmedJobName = job_name.trim();
    
    if (isNaN(customerIdNum)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid customer ID'
      });
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
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to validate job name'
    });
  }
};

export const updateJob = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    const { jobId } = req.params;
    const { job_name } = req.body;
    
    const jobIdNum = parseInt(jobId);
    
    if (isNaN(jobIdNum)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid job ID'
      });
    }
    
    if (!job_name || !job_name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Job name is required'
      });
    }
    
    await versioningService.updateJobName(jobIdNum, job_name.trim(), user?.user_id!);
    
    res.json({
      success: true,
      message: 'Job name updated successfully'
    });
  } catch (error) {
    console.error('Controller error updating job:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to update job'
    });
  }
};

export const createJob = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    const { customer_id, job_name } = req.body;
    
    if (!customer_id || !job_name) {
      return res.status(400).json({
        success: false,
        message: 'Customer ID and job name are required'
      });
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
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to create job'
    });
  }
};

export const getJobById = async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const jobIdNum = parseInt(jobId);
    
    if (isNaN(jobIdNum)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid job ID'
      });
    }
    
    const job = await versioningService.getJobById(jobIdNum);
    
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }
    
    res.json({ success: true, data: job });
  } catch (error) {
    console.error('Controller error fetching job by ID:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to fetch job'
    });
  }
};

export const checkExistingOrders = async (req: Request, res: Response) => {
  try {
    const jobId = parseInt(req.params.jobId);
    
    if (!jobId) {
      return res.status(400).json({
        success: false,
        message: 'Valid job ID is required'
      });
    }
    
    const hasOrders = await versioningService.hasExistingOrders(jobId);
    
    res.json({
      success: true,
      data: { has_existing_orders: hasOrders }
    });
  } catch (error) {
    console.error('Controller error checking existing orders:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check existing orders'
    });
  }
};

export const createAdditionalJobForOrder = async (req: Request, res: Response) => {
  try {
    const { original_job_id, estimate_id, new_job_name } = req.body;
    const userId = (req as any).user?.user_id;
    
    if (!original_job_id || !estimate_id || !new_job_name) {
      return res.status(400).json({
        success: false,
        message: 'Original job ID, estimate ID, and new job name are required'
      });
    }
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User authentication required'
      });
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
    res.status(500).json({
      success: false,
      message: 'Failed to create additional job for order'
    });
  }
};

export const suggestJobNameSuffix = async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const { baseJobName } = req.body;
    
    if (!jobId || !baseJobName) {
      return res.status(400).json({
        success: false,
        message: 'Job ID and base job name are required'
      });
    }
    
    // Get customer ID from the original job
    const [jobRows] = await pool.execute<RowDataPacket[]>(
      'SELECT customer_id FROM jobs WHERE job_id = ?',
      [parseInt(jobId)]
    );
    
    if (jobRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }
    
    const customerId = jobRows[0].customer_id;
    const suggestedName = await versioningService.generateJobNameSuffix(customerId, baseJobName);
    
    res.json({
      success: true,
      data: {
        suggestedJobName: suggestedName
      }
    });
  } catch (error) {
    console.error('Controller error suggesting job name suffix:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to suggest job name suffix'
    });
  }
};