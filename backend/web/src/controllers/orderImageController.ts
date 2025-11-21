// FINISHED: Migrated to ServiceResult<T> system - Completed 2025-11-15
// Changes:
// - Added imports: parseIntParam, sendErrorResponse
// - Replaced 2 instances of parseInt() with parseIntParam()
// - Replaced 10 instances of manual res.status().json() with sendErrorResponse()
// - Service layer already returns appropriate errors (no migration needed)

// File Clean up Finished: 2025-11-15
// Changes:
//   - Migrated 2 pool.execute() calls to query() helper (via repository layer)
//   - Refactored to 3-layer architecture (Controller → Repository → Database)
//   - Removed duplicate database query logic (both methods now use orderRepository.getOrderFolderDetails)
//   - Added orderRepository.updateJobImage() for job image updates
//   - Removed direct database access - controller now uses repository pattern
//   - Extended orderRepository.getOrderFolderDetails() to include order_id and folder_exists
/**
 * Order Image Controller
 * HTTP Request Handlers for Order Image Management (Phase 1.5.g)
 *
 * Endpoints:
 * - GET /api/orders/:orderNumber/available-images - List images in order folder
 * - PATCH /api/orders/:orderNumber/job-image - Select job image
 */

import { Request, Response } from 'express';
import { orderRepository } from '../repositories/orderRepository';
import { orderFormRepository } from '../repositories/orderFormRepository';
import { orderFolderService } from '../services/orderFolderService';
import { parseIntParam, sendErrorResponse } from '../utils/controllerHelpers';

/**
 * Get available images for an order
 * GET /api/orders/:orderNumber/available-images
 * Permission: orders.view (All roles)
 *
 * Returns list of JPG/JPEG/PNG files in order's folder
 */
export const getAvailableImages = async (req: Request, res: Response) => {
  try {
    const orderNumber = parseIntParam(req.params.orderNumber, 'order number');

    if (orderNumber === null) {
      return sendErrorResponse(res, 'Invalid order number', 'VALIDATION_ERROR');
    }

    // Get order details from repository
    const order = await orderFormRepository.getOrderFolderDetails(orderNumber);

    if (!order) {
      return sendErrorResponse(res, 'Order not found', 'NOT_FOUND');
    }

    // Check if order has a folder
    if (!order.folder_exists || !order.folder_name || order.folder_location === 'none') {
      return res.json({
        success: true,
        images: [],
        message: 'Order has no folder'
      });
    }

    // List images using orderFolderService
    const images = orderFolderService.listImagesInFolder(
      order.folder_name,
      order.folder_location,
      order.is_migrated
    );

    res.json({
      success: true,
      images: images.map(img => ({
        filename: img.filename,
        size: img.size,
        modifiedDate: img.modifiedDate
      }))
    });

  } catch (error) {
    console.error('[OrderImageController] Error listing images:', error);
    sendErrorResponse(res, 'Failed to list images', 'INTERNAL_ERROR');
  }
};

/**
 * Set job image for an order
 * PATCH /api/orders/:orderNumber/job-image
 * Permission: orders.update (Manager+ only)
 *
 * Body: { filename: "design.jpg", cropCoords?: { top, right, bottom, left } }
 * Updates orders.sign_image_path field and optional crop coordinates
 */
export const setJobImage = async (req: Request, res: Response) => {
  try {
    const orderNumber = parseIntParam(req.params.orderNumber, 'order number');
    const { filename, cropCoords } = req.body;

    // Validation
    if (orderNumber === null) {
      return sendErrorResponse(res, 'Invalid order number', 'VALIDATION_ERROR');
    }

    if (!filename || typeof filename !== 'string') {
      return sendErrorResponse(res, 'Filename is required', 'VALIDATION_ERROR');
    }

    // Validate file extension (security: only allow images)
    const allowedExtensions = ['.jpg', '.jpeg', '.png'];
    const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
    if (!allowedExtensions.includes(ext)) {
      return sendErrorResponse(res, 'Invalid file type. Only JPG, JPEG, and PNG are allowed.', 'VALIDATION_ERROR');
    }

    // Validate no path traversal attempts (security)
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return sendErrorResponse(res, 'Invalid filename: path characters not allowed', 'VALIDATION_ERROR');
    }

    // Get order details from repository
    const order = await orderFormRepository.getOrderFolderDetails(orderNumber);

    if (!order) {
      return sendErrorResponse(res, 'Order not found', 'NOT_FOUND');
    }

    // Check if order has a folder
    if (!order.folder_exists || !order.folder_name || order.folder_location === 'none') {
      return sendErrorResponse(res, 'Order has no folder', 'VALIDATION_ERROR');
    }

    // Verify image exists in folder
    const imageExists = orderFolderService.imageExists(
      order.folder_name,
      filename,
      order.folder_location,
      order.is_migrated
    );

    if (!imageExists) {
      return sendErrorResponse(res, 'Image file not found in order folder', 'NOT_FOUND');
    }

    // Validate crop coordinates if provided
    const cropTop = cropCoords?.top ?? 0;
    const cropRight = cropCoords?.right ?? 0;
    const cropBottom = cropCoords?.bottom ?? 0;
    const cropLeft = cropCoords?.left ?? 0;

    // Ensure crop values are non-negative integers
    if (cropTop < 0 || cropRight < 0 || cropBottom < 0 || cropLeft < 0) {
      return sendErrorResponse(res, 'Crop coordinates must be non-negative integers', 'VALIDATION_ERROR');
    }

    // Update job image and crop coordinates via repository
    await orderRepository.updateJobImage(
      order.order_id,
      filename,
      { top: cropTop, right: cropRight, bottom: cropBottom, left: cropLeft }
    );

    const cropInfo = cropTop || cropRight || cropBottom || cropLeft
      ? ` (crop: T${cropTop} R${cropRight} B${cropBottom} L${cropLeft})`
      : ' (no crop)';

    console.log(`[OrderImageController] ✅ Set job image for order #${orderNumber}: ${filename}${cropInfo}`);

    res.json({
      success: true,
      message: 'Job image updated successfully',
      filename
    });

  } catch (error) {
    console.error('[OrderImageController] Error setting job image:', error);
    sendErrorResponse(res, 'Failed to update job image', 'INTERNAL_ERROR');
  }
};
