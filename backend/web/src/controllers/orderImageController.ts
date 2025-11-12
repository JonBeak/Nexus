/**
 * Order Image Controller
 * HTTP Request Handlers for Order Image Management (Phase 1.5.g)
 *
 * Endpoints:
 * - GET /api/orders/:orderNumber/available-images - List images in order folder
 * - PATCH /api/orders/:orderNumber/job-image - Select job image
 */

import { Request, Response } from 'express';
import { pool } from '../config/database';
import { orderFolderService } from '../services/orderFolderService';

/**
 * Get available images for an order
 * GET /api/orders/:orderNumber/available-images
 * Permission: orders.view (All roles)
 *
 * Returns list of JPG/JPEG/PNG files in order's folder
 */
export const getAvailableImages = async (req: Request, res: Response) => {
  try {
    const orderNumber = parseInt(req.params.orderNumber);

    if (isNaN(orderNumber)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order number'
      });
    }

    // Get order details
    const [orderRows] = await pool.execute<any[]>(
      `SELECT order_id, folder_name, folder_exists, folder_location, is_migrated
       FROM orders
       WHERE order_number = ?`,
      [orderNumber]
    );

    if (orderRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    const order = orderRows[0];

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
    res.status(500).json({
      success: false,
      message: 'Failed to list images'
    });
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
    const orderNumber = parseInt(req.params.orderNumber);
    const { filename, cropCoords } = req.body;

    // Validation
    if (isNaN(orderNumber)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order number'
      });
    }

    if (!filename || typeof filename !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Filename is required'
      });
    }

    // Validate file extension (security: only allow images)
    const allowedExtensions = ['.jpg', '.jpeg', '.png'];
    const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
    if (!allowedExtensions.includes(ext)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid file type. Only JPG, JPEG, and PNG are allowed.'
      });
    }

    // Validate no path traversal attempts (security)
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({
        success: false,
        message: 'Invalid filename: path characters not allowed'
      });
    }

    // Get order details
    const [orderRows] = await pool.execute<any[]>(
      `SELECT order_id, folder_name, folder_exists, folder_location, is_migrated
       FROM orders
       WHERE order_number = ?`,
      [orderNumber]
    );

    if (orderRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    const order = orderRows[0];

    // Check if order has a folder
    if (!order.folder_exists || !order.folder_name || order.folder_location === 'none') {
      return res.status(400).json({
        success: false,
        message: 'Order has no folder'
      });
    }

    // Verify image exists in folder
    const imageExists = orderFolderService.imageExists(
      order.folder_name,
      filename,
      order.folder_location,
      order.is_migrated
    );

    if (!imageExists) {
      return res.status(404).json({
        success: false,
        message: 'Image file not found in order folder'
      });
    }

    // Validate crop coordinates if provided
    const cropTop = cropCoords?.top ?? 0;
    const cropRight = cropCoords?.right ?? 0;
    const cropBottom = cropCoords?.bottom ?? 0;
    const cropLeft = cropCoords?.left ?? 0;

    // Ensure crop values are non-negative integers
    if (cropTop < 0 || cropRight < 0 || cropBottom < 0 || cropLeft < 0) {
      return res.status(400).json({
        success: false,
        message: 'Crop coordinates must be non-negative integers'
      });
    }

    // Update sign_image_path and crop coordinates in database
    await pool.execute(
      `UPDATE orders
       SET sign_image_path = ?,
           crop_top = ?,
           crop_right = ?,
           crop_bottom = ?,
           crop_left = ?
       WHERE order_id = ?`,
      [filename, cropTop, cropRight, cropBottom, cropLeft, order.order_id]
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
    res.status(500).json({
      success: false,
      message: 'Failed to update job image'
    });
  }
};
