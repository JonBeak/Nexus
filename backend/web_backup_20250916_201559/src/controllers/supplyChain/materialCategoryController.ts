import { Request, Response } from 'express';
import { MaterialCategoryService } from '../../services/supplyChain/materialCategoryService';
import { AuthRequest } from '../../types';

/**
 * Material Categories Controller
 * Handles CRUD operations for material categories and their fields
 */

// Material Categories
export const getCategories = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    if (!user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const result = await MaterialCategoryService.getAllCategories(user);
    res.json(result);
  } catch (error: any) {
    console.error('Error fetching categories:', error);
    
    if (error.message.includes('Insufficient permissions')) {
      return res.status(403).json({ error: error.message });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to fetch categories'
    });
  }
};

export const createCategory = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    if (!user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const result = await MaterialCategoryService.createCategory(user, req.body);
    res.status(201).json(result);
  } catch (error: any) {
    console.error('Error creating category:', error);
    
    if (error.message.includes('Insufficient permissions')) {
      return res.status(403).json({ error: error.message });
    }
    
    if (error.message.includes('required') || error.message.includes('already exists')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to create category'
    });
  }
};

export const updateCategory = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    if (!user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { id } = req.params;
    const result = await MaterialCategoryService.updateCategory(user, parseInt(id), req.body);
    res.json(result);
  } catch (error: any) {
    console.error('Error updating category:', error);
    
    if (error.message.includes('Insufficient permissions')) {
      return res.status(403).json({ error: error.message });
    }
    
    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }
    
    if (error.message.includes('already exists')) {
      return res.status(409).json({
        success: false,
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to update category'
    });
  }
};

export const deleteCategory = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    if (!user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { id } = req.params;
    const result = await MaterialCategoryService.deleteCategory(user, parseInt(id));
    res.json(result);
  } catch (error: any) {
    console.error('Error deleting category:', error);
    
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
      message: 'Failed to delete category'
    });
  }
};

// Category Fields
export const getCategoryFields = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    if (!user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { categoryId } = req.params;
    const result = await MaterialCategoryService.getCategoryFields(user, parseInt(categoryId));
    res.json(result);
  } catch (error: any) {
    console.error('Error fetching category fields:', error);
    
    if (error.message.includes('Insufficient permissions')) {
      return res.status(403).json({ error: error.message });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to fetch category fields'
    });
  }
};

export const createCategoryField = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    if (!user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { categoryId } = req.params;
    const result = await MaterialCategoryService.createCategoryField(user, parseInt(categoryId), req.body);
    res.status(201).json(result);
  } catch (error: any) {
    console.error('Error creating category field:', error);
    
    if (error.message.includes('Insufficient permissions')) {
      return res.status(403).json({ error: error.message });
    }
    
    if (error.message.includes('required') || error.message.includes('already exists')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to create category field'
    });
  }
};

export const updateCategoryField = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    if (!user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { categoryId, fieldId } = req.params;
    const result = await MaterialCategoryService.updateCategoryField(
      user, 
      parseInt(categoryId), 
      parseInt(fieldId), 
      req.body
    );
    res.json(result);
  } catch (error: any) {
    console.error('Error updating category field:', error);
    
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
      message: 'Failed to update category field'
    });
  }
};

export const deleteCategoryField = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    if (!user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { categoryId, fieldId } = req.params;
    const result = await MaterialCategoryService.deleteCategoryField(
      user, 
      parseInt(categoryId), 
      parseInt(fieldId)
    );
    res.json(result);
  } catch (error: any) {
    console.error('Error deleting category field:', error);
    
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
      message: 'Failed to delete category field'
    });
  }
};