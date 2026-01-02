/**
 * QuickBooks Customer Client
 * Handles customer creation and lookup in QuickBooks
 */

import { makeQBApiCall, queryQB, APIError } from './apiClient';

// =============================================
// TYPES
// =============================================

export interface QBCustomerPayload {
  DisplayName: string;
  CompanyName?: string;
  GivenName?: string;
  FamilyName?: string;
  PrimaryEmailAddr?: { Address: string };
  PrimaryPhone?: { FreeFormNumber: string };
  BillAddr?: {
    Line1?: string;
    Line2?: string;
    City?: string;
    CountrySubDivisionCode?: string;
    PostalCode?: string;
    Country?: string;
  };
  Taxable?: boolean;
  DefaultTaxCodeRef?: { value: string };
}

export interface QBCustomerResult {
  success: boolean;
  qbCustomerId?: string;
  displayName?: string;
  syncToken?: string;
  error?: {
    type: 'VALIDATION' | 'DUPLICATE' | 'CONNECTION' | 'UNKNOWN';
    message: string;
    canRetry: boolean;
    canProceedLocal: boolean;
  };
}

// =============================================
// CUSTOMER LOOKUP
// =============================================

/**
 * Check if a customer already exists in QuickBooks by DisplayName
 * Returns QB customer ID if found, null if not found
 */
export async function checkQBCustomerExists(
  displayName: string,
  realmId: string
): Promise<{ qbCustomerId: string; syncToken: string } | null> {
  if (!displayName || !displayName.trim()) {
    return null;
  }

  try {
    const safeName = displayName.replace(/'/g, "\\'");
    const queryStr = `SELECT Id, SyncToken FROM Customer WHERE DisplayName = '${safeName}' MAXRESULTS 1`;

    console.log(`[QB Customer] Checking if customer exists: "${displayName}"`);
    const response = await queryQB(queryStr, realmId);

    const customers = response?.QueryResponse?.Customer || [];
    if (customers.length > 0) {
      console.log(`[QB Customer] Found existing customer: ID=${customers[0].Id}`);
      return {
        qbCustomerId: customers[0].Id,
        syncToken: customers[0].SyncToken
      };
    }

    console.log(`[QB Customer] Customer "${displayName}" not found in QuickBooks`);
    return null;
  } catch (error) {
    console.error('[QB Customer] Error checking customer existence:', error);
    return null;
  }
}

// =============================================
// CUSTOMER CREATION
// =============================================

/**
 * Build QB customer payload from app customer data
 */
export function buildQBCustomerPayload(customerData: {
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
  qbTaxCodeId?: string;
}): QBCustomerPayload {
  const payload: QBCustomerPayload = {
    DisplayName: customerData.quickbooks_name || customerData.company_name,
    CompanyName: customerData.company_name
  };

  // Add contact names if provided
  if (customerData.contact_first_name) {
    payload.GivenName = customerData.contact_first_name;
  }
  if (customerData.contact_last_name) {
    payload.FamilyName = customerData.contact_last_name;
  }

  // Add email if provided and valid
  if (customerData.email && customerData.email.includes('@')) {
    payload.PrimaryEmailAddr = { Address: customerData.email };
  }

  // Add phone if provided
  if (customerData.phone) {
    payload.PrimaryPhone = { FreeFormNumber: customerData.phone };
  }

  // Add billing address if provided
  if (customerData.address) {
    const addr = customerData.address;
    const billAddr: QBCustomerPayload['BillAddr'] = {};

    if (addr.address_line1) billAddr.Line1 = addr.address_line1;
    if (addr.address_line2) billAddr.Line2 = addr.address_line2;
    if (addr.city) billAddr.City = addr.city;
    if (addr.province_state_short) billAddr.CountrySubDivisionCode = addr.province_state_short;
    if (addr.postal_zip) billAddr.PostalCode = addr.postal_zip;
    if (addr.country) billAddr.Country = addr.country;

    // Only add BillAddr if at least one field is populated
    if (Object.keys(billAddr).length > 0) {
      payload.BillAddr = billAddr;
    }
  }

  // Add tax settings if QB tax code ID is provided
  if (customerData.qbTaxCodeId) {
    payload.Taxable = true;
    payload.DefaultTaxCodeRef = { value: customerData.qbTaxCodeId };
  }

  return payload;
}

/**
 * Create a customer in QuickBooks
 * Returns result with QB customer ID or error info
 */
export async function createQBCustomer(
  payload: QBCustomerPayload,
  realmId: string
): Promise<QBCustomerResult> {
  console.log('[QB Customer] Creating customer in QuickBooks...');
  console.log('[QB Customer] DisplayName:', payload.DisplayName);

  try {
    const response = await makeQBApiCall('POST', 'customer', realmId, {
      data: payload,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const customer = response.Customer;
    if (!customer || !customer.Id) {
      return {
        success: false,
        error: {
          type: 'UNKNOWN',
          message: 'Customer creation returned no ID',
          canRetry: true,
          canProceedLocal: true
        }
      };
    }

    console.log(`[QB Customer] Customer created successfully: ID=${customer.Id}`);

    return {
      success: true,
      qbCustomerId: customer.Id,
      displayName: customer.DisplayName,
      syncToken: customer.SyncToken
    };
  } catch (error) {
    console.error('[QB Customer] Error creating customer:', error);

    // Parse error type from QB error response
    if (error instanceof APIError) {
      const errorMessage = error.message.toLowerCase();

      // Check for duplicate name error
      if (errorMessage.includes('duplicate') || errorMessage.includes('already exists') ||
          errorMessage.includes('name provided already') || error.statusCode === 6240) {
        return {
          success: false,
          error: {
            type: 'DUPLICATE',
            message: `A customer with this name already exists in QuickBooks. Please use a different name.`,
            canRetry: false,
            canProceedLocal: true
          }
        };
      }

      // Check for validation errors
      if (error.statusCode === 400 || errorMessage.includes('invalid') ||
          errorMessage.includes('required') || errorMessage.includes('validation')) {
        return {
          success: false,
          error: {
            type: 'VALIDATION',
            message: error.message,
            canRetry: false,
            canProceedLocal: false
          }
        };
      }

      // Connection/auth errors
      if (error.statusCode === 401 || error.statusCode === 403 ||
          errorMessage.includes('unauthorized') || errorMessage.includes('token')) {
        return {
          success: false,
          error: {
            type: 'CONNECTION',
            message: 'QuickBooks connection error. Please check your QuickBooks authorization.',
            canRetry: true,
            canProceedLocal: true
          }
        };
      }
    }

    // Generic error
    return {
      success: false,
      error: {
        type: 'UNKNOWN',
        message: error instanceof Error ? error.message : 'Failed to create customer in QuickBooks',
        canRetry: true,
        canProceedLocal: true
      }
    };
  }
}
