/**
 * useTableData Hook
 * Extracted from DualTableLayout.tsx (Phase 3)
 *
 * Manages data fetching and synchronization for the table:
 * - Fetches QuickBooks items on mount
 * - Fetches tax rules on mount
 * - Synchronizes parts when initialParts changes
 * - Manages specification row counts
 */

import { useState, useEffect, useRef } from 'react';
import { quickbooksApi, provincesApi } from '@/services/api';
import { OrderPart } from '@/types/orders';
import { QBItem, TaxRule } from '../constants/tableConstants';

export const useTableData = (
  initialParts: OrderPart[],
  onPartsChange?: (parts: OrderPart[]) => void
) => {
  const [parts, setParts] = useState<OrderPart[]>(initialParts);
  const partsRef = useRef<OrderPart[]>(initialParts);
  const lastNotifiedPartsRef = useRef<OrderPart[]>(initialParts);
  const [qbItems, setQbItems] = useState<QBItem[]>([]);
  const [taxRules, setTaxRules] = useState<TaxRule[]>([]);
  const [specRowCounts, setSpecRowCounts] = useState<Record<number, number>>({});

  // Fetch QuickBooks items and tax rules on mount
  useEffect(() => {
    const fetchQBItems = async () => {
      try {
        const response = await quickbooksApi.getItems();
        if (response.success) {
          setQbItems(response.items);
        }
      } catch (error) {
        console.error('Error fetching QB items:', error);
      }
    };

    const fetchTaxRules = async () => {
      try {
        const rules = await provincesApi.getTaxRules();
        setTaxRules(rules);
      } catch (error) {
        console.error('Error fetching tax rules:', error);
      }
    };

    fetchQBItems();
    fetchTaxRules();
  }, []);

  // Sync parts when initialParts changes
  useEffect(() => {
    setParts(initialParts);
    partsRef.current = initialParts;
    lastNotifiedPartsRef.current = initialParts;
    // Initialize row counts for each part from specifications._row_count
    // If no _row_count, leave undefined so renderPartRow uses template count
    const initialCounts: Record<number, number> = {};
    initialParts.forEach(part => {
      if (part.specifications?._row_count) {
        initialCounts[part.part_id] = part.specifications._row_count;
      }
      // Don't set a default - let renderPartRow calculate from templates
    });
    setSpecRowCounts(initialCounts);
  }, [initialParts]);

  // Keep partsRef in sync with parts state
  useEffect(() => {
    partsRef.current = parts;
  }, [parts]);

  // Notify parent when parts change (only if actually different from last notification)
  useEffect(() => {
    // Skip if parts haven't changed since last notification
    if (parts === lastNotifiedPartsRef.current) {
      return;
    }

    if (onPartsChange) {
      lastNotifiedPartsRef.current = parts;
      onPartsChange(parts);
    }
    // Note: onPartsChange is intentionally excluded from deps to prevent unnecessary re-runs
    // when the callback reference changes. The effect should only run when parts change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parts]);

  return {
    parts,
    setParts,
    partsRef,
    qbItems,
    taxRules,
    specRowCounts,
    setSpecRowCounts
  };
};
