/**
 * QuickBooks Entity Resolver
 * Shared utility for resolving QuickBooks entity IDs (customers, tax codes)
 *
 * Used by:
 * - quickbooksService.ts (Job Estimation module)
 * - qbEstimateService.ts (Order Preparation module)
 */

import { quickbooksRepository } from '../../repositories/quickbooksRepository';
import { getCustomerIdByName } from './apiClient';

/**
 * Resolve customer ID with caching
 * Looks up QB customer ID, caches result for future lookups
 *
 * @param customerId - Local customer ID from database
 * @param customerName - QuickBooks display name to search for
 * @param realmId - QuickBooks realm ID
 * @returns QuickBooks customer ID
 * @throws Error if customer not found in QuickBooks
 */
export async function resolveCustomerId(
  customerId: number,
  customerName: string,
  realmId: string
): Promise<string> {
  // Check cache first
  let qbCustomerId = await quickbooksRepository.getCachedCustomerId(customerId);

  if (!qbCustomerId) {
    // Not cached - lookup in QuickBooks
    console.log(`Looking up customer in QB: "${customerName}"`);
    qbCustomerId = await getCustomerIdByName(customerName, realmId);

    if (!qbCustomerId) {
      throw new Error(
        `Customer "${customerName}" not found in QuickBooks. ` +
        `Please create this customer in QuickBooks first, or update the QuickBooks name in customer settings.`
      );
    }

    // Store in cache
    await quickbooksRepository.storeCustomerMapping({
      customer_id: customerId,
      qb_customer_id: qbCustomerId,
      qb_customer_name: customerName,
    });
    console.log(`Cached customer mapping: ${customerId} -> ${qbCustomerId}`);
  } else {
    console.log(`Using cached customer ID: ${qbCustomerId}`);
  }

  return qbCustomerId;
}

/**
 * Resolve tax code from customer's billing province
 * Maps province -> tax name -> QB tax code ID
 *
 * @param customerId - Local customer ID (used to lookup billing province)
 * @returns Object containing QB tax code ID and tax name
 * @throws Error if customer has no primary address or tax config not found
 */
export async function resolveTaxCodeByCustomer(customerId: number): Promise<{
  taxCodeId: string;
  taxName: string;
}> {
  // Get customer's billing province
  const customerProvince = await quickbooksRepository.getCustomerProvince(customerId);
  if (!customerProvince) {
    throw new Error('Customer does not have a primary address. Please set a primary address first.');
  }

  console.log(`Customer billing province: ${customerProvince}`);

  // Map province to tax name
  const taxName = await quickbooksRepository.getTaxNameForProvince(customerProvince);
  if (!taxName) {
    throw new Error(`No tax configuration found for province ${customerProvince}. Please check provinces_tax table.`);
  }

  console.log(`Province ${customerProvince} mapped to tax: "${taxName}"`);

  return resolveTaxCodeByName(taxName);
}

/**
 * Resolve tax code by tax name
 * Looks up QB tax code ID from tax name, falls back to default if not mapped
 *
 * @param taxName - Tax name (e.g., "HST 13%", "GST")
 * @returns Object containing QB tax code ID and resolved tax name
 * @throws Error if tax code not found and no default configured
 */
export async function resolveTaxCodeByName(taxName: string): Promise<{
  taxCodeId: string;
  taxName: string;
}> {
  // Get QB tax code ID (with fallback to default if not found)
  let qbTaxCodeId = await quickbooksRepository.getTaxCodeIdByName(taxName);
  let finalTaxName = taxName;

  if (!qbTaxCodeId) {
    // Tax name not found in mappings - use default from qb_settings
    const defaultTaxCode = await quickbooksRepository.getDefaultTaxCode();
    if (!defaultTaxCode) {
      throw new Error(
        `No QuickBooks tax code mapping found for "${taxName}" and no default tax code configured in qb_settings. ` +
        `Please configure the mapping in qb_tax_code_mappings or set a default in qb_settings.`
      );
    }
    qbTaxCodeId = defaultTaxCode.id;
    finalTaxName = defaultTaxCode.name;
    console.warn(`Tax code "${taxName}" not found - using default: "${finalTaxName}" (QB ID ${qbTaxCodeId})`);
  } else {
    console.log(`Using tax code: "${taxName}" -> QB ID: ${qbTaxCodeId}`);
  }

  return { taxCodeId: qbTaxCodeId, taxName: finalTaxName };
}

/**
 * Resolve tax code with fallback for null/undefined tax names
 * Handles cases where order has no tax_name set
 *
 * @param taxName - Tax name (can be null/undefined)
 * @returns Object containing QB tax code ID and resolved tax name
 * @throws Error if no default tax code configured when taxName is null
 */
export async function resolveTaxCodeWithFallback(taxName: string | null | undefined): Promise<{
  taxCodeId: string;
  taxName: string;
}> {
  if (taxName && taxName.trim()) {
    return resolveTaxCodeByName(taxName);
  }

  // No tax_name specified - use default from qb_settings
  const defaultTaxCode = await quickbooksRepository.getDefaultTaxCode();
  if (!defaultTaxCode) {
    throw new Error('No tax_name specified and no default tax code configured in qb_settings.');
  }

  console.log(`No tax_name specified - using default: "${defaultTaxCode.name}" (QB ID ${defaultTaxCode.id})`);

  return {
    taxCodeId: defaultTaxCode.id,
    taxName: defaultTaxCode.name,
  };
}
