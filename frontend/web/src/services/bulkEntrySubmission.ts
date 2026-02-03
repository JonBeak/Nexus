// File Clean up Finished: 2025-11-25
import { BulkEntry } from '../hooks/useBulkEntries';
import { VinylItem } from '../components/inventory/types';
import { OrderSuggestion } from '../components/common/OrderDropdown';
import { vinylApi } from './api';
import { validateBulkEntries } from './bulkEntry/bulkEntryValidation';
import { getTodayString } from '../utils/dateUtils';

interface SubmissionResult {
  success: boolean;
  entryId?: string;
  error?: string;
}

export const submitBulkEntries = async (
  bulkEntries: BulkEntry[],
  vinylItems: VinylItem[],
  _availableOrders: OrderSuggestion[],  // Currently unused but kept for API consistency
  showNotification: (message: string, type?: 'success' | 'error') => void
): Promise<{
  success: boolean;
  successCount: number;
  failCount: number;
  results: SubmissionResult[];
  successfulEntryIds: string[];
}> => {
  try {
    // Filter out empty entries
    const validEntries = bulkEntries.filter(entry => 
      entry.type && 
      entry.brand && 
      entry.series && 
      (entry.colour_number || entry.colour_name) &&
      entry.width && 
      entry.length_yards &&
      parseFloat(entry.length_yards) > 0
    );

    if (validEntries.length === 0) {
      showNotification('No valid entries to submit', 'error');
      return { success: false, successCount: 0, failCount: 0, results: [], successfulEntryIds: [] };
    }

    // Validate entries
    const validationErrors = validateBulkEntries(validEntries, vinylItems);
    if (validationErrors.length > 0) {
      showNotification(`Validation failed: ${validationErrors.join('; ')}`, 'error');
      return { success: false, successCount: 0, failCount: 0, results: [], successfulEntryIds: [] };
    }

    const results: SubmissionResult[] = [];
    const usedVinylIds = new Set<number>(); // Track vinyl IDs that have been used in this batch

    // Process each entry
    for (const entry of validEntries) {
      try {
        // Use job_ids from entry but pass as order_ids to API
        const processedOrderIds = (entry.job_ids || []).filter((id): id is number => id !== null && id > 0);

        if (entry.type === 'use') {
          // If a specific vinyl ID is selected, use that directly
          let matchingVinyl;
          
          if (entry.specific_vinyl_id) {
            // Use the specific vinyl piece selected by the user
            matchingVinyl = vinylItems.find(vinyl => {
              return vinyl.id === entry.specific_vinyl_id &&
                     vinyl.disposition === 'in_stock' &&
                     !usedVinylIds.has(vinyl.id);
            });
          } else {
            // Find matching vinyl item that hasn't been used in this batch (legacy behavior)
            matchingVinyl = vinylItems.find(vinyl => {
              // Skip if already used in this batch
              if (usedVinylIds.has(vinyl.id)) return false;

              // Must be in stock
              if (vinyl.disposition !== 'in_stock') return false;

              const basicMatch = vinyl.brand === entry.brand &&
                                vinyl.series === entry.series &&
                                vinyl.width === entry.width &&
                                parseFloat(vinyl.length_yards?.toString() || '0') >= parseFloat(entry.length_yards || '0');

              if (!basicMatch) return false;

              // Check color matching using separate fields
              const numberMatch = entry.colour_number 
                ? vinyl.colour_number === entry.colour_number
                : true;

              const nameMatch = entry.colour_name
                ? vinyl.colour_name?.toLowerCase() === entry.colour_name.toLowerCase()
                : true;

              return numberMatch && nameMatch;
            });
          }

          if (!matchingVinyl) {
            const errorMessage = entry.specific_vinyl_id 
              ? `Selected vinyl piece #${entry.specific_vinyl_id} is not available or already used`
              : `No available inventory found for ${entry.brand} ${entry.series} ${entry.colour_number || ''} ${entry.colour_name || ''} ${entry.width}"`;
            
            results.push({
              success: false,
              entryId: entry.id,
              error: errorMessage
            });
            continue;
          }

          // Mark this vinyl as used
          usedVinylIds.add(matchingVinyl.id);

          // Use the specialized endpoint for marking as used
          const result = await vinylApi.markVinylAsUsed(matchingVinyl.id, {
            usage_note: entry.notes || '',
            order_ids: processedOrderIds
          });

          // API client unwraps { success: true, data: T } to just T
          // So if we get a result without throwing, it was successful
          const isSuccess = result && typeof result === 'object';
          results.push({
            success: !!isSuccess,
            entryId: entry.id,
            error: isSuccess ? undefined : 'Failed to update vinyl item'
          });
        } else {
          // Handle store/waste/returned/damaged entries - create new vinyl items
          const transactionDate = entry.transaction_date || getTodayString();
          const createData = {
            brand: entry.brand,
            series: entry.series,
            colour_number: entry.colour_number,
            colour_name: entry.colour_name,
            width: entry.width,
            length_yards: entry.length_yards,
            location: entry.location || '',
            purchase_date: transactionDate,
            storage_date: transactionDate,
            notes: entry.notes || '',
            order_ids: processedOrderIds
          };

          const result = await vinylApi.createVinylItem(createData);

          // API client unwraps { success: true, data: T } to just T
          // So if we get a result without throwing, it was successful
          const isSuccess = result && typeof result === 'object';
          results.push({
            success: !!isSuccess,
            entryId: entry.id,
            error: isSuccess ? undefined : 'Failed to create vinyl item'
          });
        }
      } catch (error) {
        console.error('Error processing bulk entry:', error);
        results.push({
          success: false,
          entryId: entry.id,
          error: error instanceof Error ? error.message : 'Unknown error occurred'
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.length - successCount;

    if (successCount > 0) {
      showNotification(
        failCount === 0 
          ? `Successfully processed ${successCount} entries`
          : `Processed ${successCount} entries successfully, ${failCount} failed`,
        failCount === 0 ? 'success' : 'error'
      );
    }

    const successfulEntryIds = results
      .filter(r => r.success && r.entryId)
      .map(r => r.entryId!);

    return {
      success: successCount > 0,
      successCount,
      failCount,
      results,
      successfulEntryIds
    };

  } catch (error) {
    console.error('Bulk submission error:', error);
    showNotification('Failed to submit bulk entries', 'error');
    return { success: false, successCount: 0, failCount: 0, results: [], successfulEntryIds: [] };
  }
};
