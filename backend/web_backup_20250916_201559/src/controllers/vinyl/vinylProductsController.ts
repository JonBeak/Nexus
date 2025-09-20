/**
 * Vinyl Products Controller
 * HTTP layer for vinyl products catalog management
 */

import { Request, Response } from 'express';
import { VinylProductsService } from '../../services/vinyl/vinylProductsService';
import { AuthRequest } from '../../types';
import {
  VinylProductsFilters,
  CreateVinylProductRequest,
  UpdateVinylProductRequest
} from '../../types/vinyl';

/**
 * Get all vinyl products with optional filters
 */
export const getVinylProducts = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    if (!user) {
      return res.status(401).json({ success: false, error: 'User not authenticated' });
    }

    const filters: VinylProductsFilters = {
      search: req.query.search as string,
      brand: req.query.brand as string,
      series: req.query.series as string,
      is_active: req.query.is_active ? req.query.is_active === 'true' : undefined,
      has_inventory: req.query.has_inventory ? req.query.has_inventory === 'true' : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset as string) : undefined
    };

    const result = await VinylProductsService.getVinylProducts(user, filters);

    if (result.success) {
      res.json(result.data);
    } else {
      res.status(500).json({
        success: false,
        error: result.error,
        code: result.code
      });
    }
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch vinyl products',
      details: error.message
    });
  }
};

/**
 * Get single vinyl product by ID
 */
export const getVinylProductById = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    if (!user) {
      return res.status(401).json({ success: false, error: 'User not authenticated' });
    }

    const productId = parseInt(req.params.id);
    if (isNaN(productId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid product ID'
      });
    }

    const result = await VinylProductsService.getVinylProductById(user, productId);

    if (result.success) {
      res.json(result.data);
    } else {
      const statusCode = result.code === 'PRODUCT_NOT_FOUND' ? 404 : 500;
      res.status(statusCode).json({
        success: false,
        error: result.error,
        code: result.code
      });
    }
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch vinyl product',
      details: error.message
    });
  }
};

/**
 * Create new vinyl product
 */
export const createVinylProduct = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    if (!user) {
      return res.status(401).json({ success: false, error: 'User not authenticated' });
    }

    const data: CreateVinylProductRequest = req.body;
    const result = await VinylProductsService.createVinylProduct(user, data);

    if (result.success) {
      res.status(201).json({
        success: true,
        data: result.data
      });
    } else {
      const statusCode = result.code === 'VALIDATION_ERROR' ? 400 :
                        result.code === 'DUPLICATE_PRODUCT' ? 409 : 500;
      res.status(statusCode).json({
        success: false,
        error: result.error,
        code: result.code
      });
    }
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to create vinyl product',
      details: error.message
    });
  }
};

/**
 * Update vinyl product
 */
export const updateVinylProduct = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    if (!user) {
      return res.status(401).json({ success: false, error: 'User not authenticated' });
    }

    const productId = parseInt(req.params.id);
    if (isNaN(productId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid product ID'
      });
    }

    const data: UpdateVinylProductRequest = req.body;
    const result = await VinylProductsService.updateVinylProduct(user, productId, data);

    if (result.success) {
      res.json({
        success: true,
        data: result.data
      });
    } else {
      const statusCode = result.code === 'PRODUCT_NOT_FOUND' ? 404 :
                        result.code === 'VALIDATION_ERROR' ? 400 :
                        result.code === 'DUPLICATE_PRODUCT' ? 409 : 500;
      res.status(statusCode).json({
        success: false,
        error: result.error,
        code: result.code
      });
    }
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to update vinyl product',
      details: error.message
    });
  }
};

/**
 * Delete vinyl product (soft delete)
 */
export const deleteVinylProduct = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    if (!user) {
      return res.status(401).json({ success: false, error: 'User not authenticated' });
    }

    const productId = parseInt(req.params.id);
    if (isNaN(productId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid product ID'
      });
    }

    const result = await VinylProductsService.deleteVinylProduct(user, productId);

    if (result.success) {
      res.json({
        success: true,
        data: result.data
      });
    } else {
      const statusCode = result.code === 'PRODUCT_NOT_FOUND' ? 404 : 500;
      res.status(statusCode).json({
        success: false,
        error: result.error,
        code: result.code
      });
    }
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to delete vinyl product',
      details: error.message
    });
  }
};

/**
 * Get vinyl product statistics
 */
export const getVinylProductStats = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    if (!user) {
      return res.status(401).json({ success: false, error: 'User not authenticated' });
    }

    const result = await VinylProductsService.getVinylProductStats(user);

    if (result.success) {
      res.json(result.data);
    } else {
      res.status(500).json({
        success: false,
        error: result.error,
        code: result.code
      });
    }
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch vinyl product statistics',
      details: error.message
    });
  }
};

/**
 * Get autofill suggestions for product forms
 */
export const getAutofillSuggestions = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    if (!user) {
      return res.status(401).json({ success: false, error: 'User not authenticated' });
    }

    const result = await VinylProductsService.getAutofillSuggestions(user);

    if (result.success) {
      res.json(result.data);
    } else {
      res.status(500).json({
        success: false,
        error: result.error,
        code: result.code
      });
    }
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch autofill suggestions',
      details: error.message
    });
  }
};

/**
 * Get active products only
 */
export const getActiveProducts = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    if (!user) {
      return res.status(401).json({ success: false, error: 'User not authenticated' });
    }

    const result = await VinylProductsService.getActiveProducts(user);

    if (result.success) {
      res.json(result.data);
    } else {
      res.status(500).json({
        success: false,
        error: result.error,
        code: result.code
      });
    }
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch active products',
      details: error.message
    });
  }
};

/**
 * Search products
 */
export const searchProducts = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    if (!user) {
      return res.status(401).json({ success: false, error: 'User not authenticated' });
    }

    const searchTerm = req.query.q as string;
    if (!searchTerm || searchTerm.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Search term is required'
      });
    }

    const activeOnly = req.query.active_only === 'true';
    const result = await VinylProductsService.searchProducts(user, searchTerm, { activeOnly });

    if (result.success) {
      res.json(result.data);
    } else {
      res.status(500).json({
        success: false,
        error: result.error,
        code: result.code
      });
    }
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to search products',
      details: error.message
    });
  }
};

/**
 * Toggle product active status
 */
export const toggleProductStatus = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    if (!user) {
      return res.status(401).json({ success: false, error: 'User not authenticated' });
    }

    const productId = parseInt(req.params.id);
    if (isNaN(productId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid product ID'
      });
    }

    const result = await VinylProductsService.toggleProductStatus(user, productId);

    if (result.success) {
      res.json({
        success: true,
        data: result.data
      });
    } else {
      const statusCode = result.code === 'PRODUCT_NOT_FOUND' ? 404 : 500;
      res.status(statusCode).json({
        success: false,
        error: result.error,
        code: result.code
      });
    }
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to toggle product status',
      details: error.message
    });
  }
};

/**
 * Get products by brand
 */
export const getProductsByBrand = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    if (!user) {
      return res.status(401).json({ success: false, error: 'User not authenticated' });
    }

    const brand = req.params.brand;
    if (!brand || brand.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Brand is required'
      });
    }

    const result = await VinylProductsService.getProductsByBrand(user, brand);

    if (result.success) {
      res.json(result.data);
    } else {
      res.status(500).json({
        success: false,
        error: result.error,
        code: result.code
      });
    }
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch products by brand',
      details: error.message
    });
  }
};

/**
 * Bulk update products
 */
export const bulkUpdateProducts = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    if (!user) {
      return res.status(401).json({ success: false, error: 'User not authenticated' });
    }

    const { updates } = req.body;
    if (!Array.isArray(updates)) {
      return res.status(400).json({
        success: false,
        error: 'updates must be an array'
      });
    }

    const result = await VinylProductsService.bulkUpdateProducts(user, updates);

    if (result.success) {
      res.json({
        success: true,
        data: result.data
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error,
        code: result.code
      });
    }
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to bulk update products',
      details: error.message
    });
  }
};

/**
 * Sync product from inventory
 */
export const syncProductFromInventory = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    if (!user) {
      return res.status(401).json({ success: false, error: 'User not authenticated' });
    }

    const inventoryData = req.body;
    if (!inventoryData.brand || !inventoryData.series) {
      return res.status(400).json({
        success: false,
        error: 'Brand and series are required'
      });
    }

    const result = await VinylProductsService.syncProductFromInventory(user, inventoryData);

    if (result.success) {
      res.json({
        success: true,
        data: result.data
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error,
        code: result.code
      });
    }
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to sync product from inventory',
      details: error.message
    });
  }
};