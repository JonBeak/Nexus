# Import QB Descriptions - Backwards Compatibility Plan

## Problem

The "Import QB Descriptions" modal currently only loads from `estimate_preparation_items` table. This table only exists for estimates that went through the new "Prepare to Send" UI flow.

**Result:** Older estimates (sent/approved before this feature) show "No prepared items" even though they have QB descriptions stored elsewhere.

## Data Sources

| Source | Table | Has QB Description | Has Qty | Has Price | When Populated |
|--------|-------|-------------------|---------|-----------|----------------|
| Preparation Items | `estimate_preparation_items` | ✅ | ✅ | ✅ | New "Prepare to Send" flow |
| Line Descriptions | `estimate_line_descriptions` | ✅ | ❌ | ❌ | EstimateTable QB Description column |
| Grid Data | `job_estimate_items.grid_data` | ❌ | ✅ | ✅ | Always (raw calculation data) |

## Solution: Fallback Chain

When loading source items for import, try sources in this order:

```
1. estimate_preparation_items (full data - preferred)
   ↓ if empty
2. estimate_line_descriptions + grid preview data (hybrid)
   ↓ if empty
3. Show "No importable data" message
```

## Implementation

### Backend Changes

**New endpoint or modify existing:**
```
GET /job-estimation/estimates/:estimateId/importable-items
```

**Logic:**
```typescript
async getImportableItems(estimateId: number) {
  // 1. Try preparation items first
  const prepItems = await estimatePreparationRepository.getItemsByEstimateId(estimateId);
  if (prepItems.length > 0) {
    return { source: 'preparation', items: prepItems };
  }

  // 2. Fall back to line descriptions + grid data
  const lineDescriptions = await estimateLineDescriptionRepository.getDescriptionsByEstimateId(estimateId);
  if (lineDescriptions.length > 0) {
    // Get grid preview data for quantities/prices
    const estimate = await estimateRepository.getEstimateById(estimateId);
    const gridItems = await estimateItemRepository.getItemsByEstimateId(estimateId);

    // Merge line descriptions with grid preview data
    const mergedItems = mergeDescriptionsWithGridData(lineDescriptions, gridItems, estimate);
    return { source: 'line_descriptions', items: mergedItems };
  }

  // 3. No importable data
  return { source: 'none', items: [] };
}
```

**Merge function:**
```typescript
function mergeDescriptionsWithGridData(
  descriptions: EstimateLineDescription[],
  gridItems: EstimateItem[],
  estimate: EstimateVersion
): ImportableItem[] {
  // Use CalculationLayer to generate preview data from grid
  const previewData = generatePreviewFromGrid(gridItems, estimate);

  return descriptions.map(desc => {
    const previewLine = previewData.lineItems[desc.line_index];
    return {
      id: desc.id,
      display_order: desc.line_index,
      item_name: previewLine?.productTypeName || 'Unknown',
      qb_description: desc.qb_description,
      calculation_display: previewLine?.calculationDisplay || null,
      quantity: previewLine?.quantity || 1,
      unit_price: previewLine?.unitPrice || 0,
      extended_price: previewLine?.extendedPrice || 0,
      is_description_only: false,
      // Mark source for UI differentiation
      _source: 'line_descriptions'
    };
  });
}
```

### Frontend Changes

**ImportQBDescriptionsModal.tsx:**
```typescript
const handleSourceSelect = useCallback(async (estimate: ImportSourceEstimate) => {
  setSourceLoading(true);

  try {
    // Use new endpoint that handles fallback
    const response = await jobVersioningApi.getImportableItems(estimate.id);

    if (response.success && response.data.items.length > 0) {
      setSourceItems(response.data.items);

      // Show info if using fallback source
      if (response.data.source === 'line_descriptions') {
        setSourceInfo('Using QB descriptions from estimate (qty/price from grid data)');
      }
    } else {
      setSourceItems([]);
    }
  } catch (error) {
    setImportError('Failed to load items');
  } finally {
    setSourceLoading(false);
  }
}, []);
```

### Version Filter Update

Also update the version filter to show estimates that have EITHER:
- `is_prepared = 1` (has preparation items)
- OR has entries in `estimate_line_descriptions` table

```typescript
// Backend: Add flag to version list response
const versions = await getEstimateVersionsByJobId(jobId);
const versionsWithImportability = await Promise.all(
  versions.map(async (v) => ({
    ...v,
    has_importable_data: v.is_prepared ||
      (await hasLineDescriptions(v.id))
  }))
);
```

## Files to Modify

| File | Changes |
|------|---------|
| `backend/web/src/repositories/estimatePreparationRepository.ts` | Add `getImportableItems()` |
| `backend/web/src/controllers/estimates/estimatePreparationController.ts` | Add endpoint |
| `backend/web/src/routes/jobEstimation.ts` | Add route |
| `frontend/web/src/services/jobVersioningApi.ts` | Add API method |
| `frontend/web/src/components/.../ImportQBDescriptionsModal.tsx` | Use new endpoint |
| `frontend/web/src/components/.../SourceEstimatePanel.tsx` | Update version filter |

## UI Indicators

When showing versions in the selector, indicate data source:
- 🟢 "Prepared" - has full preparation data
- 🟡 "QB Descriptions" - has line descriptions only (fallback)
- ⚫ (hidden) - no importable data

## Testing Checklist

- [ ] Import from estimate with preparation items (new flow)
- [ ] Import from estimate with only line descriptions (old estimates)
- [ ] Import from estimate with neither (should show helpful message)
- [ ] Verify merged data accuracy (qty/price from grid matches)
- [ ] Test with estimates that have partial data
