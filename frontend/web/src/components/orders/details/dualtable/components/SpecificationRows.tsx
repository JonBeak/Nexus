/**
 * SpecificationRows Component
 * Extracted from DualTableLayout.tsx (Phase 5)
 *
 * Renders specification columns for a part:
 * - Template dropdown
 * - Spec 1, Spec 2, Spec 3 fields
 * - Row actions (Insert After, Delete) - visible on hover
 *
 * Updated: Phase 1.5.e - Per-row actions with hover highlighting
 */

import React, { useState } from 'react';
import { OrderPart } from '@/types/orders';
import { getSpecificationTemplate } from '@/config/orderProductTemplates';
import { SpecTemplateDropdown } from './SpecTemplateDropdown';
import { SpecFieldInput } from './SpecFieldInput';
import { SpecRowActions } from './SpecRowActions';

interface SpecificationRowsProps {
  part: OrderPart;
  rowCount: number;
  availableTemplates: string[];
  emptySpecRows: Set<number>;
  onTemplateSave: (partId: number, rowNum: number, value: string) => Promise<void>;
  onSpecFieldSave: (partId: number, specKey: string, value: string) => Promise<void>;
  onInsertAfter: (partId: number, afterRowNum: number) => void;
  onDelete: (partId: number, rowNum: number) => void;
}

export const SpecificationRows: React.FC<SpecificationRowsProps> = ({
  part,
  rowCount,
  availableTemplates,
  emptySpecRows,
  onTemplateSave,
  onSpecFieldSave,
  onInsertAfter,
  onDelete
}) => {
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  const subRows = Array.from({ length: rowCount }, (_, i) => i + 1);

  const getRowClassName = (rowNum: number) => {
    const isHovered = hoveredRow === rowNum;
    return `transition-colors -my-[0.5px] `;
  };

  return (
    <>
      {/* Specifications column - template dropdowns */}
      <div className="flex flex-col -mr-[8.5px] -mx-[0.5px] py-1">
        {subRows.map((rowNum) => {
          const currentValue = part.specifications?.[`_template_${rowNum}`] || '';
          const hasValue = !!currentValue;
          const isEmpty = emptySpecRows.has(rowNum);

          return (
            <div
              key={`${part.part_id}-template-${rowNum}`}
              className={getRowClassName(rowNum)}
              onMouseEnter={() => setHoveredRow(rowNum)}
              onMouseLeave={() => setHoveredRow(null)}
            >
              <SpecTemplateDropdown
                partId={part.part_id}
                rowNum={rowNum}
                currentValue={currentValue}
                onSave={onTemplateSave}
                availableTemplates={availableTemplates}
                hasValue={hasValue}
                isEmpty={isEmpty}
              />
            </div>
          );
        })}
      </div>

      {/* Spec 1 column */}
      <div className="flex flex-col -mr-[7.5px] -mx-[0.5px] py-1">
        {subRows.map((rowNum) => {
          const selectedTemplateName = part.specifications?.[`_template_${rowNum}`] || '';
          const template = selectedTemplateName ? getSpecificationTemplate(selectedTemplateName) : undefined;
          const field = template?.spec1;
          const isEmpty = emptySpecRows.has(rowNum);

          if (!field) {
            return (
              <div
                key={`${part.part_id}-spec1-${rowNum}`}
                className={getRowClassName(rowNum)}
                onMouseEnter={() => setHoveredRow(rowNum)}
                onMouseLeave={() => setHoveredRow(null)}
              >
                <div className="h-[26px]"></div>
              </div>
            );
          }

          const specKey = `row${rowNum}_${field.key}`;
          const currentValue = part.specifications?.[specKey] ?? '';
          const hasValue = field.type === 'boolean'
            ? (currentValue === 'true' || currentValue === 'false' || currentValue === true || currentValue === false)
            : !!currentValue;

          return (
            <div
              key={`${part.part_id}-spec1-${rowNum}`}
              className={getRowClassName(rowNum)}
              onMouseEnter={() => setHoveredRow(rowNum)}
              onMouseLeave={() => setHoveredRow(null)}
            >
              <SpecFieldInput
                partId={part.part_id}
                rowNum={rowNum}
                field={field}
                specKey={specKey}
                currentValue={currentValue}
                onSave={onSpecFieldSave}
                hasValue={hasValue}
                isEmpty={isEmpty}
              />
            </div>
          );
        })}
      </div>

      {/* Spec 2 column */}
      <div className="flex flex-col -mr-2 -mx-[1px] py-1">
        {subRows.map((rowNum) => {
          const selectedTemplateName = part.specifications?.[`_template_${rowNum}`] || '';
          const template = selectedTemplateName ? getSpecificationTemplate(selectedTemplateName) : undefined;
          const field = template?.spec2;
          const isEmpty = emptySpecRows.has(rowNum);

          if (!field) {
            return (
              <div
                key={`${part.part_id}-spec2-${rowNum}`}
                className={getRowClassName(rowNum)}
                onMouseEnter={() => setHoveredRow(rowNum)}
                onMouseLeave={() => setHoveredRow(null)}
              >
                <div className="h-[26px]"></div>
              </div>
            );
          }

          const specKey = `row${rowNum}_${field.key}`;
          const currentValue = part.specifications?.[specKey] ?? '';
          const hasValue = field.type === 'boolean'
            ? (currentValue === 'true' || currentValue === 'false' || currentValue === true || currentValue === false)
            : !!currentValue;

          return (
            <div
              key={`${part.part_id}-spec2-${rowNum}`}
              className={getRowClassName(rowNum)}
              onMouseEnter={() => setHoveredRow(rowNum)}
              onMouseLeave={() => setHoveredRow(null)}
            >
              <SpecFieldInput
                partId={part.part_id}
                rowNum={rowNum}
                field={field}
                specKey={specKey}
                currentValue={currentValue}
                onSave={onSpecFieldSave}
                hasValue={hasValue}
                isEmpty={isEmpty}
              />
            </div>
          );
        })}
      </div>

      {/* Spec 3 column */}
      <div className="flex flex-col -mr-2 -mx-[1px] py-1">
        {subRows.map((rowNum) => {
          const selectedTemplateName = part.specifications?.[`_template_${rowNum}`] || '';
          const template = selectedTemplateName ? getSpecificationTemplate(selectedTemplateName) : undefined;
          const field = template?.spec3;
          const isEmpty = emptySpecRows.has(rowNum);

          if (!field) {
            return (
              <div
                key={`${part.part_id}-spec3-${rowNum}`}
                className={getRowClassName(rowNum)}
                onMouseEnter={() => setHoveredRow(rowNum)}
                onMouseLeave={() => setHoveredRow(null)}
              >
                <div className="h-[26px]"></div>
              </div>
            );
          }

          const specKey = `row${rowNum}_${field.key}`;
          const currentValue = part.specifications?.[specKey] ?? '';
          const hasValue = field.type === 'boolean'
            ? (currentValue === 'true' || currentValue === 'false' || currentValue === true || currentValue === false)
            : !!currentValue;

          return (
            <div
              key={`${part.part_id}-spec3-${rowNum}`}
              className={getRowClassName(rowNum)}
              onMouseEnter={() => setHoveredRow(rowNum)}
              onMouseLeave={() => setHoveredRow(null)}
            >
              <SpecFieldInput
                partId={part.part_id}
                rowNum={rowNum}
                field={field}
                specKey={specKey}
                currentValue={currentValue}
                onSave={onSpecFieldSave}
                hasValue={hasValue}
                isEmpty={isEmpty}
              />
            </div>
          );
        })}
      </div>

      {/* Actions column - per-row insert/delete buttons */}
      <div className="flex flex-col py-1">
        {subRows.map((rowNum) => (
          <div
            key={`${part.part_id}-actions-${rowNum}`}
            className={`flex items-center justify-center ${getRowClassName(rowNum)}`}
            style={{ minHeight: '26px' }}
            onMouseEnter={() => setHoveredRow(rowNum)}
            onMouseLeave={() => setHoveredRow(null)}
          >
            <div style={{ opacity: hoveredRow === rowNum ? 1 : 0 }} className="transition-opacity ml-[8px]">
              <SpecRowActions
                partId={part.part_id}
                rowNum={rowNum}
                totalRows={rowCount}
                onInsertAfter={onInsertAfter}
                onDelete={onDelete}
              />
            </div>
          </div>
        ))}
      </div>
    </>
  );
};

export default SpecificationRows;
