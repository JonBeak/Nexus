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
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
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
  taxName,
  cash,
  onPartsChange
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
  } = useTableData(initialParts, onPartsChange);

  const {
    handleFieldSave,
    handleTemplateSave,
    handleSpecFieldSave,
    addSpecRow,
    removeSpecRow,
    insertSpecRowAfter,
    deleteSpecRow,
    clearSpecRow,
    toggleIsParent,
    addPartRow,
    removePartRow,
    reorderParts,
    duplicatePart,
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

  // Setup drag-and-drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 3, // Require 3px of movement before drag starts (prevents accidental drags)
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle drag end event
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return; // No change in position
    }

    // Find the indices
    const oldIndex = parts.findIndex(p => p.part_id === active.id);
    const newIndex = parts.findIndex(p => p.part_id === over.id);

    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    // Create new order by moving the item
    const reorderedParts = [...parts];
    const [movedPart] = reorderedParts.splice(oldIndex, 1);
    reorderedParts.splice(newIndex, 0, movedPart);

    // Update local state immediately for responsive UI
    setParts(reorderedParts);

    // Send reorder to backend
    const partIds = reorderedParts.map(p => p.part_id);
    reorderParts(partIds);
  };

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
    <div className="bg-white rounded-lg shadow overflow-hidden w-fit max-w-full">
      <div className="overflow-x-auto w-fit max-w-full">
        {/* Header */}
        <TableHeader />

        {/* Body */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={parts.map(p => p.part_id)}
            strategy={verticalListSortingStrategy}
          >
            <div>
              {parts.length > 0 ? (
                parts.map((part) => (
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
                    onInsertAfter={insertSpecRowAfter}
                    onDelete={deleteSpecRow}
                    onClear={clearSpecRow}
                    onToggleParent={toggleIsParent}
                    onRemovePartRow={removePartRow}
                    onDuplicatePart={duplicatePart}
                    onUpdate={handleRefreshParts}
                  />
                ))
              ) : (
                <div className="p-6 text-center text-gray-500">
                  No parts to display
                </div>
              )}
            </div>
          </SortableContext>
        </DndContext>

        {/* Footer - Invoice Summary */}
        <InvoiceSummary
          parts={parts}
          taxName={cash ? 'Out of Scope' : taxName}
          taxRules={taxRules}
          onAddPartRow={addPartRow}
        />
      </div>
    </div>
  );
};

export default DualTableLayout;
