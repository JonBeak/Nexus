import React from 'react';
import { BulkEntry } from '../../../hooks/useBulkEntries';

// Type configuration with colors
const TYPE_CONFIG: Array<{
  value: Exclude<BulkEntry['type'], ''>;
  label: string;
  shortLabel: string;
  activeClass: string;
  inactiveClass: string;
}> = [
  {
    value: 'store',
    label: 'Store',
    shortLabel: 'S',
    activeClass: 'bg-green-500 text-white border-green-500',
    inactiveClass: 'bg-white text-green-600 border-green-300 hover:bg-green-50'
  },
  {
    value: 'use',
    label: 'Use',
    shortLabel: 'U',
    activeClass: 'bg-blue-500 text-white border-blue-500',
    inactiveClass: 'bg-white text-blue-600 border-blue-300 hover:bg-blue-50'
  },
  {
    value: 'waste',
    label: 'Waste',
    shortLabel: 'W',
    activeClass: 'bg-orange-500 text-white border-orange-500',
    inactiveClass: 'bg-white text-orange-600 border-orange-300 hover:bg-orange-50'
  },
  {
    value: 'returned',
    label: 'Ret',
    shortLabel: 'R',
    activeClass: 'bg-yellow-500 text-white border-yellow-500',
    inactiveClass: 'bg-white text-yellow-700 border-yellow-400 hover:bg-yellow-50'
  },
  {
    value: 'damaged',
    label: 'Dmg',
    shortLabel: 'D',
    activeClass: 'bg-purple-500 text-white border-purple-500',
    inactiveClass: 'bg-white text-purple-600 border-purple-300 hover:bg-purple-50'
  }
];

interface TypeButtonGroupProps {
  selectedType: BulkEntry['type'];
  onTypeChange: (type: BulkEntry['type']) => void;
  variant?: 'row' | 'header';
  disabled?: boolean;
}

export const TypeButtonGroup: React.FC<TypeButtonGroupProps> = ({
  selectedType,
  onTypeChange,
  variant = 'row',
  disabled = false
}) => {
  const isHeader = variant === 'header';

  const renderButton = (typeOption: typeof TYPE_CONFIG[number]) => {
    const isSelected = selectedType === typeOption.value;
    return (
      <button
        key={typeOption.value}
        type="button"
        onClick={() => onTypeChange(typeOption.value)}
        disabled={disabled}
        title={isHeader ? `Set all rows to ${typeOption.label}` : typeOption.label}
        className={`
          ${isHeader ? 'px-2 py-1 text-xs font-medium' : 'px-2 py-1 text-xs'}
          border rounded transition-all
          ${isSelected ? typeOption.activeClass : typeOption.inactiveClass}
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
      >
        {isHeader ? typeOption.label : typeOption.shortLabel}
      </button>
    );
  };

  // Header variant: two rows (Store/Use, then Waste/Ret/Dmg)
  if (isHeader) {
    const topRow = TYPE_CONFIG.filter(t => t.value === 'store' || t.value === 'use');
    const bottomRow = TYPE_CONFIG.filter(t => t.value === 'waste' || t.value === 'returned' || t.value === 'damaged');

    return (
      <div className="flex flex-col gap-1">
        <div className="flex gap-1">
          {topRow.map(renderButton)}
        </div>
        <div className="flex gap-1">
          {bottomRow.map(renderButton)}
        </div>
      </div>
    );
  }

  // Row variant: single row
  return (
    <div className="flex gap-1">
      {TYPE_CONFIG.map(renderButton)}
    </div>
  );
};

export { TYPE_CONFIG };
export default TypeButtonGroup;
