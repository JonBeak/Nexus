import { Request, Response } from 'express';
import { ProductStandardService } from '../../services/supplyChain/productStandardService';
import { AuthRequest } from '../../types';

/**
 * Product Standards Controller
 * Handles CRUD operations for product standards and reorder settings
 */

export const getProductStandards = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    if (!user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const filters = {
      category_id: req.query.category_id ? Number(req.query.category_id) : undefined,
      supplier_id: req.query.supplier_id ? Number(req.query.supplier_id) : undefined,
      search: req.query.search as string
    };

    const result = await ProductStandardService.getProductStandards(user, filters);
    res.json(result);
  } catch (error: any) {
    console.error('Error fetching product standards:', error);
    
    if (error.message.includes('Insufficient permissions')) {
      return res.status(403).json({ error: error.message });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to fetch product standards'
    });
  }
};

export const getProductStandardById = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    if (!user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { id } = req.params;
    const result = await ProductStandardService.getProductStandardById(user, parseInt(id));
    res.json(result);
  } catch (error: any) {
    console.error('Error fetching product standard:', error);
    
    if (error.message.includes('Insufficient permissions')) {
      return res.status(403).json({ error: error.message });
    }
    
    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to fetch product standard'
    });
  }
};

export const createProductStandard = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    if (!user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const result = await ProductStandardService.createProductStandard(user, req.body);
    res.status(201).json(result);
  } catch (error: any) {
    console.error('Error creating product standard:', error);
    
    if (error.message.includes('Insufficient permissions')) {
      return res.status(403).json({ error: error.message });
    }
    
    if (error.message.includes('required')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to create product standard'
    });
  }
};

export const updateProductStandard = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    if (!user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { id } = req.params;
    const result = await ProductStandardService.updateProductStandard(user, parseInt(id), req.body);
    res.json(result);
  } catch (error: any) {
    console.error('Error updating product standard:', error);
    
    if (error.message.includes('Insufficient permissions')) {
      return res.status(403).json({ error: error.message });
    }
    
    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to update product standard'
    });
  }
};

export const deleteProductStandard = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    if (!user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { id } = req.params;
    const result = await ProductStandardService.deleteProductStandard(user, parseInt(id));
    res.json(result);
  } catch (error: any) {
    console.error('Error deleting product standard:', error);
    
    if (error.message.includes('Insufficient permissions')) {
      return res.status(403).json({ error: error.message });
    }
    
    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }
    
    if (error.message.includes('Cannot delete')) {
      return res.status(409).json({
        success: false,
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to delete product standard'
    });
  }
};

export const updateReorderSettings = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    if (!user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { id } = req.params;
    const result = await ProductStandardService.updateReorderSettings(user, parseInt(id), req.body);
    res.json(result);
  } catch (error: any) {
    console.error('Error updating reorder settings:', error);
    
    if (error.message.includes('Insufficient permissions')) {
      return res.status(403).json({ error: error.message });
    }
    
    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to update reorder settings'
    });
  }
};