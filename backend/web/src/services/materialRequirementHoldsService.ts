/**
 * Material Requirement Holds Service
 * Business logic for managing inventory holds on material requirements
 * Created: 2026-02-04
 *
 * Handles vinyl and general inventory holds placed on material requirements.
 * Extracted from MaterialRequirementService to maintain file size limits.
 *
 * Part of Enhanced Three-Layer Architecture: Route → Controller → Service → Repository → Database
 */

import { MaterialRequirementRepository, MaterialRequirementRow } from '../repositories/materialRequirementRepository';
import { ServiceResult } from '../types/serviceResults';
import { VinylHoldsRepository, VinylHoldWithDetails } from '../repositories/supplyChain/vinylHoldsRepository';
import { GeneralInventoryHoldsRepository, GeneralInventoryHoldWithDetails } from '../repositories/supplyChain/generalInventoryHoldsRepository';
import { VinylInventoryRepository } from '../repositories/vinyl/vinylInventoryRepository';
import { VinylInventoryOrderLinksRepository } from '../repositories/vinyl/vinylInventoryOrderLinksRepository';
import { SupplierProductRepository } from '../repositories/supplyChain/supplierProductRepository';
import { VinylProductsRepository } from '../repositories/vinyl/vinylProductsRepository';
import { getLocalDateString } from '../utils/dateUtils';

/** Special supplier ID indicating "In Stock" sourcing */
const SUPPLIER_IN_STOCK = -1;
/** Special supplier ID indicating customer supplies their own material */
const SUPPLIER_CUSTOMER_PROVIDED = -3;

export class MaterialRequirementHoldsService {
  private repository: MaterialRequirementRepository;
  private supplierProductRepo: SupplierProductRepository;

  constructor() {
    this.repository = new MaterialRequirementRepository();
    this.supplierProductRepo = new SupplierProductRepository();
  }

  /**
   * Create a vinyl hold for a material requirement
   * Sets the requirement's supplier to "In Stock", delivery to "pickup", and ordered_date to today
   */
  async createVinylHold(
    requirementId: number,
    vinylId: number,
    quantity: string,
    userId?: number
  ): Promise<ServiceResult<{ hold_id: number }>> {
    try {
      // Verify requirement exists
      const requirement = await this.repository.findById(requirementId);
      if (!requirement) {
        return { success: false, error: 'Material requirement not found', code: 'NOT_FOUND' };
      }

      // Check if requirement already has a hold
      const existingVinylHold = await VinylHoldsRepository.requirementHasHold(requirementId);
      const existingGeneralHold = await GeneralInventoryHoldsRepository.requirementHasHold(requirementId);
      if (existingVinylHold || existingGeneralHold) {
        return { success: false, error: 'Requirement already has a hold. Release it first.', code: 'VALIDATION_ERROR' };
      }

      // Verify vinyl exists and is available
      const vinyl = await VinylInventoryRepository.getVinylItemById(vinylId);
      if (!vinyl) {
        return { success: false, error: 'Vinyl item not found', code: 'NOT_FOUND' };
      }
      if (vinyl.disposition !== 'in_stock') {
        return { success: false, error: `Vinyl is not available. Current status: ${vinyl.disposition}`, code: 'VALIDATION_ERROR' };
      }

      // Create the hold
      const holdId = await VinylHoldsRepository.createHold({
        vinyl_id: vinylId,
        material_requirement_id: requirementId,
        quantity_held: quantity,
        created_by: userId
      });

      // Update the material requirement
      const today = getLocalDateString();
      await this.repository.update(requirementId, {
        supplier_id: SUPPLIER_IN_STOCK,
        delivery_method: 'pickup',
        ordered_date: today,
      }, userId);

      // Set the held_vinyl_id reference
      await this.repository.setHeldVinylId(requirementId, vinylId);

      return { success: true, data: { hold_id: holdId } };
    } catch (error) {
      console.error('Error in MaterialRequirementHoldsService.createVinylHold:', error);
      return { success: false, error: 'Failed to create vinyl hold', code: 'HOLD_ERROR' };
    }
  }

  /**
   * Create a general inventory hold for a material requirement
   */
  async createGeneralInventoryHold(
    requirementId: number,
    supplierProductId: number,
    quantity: string,
    userId?: number
  ): Promise<ServiceResult<{ hold_id: number }>> {
    try {
      // Verify requirement exists
      const requirement = await this.repository.findById(requirementId);
      if (!requirement) {
        return { success: false, error: 'Material requirement not found', code: 'NOT_FOUND' };
      }

      // Check if requirement already has a hold
      const existingVinylHold = await VinylHoldsRepository.requirementHasHold(requirementId);
      const existingGeneralHold = await GeneralInventoryHoldsRepository.requirementHasHold(requirementId);
      if (existingVinylHold || existingGeneralHold) {
        return { success: false, error: 'Requirement already has a hold. Release it first.', code: 'VALIDATION_ERROR' };
      }

      // Verify supplier product exists and has stock
      const product = await this.supplierProductRepo.findById(supplierProductId);
      if (!product) {
        return { success: false, error: 'Supplier product not found', code: 'NOT_FOUND' };
      }
      if (product.quantity_on_hand <= 0) {
        return { success: false, error: 'No stock available for this product', code: 'VALIDATION_ERROR' };
      }

      // Create the hold
      const holdId = await GeneralInventoryHoldsRepository.createHold({
        supplier_product_id: supplierProductId,
        material_requirement_id: requirementId,
        quantity_held: quantity,
        created_by: userId
      });

      // Update the material requirement
      const today = getLocalDateString();
      await this.repository.update(requirementId, {
        supplier_id: SUPPLIER_IN_STOCK,
        delivery_method: 'pickup',
        ordered_date: today,
      }, userId);

      // Set the held_supplier_product_id reference
      await this.repository.setHeldSupplierProductId(requirementId, supplierProductId);

      return { success: true, data: { hold_id: holdId } };
    } catch (error) {
      console.error('Error in MaterialRequirementHoldsService.createGeneralInventoryHold:', error);
      return { success: false, error: 'Failed to create general inventory hold', code: 'HOLD_ERROR' };
    }
  }

  /**
   * Release a hold from a material requirement
   * Clears the supplier, ordered_date, and held reference
   */
  async releaseHold(requirementId: number, userId?: number): Promise<ServiceResult<void>> {
    try {
      // Verify requirement exists
      const requirement = await this.repository.findById(requirementId);
      if (!requirement) {
        return { success: false, error: 'Material requirement not found', code: 'NOT_FOUND' };
      }

      // Delete any vinyl holds
      await VinylHoldsRepository.deleteHoldsByRequirementId(requirementId);

      // Delete any general inventory holds
      await GeneralInventoryHoldsRepository.deleteHoldsByRequirementId(requirementId);

      // Clear the held references and revert supplier fields
      await this.repository.clearHoldFields(requirementId);

      return { success: true, data: undefined };
    } catch (error) {
      console.error('Error in MaterialRequirementHoldsService.releaseHold:', error);
      return { success: false, error: 'Failed to release hold', code: 'RELEASE_ERROR' };
    }
  }

  /**
   * Get hold details for a requirement (either vinyl or general)
   */
  async getHoldForRequirement(requirementId: number): Promise<ServiceResult<{
    holdType: 'vinyl' | 'general' | null;
    hold: VinylHoldWithDetails | GeneralInventoryHoldWithDetails | null;
  }>> {
    try {
      // Check for vinyl hold
      const vinylHold = await VinylHoldsRepository.getHoldByRequirementId(requirementId);
      if (vinylHold) {
        return { success: true, data: { holdType: 'vinyl', hold: vinylHold } };
      }

      // Check for general inventory hold
      const generalHold = await GeneralInventoryHoldsRepository.getHoldByRequirementId(requirementId);
      if (generalHold) {
        return { success: true, data: { holdType: 'general', hold: generalHold } };
      }

      return { success: true, data: { holdType: null, hold: null } };
    } catch (error) {
      console.error('Error in MaterialRequirementHoldsService.getHoldForRequirement:', error);
      return { success: false, error: 'Failed to get hold', code: 'FETCH_ERROR' };
    }
  }

  /**
   * Get other holds on the same vinyl item (for multi-hold receive flow)
   */
  async getOtherHoldsOnVinyl(requirementId: number, vinylId: number): Promise<ServiceResult<VinylHoldWithDetails[]>> {
    try {
      const otherHolds = await VinylHoldsRepository.getOtherHoldsOnVinyl(vinylId, requirementId);
      return { success: true, data: otherHolds };
    } catch (error) {
      console.error('Error in MaterialRequirementHoldsService.getOtherHoldsOnVinyl:', error);
      return { success: false, error: 'Failed to get other holds', code: 'FETCH_ERROR' };
    }
  }

  /**
   * Receive a requirement with a vinyl hold
   * Handles multi-hold scenario where multiple requirements hold the same vinyl
   */
  async receiveRequirementWithVinylHold(
    requirementId: number,
    alsoReceiveRequirementIds: number[],
    userId?: number
  ): Promise<ServiceResult<{ received_count: number; released_count: number }>> {
    try {
      // Get the requirement and its hold
      const requirement = await this.repository.findById(requirementId);
      if (!requirement) {
        return { success: false, error: 'Material requirement not found', code: 'NOT_FOUND' };
      }

      const hold = await VinylHoldsRepository.getHoldByRequirementId(requirementId);
      if (!hold) {
        return { success: false, error: 'No vinyl hold found for this requirement', code: 'NOT_FOUND' };
      }

      // Verify vinyl is still available
      const vinyl = await VinylInventoryRepository.getVinylItemById(hold.vinyl_id);
      if (!vinyl) {
        return { success: false, error: 'Vinyl item no longer exists', code: 'NOT_FOUND' };
      }
      if (vinyl.disposition !== 'in_stock') {
        return { success: false, error: `Vinyl is no longer available. Status: ${vinyl.disposition}`, code: 'VALIDATION_ERROR' };
      }

      // Get all holds on this vinyl
      const allHolds = await VinylHoldsRepository.getHoldsByVinylId(hold.vinyl_id);
      const otherHolds = allHolds.filter(h => h.material_requirement_id !== requirementId);

      // Process the primary requirement
      const today = getLocalDateString();
      await this.repository.update(requirementId, {
        status: 'received',
        received_date: today,
        quantity_received: requirement.quantity_ordered
      }, userId);
      await VinylHoldsRepository.deleteHoldsByRequirementId(requirementId);
      await this.repository.clearHeldVinylId(requirementId);

      let receivedCount = 1;
      let releasedCount = 0;

      // Process selected other requirements (mark as received)
      for (const otherId of alsoReceiveRequirementIds) {
        const otherReq = await this.repository.findById(otherId);
        if (otherReq) {
          await this.repository.update(otherId, {
            status: 'received',
            received_date: today,
            quantity_received: otherReq.quantity_ordered
          }, userId);
          await VinylHoldsRepository.deleteHoldsByRequirementId(otherId);
          await this.repository.clearHeldVinylId(otherId);
          receivedCount++;
        }
      }

      // Process unselected holds (release them)
      for (const otherHold of otherHolds) {
        if (!alsoReceiveRequirementIds.includes(otherHold.material_requirement_id)) {
          await VinylHoldsRepository.deleteHoldsByRequirementId(otherHold.material_requirement_id);
          await this.repository.clearHoldFields(otherHold.material_requirement_id);
          releasedCount++;
        }
      }

      // Mark vinyl as used
      await VinylInventoryRepository.markVinylAsUsed(hold.vinyl_id, { usage_user: userId });

      return { success: true, data: { received_count: receivedCount, released_count: releasedCount } };
    } catch (error) {
      console.error('Error in MaterialRequirementHoldsService.receiveRequirementWithVinylHold:', error);
      return { success: false, error: 'Failed to receive requirement', code: 'RECEIVE_ERROR' };
    }
  }

  /**
   * Check if there is available stock for a material requirement
   * Returns stock type (vinyl or general) and availability
   */
  async checkStockAvailability(
    archetypeId: number | null,
    vinylProductId: number | null,
    supplierProductId: number | null
  ): Promise<ServiceResult<{ hasStock: boolean; stockType: 'vinyl' | 'general' | null }>> {
    try {
      // Check vinyl stock if vinyl_product_id is specified
      if (vinylProductId) {
        const vinylItems = await VinylInventoryRepository.getVinylItems({ disposition: 'in_stock' });
        const vp = await VinylProductsRepository.getVinylProductById(vinylProductId);

        if (vp) {
          const matchingVinyl = vinylItems.filter((v: any) =>
            v.brand === vp.brand &&
            v.series === vp.series &&
            (!vp.colour_number || v.colour_number === vp.colour_number) &&
            (!vp.colour_name || v.colour_name === vp.colour_name)
          );
          if (matchingVinyl.length > 0) {
            return { success: true, data: { hasStock: true, stockType: 'vinyl' } };
          }
        }
        return { success: true, data: { hasStock: false, stockType: null } };
      }

      // Check general inventory if archetype is specified (but not vinyl)
      if (archetypeId && archetypeId > 0) {
        const hasStock = await this.supplierProductRepo.hasInStockForArchetype(archetypeId);
        if (hasStock) {
          return { success: true, data: { hasStock: true, stockType: 'general' } };
        }
      }

      // Check specific supplier product
      if (supplierProductId) {
        const product = await this.supplierProductRepo.findById(supplierProductId);
        if (product && product.is_active && product.quantity_on_hand > 0) {
          return { success: true, data: { hasStock: true, stockType: 'general' } };
        }
      }

      return { success: true, data: { hasStock: false, stockType: null } };
    } catch (error) {
      console.error('Error in MaterialRequirementHoldsService.checkStockAvailability:', error);
      return { success: false, error: 'Failed to check stock availability', code: 'CHECK_ERROR' };
    }
  }

  /**
   * Get available vinyl items matching a vinyl product or raw specs
   * Includes holds and order associations for display
   *
   * @param params.vinylProductId - Look up specs from vinyl_products table
   * @param params.brand - Direct brand filter (alternative to vinylProductId)
   * @param params.series - Direct series filter (alternative to vinylProductId)
   * @param params.colour_number - Direct colour number filter
   * @param params.colour_name - Direct colour name filter
   */
  async getAvailableVinylWithHolds(params: {
    vinylProductId?: number;
    brand?: string;
    series?: string;
    colour_number?: string;
    colour_name?: string;
  }): Promise<ServiceResult<any[]>> {
    try {
      let brand: string;
      let series: string;
      let colour_number: string | null = null;
      let colour_name: string | null = null;

      if (params.vinylProductId) {
        // Look up specs from product
        const vp = await VinylProductsRepository.getVinylProductById(params.vinylProductId);
        if (!vp) {
          return { success: false, error: 'Vinyl product not found', code: 'NOT_FOUND' };
        }
        brand = vp.brand;
        series = vp.series;
        colour_number = vp.colour_number || null;
        colour_name = vp.colour_name || null;
      } else if (params.brand && params.series) {
        // Use raw specs directly
        brand = params.brand;
        series = params.series;
        colour_number = params.colour_number || null;
        colour_name = params.colour_name || null;
      } else {
        return { success: false, error: 'Either vinyl_product_id or brand+series are required', code: 'VALIDATION_ERROR' };
      }

      // Get matching vinyl items that are in stock
      const vinylItems = await VinylInventoryRepository.getVinylItems({ disposition: 'in_stock' });
      const matchingItems = vinylItems.filter((v: any) =>
        v.brand === brand &&
        v.series === series &&
        (!colour_number || v.colour_number === colour_number) &&
        (!colour_name || v.colour_name === colour_name)
      );

      // Get holds and order associations for these items
      const vinylIds = matchingItems.map((v: any) => v.id);
      const holdsMap = await VinylHoldsRepository.getHoldsForVinylItems(vinylIds);
      const orderLinksMap = vinylIds.length > 0
        ? await VinylInventoryOrderLinksRepository.getOrderLinksForItems(vinylIds)
        : {};

      // Attach holds and order associations to items
      const itemsWithHolds = matchingItems.map((item: any) => ({
        ...item,
        holds: holdsMap.get(item.id) || [],
        order_associations: orderLinksMap[item.id] || [],
      }));

      return { success: true, data: itemsWithHolds };
    } catch (error) {
      console.error('Error in MaterialRequirementHoldsService.getAvailableVinylWithHolds:', error);
      return { success: false, error: 'Failed to get available vinyl', code: 'FETCH_ERROR' };
    }
  }

  /**
   * Get supplier products with stock and holds for an archetype
   */
  async getSupplierProductsWithHolds(archetypeId: number): Promise<ServiceResult<any[]>> {
    try {
      const products = await GeneralInventoryHoldsRepository.getSupplierProductsWithHoldsForArchetype(archetypeId);
      return { success: true, data: products };
    } catch (error) {
      console.error('Error in MaterialRequirementHoldsService.getSupplierProductsWithHolds:', error);
      return { success: false, error: 'Failed to get supplier products', code: 'FETCH_ERROR' };
    }
  }
}
