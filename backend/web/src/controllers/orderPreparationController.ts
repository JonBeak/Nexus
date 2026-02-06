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
import { broadcastTasksRegenerated } from '../websocket';
import * as cashEstimateSyncService from '../services/cashEstimateSyncService';

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
export const generateProductionTasks = async (req: AuthRequest, res: Response) => {
  try {
    const { orderNumber } = req.params;
    const userId = req.user?.user_id || 0;

    const orderId = await validateOrderAndGetId(orderNumber, res);
    if (!orderId) return;

    // Import task generation service
    const { generateTasksForOrder } = await import('../services/taskGeneration');

    // Generate tasks based on specs
    const result = await generateTasksForOrder(orderId);

    // Broadcast to connected clients
    if (result.tasksCreated > 0) {
      broadcastTasksRegenerated(orderId, parseInt(orderNumber), result.tasksCreated, userId);
    }

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
      unknownApplications: result.unknownApplications || [],
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
 * POST /api/order-preparation/:orderNumber/resolve-unknown-applications
 * Resolve unknown vinyl/digital print applications by creating tasks and optionally saving to matrix
 */
export const resolveUnknownApplications = async (req: AuthRequest, res: Response) => {
  try {
    const { orderNumber } = req.params;
    const { resolutions } = req.body;
    const userId = req.user?.user_id;

    if (!Array.isArray(resolutions) || resolutions.length === 0) {
      return sendErrorResponse(res, 'Resolutions array is required', 'VALIDATION_ERROR');
    }

    const orderId = await validateOrderAndGetId(orderNumber, res);
    if (!orderId) return;

    // Import services
    const { vinylMatrixService } = await import('../services/vinylMatrixService');
    const { query } = await import('../config/database');
    const { TASK_ORDER, getRole } = await import('../services/taskGeneration/taskRules');

    // Helper to get sort order
    const getTaskSortOrder = (taskName: string): number => {
      const index = TASK_ORDER.indexOf(taskName);
      return index !== -1 ? index : 999;
    };

    let tasksCreated = 0;
    let matrixEntriesCreated = 0;

    let applicationsCreated = 0;

    for (const resolution of resolutions) {
      const { partId, application, applicationKey, productType, productTypeKey, colour, specName, taskNames, saveApplication, saveToMatrix } = resolution;

      // Create tasks for this resolution
      for (const taskName of taskNames) {
        // Build task note - include application for both vinyl and digital print
        let taskNote: string | null = null;
        if (specName === 'Digital Print') {
          const colourPart = colour || 'N/A';
          taskNote = application
            ? `Digital Print: ${colourPart} - ${application}`
            : `Digital Print: ${colourPart}`;
        } else {
          // Vinyl: include colour and application
          if (colour && application) {
            taskNote = `Colour: ${colour} - ${application}`;
          } else if (colour) {
            taskNote = `Colour: ${colour}`;
          } else if (application) {
            taskNote = application;
          }
        }

        await query(
          `INSERT INTO order_tasks (order_id, part_id, task_name, sort_order, assigned_role, notes)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [orderId, partId, taskName, getTaskSortOrder(taskName), getRole(taskName), taskNote]
        );
        tasksCreated++;
      }

      // Optionally save application to specification_options
      if (saveApplication) {
        const { settingsRepository } = await import('../repositories/settingsRepository');
        try {
          const maxOrder = await settingsRepository.getMaxOptionDisplayOrder('vinyl_applications');
          await settingsRepository.createSpecificationOption({
            category: 'vinyl_applications',
            category_display_name: 'Vinyl Applications',
            option_value: application,
            option_key: applicationKey,
            display_order: maxOrder + 1,
            is_active: true,
            is_system: false
          });
          applicationsCreated++;
        } catch (err) {
          // May already exist, that's okay
          console.log(`Application "${application}" may already exist:`, err);
        }
      }

      // Optionally save to matrix for future use (task mapping)
      if (saveToMatrix && taskNames.length > 0) {
        const createResult = await vinylMatrixService.createMatrixEntry(
          productType,
          productTypeKey,
          application,
          applicationKey,
          taskNames,
          userId || 0
        );
        if (createResult.success) {
          matrixEntriesCreated++;
        }
      }
    }

    const messageParts = [`Created ${tasksCreated} tasks`];
    if (applicationsCreated > 0) messageParts.push(`added ${applicationsCreated} application(s)`);
    if (matrixEntriesCreated > 0) messageParts.push(`saved ${matrixEntriesCreated} matrix mapping(s)`);

    // Broadcast to connected clients if tasks were created
    if (tasksCreated > 0) {
      broadcastTasksRegenerated(orderId, parseInt(orderNumber), tasksCreated, userId || 0);
    }

    sendSuccessResponse(res, {
      tasksCreated,
      applicationsCreated,
      matrixEntriesCreated,
      message: messageParts.join(', ')
    });
  } catch (error) {
    console.error('Error resolving unknown applications:', error);
    const message = error instanceof Error ? error.message : 'Failed to resolve unknown applications';
    sendErrorResponse(res, message, 'INTERNAL_ERROR');
  }
};

/**
 * POST /api/order-preparation/:orderNumber/resolve-painting-configurations
 * Resolve painting configurations by creating tasks and optionally saving to matrix
 */
export const resolvePaintingConfigurations = async (req: AuthRequest, res: Response) => {
  try {
    const { orderNumber } = req.params;
    const { resolutions } = req.body;
    const userId = req.user?.user_id;

    if (!Array.isArray(resolutions) || resolutions.length === 0) {
      return sendErrorResponse(res, 'Resolutions array is required', 'VALIDATION_ERROR');
    }

    const orderId = await validateOrderAndGetId(orderNumber, res);
    if (!orderId) return;

    // Import services
    const { settingsRepository } = await import('../repositories/settingsRepository');
    const { query } = await import('../config/database');
    const { TASK_ORDER, getRole } = await import('../services/taskGeneration/taskRules');
    const { PAINTING_TASKS } = await import('../services/taskGeneration/paintingTaskMatrix');

    // Helper to get sort order
    const getTaskSortOrder = (taskName: string): number => {
      const index = TASK_ORDER.indexOf(taskName);
      return index !== -1 ? index : 999;
    };

    // Reverse lookup: task name → task number
    const taskNameToNumber = Object.fromEntries(
      Object.entries(PAINTING_TASKS).map(([num, name]) => [name, parseInt(num)])
    );

    let tasksCreated = 0;
    let componentsCreated = 0;
    let matrixEntriesCreated = 0;

    for (const resolution of resolutions) {
      const {
        partId, itemType, itemTypeKey, component, componentKey,
        timing, timingKey, colour, taskNames, saveComponent, saveToMatrix
      } = resolution;

      // Create tasks for this resolution
      for (const taskName of taskNames) {
        const taskNote = colour && colour !== 'N/A' ? `Colour: ${colour}` : null;

        await query(
          `INSERT INTO order_tasks (order_id, part_id, task_name, sort_order, assigned_role, notes)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [orderId, partId, taskName, getTaskSortOrder(taskName), getRole(taskName), taskNote]
        );
        tasksCreated++;
      }

      // Optionally save component to specification_options
      if (saveComponent) {
        try {
          const maxOrder = await settingsRepository.getMaxOptionDisplayOrder('painting_components');
          await settingsRepository.createSpecificationOption({
            category: 'painting_components',
            category_display_name: 'Painting Components',
            option_value: component,
            option_key: componentKey,
            display_order: maxOrder + 1,
            is_active: true,
            is_system: false
          });
          componentsCreated++;
        } catch (err) {
          // May already exist, that's okay
          console.log(`Component "${component}" may already exist:`, err);
        }
      }

      // Optionally save to matrix for future use
      if (saveToMatrix && taskNames.length > 0) {
        // Convert task names to task numbers
        const taskNumbers = taskNames
          .map((name: string) => taskNameToNumber[name])
          .filter((num: number | undefined) => num !== undefined);

        if (taskNumbers.length > 0) {
          const result = await settingsRepository.upsertPaintingMatrixEntry(
            itemType,
            itemTypeKey,
            component,
            componentKey,
            timing,
            timingKey,
            taskNumbers,
            userId || 0
          );
          if (result.success) {
            matrixEntriesCreated++;
          }
        }
      }
    }

    const messageParts = [`Created ${tasksCreated} tasks`];
    if (componentsCreated > 0) messageParts.push(`added ${componentsCreated} component(s)`);
    if (matrixEntriesCreated > 0) messageParts.push(`saved ${matrixEntriesCreated} matrix mapping(s)`);

    // Broadcast to connected clients if tasks were created
    if (tasksCreated > 0) {
      broadcastTasksRegenerated(orderId, parseInt(orderNumber), tasksCreated, userId || 0);
    }

    sendSuccessResponse(res, {
      tasksCreated,
      componentsCreated,
      matrixEntriesCreated,
      message: messageParts.join(', ')
    });
  } catch (error) {
    console.error('Error resolving painting configurations:', error);
    const message = error instanceof Error ? error.message : 'Failed to resolve painting configurations';
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
        qbEstimate: pdfUrls?.qbEstimate || null,
        internalEstimate: pdfUrls?.internalEstimate || null
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

// =============================================
// CASH JOB ESTIMATE CONFLICT RESOLUTION
// =============================================

/**
 * GET /api/order-preparation/:orderNumber/qb-estimate/compare
 * Compare local order data with QB estimate for conflict detection
 */
export const compareQBEstimate = async (req: Request, res: Response) => {
  try {
    const { orderNumber } = req.params;
    const orderId = await validateOrderAndGetId(orderNumber, res);
    if (!orderId) return;

    // Check full sync status (local vs QB)
    const syncResult = await cashEstimateSyncService.checkFullSyncStatus(orderId);

    sendSuccessResponse(res, {
      syncStatus: syncResult
    });
  } catch (error) {
    console.error('Error comparing QB estimate:', error);
    const message = error instanceof Error ? error.message : 'Failed to compare estimate';
    sendErrorResponse(res, message, 'INTERNAL_ERROR');
  }
};

/**
 * POST /api/order-preparation/:orderNumber/qb-estimate/resolve-conflict
 * Resolve estimate conflict by applying chosen resolution
 */
export const resolveEstimateConflict = async (req: Request, res: Response) => {
  try {
    const { orderNumber } = req.params;
    const { resolution } = req.body;
    const userId = (req as AuthRequest).user?.user_id;

    if (!userId) {
      return sendErrorResponse(res, 'User not authenticated', 'VALIDATION_ERROR');
    }

    if (!resolution || !['use_local', 'use_qb'].includes(resolution)) {
      return sendErrorResponse(res, 'Invalid resolution type. Must be "use_local" or "use_qb"', 'VALIDATION_ERROR');
    }

    const orderId = await validateOrderAndGetId(orderNumber, res);
    if (!orderId) return;

    // Resolve the conflict
    const result = await cashEstimateSyncService.resolveConflict(orderId, resolution, userId);

    sendSuccessResponse(res, {
      success: result.success,
      message: result.message
    });
  } catch (error) {
    console.error('Error resolving estimate conflict:', error);
    const message = error instanceof Error ? error.message : 'Failed to resolve conflict';
    sendErrorResponse(res, message, 'INTERNAL_ERROR');
  }
};

/**
 * POST /api/order-preparation/:orderNumber/qb-estimate/link
 * Link an existing QB estimate to the order
 */
export const linkExistingEstimate = async (req: Request, res: Response) => {
  try {
    const { orderNumber } = req.params;
    const { qbEstimateId, docNumber } = req.body;
    const userId = (req as AuthRequest).user?.user_id;

    if (!userId) {
      return sendErrorResponse(res, 'User not authenticated', 'VALIDATION_ERROR');
    }

    if (!qbEstimateId) {
      return sendErrorResponse(res, 'QB estimate ID is required', 'VALIDATION_ERROR');
    }

    const orderId = await validateOrderAndGetId(orderNumber, res);
    if (!orderId) return;

    // Link the estimate
    const result = await cashEstimateSyncService.linkExistingEstimate(orderId, qbEstimateId, userId);

    sendSuccessResponse(res, {
      success: result.success,
      qbEstimateNumber: result.qbEstimateNumber,
      message: `Linked QB estimate ${result.qbEstimateNumber} to order`
    });
  } catch (error) {
    console.error('Error linking estimate:', error);
    const message = error instanceof Error ? error.message : 'Failed to link estimate';
    sendErrorResponse(res, message, 'INTERNAL_ERROR');
  }
};

/**
 * GET /api/order-preparation/:orderNumber/qb-estimate/customer-estimates
 * Get QB estimates for the order's customer (for linking)
 */
export const getCustomerEstimates = async (req: Request, res: Response) => {
  try {
    const { orderNumber } = req.params;
    const orderId = await validateOrderAndGetId(orderNumber, res);
    if (!orderId) return;

    // Get customer's QB estimates
    const estimates = await cashEstimateSyncService.getCustomerEstimates(orderId);

    sendSuccessResponse(res, {
      estimates
    });
  } catch (error) {
    console.error('Error getting customer estimates:', error);
    const message = error instanceof Error ? error.message : 'Failed to get customer estimates';
    sendErrorResponse(res, message, 'INTERNAL_ERROR');
  }
};

/**
 * GET /api/order-preparation/estimates/:estimateId/details
 * Get detailed QB estimate including line items (for preview panel)
 */
export const getEstimateDetails = async (req: Request, res: Response) => {
  try {
    const { estimateId } = req.params;
    if (!estimateId) {
      return sendErrorResponse(res, 'Estimate ID is required', 'VALIDATION_ERROR');
    }

    const { quickbooksRepository } = await import('../repositories/quickbooksRepository');
    const realmId = await quickbooksRepository.getDefaultRealmId();
    if (!realmId) {
      return sendErrorResponse(res, 'QuickBooks not configured', 'CONFIGURATION_ERROR');
    }

    const { getQBEstimate } = await import('../utils/quickbooks/apiClient');
    const estimate = await getQBEstimate(estimateId, realmId);

    const lineItems = (estimate.Line || [])
      .filter((line: any) => line.DetailType === 'SalesItemLineDetail' || line.DetailType === 'DescriptionOnly')
      .map((line: any) => ({
        description: line.Description || '',
        itemName: line.SalesItemLineDetail?.ItemRef?.name || (line.DetailType === 'DescriptionOnly' ? line.Description || '' : '-'),
        quantity: line.SalesItemLineDetail?.Qty || 0,
        unitPrice: line.SalesItemLineDetail?.UnitPrice || 0,
        amount: line.Amount || 0
      }));

    sendSuccessResponse(res, {
      estimateId: estimate.Id,
      docNumber: estimate.DocNumber,
      txnDate: estimate.TxnDate,
      total: estimate.TotalAmt,
      customerName: estimate.CustomerRef?.name || '',
      lineItems
    });
  } catch (error) {
    console.error('Error getting estimate details:', error);
    const message = error instanceof Error ? error.message : 'Failed to get estimate details';
    sendErrorResponse(res, message, 'INTERNAL_ERROR');
  }
};

// =============================================
// CASH JOB ESTIMATE EMAIL WORKFLOW
// =============================================

/**
 * GET /api/order-preparation/:orderNumber/qb-estimate/pdf
 * Get estimate PDF from QuickBooks (base64 encoded)
 */
export const getEstimatePdf = async (req: Request, res: Response) => {
  try {
    const { orderNumber } = req.params;
    const orderId = await validateOrderAndGetId(orderNumber, res);
    if (!orderId) return;

    // Get estimate ID from order
    const order = await orderPrepRepo.getOrderByOrderNumber(parseInt(orderNumber));
    if (!order?.qb_estimate_id) {
      return sendErrorResponse(res, 'No estimate linked to this order', 'NOT_FOUND');
    }

    // Get realm ID
    const { quickbooksRepository } = await import('../repositories/quickbooksRepository');
    const realmId = await quickbooksRepository.getDefaultRealmId();
    if (!realmId) {
      return sendErrorResponse(res, 'QuickBooks not configured', 'INTERNAL_ERROR');
    }

    // Get PDF from QuickBooks
    const { getQBEstimatePdf } = await import('../utils/quickbooks/apiClient');
    const pdfBuffer = await getQBEstimatePdf(order.qb_estimate_id, realmId);

    // Convert to base64
    const pdf = pdfBuffer.toString('base64');
    const filename = `Estimate-${order.qb_estimate_doc_number || orderNumber}.pdf`;

    sendSuccessResponse(res, { pdf, filename });
  } catch (error) {
    console.error('Error getting estimate PDF:', error);
    const message = error instanceof Error ? error.message : 'Failed to get estimate PDF';
    sendErrorResponse(res, message, 'INTERNAL_ERROR');
  }
};

/**
 * POST /api/order-preparation/:orderNumber/qb-estimate/send-email
 * Send estimate email to customer
 */
export const sendEstimateEmail = async (req: Request, res: Response) => {
  try {
    const { orderNumber } = req.params;
    const { recipientEmails, ccEmails, bccEmails, subject, body, attachEstimatePdf } = req.body;
    const userId = (req as AuthRequest).user?.user_id;

    if (!userId) {
      return sendErrorResponse(res, 'User not authenticated', 'UNAUTHORIZED');
    }

    const orderId = await validateOrderAndGetId(orderNumber, res);
    if (!orderId) return;

    // Validate recipients
    if (!recipientEmails || !Array.isArray(recipientEmails) || recipientEmails.length === 0) {
      return sendErrorResponse(res, 'At least one recipient email is required', 'VALIDATION_ERROR');
    }

    // Get order details
    const order = await orderPrepRepo.getOrderByOrderNumber(parseInt(orderNumber));
    if (!order) {
      return sendErrorResponse(res, 'Order not found', 'NOT_FOUND');
    }

    // Import and use estimate email service
    const { sendEstimateEmailToCustomer } = await import('../services/cashEstimateEmailService');
    const result = await sendEstimateEmailToCustomer({
      orderId,
      orderNumber: parseInt(orderNumber),
      recipientEmails,
      ccEmails: ccEmails || [],
      bccEmails: bccEmails || [],
      subject,
      body,
      attachEstimatePdf: attachEstimatePdf !== false,
      qbEstimateId: order.qb_estimate_id || undefined,
      qbEstimateDocNumber: order.qb_estimate_doc_number || undefined,
      userId
    });

    if (!result.success) {
      return sendErrorResponse(res, result.error || 'Failed to send email', 'INTERNAL_ERROR');
    }

    sendSuccessResponse(res, { success: true, messageId: result.messageId });
  } catch (error) {
    console.error('Error sending estimate email:', error);
    const message = error instanceof Error ? error.message : 'Failed to send estimate email';
    sendErrorResponse(res, message, 'INTERNAL_ERROR');
  }
};

/**
 * POST /api/order-preparation/:orderNumber/qb-estimate/schedule-email
 * Schedule estimate email for later delivery
 */
export const scheduleEstimateEmail = async (req: Request, res: Response) => {
  try {
    const { orderNumber } = req.params;
    const { recipientEmails, ccEmails, bccEmails, subject, body, attachEstimatePdf, scheduledFor } = req.body;
    const userId = (req as AuthRequest).user?.user_id;

    if (!userId) {
      return sendErrorResponse(res, 'User not authenticated', 'UNAUTHORIZED');
    }

    const orderId = await validateOrderAndGetId(orderNumber, res);
    if (!orderId) return;

    // Validate inputs
    if (!recipientEmails || recipientEmails.length === 0) {
      return sendErrorResponse(res, 'At least one recipient email is required', 'VALIDATION_ERROR');
    }
    if (!scheduledFor) {
      return sendErrorResponse(res, 'Scheduled time is required', 'VALIDATION_ERROR');
    }

    // Import and use estimate email service
    const { scheduleEstimateEmailForLater } = await import('../services/cashEstimateEmailService');
    const result = await scheduleEstimateEmailForLater({
      orderId,
      recipientEmails,
      ccEmails: ccEmails || [],
      bccEmails: bccEmails || [],
      subject,
      body,
      attachEstimatePdf: attachEstimatePdf !== false,
      scheduledFor: new Date(scheduledFor),
      userId
    });

    sendSuccessResponse(res, { scheduledEmailId: result.scheduledEmailId });
  } catch (error) {
    console.error('Error scheduling estimate email:', error);
    const message = error instanceof Error ? error.message : 'Failed to schedule estimate email';
    sendErrorResponse(res, message, 'INTERNAL_ERROR');
  }
};

/**
 * POST /api/order-preparation/:orderNumber/qb-estimate/mark-sent
 * Mark estimate as sent manually (without sending email)
 */
export const markEstimateAsSent = async (req: Request, res: Response) => {
  try {
    const { orderNumber } = req.params;
    const orderId = await validateOrderAndGetId(orderNumber, res);
    if (!orderId) return;

    // Update invoice_sent_at timestamp (used for both invoices and estimates)
    const { query } = await import('../config/database');
    await query(
      'UPDATE orders SET invoice_sent_at = NOW() WHERE order_id = ?',
      [orderId]
    );

    sendSuccessResponse(res, { success: true, message: 'Estimate marked as sent' });
  } catch (error) {
    console.error('Error marking estimate as sent:', error);
    const message = error instanceof Error ? error.message : 'Failed to mark estimate as sent';
    sendErrorResponse(res, message, 'INTERNAL_ERROR');
  }
};

/**
 * POST /api/order-preparation/:orderNumber/qb-estimate/email-preview
 * Get styled email preview for estimate
 */
export const getEstimateEmailPreview = async (req: Request, res: Response) => {
  try {
    const { orderNumber } = req.params;
    const { subject, beginning, end, summaryConfig, estimateData } = req.body;

    const orderId = await validateOrderAndGetId(orderNumber, res);
    if (!orderId) return;

    // Get order data
    const orderData = await orderPrepRepo.getOrderDataForQBEstimate(orderId);
    if (!orderData) {
      return sendErrorResponse(res, 'Order not found', 'NOT_FOUND');
    }

    // Use estimate email service to generate preview
    const { estimateEmailService } = await import('../services/estimate/estimateEmailService');
    const preview = await estimateEmailService.generateEmailPreviewHtml(
      {
        customer_name: orderData.customer_name,
        job_name: orderData.order_name,
        customer_job_number: orderData.customer_job_number,
        customer_po: orderData.customer_po,
        order_number: orderData.order_number,
        qb_doc_number: orderData.qb_estimate_doc_number,
        subtotal: estimateData?.subtotal,
        tax_amount: estimateData?.tax,
        total_amount: estimateData?.total,
        estimate_date: estimateData?.estimateDate,
        cached_balance: orderData.cached_balance ?? undefined
      },
      { subject, beginning, end, summaryConfig, estimateData }
    );

    sendSuccessResponse(res, { subject: preview.subject, html: preview.html });
  } catch (error) {
    console.error('Error generating estimate email preview:', error);
    const message = error instanceof Error ? error.message : 'Failed to generate email preview';
    sendErrorResponse(res, message, 'INTERNAL_ERROR');
  }
};

/**
 * GET /api/order-preparation/:orderNumber/qb-estimate/email-history
 * Get estimate email history for this order
 */
export const getEstimateEmailHistory = async (req: Request, res: Response) => {
  try {
    const { orderNumber } = req.params;
    const orderId = await validateOrderAndGetId(orderNumber, res);
    if (!orderId) return;

    // Get email history from scheduled_emails table (type = 'estimate')
    const { query } = await import('../config/database');
    const rows = await query(
      `SELECT
        id, email_type, recipient_emails, cc_emails, subject, body,
        scheduled_for, status, sent_at, error_message, created_at, created_by
      FROM scheduled_emails
      WHERE order_id = ? AND email_type IN ('estimate', 'cash_estimate')
      ORDER BY created_at DESC`,
      [orderId]
    ) as any[];

    sendSuccessResponse(res, rows);
  } catch (error) {
    console.error('Error getting estimate email history:', error);
    const message = error instanceof Error ? error.message : 'Failed to get email history';
    sendErrorResponse(res, message, 'INTERNAL_ERROR');
  }
};
