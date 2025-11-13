import React from 'react';
import { Check, X, Pencil } from 'lucide-react';

interface TaxRule {
  tax_rule_id: number;
  tax_name: string;
  tax_percent: number;
  is_active: number;
}

interface TaxDropdownProps {
  currentTaxName: string | null;
  taxRules: TaxRule[];
  isEditing: boolean;
  editValue: string;
  onEdit: (field: string, value: string) => void;
  onSave: (field: string) => void;
  onCancel: () => void;
  onEditValueChange: (value: string) => void;
  onKeyDown: (e: React.KeyboardEvent, field: string) => void;
  isSaving: boolean;
}

const TaxDropdown: React.FC<TaxDropdownProps> = ({
  currentTaxName,
  taxRules,
  isEditing,
  editValue,
  onEdit,
  onSave,
  onCancel,
  onEditValueChange,
  onKeyDown,
  isSaving
}) => {
  if (isEditing) {
    return (
      <div className="flex items-center space-x-1 h-6">
        <select
          value={editValue}
          onChange={(e) => onEditValueChange(e.target.value)}
          onKeyDown={(e) => onKeyDown(e, 'tax_name')}
          className="font-medium text-gray-900 border border-indigo-300 rounded px-1 text-base w-full h-full"
          autoFocus
        >
          {taxRules.map((rule) => (
            <option key={rule.tax_rule_id} value={rule.tax_name}>
              {rule.tax_name} ({(rule.tax_percent * 100).toFixed(1)}%)
            </option>
          ))}
        </select>
        <button
          onClick={() => onSave('tax_name')}
          disabled={isSaving}
          className="text-green-600 hover:text-green-700 flex-shrink-0"
        >
          <Check className="w-4 h-4" />
        </button>
        <button
          onClick={onCancel}
          className="text-gray-500 hover:text-gray-700 flex-shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-2 group h-6">
      <p className="font-medium text-gray-900 text-base">
        {currentTaxName ? (
          <>
            {currentTaxName} ({((taxRules.find(r => r.tax_name === currentTaxName)?.tax_percent || 0) * 100).toFixed(1)}%)
          </>
        ) : '-'}
      </p>
      <button
        onClick={() => onEdit('tax_name', currentTaxName || '')}
        className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-indigo-600"
      >
        <Pencil className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

export default TaxDropdown;