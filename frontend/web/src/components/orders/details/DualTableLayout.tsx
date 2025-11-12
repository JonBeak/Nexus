/**
 * DualTableLayout Component
 * Unified table for order parts with specifications and invoice details
 *
 * REFACTORED: Phase 6 - Main component simplified to orchestration only
 * Original: 1703 lines → Refactored: ~100 lines (94% reduction)
 *
 * Architecture:
 * - Components extracted to dualtable/components/
 * - Hooks extracted to dualtable/hooks/
 * - Utils extracted to dualtable/utils/
 * - Constants extracted to dualtable/constants/
 */

import React, { useMemo } from 'react';
import { getAllTemplateNames } from '@/config/orderProductTemplates';
import { DualTableLayoutProps } from './dualtable/constants/tableConstants';
import { useTableData } from './dualtable/hooks/useTableData';
import { usePartUpdates } from './dualtable/hooks/usePartUpdates';
import { TableHeader } from './dualtable/components/TableHeader';
import { PartRow } from './dualtable/components/PartRow';
import { InvoiceSummary } from './dualtable/components/InvoiceSummary';

export const DualTableLayout: React.FC<DualTableLayoutProps> = ({
  orderNumber,
  initialParts,
  taxName
}) => {
  // Use custom hooks for data and updates
  const {
    parts,
    setParts,
    partsRef,
    qbItems,
    taxRules,
    specRowCounts,
    setSpecRowCounts
  } = useTableData(initialParts);

  const {
    handleFieldSave,
    handleTemplateSave,
    handleSpecFieldSave,
    addSpecRow,
    removeSpecRow,
    toggleIsParent,
    handleRefreshParts
  } = usePartUpdates({
    orderNumber,
    parts,
    setParts,
    partsRef,
    specRowCounts,
    setSpecRowCounts
  });

  // Memoize available templates (prevent re-creation on every render)
  const availableTemplates = useMemo(() => getAllTemplateNames(), []);

  // Calculate row counts for each part (memoized)
  const rowCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    parts.forEach(part => {
      const templateCount = part.specifications
        ? Object.keys(part.specifications).filter(key => key.startsWith('_template_')).length
        : 0;
      counts[part.part_id] = specRowCounts[part.part_id] || templateCount || 1;
    });
    return counts;
  }, [parts, specRowCounts]);

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="overflow-x-auto">
        {/* Header */}
        <TableHeader />

        {/* Body */}
        <div>
          {parts.length > 0 ? (
            parts.map(part => (
              <PartRow
                key={part.part_id}
                part={part}
                orderNumber={orderNumber}
                availableTemplates={availableTemplates}
                qbItems={qbItems}
                rowCount={rowCounts[part.part_id]}
                onFieldSave={handleFieldSave}
                onTemplateSave={handleTemplateSave}
                onSpecFieldSave={handleSpecFieldSave}
                onAddRow={addSpecRow}
                onRemoveRow={removeSpecRow}
                onToggleParent={toggleIsParent}
                onUpdate={handleRefreshParts}
              />
            ))
          ) : (
            <div className="p-6 text-center text-gray-500">
              No parts to display
            </div>
          )}
        </div>

        {/* Footer - Invoice Summary */}
        <InvoiceSummary
          parts={parts}
          taxName={taxName}
          taxRules={taxRules}
        />
      </div>
    </div>
  );
};

export default DualTableLayout;
