/**
 * SpecificationRows Component
 * Extracted from DualTableLayout.tsx (Phase 5)
 *
 * Renders specification columns for a part:
 * - Template dropdown
 * - Spec 1, Spec 2, Spec 3 fields
 * Handles multi-row rendering based on rowCount
 */

import React from 'react';
import { OrderPart } from '@/types/orders';
import { getSpecificationTemplate } from '@/config/orderProductTemplates';
import { SpecTemplateDropdown } from './SpecTemplateDropdown';
import { SpecFieldInput } from './SpecFieldInput';

interface SpecificationRowsProps {
  part: OrderPart;
  rowCount: number;
  availableTemplates: string[];
  onTemplateSave: (partId: number, rowNum: number, value: string) => Promise<void>;
  onSpecFieldSave: (partId: number, specKey: string, value: string) => Promise<void>;
}

export const SpecificationRows: React.FC<SpecificationRowsProps> = ({
  part,
  rowCount,
  availableTemplates,
  onTemplateSave,
  onSpecFieldSave
}) => {
  const subRows = Array.from({ length: rowCount }, (_, i) => i + 1);

  return (
    <>
      {/* Specifications column - template dropdowns */}
      <div className="flex flex-col">
        {subRows.map((rowNum) => {
          const currentValue = part.specifications?.[`_template_${rowNum}`] || '';
          const hasValue = !!currentValue;

          return (
            <div key={`${part.part_id}-template-${rowNum}`} className={rowNum > 1 ? 'border-t border-gray-100 py-0.5' : 'py-0.5'}>
              <SpecTemplateDropdown
                partId={part.part_id}
                rowNum={rowNum}
                currentValue={currentValue}
                onSave={onTemplateSave}
                availableTemplates={availableTemplates}
                hasValue={hasValue}
              />
            </div>
          );
        })}
      </div>

      {/* Spec 1 column */}
      <div className="flex flex-col">
        {subRows.map((rowNum) => {
          const selectedTemplateName = part.specifications?.[`_template_${rowNum}`] || '';
          const template = selectedTemplateName ? getSpecificationTemplate(selectedTemplateName) : undefined;
          const field = template?.spec1;

          if (!field) {
            return (
              <div key={`${part.part_id}-spec1-${rowNum}`} className={rowNum > 1 ? 'border-t border-gray-100 py-0.5' : 'py-0.5'}>
                <div className="h-[26px] flex items-center text-xs text-gray-400">-</div>
              </div>
            );
          }

          const specKey = `row${rowNum}_${field.key}`;
          const currentValue = part.specifications?.[specKey] ?? '';
          const hasValue = field.type === 'boolean'
            ? (currentValue === 'true' || currentValue === 'false' || currentValue === true || currentValue === false)
            : !!currentValue;

          return (
            <div key={`${part.part_id}-spec1-${rowNum}`} className={rowNum > 1 ? 'border-t border-gray-100 py-0.5' : 'py-0.5'}>
              <SpecFieldInput
                partId={part.part_id}
                rowNum={rowNum}
                field={field}
                specKey={specKey}
                currentValue={currentValue}
                onSave={onSpecFieldSave}
                hasValue={hasValue}
              />
            </div>
          );
        })}
      </div>

      {/* Spec 2 column */}
      <div className="flex flex-col">
        {subRows.map((rowNum) => {
          const selectedTemplateName = part.specifications?.[`_template_${rowNum}`] || '';
          const template = selectedTemplateName ? getSpecificationTemplate(selectedTemplateName) : undefined;
          const field = template?.spec2;

          if (!field) {
            return (
              <div key={`${part.part_id}-spec2-${rowNum}`} className={rowNum > 1 ? 'border-t border-gray-100 py-0.5' : 'py-0.5'}>
                <div className="h-[26px] flex items-center text-xs text-gray-400">-</div>
              </div>
            );
          }

          const specKey = `row${rowNum}_${field.key}`;
          const currentValue = part.specifications?.[specKey] ?? '';
          const hasValue = field.type === 'boolean'
            ? (currentValue === 'true' || currentValue === 'false' || currentValue === true || currentValue === false)
            : !!currentValue;

          return (
            <div key={`${part.part_id}-spec2-${rowNum}`} className={rowNum > 1 ? 'border-t border-gray-100 py-0.5' : 'py-0.5'}>
              <SpecFieldInput
                partId={part.part_id}
                rowNum={rowNum}
                field={field}
                specKey={specKey}
                currentValue={currentValue}
                onSave={onSpecFieldSave}
                hasValue={hasValue}
              />
            </div>
          );
        })}
      </div>

      {/* Spec 3 column */}
      <div className="flex flex-col">
        {subRows.map((rowNum) => {
          const selectedTemplateName = part.specifications?.[`_template_${rowNum}`] || '';
          const template = selectedTemplateName ? getSpecificationTemplate(selectedTemplateName) : undefined;
          const field = template?.spec3;

          if (!field) {
            return (
              <div key={`${part.part_id}-spec3-${rowNum}`} className={rowNum > 1 ? 'border-t border-gray-100 py-0.5' : 'py-0.5'}>
                <div className="h-[26px] flex items-center text-xs text-gray-400">-</div>
              </div>
            );
          }

          const specKey = `row${rowNum}_${field.key}`;
          const currentValue = part.specifications?.[specKey] ?? '';
          const hasValue = field.type === 'boolean'
            ? (currentValue === 'true' || currentValue === 'false' || currentValue === true || currentValue === false)
            : !!currentValue;

          return (
            <div key={`${part.part_id}-spec3-${rowNum}`} className={rowNum > 1 ? 'border-t border-gray-100 py-0.5' : 'py-0.5'}>
              <SpecFieldInput
                partId={part.part_id}
                rowNum={rowNum}
                field={field}
                specKey={specKey}
                currentValue={currentValue}
                onSave={onSpecFieldSave}
                hasValue={hasValue}
              />
            </div>
          );
        })}
      </div>
    </>
  );
};
