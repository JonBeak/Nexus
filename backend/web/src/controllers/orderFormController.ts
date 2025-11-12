/**
 * Order Form Controller
 * HTTP Request Handlers for PDF Form Generation
 *
 * Responsibilities:
 * - Handle HTTP requests for form generation
 * - Validate request parameters
 * - Format responses
 * - Handle errors appropriately
 */

import { Request, Response } from 'express';
import { AuthRequest } from '../types';
import { pdfGenerationService } from '../services/pdf/pdfGenerationService';
import fs from 'fs/promises';
import path from 'path';

/**
 * Generate all order forms
 * POST /api/orders/:orderId/forms
 * Body: { createNewVersion?: boolean }
 * Permission: orders.forms (Manager+)
 */
export const generateOrderForms = async (req: Request, res: Response) => {
  try {
    const { orderNumber } = req.params;
    const { createNewVersion = false } = req.body;
    const authReq = req as AuthRequest;
    const userId = authReq.user?.user_id;

    const orderNumberNum = parseInt(orderNumber);

    if (isNaN(orderNumberNum)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order number'
      });
    }

    // Look up order_id from order_number
    const { pool } = await import('../config/database');
    const [rows] = await pool.execute<any[]>(
      'SELECT order_id FROM orders WHERE order_number = ?',
      [orderNumberNum]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    const orderId = rows[0].order_id;

    // Generate all forms
    const paths = await pdfGenerationService.generateAllForms({
      orderId,
      createNewVersion,
      userId
    });

    res.json({
      success: true,
      data: {
        paths,
        message: createNewVersion
          ? 'New version of order forms generated and previous version archived'
          : 'Order forms generated successfully'
      }
    });
  } catch (error) {
    console.error('Error generating order forms:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to generate order forms'
    });
  }
};

/**
 * Download specific form
 * GET /api/orders/:orderId/forms/:formType
 * formType: 'master' | 'shop' | 'customer' | 'packing'
 * Permission: orders.forms (Manager+)
 */
export const downloadOrderForm = async (req: Request, res: Response) => {
  try {
    const { orderNumber, formType } = req.params;
    const { version } = req.query;

    const orderNumberNum = parseInt(orderNumber);

    if (isNaN(orderNumberNum)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order number'
      });
    }

    // Look up order_id from order_number
    const { pool } = await import('../config/database');
    const [rows] = await pool.execute<any[]>(
      'SELECT order_id FROM orders WHERE order_number = ?',
      [orderNumberNum]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    const orderId = rows[0].order_id;

    // Validate form type
    const validFormTypes = ['master', 'shop', 'customer', 'packing'];
    if (!validFormTypes.includes(formType)) {
      return res.status(400).json({
        success: false,
        message: `Invalid form type. Must be one of: ${validFormTypes.join(', ')}`
      });
    }

    // Get form paths from database
    const versionNum = version ? parseInt(version as string) : undefined;
    const paths = await pdfGenerationService.getFormPaths(orderId, versionNum);

    if (!paths) {
      return res.status(404).json({
        success: false,
        message: 'Order forms not found. Please generate forms first.'
      });
    }

    // Map form type to path
    const formPathMap: { [key: string]: string } = {
      'master': paths.masterForm,
      'shop': paths.shopForm,
      'customer': paths.customerForm,
      'packing': paths.packingList
    };

    const filePath = formPathMap[formType];

    if (!filePath) {
      return res.status(404).json({
        success: false,
        message: 'Form path not found in database'
      });
    }

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch {
      return res.status(404).json({
        success: false,
        message: 'Form file not found on disk. It may have been deleted.'
      });
    }

    // Send file
    const fileName = path.basename(filePath);
    res.download(filePath, fileName, (err) => {
      if (err) {
        console.error('Error downloading file:', err);
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            message: 'Failed to download form'
          });
        }
      }
    });
  } catch (error) {
    console.error('Error downloading order form:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to download order form'
    });
  }
};

/**
 * Get form paths for an order
 * GET /api/orders/:orderId/forms
 * Query params: version (optional)
 * Permission: orders.view (All roles)
 */
export const getFormPaths = async (req: Request, res: Response) => {
  try {
    const { orderNumber } = req.params;
    const { version } = req.query;

    const orderNumberNum = parseInt(orderNumber);

    if (isNaN(orderNumberNum)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order number'
      });
    }

    // Look up order_id from order_number
    const { pool } = await import('../config/database');
    const [rows] = await pool.execute<any[]>(
      'SELECT order_id FROM orders WHERE order_number = ?',
      [orderNumberNum]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    const orderId = rows[0].order_id;

    const versionNum = version ? parseInt(version as string) : undefined;
    const paths = await pdfGenerationService.getFormPaths(orderId, versionNum);

    if (!paths) {
      return res.status(404).json({
        success: false,
        message: 'Order forms not found. Please generate forms first.',
        data: null
      });
    }

    // Check which files actually exist
    const fileExistence = await Promise.all([
      fs.access(paths.masterForm).then(() => true).catch(() => false),
      fs.access(paths.shopForm).then(() => true).catch(() => false),
      fs.access(paths.customerForm).then(() => true).catch(() => false),
      fs.access(paths.packingList).then(() => true).catch(() => false)
    ]);

    res.json({
      success: true,
      data: {
        paths,
        filesExist: {
          masterForm: fileExistence[0],
          shopForm: fileExistence[1],
          customerForm: fileExistence[2],
          packingList: fileExistence[3]
        }
      }
    });
  } catch (error) {
    console.error('Error getting form paths:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get form paths'
    });
  }
};

/**
 * Check if forms exist for an order
 * GET /api/orders/:orderId/forms/exists
 * Permission: orders.view (All roles)
 */
export const checkFormsExist = async (req: Request, res: Response) => {
  try {
    const { orderNumber } = req.params;
    const orderNumberNum = parseInt(orderNumber);

    if (isNaN(orderNumberNum)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order number'
      });
    }

    // Look up order_id from order_number
    const { pool } = await import('../config/database');
    const [rows] = await pool.execute<any[]>(
      'SELECT order_id FROM orders WHERE order_number = ?',
      [orderNumberNum]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    const orderId = rows[0].order_id;

    const exists = await pdfGenerationService.formsExist(orderId);

    res.json({
      success: true,
      data: {
        exists
      }
    });
  } catch (error) {
    console.error('Error checking if forms exist:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to check form existence'
    });
  }
};
