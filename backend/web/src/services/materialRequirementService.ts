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
import { query as dbQuery } from '../config/database';
import { RowDataPacket } from 'mysql2';
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
   * Get unassigned requirements (no supplier set)
   */
  async getUnassignedRequirements(): Promise<ServiceResult<MaterialRequirementRow[]>> {
    try {
      const requirements = await this.repository.findAll({
        status: ['pending', 'backordered'],
      });
      // Filter to only those with no supplier assigned
      const unassigned = requirements.filter(r => !r.supplier_id);
      return { success: true, data: unassigned };
    } catch (error) {
      console.error('Error in MaterialRequirementService.getUnassignedRequirements:', error);
      return {
        success: false,
        error: 'Failed to fetch unassigned requirements',
        code: 'FETCH_ERROR',
      };
    }
  }

  /**
   * Get draft PO groups — MRs with a supplier assigned but not yet ordered,
   * grouped by supplier. This replaces the old "draft supplier_orders" rows.
   */
  async getDraftPOGroups(): Promise<ServiceResult<any[]>> {
    try {
      const requirements = await this.repository.findForDraftPO();

      // Group by supplier_id
      const groupMap = new Map<number, any>();

      for (const req of requirements) {
        const sid = req.supplier_id!;
        if (!groupMap.has(sid)) {
          groupMap.set(sid, {
            supplier_id: sid,
            supplier_name: req.supplier_name || 'Unknown Supplier',
            contact_email: null, // filled from supplier_contacts later if needed
            contact_phone: null,
            requirements: [],
          });
        }
        groupMap.get(sid)!.requirements.push({
          requirement_id: req.requirement_id,
          archetype_name: req.archetype_name ?? null,
          custom_product_type: req.custom_product_type ?? null,
          size_description: req.size_description ?? null,
          quantity_ordered: req.quantity_ordered,
          unit_of_measure: req.unit_of_measure ?? null,
          order_number: req.order_number ?? null,
          order_name: req.order_name ?? null,
          customer_name: req.customer_name ?? null,
          is_stock_item: !!req.is_stock_item,
          notes: req.notes ?? null,
          supplier_product_id: req.supplier_product_id ?? null,
          supplier_product_sku: req.supplier_product_sku ?? null,
          entry_date: req.entry_date,
        });
      }

      // Enrich groups with contact info from supplier_contacts
      const supplierIds = Array.from(groupMap.keys());
      if (supplierIds.length > 0) {
        const placeholders = supplierIds.map(() => '?').join(',');
        const contactRows = await dbQuery(
          `SELECT sc.supplier_id, sc.email, s.contact_phone
           FROM supplier_contacts sc
           JOIN suppliers s ON sc.supplier_id = s.supplier_id
           WHERE sc.supplier_id IN (${placeholders}) AND sc.is_primary = 1
           LIMIT ${supplierIds.length}`,
          supplierIds
        ) as any[];
        for (const row of contactRows) {
          const group = groupMap.get(row.supplier_id);
          if (group) {
            group.contact_email = row.email || null;
            group.contact_phone = row.contact_phone || null;
          }
        }
      }

      return { success: true, data: Array.from(groupMap.values()) };
    } catch (error) {
      console.error('Error in MaterialRequirementService.getDraftPOGroups:', error);
      return {
        success: false,
        error: 'Failed to fetch draft PO groups',
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
