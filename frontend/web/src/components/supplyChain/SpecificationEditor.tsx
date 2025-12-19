/**
 * SpecificationEditor Component
 * Reusable drag-and-drop specification editor for archetype specs and supplier product specs
 * Supports both key-only templates (for archetype templates) and key-value pairs (for supplier specs)
 */

import React, { useRef } from 'react';
import { GripVertical, X } from 'lucide-react';

export interface SpecRow {
  key: string;
  value?: string;
}

interface SpecificationEditorProps {
  specRows: SpecRow[];
  setSpecRows: (rows: SpecRow[]) => void;
  disabled?: boolean;
  archetypeTemplate?: string[] | null;
  mode?: 'template' | 'supplier'; // 'template' = keys only, 'supplier' = key-value pairs
}

export const SpecificationEditor: React.FC<SpecificationEditorProps> = ({
  specRows,
  setSpecRows,
  disabled = false,
  archetypeTemplate,
  mode = 'supplier'
}) => {
  const dragItem = useRef<number | null>(null);
  const specRowRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    dragItem.current = index;
    e.dataTransfer.effectAllowed = 'move';
    const rowElement = specRowRefs.current[index];
    if (rowElement) {
      e.dataTransfer.setDragImage(rowElement, 0, 0);
    }
  };

  const handleDragEnter = (index: number) => {
    if (dragItem.current === null || dragItem.current === index) return;

    const draggedItem = dragItem.current;
    const draggedOverItem = index;

    const newRows = [...specRows];
    const draggedItemContent = newRows[draggedItem];
    newRows[draggedItem] = newRows[draggedOverItem];
    newRows[draggedOverItem] = draggedItemContent;

    dragItem.current = draggedOverItem;
    setSpecRows(newRows);
  };

  const handleDragEnd = () => {
    dragItem.current = null;
  };

  // Add/remove row handlers
  const addSpecRow = () => {
    if (mode === 'template') {
      setSpecRows([...specRows, { key: '' }]);
    } else {
      setSpecRows([...specRows, { key: '', value: '' }]);
    }
  };

  const removeSpecRow = (index: number) => {
    if (specRows.length > 1) {
      setSpecRows(specRows.filter((_, i) => i !== index));
    }
  };

  const updateSpecRow = (index: number, field: 'key' | 'value', value: string) => {
    const updated = [...specRows];
    if (field === 'key' || field === 'value') {
      (updated[index] as any)[field] = value;
    }
    setSpecRows(updated);
  };

  return (
    <div>
      <div className="space-y-2">
        {specRows.map((row, index) => (
          <div
            key={index}
            ref={(el) => { specRowRefs.current[index] = el; }}
            onDragEnter={() => handleDragEnter(index)}
            onDragOver={(e) => e.preventDefault()}
            className="flex gap-2 items-center group bg-white"
          >
            <div
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragEnd={handleDragEnd}
              className={`p-1 text-gray-300 hover:text-gray-500 group-hover:text-gray-400 ${
                disabled ? 'cursor-not-allowed opacity-50' : 'cursor-grab active:cursor-grabbing'
              }`}
            >
              <GripVertical className="w-4 h-4" />
            </div>

            <input
              type="text"
              placeholder={mode === 'template' ? 'Key (e.g., thickness, color)' : 'Key'}
              value={row.key}
              onChange={(e) => updateSpecRow(index, 'key', e.target.value)}
              disabled={disabled}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-purple-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            />

            {mode === 'supplier' && (
              <input
                type="text"
                placeholder="Value (e.g., 3mm)"
                value={row.value || ''}
                onChange={(e) => updateSpecRow(index, 'value', e.target.value)}
                disabled={disabled}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-purple-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
            )}

            <button
              onClick={() => removeSpecRow(index)}
              disabled={disabled || specRows.length === 1}
              className="p-2 text-gray-400 hover:text-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={addSpecRow}
          disabled={disabled}
          className="text-sm text-purple-600 hover:text-purple-700 ml-6 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          + Add {mode === 'template' ? 'specification key' : 'specification'}
        </button>
      </div>

      {archetypeTemplate && archetypeTemplate.length > 0 && (
        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-xs font-medium text-blue-900 mb-2">Archetype Template:</p>
          <div className="flex flex-wrap gap-2">
            {archetypeTemplate.map((key) => (
              <span
                key={key}
                className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded border border-blue-300"
              >
                {key}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
