// Created: Nov 21, 2025
// Refactored from estimateController.ts - Estimate version management endpoints
/**
 * Estimate Version Controller
 *
 * Handles estimate versioning operations:
 * - Get estimate versions for a job
 * - Create new estimate versions
 * - Duplicate estimates as new versions
 */

import { Response } from 'express';
import { promises as fs } from 'fs';
import * as path from 'path';
import { AuthRequest } from '../../types';
import { EstimateVersioningService, EstimateVersionData } from '../../services/estimateVersioningService';
import { validateEstimateId, validateJobId, validateEstimateRequest, validateJobRequest } from '../../utils/estimateValidation';

// PDF cache directory for estimate previews
const PDF_CACHE_DIR = '/tmp/estimate-pdf-cache';

const versioningService = new EstimateVersioningService();

// =============================================
// ESTIMATE VERSION ENDPOINTS
// =============================================

/**
 * Get a single estimate by ID with full context
 * Used by the EstimateEditorPage for direct URL access
 * @route GET /estimates/:estimateId
 */
export const getEstimateById = async (req: AuthRequest, res: Response) => {
  try {
    const validation = validateEstimateId(req.params.estimateId, res);
    if (!validation.isValid) return;
    const estimateId = validation.value!;

    const estimate = await versioningService.getEstimateById(estimateId);

    if (!estimate) {
      return res.status(404).json({
        success: false,
        message: 'Estimate not found'
      });
    }

    res.json({ success: true, data: estimate });
  } catch (error) {
    console.error('Controller error fetching estimate:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to fetch estimate'
    });
  }
};

/**
 * Look up estimate by QB document number or estimate ID
 * Used by Copy Rows feature for quick lookup
 * @route GET /estimates/lookup
 * @query qbDocNumber - QB document number (e.g., "EST-00001")
 * @query estimateId - Estimate ID (numeric)
 */
export const lookupEstimate = async (req: AuthRequest, res: Response) => {
  try {
    const { qbDocNumber, estimateId } = req.query;

    // Must provide one of the two
    if (!qbDocNumber && !estimateId) {
      return res.status(400).json({
        success: false,
        message: 'Must provide either qbDocNumber or estimateId'
      });
    }

    let estimate = null;

    // Try QB doc number lookup first
    if (qbDocNumber && typeof qbDocNumber === 'string') {
      estimate = await versioningService.getEstimateByQbDocNumber(qbDocNumber);
    }

    // Try estimate ID lookup if QB doc number not provided or not found
    if (!estimate && estimateId) {
      const id = parseInt(estimateId as string);
      if (!isNaN(id)) {
        estimate = await versioningService.getEstimateSummaryById(id);
      }
    }

    if (!estimate) {
      return res.status(404).json({
        success: false,
        message: 'Estimate not found'
      });
    }

    res.json({ success: true, data: estimate });
  } catch (error) {
    console.error('Controller error looking up estimate:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to look up estimate'
    });
  }
};

/**
 * Get all estimate versions for a job
 * @route GET /jobs/:jobId/estimates
 */
export const getEstimateVersionsByJob = async (req: AuthRequest, res: Response) => {
  try {
    const { jobId } = req.params;

    const validation = validateJobId(jobId, res);
    if (!validation.isValid) return;
    const jobIdNum = validation.value!;

    const versions = await versioningService.getEstimateVersionsByJob(jobIdNum);
    res.json({ success: true, data: versions });
  } catch (error) {
    console.error('Controller error fetching estimate versions:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to fetch estimate versions'
    });
  }
};

/**
 * Create a new estimate version for a job
 * @route POST /jobs/:jobId/estimates
 */
export const createNewEstimateVersion = async (req: AuthRequest, res: Response) => {
  try {
    const validated = validateJobRequest(req, res);
    if (!validated) return;

    const { parent_estimate_id, notes } = req.body;

    // Validate job exists and user has access
    const hasAccess = await versioningService.validateJobAccess(validated.jobId);
    if (!hasAccess) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    // Validate parent estimate if provided
    if (parent_estimate_id) {
      const parentId = parseInt(parent_estimate_id);
      if (!isNaN(parentId)) {
        const parentExists = await versioningService.validateEstimateAccess(parentId);
        if (!parentExists) {
          return res.status(400).json({
            success: false,
            message: 'Parent estimate not found'
          });
        }

        const isValidParent = await versioningService.validateParentChain(parentId);
        if (!isValidParent) {
          return res.status(400).json({
            success: false,
            message: 'Cannot use this estimate as parent: circular reference detected'
          });
        }
      }
    }

    const versionData: EstimateVersionData = {
      job_id: validated.jobId,
      parent_estimate_id: parent_estimate_id ? parseInt(parent_estimate_id) : undefined,
      notes
    };

    const estimateId = await versioningService.createNewEstimateVersion(versionData, validated.userId);

    res.json({
      success: true,
      data: { estimate_id: estimateId }
    });
  } catch (error) {
    console.error('Controller error creating estimate version:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to create estimate version'
    });
  }
};

// =============================================
// DUPLICATE ESTIMATE (CREATE NEW VERSION FROM EXISTING)
// =============================================

/**
 * Duplicate an estimate as a new version (optionally to a different job)
 * @route POST /estimates/:estimateId/duplicate
 */
export const duplicateEstimateAsNewVersion = async (req: AuthRequest, res: Response) => {
  try {
    const validated = validateEstimateRequest(req, res);
    if (!validated) return;

    const { target_job_id, notes } = req.body;
    const targetJobIdNum = target_job_id ? parseInt(target_job_id) : undefined;

    // Validate source estimate exists
    const sourceExists = await versioningService.validateEstimateAccess(validated.estimateId);
    if (!sourceExists) {
      return res.status(404).json({
        success: false,
        message: 'Source estimate not found'
      });
    }

    // Validate source estimate's parent chain doesn't have cycles
    const isValidSource = await versioningService.validateParentChain(validated.estimateId);
    if (!isValidSource) {
      return res.status(400).json({
        success: false,
        message: 'Cannot duplicate from this estimate: circular reference detected in parent chain'
      });
    }

    // If no target job specified, get job from source estimate via service layer
    let jobId = targetJobIdNum;
    if (!jobId) {
      jobId = await versioningService.getJobIdByEstimateId(validated.estimateId);
    }

    const versionData: EstimateVersionData = {
      job_id: jobId,
      parent_estimate_id: validated.estimateId,
      notes
    };

    const newEstimateId = await versioningService.createNewEstimateVersion(versionData, validated.userId);

    res.json({
      success: true,
      data: {
        estimate_id: newEstimateId,
        job_id: jobId
      },
      message: 'New version created successfully'
    });
  } catch (error) {
    console.error('Controller error duplicating estimate:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to duplicate estimate'
    });
  }
};

// =============================================
// ESTIMATE WORKFLOW ENDPOINTS (Phase 4c)
// =============================================

/**
 * Prepare estimate for sending
 * - Cleans empty rows
 * - Saves point persons and email content
 * - Locks the estimate
 * @route POST /estimates/:estimateId/prepare
 */
export const prepareEstimate = async (req: AuthRequest, res: Response) => {
  try {
    const validated = validateEstimateRequest(req, res);
    if (!validated) return;

    const { emailSubject, emailBeginning, emailEnd, emailSummaryConfig, pointPersons, estimatePreviewData } = req.body;

    // Debug: Check what's being received
    console.log('[Prepare] estimatePreviewData received:', !!estimatePreviewData, 'items:', estimatePreviewData?.items?.length ?? 0);

    const result = await versioningService.prepareEstimateForSending(
      validated.estimateId,
      validated.userId,
      { emailSubject, emailBeginning, emailEnd, emailSummaryConfig, pointPersons, estimatePreviewData }
    );

    res.json({
      success: true,
      data: result,
      message: `Estimate prepared. ${result.deletedRowCount} empty rows removed.`
    });
  } catch (error) {
    console.error('Controller error preparing estimate:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to prepare estimate'
    });
  }
};

/**
 * Send estimate to customer
 * - Creates QB estimate
 * - Sends email
 * @route POST /estimates/:estimateId/send
 */
export const sendEstimate = async (req: AuthRequest, res: Response) => {
  try {
    const validated = validateEstimateRequest(req, res);
    if (!validated) return;

    const { estimatePreviewData, recipients } = req.body;
    console.log(`📧 [Controller] sendEstimate called for estimate ${validated.estimateId}`);
    console.log(`📧 [Controller] Recipients from body:`, JSON.stringify(recipients));

    const result = await versioningService.sendEstimateToCustomer(
      validated.estimateId,
      validated.userId,
      estimatePreviewData,
      recipients
    );

    res.json(result);
  } catch (error) {
    console.error('Controller error sending estimate:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to send estimate'
    });
  }
};

/**
 * Get point persons for an estimate
 * @route GET /estimates/:estimateId/point-persons
 */
export const getEstimatePointPersons = async (req: AuthRequest, res: Response) => {
  try {
    const validation = validateEstimateId(req.params.estimateId, res);
    if (!validation.isValid) return;
    const estimateId = validation.value!;

    const pointPersons = await versioningService.getEstimatePointPersons(estimateId);

    res.json({ success: true, data: pointPersons });
  } catch (error) {
    console.error('Controller error fetching point persons:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to fetch point persons'
    });
  }
};

/**
 * Update point persons for an estimate
 * @route PUT /estimates/:estimateId/point-persons
 */
export const updateEstimatePointPersons = async (req: AuthRequest, res: Response) => {
  try {
    const validated = validateEstimateRequest(req, res);
    if (!validated) return;

    const { pointPersons } = req.body;

    if (!Array.isArray(pointPersons)) {
      return res.status(400).json({
        success: false,
        message: 'pointPersons must be an array'
      });
    }

    await versioningService.updateEstimatePointPersons(
      validated.estimateId,
      pointPersons,
      validated.userId
    );

    res.json({
      success: true,
      message: 'Point persons updated'
    });
  } catch (error) {
    console.error('Controller error updating point persons:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to update point persons'
    });
  }
};

/**
 * Get email content for an estimate
 * @route GET /estimates/:estimateId/email-content
 */
export const getEstimateEmailContent = async (req: AuthRequest, res: Response) => {
  try {
    const validation = validateEstimateId(req.params.estimateId, res);
    if (!validation.isValid) return;
    const estimateId = validation.value!;

    const emailContent = await versioningService.getEstimateEmailContent(estimateId);

    res.json({ success: true, data: emailContent });
  } catch (error) {
    console.error('Controller error fetching email content:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to fetch email content'
    });
  }
};

/**
 * Update email content for an estimate (3-part structure)
 * @route PUT /estimates/:estimateId/email-content
 */
export const updateEstimateEmailContent = async (req: AuthRequest, res: Response) => {
  try {
    const validated = validateEstimateRequest(req, res);
    if (!validated) return;

    const { subject, beginning, end, summaryConfig } = req.body;

    await versioningService.updateEstimateEmailContent(
      validated.estimateId,
      subject || null,
      beginning || null,
      end || null,
      summaryConfig || null,
      validated.userId
    );

    res.json({
      success: true,
      message: 'Email content updated'
    });
  } catch (error) {
    console.error('Controller error updating email content:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to update email content'
    });
  }
};

/**
 * Get email preview for modal display
 * Generates HTML preview of what will be sent to recipients
 * @route POST /estimates/:estimateId/email-preview
 * @body recipients - comma-separated email addresses
 * @body subject, beginning, end, summaryConfig, estimateData - email content from composer
 */
export const getEstimateEmailPreview = async (req: AuthRequest, res: Response) => {
  try {
    const validation = validateEstimateId(req.params.estimateId, res);
    if (!validation.isValid) return;
    const estimateId = validation.value!;

    // Parse recipients from body (comma-separated string)
    const recipientString = req.body.recipients as string || '';
    const recipients = recipientString
      .split(',')
      .map((r: string) => r.trim())
      .filter((r: string) => r.length > 0);

    // Extract email content from body
    const emailContent = {
      subject: req.body.subject as string | undefined,
      beginning: req.body.beginning as string | undefined,
      end: req.body.end as string | undefined,
      summaryConfig: req.body.summaryConfig as {
        includeJobName?: boolean;
        includeCustomerRef?: boolean;
        includeQbEstimateNumber?: boolean;
        includeSubtotal?: boolean;
        includeTax?: boolean;
        includeTotal?: boolean;
        includeEstimateDate?: boolean;
        includeValidUntilDate?: boolean;
      } | undefined,
      estimateData: req.body.estimateData as {
        jobName?: string;
        customerJobNumber?: string;
        qbEstimateNumber?: string;
        subtotal?: number;
        tax?: number;
        total?: number;
        estimateDate?: string;
      } | undefined
    };

    const preview = await versioningService.getEmailPreviewHtml(estimateId, recipients, emailContent);

    res.json({
      success: true,
      data: preview
    });
  } catch (error) {
    console.error('Controller error fetching email preview:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to fetch email preview'
    });
  }
};

/**
 * Get estimate send email template
 * @route GET /estimates/template/send-email
 */
export const getEstimateSendTemplate = async (req: AuthRequest, res: Response) => {
  try {
    const template = await versioningService.getEstimateSendTemplate();

    res.json({
      success: true,
      data: template
    });
  } catch (error) {
    console.error('Controller error fetching send template:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to fetch send template'
    });
  }
};

// =============================================
// QB LINE DESCRIPTIONS (Phase 4.c)
// =============================================

/**
 * Get all QB descriptions for an estimate
 * @route GET /estimates/:estimateId/line-descriptions
 */
export const getLineDescriptions = async (req: AuthRequest, res: Response) => {
  try {
    const validation = validateEstimateId(req.params.estimateId, res);
    if (!validation.isValid) return;
    const estimateId = validation.value!;

    const descriptions = await versioningService.getLineDescriptions(estimateId);

    res.json({ success: true, data: descriptions });
  } catch (error) {
    console.error('Controller error fetching line descriptions:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to fetch line descriptions'
    });
  }
};

/**
 * Update QB descriptions (batch update)
 * @route PUT /estimates/:estimateId/line-descriptions
 */
export const updateLineDescriptions = async (req: AuthRequest, res: Response) => {
  try {
    const validated = validateEstimateRequest(req, res);
    if (!validated) return;

    const { updates } = req.body;

    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Updates array is required and must not be empty'
      });
    }

    await versioningService.updateLineDescriptions(
      validated.estimateId,
      updates
    );

    res.json({
      success: true,
      message: `Updated ${updates.length} description(s)`
    });
  } catch (error) {
    console.error('Controller error updating line descriptions:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to update line descriptions'
    });
  }
};

// =============================================
// QB ESTIMATE PDF (Phase 4.c)
// =============================================

/**
 * Get QB estimate PDF for preview
 * Downloads PDF from QuickBooks and returns as base64
 * @route GET /estimates/:estimateId/qb-pdf
 */
export const getEstimatePdf = async (req: AuthRequest, res: Response) => {
  try {
    const validation = validateEstimateId(req.params.estimateId, res);
    if (!validation.isValid) return;
    const estimateId = validation.value!;

    // Get estimate to find QB estimate ID
    const estimate = await versioningService.getEstimateById(estimateId);
    if (!estimate) {
      return res.status(404).json({
        success: false,
        message: 'Estimate not found'
      });
    }

    if (!estimate.qb_estimate_id) {
      return res.status(404).json({
        success: false,
        message: 'No QuickBooks estimate linked to this estimate'
      });
    }

    // Get realm ID
    const { quickbooksRepository } = await import('../../repositories/quickbooksRepository');
    const realmId = await quickbooksRepository.getDefaultRealmId();
    if (!realmId) {
      return res.status(500).json({
        success: false,
        message: 'QuickBooks not configured'
      });
    }

    // Download PDF from QuickBooks
    const { getQBEstimatePdf } = await import('../../utils/quickbooks/apiClient');
    const pdfBuffer = await getQBEstimatePdf(estimate.qb_estimate_id, realmId);

    // Cache PDF to disk for later use when sending email
    try {
      await fs.mkdir(PDF_CACHE_DIR, { recursive: true });
      const cachePath = path.join(PDF_CACHE_DIR, `estimate-${estimateId}.pdf`);
      await fs.writeFile(cachePath, pdfBuffer);
      console.log(`📎 Cached PDF for estimate ${estimateId} at ${cachePath}`);
    } catch (cacheError) {
      // Non-blocking - log but don't fail the request
      console.error('⚠️ Failed to cache PDF:', cacheError instanceof Error ? cacheError.message : cacheError);
    }

    // Return as base64 for frontend to display
    res.json({
      success: true,
      data: {
        pdf: pdfBuffer.toString('base64'),
        filename: `Estimate-${estimate.qb_doc_number || estimateId}.pdf`
      }
    });
  } catch (error) {
    console.error('Controller error getting estimate PDF:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get estimate PDF'
    });
  }
};
