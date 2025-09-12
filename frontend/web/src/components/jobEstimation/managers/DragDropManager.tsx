import React, { useState } from 'react';
import { flushSync } from 'react-dom';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { EstimateRow } from '../types';
import { findProductGroupStart, findProductGroupEnd, getDraggedRows } from '../utils/groupUtils';
import { updateParentAssignments } from '../utils/parentAssignmentUtils';
// Assembly references now handled in updateAssemblyGroupMappings

// Context to provide drag state to child components
interface DragDropContextType {
  activeId: string | null;
  draggedGroupRows: EstimateRow[];
  draggedRowIds: Set<string>;
  isDragCalculating: boolean;
}

const DragDropContext = React.createContext<DragDropContextType>({ 
  activeId: null,
  draggedGroupRows: [],
  draggedRowIds: new Set(),
  isDragCalculating: false
});

export const useDragDropContext = () => React.useContext(DragDropContext);

interface DragDropManagerProps {
  children: React.ReactNode;
  rows: EstimateRow[];
  onRowsReorder: (newRows: EstimateRow[]) => void;
  onEstimateChange: () => void;
  onImmediateSave?: () => Promise<void>;
  onReloadGridData?: () => Promise<void>;
}

export const DragDropManager: React.FC<DragDropManagerProps> = ({
  children,
  rows,
  onRowsReorder,
  onEstimateChange,
  onImmediateSave,
  onReloadGridData
}) => {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draggedGroupRows, setDraggedGroupRows] = useState<EstimateRow[]>([]);
  const [draggedRowIds, setDraggedRowIds] = useState<Set<string>>(new Set());
  const [isDragCalculating, setIsDragCalculating] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const draggedId = event.active.id as string;
    
    // PHASE 1: Set drag calculating flag immediately to pause validation
    setIsDragCalculating(true);
    setActiveId(draggedId);
    
    // Get all rows in the dragged group
    const groupedRows = getDraggedRows(draggedId, rows);
    setDraggedGroupRows(groupedRows);
    
    // Create Set of IDs for O(1) lookup performance
    setDraggedRowIds(new Set(groupedRows.map(row => row.id)));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over || active.id === over.id) {
      setActiveId(null);
      setDraggedGroupRows([]);
      setDraggedRowIds(new Set());
      setIsDragCalculating(false);  // Reset drag flag on cancelled drag
      return;
    }

    // PAUSE RENDERS during drag calculation
    setIsDragCalculating(true);
    
    // Use flushSync to batch all the drag updates together
    flushSync(() => {
      // First, let @dnd-kit do its normal move for main rows only
      const mainRows = rows.filter(row => row.isMainRow);
      const oldIndex = mainRows.findIndex(row => row.id === active.id);
      const newIndex = mainRows.findIndex(row => row.id === over.id);
      
      if (oldIndex !== newIndex) {
        // Check if dragged item is a sub-item and validate drop position
        const draggedRow = rows.find(row => row.id === active.id);
        const targetRow = rows.find(row => row.id === over.id);
        
        if (draggedRow && !draggedRow.isMainRow && !draggedRow.parentProductId) {
          // This is a sub-item being dragged - ensure it won't be at the top
          const targetIndex = rows.findIndex(row => row.id === over.id);
          
          // If dropping at position 0, or target is at position 0, prevent the drop
          if (targetIndex === 0 || (targetRow && rows.indexOf(targetRow) === 0)) {
            console.warn('⚠️ Sub-items cannot be placed at the top - they need a parent above them');
            setActiveId(null);
            setDraggedGroupRows([]);
            setDraggedRowIds(new Set());
            setIsDragCalculating(false);
            return;
          }
        }
        
        // Move the entire product group instead of just the main row
        moveRowGroup(active.id as string, over.id as string);
      }
      
      setActiveId(null);
      setDraggedGroupRows([]);
      setDraggedRowIds(new Set());
      setIsDragCalculating(false);
    });
  };

  // Helper: Build assembly position mapping (oldIndex -> newIndex)
  const buildAssemblyPositionMap = (originalRows: EstimateRow[], reorderedRows: EstimateRow[]): Record<number, number> => {
    // Assembly logic temporarily disabled
    const originalAssemblies: string[] = [];
    const reorderedAssemblies: string[] = [];
    
    return originalAssemblies.reduce((map, assemblyId, oldIndex) => {
      const newIndex = reorderedAssemblies.indexOf(assemblyId);
      if (newIndex !== -1) map[oldIndex] = newIndex;
      return map;
    }, {} as Record<number, number>);
  };

  // Helper: Build logical item number mapping for a row array
  const buildLogicalNumbers = (rows: EstimateRow[]): Record<string, number> => {
    const mapping: Record<string, number> = {};
    let logicalNumber = 0;
    
    rows.forEach((row) => {
      if (row.isMainRow && !row.parentProductId) {
        logicalNumber++;
        mapping[row.id] = logicalNumber;
      }
    });
    
    return mapping;
  };

  // Helper: Build item number change mapping (oldNumber -> newNumber)
  const buildItemNumberMap = (originalRows: EstimateRow[], reorderedRows: EstimateRow[]): Record<string, string> => {
    const oldNumbers = buildLogicalNumbers(originalRows);
    const newNumbers = buildLogicalNumbers(reorderedRows);
    
    return reorderedRows.reduce((map, row) => {
      const oldNum = oldNumbers[row.id];
      const newNum = newNumbers[row.id];
      if (oldNum && newNum && oldNum !== newNum) {
        map[oldNum.toString()] = newNum.toString();
      }
      return map;
    }, {} as Record<string, string>);
  };

  // Helper: Update assembly group memberships
  const updateAssemblyGroupMemberships = (rows: EstimateRow[], positionMap: Record<number, number>): EstimateRow[] => {
    return rows.map(row => {
      if (row.data?.assemblyGroup !== undefined) {
        const oldGroup = row.data.assemblyGroup;
        const newGroup = positionMap[oldGroup] !== undefined ? positionMap[oldGroup] : oldGroup;
        return {
          ...row,
          data: { ...row.data, assemblyGroup: newGroup }
        };
      }
      return row;
    });
  };

  // Helper: Update assembly field references  
  const updateAssemblyFieldReferences = (rows: EstimateRow[], itemNumberMap: Record<string, string>): EstimateRow[] => {
    return rows.map(row => {
      // Assembly system simplified - no field reference updates needed
      if (false) { // Remove assembly logic
        const updatedData = { ...row.data };
        
        // Check all 11 assembly item fields
        for (let fieldNum = 1; fieldNum <= 11; fieldNum++) {
          const fieldName = `item_${fieldNum}`;
          const fieldValue = updatedData[fieldName];
          
          if (fieldValue && itemNumberMap[fieldValue]) {
            updatedData[fieldName] = itemNumberMap[fieldValue];
          }
        }
        
        return { ...row, data: updatedData };
      }
      return row;
    });
  };

  // Main function: Update assembly mappings after drag operations
  const updateAssemblyGroupMappings = (originalRows: EstimateRow[], reorderedRows: EstimateRow[]): EstimateRow[] => {
    const assemblyPositionMap = buildAssemblyPositionMap(originalRows, reorderedRows);
    const itemNumberMap = buildItemNumberMap(originalRows, reorderedRows);
    
    let updatedRows = updateAssemblyGroupMemberships(reorderedRows, assemblyPositionMap);
    updatedRows = updateAssemblyFieldReferences(updatedRows, itemNumberMap);
    
    return updatedRows;
  };

  const moveRowGroup = (draggedRowId: string, dropTargetRowId: string) => {
    const draggedRowIndex = rows.findIndex(row => row.id === draggedRowId);
    const dropTargetIndex = rows.findIndex(row => row.id === dropTargetRowId);
    
    if (draggedRowIndex === -1 || dropTargetIndex === -1) {
      return;
    }


    // Use getDraggedRows to get ALL related rows (including scattered sub-items)
    const sourceGroupRows = getDraggedRows(draggedRowId, rows);
    
    if (sourceGroupRows.length === 0) {
      return;
    }
    
    // Find destination position
    const destGroupEnd = findProductGroupEnd(dropTargetIndex, rows);
    const destGroupStart = findProductGroupStart(dropTargetIndex, rows);
    
    // Prevent dropping inside a product group
    let actualDestIndex: number;
    
    if (dropTargetIndex > draggedRowIndex) {
      // Moving down: place after the complete destination group
      actualDestIndex = destGroupEnd + 1;
    } else {
      // Moving up: place at the start of the destination group
      actualDestIndex = destGroupStart;
    }
    
    // Create new rows array by removing all source rows first
    let newRows = rows.filter(row => !sourceGroupRows.some(sourceRow => sourceRow.id === row.id));
    
    // Recalculate insertion index since we've removed rows
    const updatedDestIndex = newRows.findIndex(row => row.id === dropTargetRowId);
    if (updatedDestIndex === -1) {
      return;
    }
    
    const updatedDestGroupEnd = findProductGroupEnd(updatedDestIndex, newRows);
    const updatedDestGroupStart = findProductGroupStart(updatedDestIndex, newRows);
    
    let finalDestIndex: number;
    if (dropTargetIndex > draggedRowIndex) {
      finalDestIndex = updatedDestGroupEnd + 1;
    } else {
      finalDestIndex = updatedDestGroupStart;
    }
    
    
    // Insert the group at the new position (keep them together)
    newRows.splice(finalDestIndex, 0, ...sourceGroupRows);
    
    // Fix assembly group mappings and assembly field references after reordering
    const assemblyUpdatedRows = updateAssemblyGroupMappings(rows, newRows);
    
    // Update parent assignments based on new positions
    const finalRows = updateParentAssignments(assemblyUpdatedRows);
    
    // ✅ ASSEMBLY FIELDS: Now handled directly in updateAssemblyGroupMappings using itemNumberMapping
    // ✅ FIXED: Use finalRows with correct assembly color mappings and updated assembly refs
    onRowsReorder(finalRows);
    
    // ✅ ASSEMBLY FIELD UPDATES: Now handled immediately via itemNumberMapping
    // No need for save/reload - assembly fields update instantly during drag operation
    // The normal auto-save system will persist changes when appropriate
    
    // Note: onEstimateChange() is called by handleRowsReorder, so no need to call it again
  };


  // Get draggable items for SortableContext (main rows + sub-items, but NOT continuation rows)
  const sortableItems = rows.filter(row => 
    row.isMainRow || (!row.isMainRow && row.productTypeId)
  ).map(row => row.id);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext 
        items={sortableItems} 
        strategy={verticalListSortingStrategy}
      >
        <DragDropContext.Provider value={{ 
          activeId, 
          draggedGroupRows,
          draggedRowIds,
          isDragCalculating
        }}>
          {children}
        </DragDropContext.Provider>
      </SortableContext>
      <DragOverlay>
        {activeId ? (
          <div className="opacity-0 pointer-events-none">
            {/* Invisible drag overlay to prevent grid scrolling */}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};