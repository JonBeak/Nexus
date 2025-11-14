// File Clean up Finished: Nov 14, 2025
// Changes:
//   - Removed 5 legacy CRUD methods (getEstimates, getEstimateById, createEstimate, updateEstimate, deleteEstimate)
//   - Removed 3 helper methods (generateJobCode, validateEstimateData, calculateEstimateTotals)
//   - Removed unused imports (EstimateFilters, EstimateData)
//   - Kept only: getProductTypes (still needed by controller for template system)
//   - Reduced from 155 lines to ~20 lines (87% reduction)
//
// This service now only supports product type retrieval for dynamic form generation
// All estimate operations moved to new EstimateVersioningService

import { JobEstimationRepository } from '../repositories/jobEstimationRepository';
import { RowDataPacket } from 'mysql2';

export class JobEstimationService {
  private repository: JobEstimationRepository;

  constructor() {
    this.repository = new JobEstimationRepository();
  }

  async getProductTypes(category?: string): Promise<RowDataPacket[]> {
    try {
      return await this.repository.getProductTypes(category);
    } catch (error) {
      console.error('Service error fetching product types:', error);
      throw new Error('Failed to fetch product types');
    }
  }
}