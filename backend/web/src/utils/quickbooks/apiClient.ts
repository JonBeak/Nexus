/**
 * QuickBooks API Client
 * Handles authenticated API calls to QuickBooks with automatic token refresh
 */

import axios from 'axios';
import { getActiveTokens, getDefaultRealmId } from './dbManager';
import { refreshAccessToken, OAuthError } from './oauthClient';

// =============================================
// CONFIGURATION
// =============================================

const QB_API_BASE_URL = 'https://quickbooks.api.intuit.com/v3/company';
const QB_ENVIRONMENT = process.env.QB_ENVIRONMENT || 'sandbox';

// =============================================
// ERROR HANDLING
// =============================================

export class APIError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public qbError?: any
  ) {
    super(message);
    this.name = 'APIError';
  }
}

// =============================================
// API CLIENT
// =============================================

/**
 * Make authenticated API call to QuickBooks
 * Automatically handles token refresh on 401 errors
 */
export async function makeQBApiCall(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  endpoint: string,
  realmId: string,
  options: {
    data?: any;
    params?: Record<string, any>;
    headers?: Record<string, string>;
    attemptRefresh?: boolean;
  } = {}
): Promise<any> {
  const { data, params, headers = {}, attemptRefresh = true } = options;

  if (!realmId) {
    throw new APIError('Realm ID is required for API calls');
  }

  // Get active access token
  let tokenData = await getActiveTokens(realmId);

  // If no active token and refresh is allowed, try to refresh
  if (!tokenData && attemptRefresh) {
    console.log(`⚠️  No active access token for Realm ${realmId}. Attempting refresh...`);
    try {
      await refreshAccessToken(realmId);
      tokenData = await getActiveTokens(realmId);
      console.log('✅ Token refreshed, retrying API call');
    } catch (error) {
      throw new APIError(`Token refresh failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  if (!tokenData) {
    throw new APIError('No active access token available and refresh failed');
  }

  // Build request URL
  const url = `${QB_API_BASE_URL}/${realmId}/${endpoint}`;

  // Prepare request config
  const config = {
    method,
    url,
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
      Accept: 'application/json',
      ...headers,
    },
    params,
    data,
  };

  try {
    console.log(`📡 QB API: ${method} ${endpoint}`);

    // Log detailed request information for debugging
    if (method === 'POST' && data) {
      console.log('\n🔍 REQUEST DETAILS:');
      console.log('===================');
      console.log(`URL: ${config.url}`);
      console.log(`Headers:`, config.headers);
      console.log(`Body:`, JSON.stringify(config.data, null, 2));
      console.log('===================\n');
    }

    const response = await axios(config);
    console.log(`✅ QB API Response: ${response.status}`);
    return response.data;
  } catch (error: any) {
    const status = error.response?.status;
    const errorData = error.response?.data;

    console.error(`❌ QB API Error (${status}):`, errorData);

    // Handle 401 - Token might be expired, try refresh once
    if ((status === 401 || status === 400) && attemptRefresh) {
      console.log('🔄 Received 401/400, attempting token refresh...');
      try {
        await refreshAccessToken(realmId);
        console.log('✅ Token refreshed, retrying API call...');
        // Retry once without attempting refresh again
        return makeQBApiCall(method, endpoint, realmId, { ...options, attemptRefresh: false });
      } catch (refreshError) {
        throw new APIError(
          `Token refresh failed: ${refreshError instanceof Error ? refreshError.message : 'Unknown error'}`,
          status,
          errorData
        );
      }
    }

    // Parse QuickBooks error details
    const qbFault = errorData?.Fault;
    const qbErrors = qbFault?.Error || [];
    let errorMessage = `API Error (${status})`;

    if (qbErrors.length > 0) {
      const errorDetails = qbErrors
        .map((e: any) => `Code ${e.code || 'N/A'}: ${e.Message || 'Unknown'} (${e.Detail || 'N/A'})`)
        .join('; ');
      errorMessage = errorDetails;
    } else if (errorData) {
      errorMessage = JSON.stringify(errorData);
    }

    throw new APIError(errorMessage, status, errorData);
  }
}

// =============================================
// ENTITY LOOKUP FUNCTIONS
// =============================================

/**
 * Query QuickBooks using SQL-like syntax
 */
export async function queryQB(query: string, realmId: string): Promise<any> {
  return makeQBApiCall('GET', 'query', realmId, {
    params: { query },
  });
}

/**
 * Get customer ID by display name
 */
export async function getCustomerIdByName(customerName: string, realmId: string): Promise<string | null> {
  if (!customerName || !customerName.trim()) {
    console.error('❌ Customer name cannot be empty');
    return null;
  }

  try {
    const safeName = customerName.replace(/'/g, "\\'");
    const query = `SELECT Id FROM Customer WHERE DisplayName = '${safeName}' MAXRESULTS 1`;

    console.log(`🔍 Looking up QB customer: "${customerName}"`);
    const response = await queryQB(query, realmId);

    const customers = response?.QueryResponse?.Customer || [];
    if (customers.length > 0) {
      const customerId = customers[0].Id;
      console.log(`✅ Found QB Customer ID: ${customerId}`);
      return customerId;
    }

    console.log(`⚠️  Customer "${customerName}" not found in QuickBooks`);
    return null;
  } catch (error) {
    console.error('❌ Error looking up customer:', error);
    return null;
  }
}

/**
 * Get tax code ID by name
 */
export async function getTaxCodeIdByName(taxName: string, realmId: string): Promise<string | null> {
  if (!taxName || !taxName.trim()) {
    console.error('❌ Tax name cannot be empty');
    return null;
  }

  try {
    const safeName = taxName.replace(/'/g, "\\'");
    const query = `SELECT Id FROM TaxCode WHERE Name = '${safeName}' MAXRESULTS 1`;

    console.log(`🔍 Looking up QB tax code: "${taxName}"`);
    const response = await queryQB(query, realmId);

    const taxCodes = response?.QueryResponse?.TaxCode || [];
    if (taxCodes.length > 0) {
      const taxCodeId = taxCodes[0].Id;
      console.log(`✅ Found QB Tax Code ID: ${taxCodeId}`);
      return taxCodeId;
    }

    console.log(`⚠️  Tax code "${taxName}" not found in QuickBooks`);
    return null;
  } catch (error) {
    console.error('❌ Error looking up tax code:', error);
    return null;
  }
}

/**
 * Get item/service ID by name
 */
export async function getItemIdByName(itemName: string, realmId: string): Promise<string | null> {
  if (!itemName || !itemName.trim()) {
    console.error('❌ Item name cannot be empty');
    return null;
  }

  try {
    const safeName = itemName.replace(/'/g, "\\'");
    const query = `SELECT Id FROM Item WHERE Name = '${safeName}' MAXRESULTS 1`;

    console.log(`🔍 Looking up QB item: "${itemName}"`);
    const response = await queryQB(query, realmId);

    const items = response?.QueryResponse?.Item || [];
    if (items.length > 0) {
      const itemId = items[0].Id;
      console.log(`✅ Found QB Item ID: ${itemId}`);
      return itemId;
    }

    console.log(`⚠️  Item "${itemName}" not found in QuickBooks`);
    return null;
  } catch (error) {
    console.error('❌ Error looking up item:', error);
    return null;
  }
}

// =============================================
// ESTIMATE OPERATIONS
// =============================================

export interface QBEstimateLine {
  Description?: string;  // Optional, used for all line types
  DetailType: string;
  SalesItemLineDetail?: {  // Required for SalesItemLineDetail type
    ItemRef: { value: string; name: string };
    Qty: number;
    UnitPrice: number;
    TaxCodeRef: { value: string };
  };
  SubTotalLineDetail?: {};  // Required for SubTotalLineDetail type
  DescriptionLineDetail?: {};  // Required for DescriptionOnly type
  Amount?: number;  // Optional for DescriptionOnly lines
  LineNum?: number;  // Optional line number for ordering
}

export interface QBEstimatePayload {
  CustomerRef: { value: string };
  TxnDate: string;
  Line: QBEstimateLine[];
}

/**
 * Create estimate in QuickBooks
 */
export async function createEstimate(
  estimatePayload: QBEstimatePayload,
  realmId: string
): Promise<{ estimateId: string; docNumber: string }> {
  console.log('📝 Creating estimate in QuickBooks...');

  // Log the actual API call being made
  console.log('\n🌐 QUICKBOOKS API CALL:');
  console.log('=======================');
  console.log(`Endpoint: POST /v3/company/${realmId}/estimate`);
  console.log(`Environment: ${process.env.QB_ENVIRONMENT || 'sandbox'}`);
  console.log(`Line Items Count: ${estimatePayload.Line.length}`);
  console.log('\nLine Items Summary:');
  estimatePayload.Line.forEach((line, idx) => {
    console.log(`  ${idx + 1}. ${line.DetailType}${line.Description ? `: "${line.Description.substring(0, 50)}${line.Description.length > 50 ? '...' : ''}"` : ''}`);
  });
  console.log('=======================\n');

  const response = await makeQBApiCall('POST', 'estimate', realmId, {
    data: estimatePayload,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  const estimate = response.Estimate;
  if (!estimate || !estimate.Id) {
    throw new APIError('Estimate creation returned no ID');
  }

  // Log what QuickBooks returned
  console.log('\n📥 QUICKBOOKS RESPONSE:');
  console.log('=======================');
  console.log(`✅ Estimate created: ID=${estimate.Id}, Doc#=${estimate.DocNumber}`);
  console.log(`Line Items Returned: ${estimate.Line ? estimate.Line.length : 0}`);

  if (estimate.Line) {
    console.log('\nReturned Line Items:');
    estimate.Line.forEach((line: any, idx: number) => {
      console.log(`  ${idx + 1}. ${line.DetailType}${line.Description ? `: "${line.Description.substring(0, 50)}${line.Description.length > 50 ? '...' : ''}"` : ''}`);
      if (line.Amount !== undefined) {
        console.log(`     Amount: $${line.Amount}`);
      }
    });
  }
  console.log('=======================\n');

  return {
    estimateId: estimate.Id,
    docNumber: estimate.DocNumber,
  };
}

/**
 * Get estimate PDF URL
 */
export function getEstimatePdfUrl(estimateId: string, realmId: string): string {
  return `https://qbo.intuit.com/app/estimate?txnId=${estimateId}`;
}
