import { SupplyChainPermissions } from '../../utils/supplyChain/permissions';
import { User } from '../../types';
import { DashboardRepository } from '../../repositories/supplyChain/dashboardRepository';

export class DashboardService {
  /**
   * Get supply chain dashboard statistics
   */
  static async getDashboardStats(user: User) {
    // Check view permission
    const canView = await SupplyChainPermissions.canViewSupplyChainHybrid(user);
    if (!canView) {
      throw new Error('Insufficient permissions to view supply chain dashboard');
    }

    const stats = await DashboardRepository.getDashboardStats();
    return { success: true, data: stats };
  }
}