/**
 * Auto PO Service — DEPRECATED
 *
 * Draft POs are now live queries against material_requirements
 * (WHERE supplier_id > 0 AND ordered_date IS NULL AND status = 'pending').
 *
 * No database rows are created until the user clicks "Place Order",
 * at which point a snapshot is created in supplier_orders/supplier_order_items.
 *
 * This file is kept as an empty shell to avoid breaking any remaining imports.
 * All methods are no-ops.
 */

export class AutoPOService {
  async syncRequirementToDraftPO(): Promise<void> {}
  async removeRequirementFromDraftPO(): Promise<void> {}
  async handleSupplierChange(): Promise<void> {}
}
