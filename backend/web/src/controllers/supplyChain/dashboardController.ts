import { Request, Response } from 'express';
import { DashboardService } from '../../services/supplyChain/dashboardService';
import { ProductStandardService } from '../../services/supplyChain/productStandardService';
import { InventoryService } from '../../services/supplyChain/inventoryService';
import { AuthRequest } from '../../types';

/**
 * Dashboard Controller
 * Handles supply chain dashboard statistics and low stock monitoring
 */

export const getDashboardStats = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    if (!user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const result = await DashboardService.getDashboardStats(user);
    res.json(result);
  } catch (error: any) {
    console.error('Error fetching dashboard stats:', error);
    
    if (error.message.includes('Insufficient permissions')) {
      return res.status(403).json({ error: error.message });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard stats'
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