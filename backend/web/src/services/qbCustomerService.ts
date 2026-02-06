// File Clean up Finished: 2026-02-06
/**
 * QuickBooks Customer Service
 * Business logic for creating and syncing customers with QuickBooks
 */

import { quickbooksRepository } from '../repositories/quickbooksRepository';
import {
  createQBCustomer,
  checkQBCustomerExists,
  buildQBCustomerPayload,
  QBCustomerResult
} from '../utils/quickbooks/customerClient';

// =============================================
// TYPES
// =============================================

export interface CustomerQBData {
  company_name: string;
  quickbooks_name?: string;
  contact_first_name?: string;
  contact_last_name?: string;
  email?: string;
  phone?: string;
  address?: {
    address_line1?: string;
    address_line2?: string;
    city?: string;
    province_state_short?: string;
    postal_zip?: string;
    country?: string;
  };
  tax_type?: string; // Tax name from province (e.g., "GST", "HST Ontario")
}

export interface QBCustomerCreationResult {
  success: boolean;
  qbCustomerId?: string;
  existingCustomer?: boolean;
  error?: {
    type: 'VALIDATION' | 'DUPLICATE' | 'CONNECTION' | 'NOT_CONNECTED' | 'UNKNOWN';
    message: string;
    canRetry: boolean;
    canProceedLocal: boolean;
  };
}

// =============================================
// SERVICE CLASS
// =============================================

export class QBCustomerService {
  /**
   * Create or link customer in QuickBooks
   *
   * Flow:
   * 1. Get realm ID (QB connection check)
   * 2. Check if customer already exists in QB by DisplayName
   * 3. If exists, use existing QB ID (avoid duplicates)
   * 4. If not exists, create in QB
   * 5. Return result with QB customer ID
   */
  async createCustomerInQuickBooks(
    customerData: CustomerQBData,
    customerId?: number
  ): Promise<QBCustomerCreationResult> {
    console.log('[QBCustomerService] Starting QB customer creation...');

    // Step 1: Get QB realm ID
    const realmId = await quickbooksRepository.getDefaultRealmId();
    if (!realmId) {
      console.log('[QBCustomerService] No QuickBooks connection configured');
      return {
        success: false,
        error: {
          type: 'NOT_CONNECTED',
          message: 'QuickBooks is not connected. Please connect to QuickBooks first.',
          canRetry: false,
          canProceedLocal: true
        }
      };
    }

    const displayName = customerData.quickbooks_name || customerData.company_name;

    // Step 2: Check if customer already exists in QB
    console.log(`[QBCustomerService] Checking for existing customer: "${displayName}"`);
    const existingCustomer = await checkQBCustomerExists(displayName, realmId);

    if (existingCustomer) {
      console.log(`[QBCustomerService] Customer already exists in QB: ${existingCustomer.qbCustomerId}`);

      // Store mapping if we have a local customer ID
      if (customerId) {
        await quickbooksRepository.storeCustomerMapping({
          customer_id: customerId,
          qb_customer_id: existingCustomer.qbCustomerId,
          qb_customer_name: displayName
        });
      }

      return {
        success: true,
        qbCustomerId: existingCustomer.qbCustomerId,
        existingCustomer: true
      };
    }

    // Step 3: Resolve QB tax code ID from tax_type
    let qbTaxCodeId: string | null = null;
    if (customerData.tax_type) {
      qbTaxCodeId = await quickbooksRepository.getTaxCodeIdByName(customerData.tax_type);
      if (qbTaxCodeId) {
        console.log(`[QBCustomerService] Resolved tax code: "${customerData.tax_type}" -> QB ID: ${qbTaxCodeId}`);
      } else {
        // Try default tax code as fallback
        const defaultTaxCode = await quickbooksRepository.getDefaultTaxCode();
        if (defaultTaxCode) {
          qbTaxCodeId = defaultTaxCode.id;
          console.log(`[QBCustomerService] Tax code "${customerData.tax_type}" not found, using default: "${defaultTaxCode.name}" (${qbTaxCodeId})`);
        } else {
          console.warn(`[QBCustomerService] Tax code "${customerData.tax_type}" not found and no default configured`);
        }
      }
    }

    // Step 4: Build QB payload
    const payload = buildQBCustomerPayload({
      ...customerData,
      qbTaxCodeId: qbTaxCodeId || undefined
    });

    // Step 5: Create customer in QB
    console.log('[QBCustomerService] Creating new customer in QuickBooks...');
    const result: QBCustomerResult = await createQBCustomer(payload, realmId);

    if (!result.success) {
      console.error('[QBCustomerService] QB customer creation failed:', result.error);
      return {
        success: false,
        error: result.error
      };
    }

    // Step 6: Store mapping if we have local customer ID
    if (customerId && result.qbCustomerId) {
      await quickbooksRepository.storeCustomerMapping({
        customer_id: customerId,
        qb_customer_id: result.qbCustomerId,
        qb_customer_name: displayName
      });
      console.log(`[QBCustomerService] Stored QB mapping: local=${customerId} -> QB=${result.qbCustomerId}`);
    }

    return {
      success: true,
      qbCustomerId: result.qbCustomerId,
      existingCustomer: false
    };
  }

}

// Export singleton instance
export const qbCustomerService = new QBCustomerService();
