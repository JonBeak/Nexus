import { JobEstimationRepository, EstimateFilters, EstimateData } from '../repositories/jobEstimationRepository';
import { RowDataPacket } from 'mysql2';

export class JobEstimationService {
  private repository: JobEstimationRepository;

  constructor() {
    this.repository = new JobEstimationRepository();
  }

  async getEstimates(filters: EstimateFilters): Promise<RowDataPacket[]> {
    try {
      return await this.repository.getEstimates(filters);
    } catch (error) {
      console.error('Service error fetching estimates:', error);
      throw new Error('Failed to fetch job estimates');
    }
  }

  async getEstimateById(id: number): Promise<any> {
    try {
      const estimate = await this.repository.getEstimateById(id);
      if (!estimate) {
        throw new Error('Job estimate not found');
      }

      // Phase 4/5: No longer loading legacy groups - grid data loaded separately via /grid-data endpoint
      // estimate.groups = []; // Could set empty array, but better to omit entirely

      return estimate;
    } catch (error) {
      console.error('Service error fetching estimate by ID:', error);
      if (error instanceof Error && error.message === 'Job estimate not found') {
        throw error;
      }
      throw new Error('Failed to fetch job estimate');
    }
  }

  async createEstimate(data: EstimateData, userId: number): Promise<any> {
    try {
      // Validate required fields
      if (!data.estimate_name?.trim()) {
        throw new Error('Estimate name is required');
      }

      // Generate job code: CH + YYYYMMDD + counter
      const jobCode = await this.generateJobCode();
      
      const estimateId = await this.repository.createEstimate(data, jobCode, userId);

      return {
        id: estimateId,
        job_code: jobCode,
        customer_id: data.customer_id,
        estimate_name: data.estimate_name
      };
    } catch (error) {
      console.error('Service error creating estimate:', error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to create job estimate');
    }
  }

  async updateEstimate(id: number, data: EstimateData, userId: number): Promise<void> {
    try {
      const success = await this.repository.updateEstimate(id, data, userId);
      if (!success) {
        throw new Error('Job estimate not found');
      }
    } catch (error) {
      console.error('Service error updating estimate:', error);
      if (error instanceof Error && error.message === 'Job estimate not found') {
        throw error;
      }
      throw new Error('Failed to update job estimate');
    }
  }

  async deleteEstimate(id: number): Promise<void> {
    try {
      const success = await this.repository.deleteEstimate(id);
      if (!success) {
        throw new Error('Job estimate not found');
      }
    } catch (error) {
      console.error('Service error deleting estimate:', error);
      if (error instanceof Error && error.message === 'Job estimate not found') {
        throw error;
      }
      throw new Error('Failed to delete job estimate');
    }
  }

  async getProductTypes(category?: string): Promise<RowDataPacket[]> {
    try {
      return await this.repository.getProductTypes(category);
    } catch (error) {
      console.error('Service error fetching product types:', error);
      throw new Error('Failed to fetch product types');
    }
  }


  private async generateJobCode(): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    
    const count = await this.repository.getJobCodeCount(dateStr);
    const counter = (count + 1).toString().padStart(3, '0');
    
    return `CH${dateStr}${counter}`;
  }

  // Business logic for validation and calculations can go here
  validateEstimateData(data: EstimateData): string[] {
    const errors: string[] = [];
    
    if (!data.estimate_name || data.estimate_name.trim().length === 0) {
      errors.push('Estimate name is required');
    }
    
    if (data.estimate_name && data.estimate_name.length > 255) {
      errors.push('Estimate name must be 255 characters or less');
    }
    
    return errors;
  }

  calculateEstimateTotals(estimate: any): any {
    // Future implementation for estimate calculations
    // This would include tax calculations, totals, discounts, etc.
    let subtotal = 0;
    
    if (estimate.groups) {
      estimate.groups.forEach((group: any) => {
        if (group.items) {
          group.items.forEach((item: any) => {
            subtotal += item.extended_price || 0;
          });
        }
        subtotal += group.assembly_cost || 0;
      });
    }
    
    return {
      ...estimate,
      subtotal,
      tax_amount: subtotal * 0.13, // Default 13% tax
      total_amount: subtotal * 1.13
    };
  }
}