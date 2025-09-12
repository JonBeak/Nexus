import { pool } from '../../config/database';
import { RowDataPacket } from 'mysql2';

export interface DashboardStats {
  total_categories: number;
  total_products: number;
  total_inventory_items: number;
  total_available_quantity: number;
  critical_items: number;
  low_items: number;
}

export class DashboardRepository {
  /**
   * Get comprehensive supply chain dashboard statistics
   */
  static async getDashboardStats(): Promise<DashboardStats> {
    const [stats] = await pool.execute<RowDataPacket[]>(
      `SELECT 
        (SELECT COUNT(*) FROM material_categories WHERE is_active = TRUE) as total_categories,
        (SELECT COUNT(*) FROM product_standards WHERE is_active = TRUE) as total_products,
        (SELECT COUNT(*) FROM inventory) as total_inventory_items,
        (SELECT COALESCE(SUM(available_quantity), 0) FROM inventory) as total_available_quantity,
        (SELECT COUNT(*) FROM low_stock_items WHERE stock_status IN ('critical', 'out_of_stock')) as critical_items,
        (SELECT COUNT(*) FROM low_stock_items WHERE stock_status = 'low') as low_items`
    );

    return stats[0] as DashboardStats;
  }
}