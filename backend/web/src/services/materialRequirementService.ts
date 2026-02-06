/**
 * Material Requirements Service
 * Business logic, validation, and coordination for material requirements
 * Created: 2025-01-27
 *
 * Note: Hold management methods are in MaterialRequirementHoldsService
 */

import {
  MaterialRequirementRepository,
  MaterialRequirementRow,
} from '../repositories/materialRequirementRepository';
import { ServiceResult } from '../types/serviceResults';
import {
  MaterialRequirement,
  MaterialRequirementStatus,
  MaterialRequirementSearchParams,
  CreateMaterialRequirementRequest,
  UpdateMaterialRequirementRequest,
  ReceiveQuantityRequest,
  BulkReceiveRequest,
  ActionableMaterialRequirement,
} from '../types/materialRequirements';
import { getLocalDateString } from '../utils/dateUtils';

export class MaterialRequirementService {
  private repository: MaterialRequirementRepository;

  constructor() {
    this.repository = new MaterialRequirementRepository();
  }

  /**
   * Get all material requirements with optional filtering
   */
  async getMaterialRequirements(
    params: MaterialRequirementSearchParams
  ): Promise<ServiceResult<MaterialRequirementRow[]>> {
    try {
      const requirements = await this.repository.findAll(params);
      return { success: true, data: requirements };
    } catch (error) {
      console.error('Error in MaterialRequirementService.getMaterialRequirements:', error);
      return {
        success: false,
        error: 'Failed to fetch material requirements',
        code: 'FETCH_ERROR',
      };
    }
  }

  /**
   * Get actionable requirements for Overview (pending/backordered)
   */
  async getActionableRequirements(): Promise<
    ServiceResult<{
      pending: ActionableMaterialRequirement[];
      backordered: ActionableMaterialRequirement[];
      total_pending: number;
      total_backordered: number;
    }>
  > {
    try {
      const requirements = await this.repository.findActionable();
      const today = new Date();

      // Separate by status and calculate days pending
      const pending: ActionableMaterialRequirement[] = [];
      const backordered: ActionableMaterialRequirement[] = [];

      requirements.forEach((req) => {
        const entryDate = new Date(req.entry_date);
        const daysPending = Math.floor(
          (today.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        const enrichedReq: ActionableMaterialRequirement = {
          ...req,
          days_pending: daysPending,
          priority_score: daysPending + (req.is_stock_item ? 0 : 10), // Order items prioritized
        };

        if (req.status === 'pending') {
          pending.push(enrichedReq);
        } else if (req.status === 'backordered') {
          backordered.push(enrichedReq);
        }
      });

      // Sort by priority score (higher = more urgent)
      pending.sort((a, b) => (b.priority_score ?? 0) - (a.priority_score ?? 0));
      backordered.sort((a, b) => (b.priority_score ?? 0) - (a.priority_score ?? 0));

      return {
        success: true,
        data: {
          pending,
          backordered,
          total_pending: pending.length,
          total_backordered: backordered.length,
        },
      };
    } catch (error) {
      console.error('Error in MaterialRequirementService.getActionableRequirements:', error);
      return {
        success: false,
        error: 'Failed to fetch actionable requirements',
        code: 'FETCH_ERROR',
      };
    }
  }

  /**
   * Get requirements for a specific order
   */
  async getRequirementsByOrderId(
    orderId: number
  ): Promise<ServiceResult<MaterialRequirementRow[]>> {
    try {
      if (!orderId || orderId <= 0) {
        return {
          success: false,
          error: 'Valid order ID is required',
          code: 'VALIDATION_ERROR',
        };
      }

      const requirements = await this.repository.findByOrderId(orderId);
      return { success: true, data: requirements };
    } catch (error) {
      console.error('Error in MaterialRequirementService.getRequirementsByOrderId:', error);
      return {
        success: false,
        error: 'Failed to fetch requirements for order',
        code: 'FETCH_ERROR',
      };
    }
  }

  /**
   * Get single requirement by ID
   */
  async getRequirementById(id: number): Promise<ServiceResult<MaterialRequirementRow>> {
    try {
      const requirement = await this.repository.findById(id);

      if (!requirement) {
        return {
          success: false,
          error: 'Material requirement not found',
          code: 'NOT_FOUND',
        };
      }

      return { success: true, data: requirement };
    } catch (error) {
      console.error('Error in MaterialRequirementService.getRequirementById:', error);
      return {
        success: false,
        error: 'Failed to fetch material requirement',
        code: 'FETCH_ERROR',
      };
    }
  }

  /**
   * Create new material requirement
   */
  async createRequirement(
    data: CreateMaterialRequirementRequest,
    userId?: number
  ): Promise<ServiceResult<number>> {
    try {
      // Validate quantity
      if (data.quantity_ordered === undefined || data.quantity_ordered < 0) {
        return {
          success: false,
          error: 'Quantity must be 0 or greater',
          code: 'VALIDATION_ERROR',
        };
      }

      // Validate that either order_id or is_stock_item is set
      if (!data.order_id && !data.is_stock_item) {
        return {
          success: false,
          error: 'Either order_id or is_stock_item must be specified',
          code: 'VALIDATION_ERROR',
        };
      }

      // Validate product identification (at least one should be set unless it's a "nothing to order" entry)
      if (
        data.quantity_ordered > 0 &&
        !data.archetype_id &&
        !data.custom_product_type
      ) {
        return {
          success: false,
          error: 'Product type (archetype or custom) is required for non-zero quantities',
          code: 'VALIDATION_ERROR',
        };
      }

      const requirementId = await this.repository.create(data, userId);

      return { success: true, data: requirementId };
    } catch (error) {
      console.error('Error in MaterialRequirementService.createRequirement:', error);
      return {
        success: false,
        error: 'Failed to create material requirement',
        code: 'CREATE_ERROR',
      };
    }
  }

  /**
   * Update material requirement
   */
  async updateRequirement(
    id: number,
    data: UpdateMaterialRequirementRequest,
    userId?: number
  ): Promise<ServiceResult<void>> {
    try {
      // Verify requirement exists
      const existing = await this.repository.findById(id);
      if (!existing) {
        return {
          success: false,
          error: 'Material requirement not found',
          code: 'NOT_FOUND',
        };
      }

      // Validate quantity if being updated
      if (data.quantity_ordered !== undefined && data.quantity_ordered < 0) {
        return {
          success: false,
          error: 'Quantity must be 0 or greater',
          code: 'VALIDATION_ERROR',
        };
      }

      // Prevent invalid status transitions
      if (data.status) {
        const validTransitions = this.getValidStatusTransitions(existing.status);
        if (!validTransitions.includes(data.status)) {
          return {
            success: false,
            error: `Cannot transition from ${existing.status} to ${data.status}`,
            code: 'VALIDATION_ERROR',
          };
        }
      }

      await this.repository.update(id, data, userId);

      return { success: true, data: undefined };
    } catch (error) {
      console.error('Error in MaterialRequirementService.updateRequirement:', error);
      return {
        success: false,
        error: 'Failed to update material requirement',
        code: 'UPDATE_ERROR',
      };
    }
  }

  /**
   * Receive quantity for a requirement (partial receipt support)
   */
  async receiveQuantity(
    id: number,
    data: ReceiveQuantityRequest,
    userId?: number
  ): Promise<
    ServiceResult<{
      requirement_id: number;
      new_quantity_received: number;
      status: MaterialRequirementStatus;
      fully_received: boolean;
    }>
  > {
    try {
      // Verify requirement exists
      const existing = await this.repository.findById(id);
      if (!existing) {
        return {
          success: false,
          error: 'Material requirement not found',
          code: 'NOT_FOUND',
        };
      }

      // Validate quantity
      if (data.quantity <= 0) {
        return {
          success: false,
          error: 'Quantity to receive must be greater than 0',
          code: 'VALIDATION_ERROR',
        };
      }

      // Check status allows receiving
      if (!['pending', 'ordered', 'backordered', 'partial_received'].includes(existing.status)) {
        return {
          success: false,
          error: `Cannot receive items with status: ${existing.status}`,
          code: 'VALIDATION_ERROR',
        };
      }

      const receivedDate = data.received_date || new Date();
      const result = await this.repository.receiveQuantity(id, data.quantity, receivedDate, userId);

      // Update notes if provided
      if (data.notes) {
        const existingNotes = existing.notes || '';
        const todayStr = getLocalDateString();
        const newNotes = existingNotes
          ? `${existingNotes}\n[${todayStr}] Received ${data.quantity}: ${data.notes}`
          : `[${todayStr}] Received ${data.quantity}: ${data.notes}`;
        await this.repository.update(id, { notes: newNotes }, userId);
      }

      return {
        success: true,
        data: {
          requirement_id: id,
          new_quantity_received: result.newQuantityReceived,
          status: result.status,
          fully_received: result.status === 'received',
        },
      };
    } catch (error) {
      console.error('Error in MaterialRequirementService.receiveQuantity:', error);
      return {
        success: false,
        error: 'Failed to receive quantity',
        code: 'RECEIVE_ERROR',
      };
    }
  }

  /**
   * Bulk receive multiple requirements
   */
  async bulkReceive(
    data: BulkReceiveRequest,
    userId?: number
  ): Promise<
    ServiceResult<{
      updated_count: number;
      items: Array<{
        requirement_id: number;
        new_quantity_received: number;
        status: MaterialRequirementStatus;
      }>;
    }>
  > {
    try {
      if (!data.items || data.items.length === 0) {
        return {
          success: false,
          error: 'At least one item is required',
          code: 'VALIDATION_ERROR',
        };
      }

      const receivedDate = data.received_date || new Date();
      const results: Array<{
        requirement_id: number;
        new_quantity_received: number;
        status: MaterialRequirementStatus;
      }> = [];

      for (const item of data.items) {
        try {
          const result = await this.repository.receiveQuantity(
            item.requirement_id,
            item.quantity,
            receivedDate,
            userId
          );
          results.push({
            requirement_id: item.requirement_id,
            new_quantity_received: result.newQuantityReceived,
            status: result.status,
          });
        } catch (err) {
          console.error(`Failed to receive requirement ${item.requirement_id}:`, err);
          // Continue with other items
        }
      }

      return {
        success: true,
        data: {
          updated_count: results.length,
          items: results,
        },
      };
    } catch (error) {
      console.error('Error in MaterialRequirementService.bulkReceive:', error);
      return {
        success: false,
        error: 'Failed to bulk receive',
        code: 'BULK_RECEIVE_ERROR',
      };
    }
  }

  /**
   * Add requirements to shopping cart
   */
  async addToCart(
    requirementIds: number[],
    cartId: string,
    userId?: number
  ): Promise<ServiceResult<{ updated_count: number }>> {
    try {
      if (!requirementIds || requirementIds.length === 0) {
        return {
          success: false,
          error: 'At least one requirement ID is required',
          code: 'VALIDATION_ERROR',
        };
      }

      if (!cartId) {
        return {
          success: false,
          error: 'Cart ID is required',
          code: 'VALIDATION_ERROR',
        };
      }

      const updatedCount = await this.repository.bulkUpdateStatus(
        requirementIds,
        'ordered',
        new Date(),
        cartId,
        userId
      );

      return {
        success: true,
        data: { updated_count: updatedCount },
      };
    } catch (error) {
      console.error('Error in MaterialRequirementService.addToCart:', error);
      return {
        success: false,
        error: 'Failed to add requirements to cart',
        code: 'CART_ERROR',
      };
    }
  }

  /**
   * Delete material requirement
   */
  async deleteRequirement(id: number): Promise<ServiceResult<void>> {
    try {
      const existing = await this.repository.findById(id);

      if (!existing) {
        return {
          success: false,
          error: 'Material requirement not found',
          code: 'NOT_FOUND',
        };
      }

      // Don't allow deleting received requirements
      if (existing.status === 'received') {
        return {
          success: false,
          error: 'Cannot delete received requirements',
          code: 'VALIDATION_ERROR',
        };
      }

      await this.repository.delete(id);

      return { success: true, data: undefined };
    } catch (error) {
      console.error('Error in MaterialRequirementService.deleteRequirement:', error);
      return {
        success: false,
        error: 'Failed to delete material requirement',
        code: 'DELETE_ERROR',
      };
    }
  }

  /**
   * Get recent orders for dropdown
   */
  async getRecentOrders(limit: number = 50): Promise<ServiceResult<any[]>> {
    try {
      const orders = await this.repository.getRecentOrders(limit);
      return { success: true, data: orders };
    } catch (error) {
      console.error('Error in MaterialRequirementService.getRecentOrders:', error);
      return {
        success: false,
        error: 'Failed to fetch recent orders',
        code: 'FETCH_ERROR',
      };
    }
  }

  /**
   * Get status counts
   */
  async getStatusCounts(): Promise<ServiceResult<Record<string, number>>> {
    try {
      const counts = await this.repository.getCountByStatus();
      return { success: true, data: counts };
    } catch (error) {
      console.error('Error in MaterialRequirementService.getStatusCounts:', error);
      return {
        success: false,
        error: 'Failed to fetch status counts',
        code: 'FETCH_ERROR',
      };
    }
  }

  /**
   * Get pending/backordered requirements grouped by supplier
   * Used for supplier order generation
   */
  async getGroupedBySupplier(): Promise<ServiceResult<{
    groups: Array<{
      supplier_id: number;
      supplier_name: string;
      contact_email: string | null;
      contact_phone: string | null;
      item_count: number;
      total_quantity: number;
      requirements: Array<{
        requirement_id: number;
        entry_date: Date | string;
        custom_product_type: string | null;
        archetype_name: string | null;
        size_description: string | null;
        quantity_ordered: number;
        unit_of_measure: string | null;
        order_number: string | null;
        order_name: string | null;
        is_stock_item: boolean;
        notes: string | null;
      }>;
    }>;
    total_requirements: number;
    total_suppliers: number;
  }>> {
    try {
      const rows = await this.repository.getGroupedBySupplier();

      // Group by supplier
      const supplierMap = new Map<number, {
        supplier_id: number;
        supplier_name: string;
        contact_email: string | null;
        contact_phone: string | null;
        requirements: any[];
      }>();

      for (const row of rows) {
        const supplierId = row.supplier_id;

        if (!supplierMap.has(supplierId)) {
          supplierMap.set(supplierId, {
            supplier_id: supplierId,
            supplier_name: row.supplier_name,
            contact_email: row.contact_email,
            contact_phone: row.contact_phone,
            requirements: [],
          });
        }

        supplierMap.get(supplierId)!.requirements.push({
          requirement_id: row.requirement_id,
          entry_date: row.entry_date,
          custom_product_type: row.custom_product_type,
          archetype_name: row.archetype_name,
          size_description: row.size_description,
          quantity_ordered: Number(row.quantity_ordered),
          unit_of_measure: row.unit_of_measure,
          order_number: row.order_number,
          order_name: row.order_name,
          is_stock_item: !!row.is_stock_item,
          notes: row.notes,
        });
      }

      // Convert to array and calculate totals
      const groups = Array.from(supplierMap.values()).map(group => ({
        ...group,
        item_count: group.requirements.length,
        total_quantity: group.requirements.reduce((sum, r) => sum + r.quantity_ordered, 0),
      }));

      return {
        success: true,
        data: {
          groups,
          total_requirements: rows.length,
          total_suppliers: groups.length,
        },
      };
    } catch (error) {
      console.error('Error in MaterialRequirementService.getGroupedBySupplier:', error);
      return {
        success: false,
        error: 'Failed to fetch grouped requirements',
        code: 'FETCH_ERROR',
      };
    }
  }

  /**
   * Get valid status transitions for a given status
   */
  private getValidStatusTransitions(currentStatus: MaterialRequirementStatus): MaterialRequirementStatus[] {
    // Allow all transitions to support "unreceiving" via Receiving Status dropdown
    // The UI handles the workflow logic; backend just stores the state
    const allStatuses: MaterialRequirementStatus[] = [
      'pending', 'ordered', 'backordered', 'partial_received', 'received', 'cancelled'
    ];

    // Allow transition to any status except the current one
    return allStatuses.filter(s => s !== currentStatus);
  }
}
