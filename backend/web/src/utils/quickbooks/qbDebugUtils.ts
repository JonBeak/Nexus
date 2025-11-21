/**
 * QuickBooks Debug Utilities
 * Debug and analysis tools for QuickBooks estimate troubleshooting
 *
 * These are owner-only utilities for debugging estimate creation
 */

import { quickbooksRepository } from '../../repositories/quickbooksRepository';
import { makeQBApiCall } from './apiClient';

/**
 * QuickBooks Line Item Interface (for debug comparison)
 */
export interface QBLineForDebug {
  DetailType: string;
  Description?: string;
  SalesItemLineDetail?: {
    ItemRef: { value: string; name: string };
    Qty: number;
    UnitPrice: number;
    TaxCodeRef: { value: string; name: string };
  };
  DescriptionLineDetail?: {};
  Amount?: number;
  LineNum?: number;
}

/**
 * Fetch estimate back from QB for debug comparison
 * Logs detailed comparison of sent vs. returned line items
 *
 * @param qbEstimateId - QuickBooks estimate ID
 * @param realmId - QuickBooks realm ID
 * @param sentLines - Lines that were sent to QuickBooks
 * @returns Debug data with sent/returned comparison
 */
export async function fetchEstimateForDebug(
  qbEstimateId: string,
  realmId: string,
  sentLines: QBLineForDebug[]
): Promise<{
  linesSent: number;
  linesReturned: number;
  sentLines: QBLineForDebug[];
  returnedLines: any[];
  fullEstimate: any;
}> {
  console.log('\nDEBUG MODE: Fetching estimate back from QuickBooks...');

  const fetchedEstimate = await makeQBApiCall('GET', `estimate/${qbEstimateId}`, realmId, {});
  const returnedLines = fetchedEstimate.Estimate?.Line || [];

  console.log('\n===============================================================');
  console.log('WHAT WE SENT TO QUICKBOOKS:');
  console.log('===============================================================');
  console.log(`Total Line Items Sent: ${sentLines.length}\n`);

  sentLines.forEach((line, index) => {
    console.log(`\n[Sent Line ${index + 1}]`);
    console.log(`  DetailType: ${line.DetailType}`);
    console.log(`  LineNum: ${line.LineNum || 'N/A'}`);

    if (line.DetailType === 'SalesItemLineDetail') {
      console.log(`  Product/Service: "${line.SalesItemLineDetail?.ItemRef?.name}"`);
      console.log(`  Quantity: ${line.SalesItemLineDetail?.Qty}`);
      console.log(`  Unit Price: $${line.SalesItemLineDetail?.UnitPrice}`);
      console.log(`  Extended Amount: $${line.Amount}`);
    } else if (line.DetailType === 'DescriptionOnly') {
      const desc = line.Description || '(empty)';
      console.log(`  Text: "${desc.substring(0, 100)}${desc.length > 100 ? '...' : ''}"`);
    }
  });

  console.log('\n===============================================================');
  console.log('WHAT QUICKBOOKS RETURNED:');
  console.log('===============================================================');
  console.log(`Total Line Items Returned: ${returnedLines.length}\n`);

  returnedLines.forEach((line: any, index: number) => {
    console.log(`\n[Returned Line ${index + 1}]`);
    console.log(`  DetailType: ${line.DetailType}`);
    console.log(`  LineNum: ${line.LineNum || 'N/A'}`);

    if (line.DetailType === 'SalesItemLineDetail') {
      console.log(`  Product/Service: "${line.SalesItemLineDetail?.ItemRef?.name}"`);
      console.log(`  Quantity: ${line.SalesItemLineDetail?.Qty}`);
      console.log(`  Unit Price: $${line.SalesItemLineDetail?.UnitPrice}`);
      console.log(`  Extended Amount: $${line.Amount}`);
    } else if (line.DetailType === 'DescriptionOnly') {
      const desc = line.Description || '(empty)';
      console.log(`  Text: "${desc.substring(0, 100)}${desc.length > 100 ? '...' : ''}"`);
    }
  });

  console.log('===============================================================');
  console.log(`COMPARISON: Sent ${sentLines.length} lines, QB returned ${returnedLines.length} lines`);
  if (sentLines.length !== returnedLines.length) {
    console.log(`WARNING: Line count mismatch!`);
  }
  console.log('===============================================================\n');

  return {
    linesSent: sentLines.length,
    linesReturned: returnedLines.length,
    sentLines: sentLines,
    returnedLines: returnedLines,
    fullEstimate: fetchedEstimate.Estimate,
  };
}

/**
 * Fetch estimate from QuickBooks for analysis
 * Used by debug endpoints
 *
 * @param estimateId - QuickBooks estimate ID
 * @param realmId - Optional realm ID (uses default if not provided)
 * @returns Formatted estimate data
 */
export async function fetchEstimateForAnalysis(
  estimateId: string,
  realmId?: string
): Promise<{
  id: string;
  docNumber: string;
  totalAmount: number;
  lineCount: number;
  lines: any[];
  raw: any;
}> {
  // Fetch default realm ID if not provided
  const targetRealmId = realmId || await quickbooksRepository.getDefaultRealmId();

  if (!targetRealmId) {
    throw new Error('Not connected to QuickBooks');
  }

  console.log('\nFETCHING QUICKBOOKS ESTIMATE');
  console.log('================================');
  console.log(`Estimate ID: ${estimateId}`);
  console.log(`Realm ID: ${targetRealmId}`);

  const response = await makeQBApiCall('GET', `estimate/${estimateId}`, targetRealmId, {});
  const estimate = response.Estimate;

  if (!estimate) {
    throw new Error('Estimate not found');
  }

  console.log('\nQUICKBOOKS ESTIMATE STRUCTURE');
  console.log('==================================');
  console.log(`Doc Number: ${estimate.DocNumber}`);
  console.log(`Total Amount: ${estimate.TotalAmt}`);
  console.log(`Line Items: ${estimate.Line ? estimate.Line.length : 0}`);

  return {
    id: estimate.Id,
    docNumber: estimate.DocNumber,
    totalAmount: estimate.TotalAmt,
    lineCount: estimate.Line ? estimate.Line.length : 0,
    lines: estimate.Line || [],
    raw: estimate,
  };
}

/**
 * Test logging functionality
 * Simple endpoint to verify logs are working
 */
export function testLogging(): { success: boolean; message: string; timestamp: string } {
  console.log('\nQUICKBOOKS LOGGING TEST');
  console.log('==========================');
  console.log('Logging is working!');
  console.log('Timestamp:', new Date().toISOString());
  console.log('==========================\n');

  return {
    success: true,
    message: 'Logging test successful - check logs',
    timestamp: new Date().toISOString(),
  };
}
