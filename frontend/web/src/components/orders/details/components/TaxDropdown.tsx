import React from 'react';
import { Pencil } from 'lucide-react';

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
  onSave: (field: string, newValue?: string) => void;
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
  const originalValue = currentTaxName || '';

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newValue = e.target.value;
    onEditValueChange(newValue);
    // Auto-save immediately if changed
    if (newValue !== originalValue) {
      setTimeout(() => onSave('tax_name', newValue), 0);
    }
  };

  const handleBlur = () => {
    // Auto-cancel if unchanged
    if (editValue === originalValue) {
      onCancel();
    }
  };

  if (isEditing) {
    return (
      <div className="flex items-center h-6">
        <select
          value=""
          onChange={handleSelectChange}
          onBlur={handleBlur}
          onKeyDown={(e) => onKeyDown(e, 'tax_name')}
          className="font-medium text-gray-900 border border-indigo-300 rounded px-1 text-sm w-full h-full focus:outline-none focus:ring-1 focus:ring-indigo-500"
          autoFocus
        >
          <option value="" disabled>Select...</option>
          {taxRules.map((rule) => (
            <option key={rule.tax_rule_id} value={rule.tax_name}>
              {rule.tax_name} ({(rule.tax_percent * 100).toFixed(1)}%)
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-2 group h-6">
      <p className="font-medium text-gray-900 text-sm">
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