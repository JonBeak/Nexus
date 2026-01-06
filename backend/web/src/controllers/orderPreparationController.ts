// File Clean up Finished: 2025-11-18
// Cleanup Summary:
// - ✅ Removed unused imports: path, fs, orderService
// - ✅ Removed savePDFsToFolder endpoint (redundant - PDFs already saved in previous steps)
// - ✅ Created controllers/helpers/orderHelpers.ts with validateOrderAndGetId helper
// - ✅ Refactored 7 of 9 controller functions to use validation helper
// - ✅ Reduced code duplication by ~49 lines (7 functions × 7 lines each)
// - ✅ Functions now use helper: checkQBEstimateStaleness, checkPDFStaleness, createQBEstimate,
//     generateOrderFormPDF, validateForPreparation, checkTaskStaleness, generateProductionTasks
// - ℹ️  Functions that can't use helper (use orderNumber not orderId): downloadQBEstimatePDF, getPointPersons
// - ✅ Architecture: Follows 3-layer pattern correctly (Controller → Service → Repository)
// - ✅ No direct database queries - all delegated to services/repositories
// - ✅ File size: 267 lines (reduced from 367 lines, 27% reduction)

/**
 * Order Preparation Controller
 *
 * HTTP request/response handlers for order preparation workflow endpoints.
 * Handles QB estimate creation, PDF generation, and preparation steps.
 */

import { Request, Response } from 'express';
import { parseIntParam, sendErrorResponse, sendSuccessResponse } from '../utils/controllerHelpers';
import { AuthRequest } from '../types';
import * as qbEstimateService from '../services/qbEstimateService';
import { pdfGenerationService } from '../services/pdf/pdfGenerationService';
import { orderValidationService } from '../services/orderValidationService';
import * as orderPrepRepo from '../repositories/orderPreparationRepository';
import { orderFormRepository } from '../repositories/orderFormRepository';
import { orderPartRepository } from '../repositories/orderPartRepository';
import { validateOrderAndGetId } from './helpers/orderHelpers';
import * as orderFinalizationService from '../services/orderFinalizationService';
import { getEmailPreviewHtml, getOrderEmailPreviewHtml, OrderEmailContent } from '../services/gmailService';

/**
 * GET /api/order-preparation/:orderNumber/qb-estimate/staleness
 * Check if QB estimate is stale (order data changed)
 */
export const checkQBEstimateStaleness = async (req: Request, res: Response) => {
  try {
    const { orderNumber } = req.params;
    const orderId = await validateOrderAndGetId(orderNumber, res);
    if (!orderId) return;

    // Check staleness
    const stalenessResult = await qbEstimateService.checkEstimateStaleness(orderId);

    sendSuccessResponse(res, {
      staleness: stalenessResult
    });
  } catch (error) {
    console.error('Error checking QB estimate staleness:', error);
    const message = error instanceof Error ? error.message : 'Failed to check estimate staleness';
    sendErrorResponse(res, message, 'INTERNAL_ERROR');
  }
};

/**
 * GET /api/order-preparation/:orderNumber/pdfs/staleness
 * Check if order form PDFs are stale (order data changed since PDFs were generated)
 */
export const checkPDFStaleness = async (req: Request, res: Response) => {
  try {
    const { orderNumber } = req.params;
    const orderId = await validateOrderAndGetId(orderNumber, res);
    if (!orderId) return;

    // Check PDF staleness
    const stalenessResult = await orderFormRepository.checkOrderFormStaleness(orderId);

    sendSuccessResponse(res, {
      staleness: stalenessResult
    });
  } catch (error) {
    console.error('Error checking PDF staleness:', error);
    const message = error instanceof Error ? error.message : 'Failed to check PDF staleness';
    sendErrorResponse(res, message, 'INTERNAL_ERROR');
  }
};

/**
 * POST /api/order-preparation/:orderNumber/qb-estimate
 * Create or recreate QB estimate for order
 */
export const createQBEstimate = async (req: Request, res: Response) => {
  try {
    const { orderNumber } = req.params;
    const userId = (req as AuthRequest).user?.user_id;

    if (!userId) {
      return sendErrorResponse(res, 'User not authenticated', 'VALIDATION_ERROR');
    }

    const orderId = await validateOrderAndGetId(orderNumber, res);
    if (!orderId) return;

    // Create QB estimate (auto-downloads PDF to Specs folder)
    const result = await qbEstimateService.createEstimateFromOrder(orderId, userId);

    sendSuccessResponse(res, {
      estimateId: result.estimateId,
      estimateNumber: result.estimateNumber,
      dataHash: result.dataHash,
      estimateUrl: result.estimateUrl,
      pdfPath: result.pdfPath,
      message: `QuickBooks estimate ${result.estimateNumber} created and PDF saved to Specs folder`
    });
  } catch (error) {
    console.error('Error creating QB estimate:', error);
    const message = error instanceof Error ? error.message : 'Failed to create QB estimate';
    sendErrorResponse(res, message, 'INTERNAL_ERROR');
  }
};

/**
 * POST /api/order-preparation/:orderNumber/pdfs/order-form
 * Generate order form PDF
 */
export const generateOrderFormPDF = async (req: Request, res: Response) => {
  try {
    const { orderNumber } = req.params;
    const userId = (req as AuthRequest).user?.user_id;

    const orderId = await validateOrderAndGetId(orderNumber, res);
    if (!orderId) return;

    // Generate all order forms (reuse existing service)
    const formPaths = await pdfGenerationService.generateAllForms({
      orderId,
      createNewVersion: false,
      userId
    });

    sendSuccessResponse(res, {
      formPaths,
      message: 'Order form PDFs generated successfully'
    });
  } catch (error) {
    console.error('Error generating order form PDF:', error);
    const message = error instanceof Error ? error.message : 'Failed to generate order form PDF';
    sendErrorResponse(res, message, 'INTERNAL_ERROR');
  }
};

/**
 * POST /api/order-preparation/:orderNumber/pdfs/qb-estimate
 * Download QB estimate PDF and save to order folder
 */
export const downloadQBEstimatePDF = async (req: Request, res: Response) => {
  try {
    const { orderNumber } = req.params;
    const { qbEstimateId } = req.body;

    const orderNumberNum = parseIntParam(orderNumber, 'order number');
    if (orderNumberNum === null) {
      return sendErrorResponse(res, 'Invalid order number', 'VALIDATION_ERROR');
    }

    if (!qbEstimateId) {
      return sendErrorResponse(res, 'QB estimate ID is required', 'VALIDATION_ERROR');
    }

    // Download QB estimate PDF
    const result = await qbEstimateService.downloadEstimatePDF(qbEstimateId, orderNumberNum);

    sendSuccessResponse(res, {
      pdfPath: result.pdfPath,
      pdfUrl: result.pdfUrl,
      message: 'QB estimate PDF downloaded successfully'
    });
  } catch (error) {
    console.error('Error downloading QB estimate PDF:', error);
    const message = error instanceof Error ? error.message : 'Failed to download QB estimate PDF';
    sendErrorResponse(res, message, 'INTERNAL_ERROR');
  }
};


/**
 * GET /api/order-preparation/:orderNumber/validate
 * Validate order for preparation
 * Also cleans up empty spec rows as part of validation
 */
export const validateForPreparation = async (req: Request, res: Response) => {
  try {
    const { orderNumber } = req.params;
    const orderId = await validateOrderAndGetId(orderNumber, res);
    if (!orderId) return;

    // Validate order specifications (also cleans up empty spec rows)
    const validationResult = await orderValidationService.validateOrderForPreparation(orderId);

    if (!validationResult.isValid) {
      // Return validation errors
      return sendErrorResponse(res, 'Order validation failed', 'VALIDATION_ERROR', {
        errors: validationResult.errors
      });
    }

    sendSuccessResponse(res, {
      valid: true,
      message: 'Order validated successfully',
      cleanedSpecRows: validationResult.cleanedSpecRows || 0  // Report how many parts had empty specs removed
    });
  } catch (error) {
    console.error('Error validating order:', error);
    const message = error instanceof Error ? error.message : 'Failed to validate order';
    sendErrorResponse(res, message, 'INTERNAL_ERROR');
  }
};

/**
 * GET /api/order-preparation/:orderNumber/tasks/staleness
 * Check if production tasks are stale (order data changed since tasks were generated)
 */
export const checkTaskStaleness = async (req: Request, res: Response) => {
  try {
    const { orderNumber } = req.params;
    const orderId = await validateOrderAndGetId(orderNumber, res);
    if (!orderId) return;

    // Check task staleness (shares same hash as QB/PDFs)
    const stalenessResult = await orderPartRepository.checkTaskStaleness(orderId);

    sendSuccessResponse(res, {
      staleness: stalenessResult
    });
  } catch (error) {
    console.error('Error checking task staleness:', error);
    const message = error instanceof Error ? error.message : 'Failed to check task staleness';
    sendErrorResponse(res, message, 'INTERNAL_ERROR');
  }
};

/**
 * POST /api/order-preparation/:orderNumber/tasks
 * Generate production tasks from order specifications
 */
export const generateProductionTasks = async (req: Request, res: Response) => {
  try {
    const { orderNumber } = req.params;

    const orderId = await validateOrderAndGetId(orderNumber, res);
    if (!orderId) return;

    // Import task generation service
    const { generateTasksForOrder } = await import('../services/taskGeneration');

    // Generate tasks based on specs
    const result = await generateTasksForOrder(orderId);

    sendSuccessResponse(res, {
      tasksCreated: result.tasksCreated,
      tasksByPart: result.tasksByPart.map(p => ({
        partId: p.partId,
        displayNumber: p.displayNumber,
        taskCount: p.tasks.length
      })),
      requiresManualInput: result.requiresManualInput,
      manualInputReasons: result.manualInputReasons,
      warnings: result.warnings,
      paintingWarnings: result.paintingWarnings,
      message: result.tasksCreated > 0
        ? `Generated ${result.tasksCreated} production tasks`
        : 'No tasks generated (check order specifications)'
    });
  } catch (error) {
    console.error('Error generating production tasks:', error);
    const message = error instanceof Error ? error.message : 'Failed to generate production tasks';
    sendErrorResponse(res, message, 'INTERNAL_ERROR');
  }
};

/**
 * GET /api/order-preparation/:orderNumber/point-persons
 * Get point persons for order (for Phase 1.5.c.6.3 - Send to Customer)
 */
export const getPointPersons = async (req: Request, res: Response) => {
  try {
    const { orderNumber } = req.params;

    const orderNumberNum = parseIntParam(orderNumber, 'order number');
    if (orderNumberNum === null) {
      return sendErrorResponse(res, 'Invalid order number', 'VALIDATION_ERROR');
    }

    // Get point persons
    const pointPersons = await orderPrepRepo.getOrderPointPersons(orderNumberNum);

    console.log(`[Point Persons] Order ${orderNumberNum}: Found ${pointPersons.length} point persons`, pointPersons);

    sendSuccessResponse(res, {
      pointPersons
    });
  } catch (error) {
    console.error('Error getting point persons:', error);
    const message = error instanceof Error ? error.message : 'Failed to get point persons';
    sendErrorResponse(res, message, 'INTERNAL_ERROR');
  }
};

/**
 * GET /api/order-preparation/:orderNumber/email-preview
 * Get email preview HTML for Send to Customer step
 */
export const getEmailPreview = async (req: Request, res: Response) => {
  try {
    const { orderNumber } = req.params;
    const { recipients } = req.query;

    const orderNumberNum = parseIntParam(orderNumber, 'order number');
    if (orderNumberNum === null) {
      return sendErrorResponse(res, 'Invalid order number', 'VALIDATION_ERROR');
    }

    // Get order info
    const order = await orderPrepRepo.getOrderByOrderNumber(orderNumberNum);
    if (!order) {
      return sendErrorResponse(res, 'Order not found', 'NOT_FOUND');
    }

    // Get customer name
    const orderData = await orderPrepRepo.getOrderDataForQBEstimate(order.order_id);

    // Build email preview with actual customer name
    const recipientList = recipients ? String(recipients).split(',') : [];
    const preview = getEmailPreviewHtml({
      recipients: recipientList,
      orderNumber: orderNumberNum,
      orderName: order.order_name,
      customerName: orderData?.customer_name || undefined,
      pdfUrls: { orderForm: null, qbEstimate: null }
    });

    sendSuccessResponse(res, {
      subject: preview.subject,
      html: preview.html
    });
  } catch (error) {
    console.error('Error generating email preview:', error);
    const message = error instanceof Error ? error.message : 'Failed to generate email preview';
    sendErrorResponse(res, message, 'INTERNAL_ERROR');
  }
};

/**
 * POST /api/order-preparation/:orderNumber/email-preview
 * Get styled email preview with customizable content
 */
export const getOrderEmailPreviewWithContent = async (req: Request, res: Response) => {
  try {
    const { orderNumber } = req.params;
    const { recipients, emailContent, customerName, orderName, pdfUrls } = req.body;

    const orderNumberNum = parseIntParam(orderNumber, 'order number');
    if (orderNumberNum === null) {
      return sendErrorResponse(res, 'Invalid order number', 'VALIDATION_ERROR');
    }

    // Get order info
    const order = await orderPrepRepo.getOrderByOrderNumber(orderNumberNum);
    let finalOrderName = orderName;
    let finalCustomerName = customerName;
    let orderNameWithRef = orderName || '';

    if (order) {
      const orderData = await orderPrepRepo.getOrderDataForQBEstimate(order.order_id);
      finalOrderName = finalOrderName || order.order_name;
      finalCustomerName = finalCustomerName || orderData?.customer_name;

      // Build orderNameWithRef: "Order Name - Job # XXX - PO # YYY"
      orderNameWithRef = order.order_name || '';
      if (orderData?.customer_job_number) {
        orderNameWithRef += ` - Job # ${orderData.customer_job_number}`;
      }
      if (orderData?.customer_po) {
        orderNameWithRef += ` - PO # ${orderData.customer_po}`;
      }
    }

    // Build email preview with content
    // Map frontend field names (specsOrderForm) to backend field names (orderForm)
    const preview = await getOrderEmailPreviewHtml({
      recipients: recipients?.to || [],
      ccRecipients: recipients?.cc || [],
      bccRecipients: recipients?.bcc || [],
      orderNumber: orderNumberNum,
      orderName: orderNameWithRef || finalOrderName || `Order #${orderNumberNum}`,
      customerName: finalCustomerName,
      emailContent: emailContent as OrderEmailContent,
      pdfUrls: {
        orderForm: pdfUrls?.specsOrderForm || null,
        qbEstimate: pdfUrls?.qbEstimate || null
      }
    });

    sendSuccessResponse(res, {
      subject: preview.subject,
      html: preview.html
    });
  } catch (error) {
    console.error('Error generating styled email preview:', error);
    const message = error instanceof Error ? error.message : 'Failed to generate email preview';
    sendErrorResponse(res, message, 'INTERNAL_ERROR');
  }
};

/**
 * POST /api/order-preparation/:orderNumber/finalize
 * Finalize order and optionally send to customer
 * (Phase 1.5.c.6.3 - Send to Customer)
 */
export const finalizeOrder = async (req: Request, res: Response) => {
  try {
    const { orderNumber } = req.params;
    const { sendEmail, recipients, recipientSelection, emailContent, orderName, pdfUrls } = req.body;
    const user = (req as AuthRequest).user;

    if (!user) {
      return sendErrorResponse(res, 'User not authenticated', 'UNAUTHORIZED');
    }

    const orderNumberNum = parseIntParam(orderNumber, 'order number');
    if (orderNumberNum === null) {
      return sendErrorResponse(res, 'Invalid order number', 'VALIDATION_ERROR');
    }

    // Validate sendEmail flag
    if (typeof sendEmail !== 'boolean') {
      return sendErrorResponse(res, 'sendEmail flag is required', 'VALIDATION_ERROR');
    }

    // Validate recipients if sending email (support both old and new format)
    if (sendEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (recipientSelection) {
        // New format: To/CC/BCC
        const allRecipients = [
          ...(recipientSelection.to || []),
          ...(recipientSelection.cc || []),
          ...(recipientSelection.bcc || [])
        ];
        if (allRecipients.length === 0) {
          return sendErrorResponse(res, 'At least one recipient is required when sending email', 'VALIDATION_ERROR');
        }
        const invalidEmails = allRecipients.filter((email: string) => !emailRegex.test(email));
        if (invalidEmails.length > 0) {
          return sendErrorResponse(res, `Invalid email addresses: ${invalidEmails.join(', ')}`, 'VALIDATION_ERROR');
        }
      } else if (recipients) {
        // Legacy format: simple array
        if (!Array.isArray(recipients) || recipients.length === 0) {
          return sendErrorResponse(res, 'At least one recipient is required when sending email', 'VALIDATION_ERROR');
        }
        const invalidEmails = recipients.filter((email: string) => !emailRegex.test(email));
        if (invalidEmails.length > 0) {
          return sendErrorResponse(res, `Invalid email addresses: ${invalidEmails.join(', ')}`, 'VALIDATION_ERROR');
        }
      } else {
        return sendErrorResponse(res, 'Recipients are required when sending email', 'VALIDATION_ERROR');
      }
    }

    // Finalize order
    const result = await orderFinalizationService.finalizeOrderToCustomer({
      orderNumber: orderNumberNum,
      sendEmail,
      recipients: recipients || [],
      recipientSelection,
      emailContent,
      userId: user.user_id,
      orderName,
      pdfUrls
    });

    if (!result.success) {
      return sendErrorResponse(res, result.message, 'INTERNAL_ERROR', {
        error: result.error
      });
    }

    sendSuccessResponse(res, {
      emailSent: result.emailSent,
      statusUpdated: result.statusUpdated,
      message: result.message
    });
  } catch (error) {
    console.error('Error finalizing order:', error);
    const message = error instanceof Error ? error.message : 'Failed to finalize order';
    sendErrorResponse(res, message, 'INTERNAL_ERROR');
  }
};
