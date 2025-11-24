// File Clean up Finished: 2025-11-18
// Analysis: Pure utility for calculating SHA256 hash of order data
// Status: CLEAN - Moved from /services/ to /utils/ (architectural improvement)
// Changes:
//   - Moved from services/ to utils/ to resolve architecture violation
//   - Repository layer was calling service layer (circular dependency risk)
//   - Now both services and repositories can safely import this utility
//   - Updated 4 import locations: qbEstimateService, pdfGenerationService, orderRepository (2x)
// Findings:
//   - Single responsibility: hash calculation only
//   - Well-documented, deterministic hashing
//   - Properly separated from database access
//   - Dependencies on orderPreparationRepository (getOrderDataForHash, getOrderPartsForHash)
// Decision: File is architecturally sound and follows best practices

/**
 * Order Data Hash Service
 *
 * Shared utility for calculating SHA256 hash of order data.
 * Used for staleness detection in both QB estimates and order form PDFs.
 *
 * Includes ALL fields that affect PDFs:
 * - Part-level: specs, invoice, QB fields, notes
 * - Order-level: header info, financial settings, notes
 */

import * as crypto from 'crypto';
import * as orderPrepRepo from '../repositories/orderPreparationRepository';

/**
 * Calculate SHA256 hash of order data
 *
 * Creates a deterministic hash based on ALL order and part data to detect
 * when order content has meaningfully changed (vs timestamp changes).
 *
 * Includes:
 * - Order-level fields (name, PO, dates, notes, financial settings)
 * - Part-level fields (specs, invoice, QB fields, production notes)
 * - Point persons (contact_name, contact_email)
 *
 * @param orderId - The order ID to hash
 * @returns SHA256 hex string
 */
export async function calculateOrderDataHash(orderId: number): Promise<string> {
  // Get order-level data
  const orderData = await orderPrepRepo.getOrderDataForHash(orderId);

  // Get all order parts data
  const orderParts = await orderPrepRepo.getOrderPartsForHash(orderId);

  // Get point persons data (only name and email for hash)
  const pointPersons = await orderPrepRepo.getPointPersonsForHash(orderId);

  // Create normalized data structure for hashing
  const hashData = {
    // Order-level fields (sorted alphabetically for determinism)
    order: {
      cash: orderData?.cash ?? false,
      customer_job_number: orderData?.customer_job_number ?? null,
      customer_po: orderData?.customer_po ?? null,
      deposit_required: orderData?.deposit_required ?? false,
      discount: orderData?.discount ?? 0,
      due_date: orderData?.due_date ?? null,
      internal_note: orderData?.internal_note ?? null,
      invoice_email: orderData?.invoice_email ?? null,
      invoice_notes: orderData?.invoice_notes ?? null,
      manufacturing_note: orderData?.manufacturing_note ?? null,
      order_date: orderData?.order_date ?? null,
      order_name: orderData?.order_name ?? null,
      production_notes: orderData?.production_notes ?? null,
      shipping_required: orderData?.shipping_required ?? false,
      sign_image_path: orderData?.sign_image_path ?? null,
      tax_name: orderData?.tax_name ?? null,
      terms: orderData?.terms ?? null
    },

    // Point persons (only name and email, sorted by email for determinism)
    pointPersons: pointPersons.map(pp => ({
      contact_name: pp.contact_name ?? null,
      contact_email: pp.contact_email ?? null
    })),

    // Part-level fields (all fields that affect PDFs/QB estimates)
    parts: orderParts.map(part => ({
      base_product_type_id: part.base_product_type_id ?? null,
      channel_letter_type_id: part.channel_letter_type_id ?? null,
      display_number: part.display_number ?? null,
      extended_price: part.extended_price ?? null,
      invoice_description: part.invoice_description ?? null,
      is_parent: part.is_parent ?? false,
      part_number: part.part_number,
      part_scope: part.part_scope ?? null,
      product_type: part.product_type ?? null,
      product_type_id: part.product_type_id ?? null,
      production_notes: part.production_notes ?? null,
      qb_description: part.qb_description ?? null,
      qb_item_name: part.qb_item_name ?? null,
      quantity: part.quantity ?? null,
      specs_display_name: part.specs_display_name ?? null,
      specs_qty: part.specs_qty ?? 0,
      // Handle JSON specifications field - parse and normalize
      specifications: part.specifications ? JSON.parse(JSON.stringify(part.specifications)) : null,
      unit_price: part.unit_price ?? null
    }))
  };

  // Calculate SHA256 hash
  const hash = crypto
    .createHash('sha256')
    .update(JSON.stringify(hashData))
    .digest('hex');

  return hash;
}
