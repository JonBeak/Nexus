import { Request, Response } from 'express';
import { InventoryService } from '../../services/supplyChain/inventoryService';
import { AuthRequest } from '../../types';

/**
 * Inventory Controller
 * Handles inventory management and low stock monitoring
 */

export const getInventory = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    if (!user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const filters = {
      category_id: req.query.category_id ? Number(req.query.category_id) : undefined,
      location: req.query.location as string,
      low_stock: req.query.low_stock === 'true'
    };

    const result = await InventoryService.getInventory(user, filters);
    res.json(result);
  } catch (error: any) {
    console.error('Error fetching inventory:', error);
    
    if (error.message.includes('Insufficient permissions')) {
      return res.status(403).json({ error: error.message });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to fetch inventory'
    });
  }
};

export const getInventoryAvailability = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    if (!user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { productStandardId } = req.params;
    const result = await InventoryService.getInventoryAvailability(user, parseInt(productStandardId));
    res.json(result);
  } catch (error: any) {
    console.error('Error fetching inventory availability:', error);
    
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
      message: 'Failed to fetch inventory availability'
    });
  }
};

export const createInventoryItem = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    if (!user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const result = await InventoryService.createInventoryItem(user, req.body);
    res.status(201).json(result);
  } catch (error: any) {
    console.error('Error creating inventory item:', error);
    
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
      message: 'Failed to create inventory item'
    });
  }
};

export const updateInventoryItem = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    if (!user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { id } = req.params;
    const result = await InventoryService.updateInventoryItem(user, parseInt(id), req.body);
    res.json(result);
  } catch (error: any) {
    console.error('Error updating inventory item:', error);
    
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
      message: 'Failed to update inventory item'
    });
  }
};

export const deleteInventoryItem = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    if (!user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { id } = req.params;
    const result = await InventoryService.deleteInventoryItem(user, parseInt(id));
    res.json(result);
  } catch (error: any) {
    console.error('Error deleting inventory item:', error);
    
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
      message: 'Failed to delete inventory item'
    });
  }
};

export const getLowStockItems = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    if (!user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const filters = {
      category_id: req.query.category_id ? Number(req.query.category_id) : undefined
    };

    const result = await InventoryService.getLowStockItems(user, filters);
    res.json(result);
  } catch (error: any) {
    console.error('Error fetching low stock items:', error);
    
    if (error.message.includes('Insufficient permissions')) {
      return res.status(403).json({ error: error.message });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to fetch low stock items'
    });
  }
};