import React, { useState, useEffect, useCallback } from 'react';
import { ordersApi, quickbooksApi, provincesApi } from '@/services/api';
import { OrderPart } from '@/types/orders';
import { getSpecificationTemplate, getAllTemplateNames, type SpecificationField } from '@/config/orderProductTemplates';
import { Pencil, Check, X, RefreshCw } from 'lucide-react';
import { getValidInputClass, getValidSpecTemplateClass, getValidSpecFieldClass } from '@/utils/highlightStyles';

// All available specs display names (from specsTypeMapper.ts)
const SPECS_DISPLAY_NAMES = [
  'Front Lit',
  'Halo Lit',
  'Front Lit Acrylic Face',
  'Dual Lit - Single Layer',
  'Dual Lit - Double Layer',
  'Vinyl',
  'LEDs',
  'Power Supplies',
  'UL',
  'Substrate Cut',
  'Painting',
  'Dual Lit',
  'Trimless Front Lit',
  'Trimless Halo Lit',
  'Trimless Dual Lit',
  '3D print',
  'Blade Sign',
  'Marquee Bulb',
  'Epoxy',
  'Push Thru',
  'Neon LED',
  'Stainless Steel Sign',
  'Return',
  'Trim Cap',
  'Front Lit Push Thru',
  'Acrylic MINI',
  'Halo Acrylic',
  'Vinyl Cut',
  'Backer',
  'Frame',
  'Custom',
  'Aluminum Raceway',
  'Extrusion Raceway',
  'Dual Lit Acrylic Face (Discontinued)',
  'Material Cut',
  'Channel Letter',
  'Reverse Channel',
  'Trimless Channel',
  'Knockout Box',
];

interface QBItem {
  id: number;
  name: string;
  description: string | null;
  qbItemId: string;
  qbItemType: string | null;
}

interface TaxRule {
  tax_rule_id: number;
  tax_name: string;
  tax_percent: number;
  is_active: number;
}

interface Props {
  orderNumber: number;
  initialParts: OrderPart[];
  taxName?: string;
}

// =============================================
// MEMOIZED EDITABLE COMPONENTS
// =============================================

interface EditableTextareaProps {
  partId: number;
  field: 'invoice_description' | 'qb_description';
  currentValue: string;
  onSave: (partId: number, field: string, value: string) => Promise<void>;
  placeholder: string;
  hasValue: boolean;
}

const EditableTextarea = React.memo<EditableTextareaProps>(({
  partId,
  field,
  currentValue,
  onSave,
  placeholder,
  hasValue
}) => {
  const [localValue, setLocalValue] = useState(currentValue ?? '');
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Update local value when currentValue changes from parent
  React.useEffect(() => {
    setLocalValue(currentValue ?? '');
  }, [currentValue]);

  // Auto-resize textarea
  React.useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [localValue]);

  const handleBlur = async () => {
    // Only save if value changed
    if (localValue !== currentValue && !isSaving) {
      setIsSaving(true);
      try {
        await onSave(partId, field, localValue);
      } finally {
        setIsSaving(false);
      }
    }
  };

  const baseClass = field === 'invoice_description'
    ? 'w-full px-1.5 py-1 text-sm text-gray-600 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 resize-none overflow-hidden bg-gray-50'
    : 'w-full px-1.5 py-1 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 resize-none overflow-hidden';

  const className = field === 'qb_description'
    ? getValidInputClass(hasValue, baseClass)
    : baseClass;

  return (
    <div className="py-1 w-full">
      <textarea
        ref={textareaRef}
        value={localValue}
        onChange={(e) => {
          setLocalValue(e.target.value);
          // Auto-resize on input
          if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
          }
        }}
        onBlur={handleBlur}
        className={className}
        placeholder={placeholder}
        rows={1}
        style={{ minHeight: '26px' }}
        disabled={isSaving}
      />
    </div>
  );
}, (prevProps, nextProps) => {
  // Only re-render if these specific props change
  return prevProps.currentValue === nextProps.currentValue &&
         prevProps.hasValue === nextProps.hasValue &&
         prevProps.partId === nextProps.partId;
});

EditableTextarea.displayName = 'EditableTextarea';

interface EditableInputProps {
  partId: number;
  field: 'quantity' | 'unit_price';
  currentValue: number | null;
  onSave: (partId: number, field: string, value: string) => Promise<void>;
  placeholder: string;
  hasValue: boolean;
  align?: 'left' | 'right';
}

const EditableInput = React.memo<EditableInputProps>(({
  partId,
  field,
  currentValue,
  onSave,
  placeholder,
  hasValue,
  align = 'left'
}) => {
  const [localValue, setLocalValue] = useState(currentValue?.toString() ?? '');
  const [isSaving, setIsSaving] = useState(false);

  // Update local value when currentValue changes from parent
  React.useEffect(() => {
    setLocalValue(currentValue?.toString() ?? '');
  }, [currentValue]);

  const handleBlur = async () => {
    // Only save if value changed
    if (localValue !== (currentValue?.toString() ?? '') && !isSaving) {
      setIsSaving(true);
      try {
        await onSave(partId, field, localValue);
      } finally {
        setIsSaving(false);
      }
    }
  };

  const baseClass = `w-full px-1.5 py-0.5 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 ${align === 'right' ? 'text-right' : ''}`;

  return (
    <div className="py-1">
      <input
        type="text"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={handleBlur}
        className={getValidInputClass(hasValue, baseClass)}
        placeholder={placeholder}
        disabled={isSaving}
      />
    </div>
  );
}, (prevProps, nextProps) => {
  // Only re-render if these specific props change
  return prevProps.currentValue === nextProps.currentValue &&
         prevProps.hasValue === nextProps.hasValue &&
         prevProps.partId === nextProps.partId;
});

EditableInput.displayName = 'EditableInput';

// =============================================
// MEMOIZED SPEC COMPONENTS
// =============================================

interface SpecTemplateDropdownProps {
  partId: number;
  rowNum: number;
  currentValue: string;
  onSave: (partId: number, rowNum: number, value: string) => Promise<void>;
  availableTemplates: string[];
  hasValue: boolean;
}

const SpecTemplateDropdown = React.memo<SpecTemplateDropdownProps>(({
  partId,
  rowNum,
  currentValue,
  onSave,
  availableTemplates,
  hasValue
}) => {
  const [isSaving, setIsSaving] = useState(false);

  const handleChange = async (value: string) => {
    if (!isSaving) {
      setIsSaving(true);
      try {
        await onSave(partId, rowNum, value);
      } finally {
        setIsSaving(false);
      }
    }
  };

  const baseClass = `w-full h-[26px] px-1.5 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 ${
    !currentValue ? 'text-gray-400' : 'text-gray-900 font-bold'
  }`;

  return (
    <div className="h-[26px] flex items-center py-1">
      <select
        value={currentValue}
        onChange={(e) => handleChange(e.target.value)}
        className={getValidSpecTemplateClass(hasValue, baseClass)}
        disabled={isSaving}
      >
        <option value="" className="text-gray-400">Select...</option>
        {availableTemplates.map((templateName) => (
          <option key={templateName} value={templateName} className="text-gray-900">
            {templateName}
          </option>
        ))}
      </select>
    </div>
  );
}, (prevProps, nextProps) => {
  return prevProps.currentValue === nextProps.currentValue &&
         prevProps.hasValue === nextProps.hasValue &&
         prevProps.partId === nextProps.partId &&
         prevProps.rowNum === nextProps.rowNum;
});

SpecTemplateDropdown.displayName = 'SpecTemplateDropdown';

interface SpecFieldInputProps {
  partId: number;
  rowNum: number;
  field: SpecificationField;
  specKey: string;
  currentValue: any;
  onSave: (partId: number, specKey: string, value: string) => Promise<void>;
  hasValue: boolean;
}

const SpecFieldInput = React.memo<SpecFieldInputProps>(({
  partId,
  rowNum,
  field,
  specKey,
  currentValue,
  onSave,
  hasValue
}) => {
  const [isSaving, setIsSaving] = useState(false);
  const [localValue, setLocalValue] = useState(currentValue);

  // Update local value when prop changes (from server)
  React.useEffect(() => {
    setLocalValue(currentValue);
  }, [currentValue]);

  const handleDropdownChange = async (value: string) => {
    if (!isSaving) {
      setIsSaving(true);
      try {
        await onSave(partId, specKey, value);
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleTextBlur = async () => {
    // Only save if value changed
    if (localValue !== currentValue && !isSaving) {
      setIsSaving(true);
      try {
        await onSave(partId, specKey, localValue);
      } finally {
        setIsSaving(false);
      }
    }
  };

  const baseClass = `w-full h-[26px] px-1.5 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
    !hasValue ? 'text-gray-400' : 'text-gray-900'
  }`;

  return (
    <div className="h-[26px] flex items-center py-1">
      {field.type === 'dropdown' && field.options ? (
        <select
          value={currentValue}
          onChange={(e) => handleDropdownChange(e.target.value)}
          className={getValidSpecFieldClass(hasValue, baseClass)}
          disabled={isSaving}
        >
          <option value="" className="text-gray-400">{field.placeholder || 'Select...'}</option>
          {field.options.map(opt => (
            <option key={opt} value={opt} className="text-gray-900">{opt}</option>
          ))}
        </select>
      ) : field.type === 'combobox' && field.options ? (
        <>
          <input
            type="text"
            list={`${partId}-${specKey}-datalist`}
            value={localValue}
            onChange={(e) => setLocalValue(e.target.value)}
            onBlur={handleTextBlur}
            className={getValidSpecFieldClass(hasValue, baseClass)}
            placeholder={field.placeholder}
            disabled={isSaving}
          />
          <datalist id={`${partId}-${specKey}-datalist`}>
            {field.options.map(opt => (
              <option key={opt} value={opt} />
            ))}
          </datalist>
        </>
      ) : field.type === 'boolean' ? (
        <select
          value={currentValue}
          onChange={(e) => handleDropdownChange(e.target.value)}
          className={getValidSpecFieldClass(hasValue, baseClass)}
          disabled={isSaving}
        >
          <option value="" className="text-gray-400">{field.placeholder || 'Select...'}</option>
          <option value="true" className="text-gray-900">Yes</option>
          <option value="false" className="text-gray-900">No</option>
        </select>
      ) : (
        <input
          type="text"
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onBlur={handleTextBlur}
          className={getValidSpecFieldClass(hasValue, baseClass)}
          placeholder={field.placeholder}
          disabled={isSaving}
        />
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  return prevProps.currentValue === nextProps.currentValue &&
         prevProps.hasValue === nextProps.hasValue &&
         prevProps.partId === nextProps.partId &&
         prevProps.specKey === nextProps.specKey &&
         prevProps.rowNum === nextProps.rowNum &&
         prevProps.field.key === nextProps.field.key &&
         prevProps.field.type === nextProps.field.type;
});

SpecFieldInput.displayName = 'SpecFieldInput';

// =============================================
// ITEM NAME DROPDOWN COMPONENT
// =============================================

interface ItemNameDropdownProps {
  partId: number;
  orderNumber: number;
  currentValue: string;
  onUpdate: () => void;
  isParentOrRegular?: boolean;
}

const ItemNameDropdown = React.memo<ItemNameDropdownProps>(({
  partId,
  orderNumber,
  currentValue,
  onUpdate,
  isParentOrRegular = false
}) => {
  const [isSaving, setIsSaving] = useState(false);

  const handleChange = async (value: string) => {
    if (isSaving) return;

    setIsSaving(true);
    try {
      console.log('[ItemNameDropdown] Updating part', partId, 'with specs_display_name:', value);

      // Call the new API endpoint
      const response = await ordersApi.updateSpecsDisplayName(orderNumber, partId, value);

      if (response.success) {
        console.log('[ItemNameDropdown] Successfully updated specs_display_name');
        // Trigger parent refresh
        onUpdate();
      } else {
        console.error('[ItemNameDropdown] Failed to update:', response.message);
        alert(`Failed to update Item Name: ${response.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('[ItemNameDropdown] Error updating specs_display_name:', error);
      alert('Failed to update Item Name. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const baseClass = `w-full px-1.5 py-0.5 text-sm rounded focus:outline-none focus:ring-1 ${
    !currentValue ? 'text-gray-400' : 'text-gray-900'
  } ${
    isParentOrRegular && currentValue
      ? 'border-2 border-blue-600 bg-blue-100 focus:ring-blue-600'
      : 'border border-gray-300 focus:ring-indigo-500'
  }`;

  return (
    <div className="py-1">
      <select
        value={currentValue}
        onChange={(e) => handleChange(e.target.value)}
        className={baseClass}
        disabled={isSaving}
      >
        <option value="" className="text-gray-400">Select Item Name...</option>
        {SPECS_DISPLAY_NAMES.map((name) => (
          <option key={name} value={name} className="text-gray-900">
            {name}
          </option>
        ))}
      </select>
    </div>
  );
}, (prevProps, nextProps) => {
  return prevProps.currentValue === nextProps.currentValue &&
         prevProps.partId === nextProps.partId &&
         prevProps.isParentOrRegular === nextProps.isParentOrRegular;
});

ItemNameDropdown.displayName = 'ItemNameDropdown';

// =============================================
// MAIN COMPONENT
// =============================================

export const DualTableLayout: React.FC<Props> = ({
  orderNumber,
  initialParts,
  taxName
}) => {
  const [parts, setParts] = useState<OrderPart[]>(initialParts);
  const partsRef = React.useRef<OrderPart[]>(initialParts);
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<any>('');
  const [saving, setSaving] = useState(false);
  const [qbItems, setQbItems] = useState<QBItem[]>([]);
  const [taxRules, setTaxRules] = useState<TaxRule[]>([]);
  const [specRowCounts, setSpecRowCounts] = useState<Record<number, number>>({});

  // Fetch QuickBooks items and tax rules on mount
  useEffect(() => {
    const fetchQBItems = async () => {
      try {
        const response = await quickbooksApi.getItems();
        if (response.success) {
          setQbItems(response.items);
        }
      } catch (error) {
        console.error('Error fetching QB items:', error);
      }
    };

    const fetchTaxRules = async () => {
      try {
        const rules = await provincesApi.getTaxRules();
        setTaxRules(rules);
      } catch (error) {
        console.error('Error fetching tax rules:', error);
      }
    };

    fetchQBItems();
    fetchTaxRules();
  }, []);

  // Sync parts when initialParts changes
  useEffect(() => {
    setParts(initialParts);
    partsRef.current = initialParts;
    // Initialize row counts for each part from specifications._row_count
    // If no _row_count, leave undefined so renderPartRow uses template count
    const initialCounts: Record<number, number> = {};
    initialParts.forEach(part => {
      if (part.specifications?._row_count) {
        initialCounts[part.part_id] = part.specifications._row_count;
      }
      // Don't set a default - let renderPartRow calculate from templates
    });
    setSpecRowCounts(initialCounts);
  }, [initialParts]);

  // Keep partsRef in sync with parts state
  useEffect(() => {
    partsRef.current = parts;
  }, [parts]);

  // Memoize template names to prevent re-creation on every render
  const availableTemplates = React.useMemo(() => getAllTemplateNames(), []);

  // Unified save handler for editable fields (textareas and inputs)
  const handleFieldSave = useCallback(async (partId: number, field: string, value: string) => {
    try {
      // Get fresh part data from ref
      const partToUpdate = partsRef.current.find(p => p.part_id === partId);
      if (!partToUpdate) return;

      let updatedPart = { ...partToUpdate };

      if (field === 'qb_description') {
        updatedPart.specifications = {
          ...updatedPart.specifications,
          _qb_description: value
        };
      } else if (field === 'quantity' || field === 'unit_price') {
        const numericValue = value === '' ? null : parseFloat(value);
        updatedPart[field] = numericValue;

        // Auto-calculate extended_price
        const qty = field === 'quantity'
          ? (numericValue ?? 0)
          : (updatedPart.quantity ? parseFloat(updatedPart.quantity.toString()) : 0);
        const price = field === 'unit_price'
          ? (numericValue ?? 0)
          : (updatedPart.unit_price ? parseFloat(updatedPart.unit_price.toString()) : 0);
        updatedPart.extended_price = qty * price;
      } else if (field === 'invoice_description') {
        updatedPart.invoice_description = value;
      }

      // Save to API
      await ordersApi.updateOrderParts(orderNumber, [{
        part_id: updatedPart.part_id,
        qb_item_name: updatedPart.qb_item_name,
        specifications: updatedPart.specifications,
        invoice_description: updatedPart.invoice_description,
        quantity: updatedPart.quantity,
        unit_price: updatedPart.unit_price,
        extended_price: updatedPart.extended_price,
        production_notes: updatedPart.production_notes
      }]);

      // Update local state
      setParts(prevParts =>
        prevParts.map(p => p.part_id === partId ? updatedPart : p)
      );
    } catch (error) {
      console.error('Error saving field:', error);
      alert('Failed to save changes. Please try again.');
      throw error; // Re-throw so component knows save failed
    }
  }, [orderNumber]);

  // Save handler for template dropdown changes
  const handleTemplateSave = useCallback(async (partId: number, rowNum: number, value: string) => {
    try {
      console.log('[handleTemplateSave] START:', { partId, rowNum, value });

      // Get fresh part data from ref
      const partToUpdate = partsRef.current.find(p => p.part_id === partId);

      if (!partToUpdate) {
        console.error('[handleTemplateSave] ERROR: Part not found!', partId);
        return;
      }

      console.log('[handleTemplateSave] partToUpdate found:', partToUpdate);

      // Clear all spec data for this row when changing templates
      const updatedSpecs = { ...partToUpdate.specifications };
      console.log('[handleTemplateSave] Original specs:', updatedSpecs);

      // Remove all rowN_* fields for this specific row
      Object.keys(updatedSpecs).forEach(key => {
        if (key.startsWith(`row${rowNum}_`)) {
          delete updatedSpecs[key];
        }
      });

      // Set the new template
      updatedSpecs[`_template_${rowNum}`] = value;
      console.log('[handleTemplateSave] Updated specs:', updatedSpecs);

      const updatedPart = {
        ...partToUpdate,
        specifications: updatedSpecs
      };

      // Save to API
      console.log('[handleTemplateSave] Calling API...');
      await ordersApi.updateOrderParts(orderNumber, [{
        part_id: updatedPart.part_id,
        qb_item_name: updatedPart.qb_item_name,
        specifications: updatedPart.specifications,
        invoice_description: updatedPart.invoice_description,
        quantity: updatedPart.quantity,
        unit_price: updatedPart.unit_price,
        extended_price: updatedPart.extended_price,
        production_notes: updatedPart.production_notes
      }]);
      console.log('[handleTemplateSave] API success!');

      // Update local state
      setParts(prevParts => {
        const newParts = prevParts.map(p => p.part_id === partId ? updatedPart : p);
        console.log('[handleTemplateSave] State updated:', newParts);
        return newParts;
      });

      console.log('[handleTemplateSave] COMPLETE');
    } catch (error) {
      console.error('[handleTemplateSave] ERROR:', error);
      alert('Failed to save template selection. Please try again.');
      throw error;
    }
  }, [orderNumber]);

  // Save handler for spec field changes
  const handleSpecFieldSave = useCallback(async (partId: number, specKey: string, value: string) => {
    try {
      // Get fresh part data from ref
      const partToUpdate = partsRef.current.find(p => p.part_id === partId);
      if (!partToUpdate) return;

      const updatedPart = {
        ...partToUpdate,
        specifications: {
          ...partToUpdate.specifications,
          [specKey]: value
        }
      };

      // Save to API
      await ordersApi.updateOrderParts(orderNumber, [{
        part_id: updatedPart.part_id,
        qb_item_name: updatedPart.qb_item_name,
        specifications: updatedPart.specifications,
        invoice_description: updatedPart.invoice_description,
        quantity: updatedPart.quantity,
        unit_price: updatedPart.unit_price,
        extended_price: updatedPart.extended_price,
        production_notes: updatedPart.production_notes
      }]);

      // Update local state
      setParts(prevParts =>
        prevParts.map(p => p.part_id === partId ? updatedPart : p)
      );
    } catch (error) {
      console.error('Error saving spec field:', error);
      alert('Failed to save specification. Please try again.');
      throw error;
    }
  }, [orderNumber]);

  const addSpecRow = async (partId: number) => {
    const currentCount = specRowCounts[partId] || 5;
    const newCount = Math.min(currentCount + 1, 20); // Max 20 rows

    setSpecRowCounts(prev => ({
      ...prev,
      [partId]: newCount
    }));

    // Save row count to database
    const part = parts.find(p => p.part_id === partId);
    if (!part) return;

    try {
      setSaving(true);
      const updatedPart = {
        ...part,
        specifications: {
          ...part.specifications,
          _row_count: newCount
        }
      };

      await ordersApi.updateOrderParts(orderNumber, [{
        part_id: updatedPart.part_id,
        qb_item_name: updatedPart.qb_item_name,
        specifications: updatedPart.specifications,
        invoice_description: updatedPart.invoice_description,
        quantity: updatedPart.quantity,
        unit_price: updatedPart.unit_price,
        extended_price: updatedPart.extended_price,
        production_notes: updatedPart.production_notes
      }]);

      setParts(prevParts =>
        prevParts.map(p => p.part_id === partId ? updatedPart : p)
      );
    } catch (error) {
      console.error('Error saving row count:', error);
      alert('Failed to save row count. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const removeSpecRow = async (partId: number) => {
    const currentCount = specRowCounts[partId] || 5;
    const newCount = Math.max(currentCount - 1, 1); // Min 1 row

    setSpecRowCounts(prev => ({
      ...prev,
      [partId]: newCount
    }));

    // Clear data from removed rows
    const part = parts.find(p => p.part_id === partId);
    if (!part) return;

    try {
      setSaving(true);
      const updatedSpecs = { ...part.specifications, _row_count: newCount };

      // Clear data from rows beyond the new count
      for (let rowNum = newCount + 1; rowNum <= 20; rowNum++) {
        // Clear template selection
        delete updatedSpecs[`_template_${rowNum}`];

        // Clear all spec fields for this row
        Object.keys(updatedSpecs).forEach(key => {
          if (key.startsWith(`row${rowNum}_`)) {
            delete updatedSpecs[key];
          }
        });
      }

      const updatedPart = {
        ...part,
        specifications: updatedSpecs
      };

      await ordersApi.updateOrderParts(orderNumber, [{
        part_id: updatedPart.part_id,
        qb_item_name: updatedPart.qb_item_name,
        specifications: updatedPart.specifications,
        invoice_description: updatedPart.invoice_description,
        quantity: updatedPart.quantity,
        unit_price: updatedPart.unit_price,
        extended_price: updatedPart.extended_price,
        production_notes: updatedPart.production_notes
      }]);

      setParts(prevParts =>
        prevParts.map(p => p.part_id === partId ? updatedPart : p)
      );
    } catch (error) {
      console.error('Error saving row count:', error);
      alert('Failed to save row count. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const toggleIsParent = async (partId: number) => {
    const part = parts.find(p => p.part_id === partId);
    if (!part) return;

    try {
      setSaving(true);
      const newIsParent = !part.is_parent;

      // Call API to toggle is_parent
      await ordersApi.toggleIsParent(orderNumber, partId);

      // Update local state
      setParts(prevParts =>
        prevParts.map(p => p.part_id === partId ? { ...p, is_parent: newIsParent } : p)
      );
    } catch (error) {
      console.error('Error toggling is_parent:', error);
      alert('Failed to toggle item type. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleEditStart = (partId: number, field: string, value: any) => {
    setEditingCell(`${partId}-${field}`);
    setEditValue(value ?? '');
  };

  const handleEditChange = (value: any) => {
    setEditValue(value);
  };

  const handleEditCancel = () => {
    setEditingCell(null);
    setEditValue('');
  };

  const handleCellSave = async () => {
    if (!editingCell) return;

    const [partIdStr, field] = editingCell.split('-');
    const partId = parseInt(partIdStr);

    // Find the part being edited
    const partToUpdate = parts.find(p => p.part_id === partId);
    if (!partToUpdate) return;

    try {
      setSaving(true);

      // Update local state
      let updatedPart = { ...partToUpdate };

      // Check if it's a spec field or invoice field
      if (field.startsWith('spec_')) {
        const specKey = field.replace('spec_', '');
        updatedPart.specifications = {
          ...updatedPart.specifications,
          [specKey]: editValue
        };
      } else if (field === 'qb_description') {
        // Save QB description to specifications._qb_description
        updatedPart.specifications = {
          ...updatedPart.specifications,
          _qb_description: editValue
        };
      } else if (field === 'quantity' || field === 'unit_price') {
        // Convert empty string to null for numeric fields, and treat 0 as null
        let numericValue = editValue === '' ? null : parseFloat(editValue);
        if (numericValue === 0) numericValue = null;
        updatedPart[field] = numericValue;

        // Auto-calculate extended_price when quantity or unit_price changes
        const qty = field === 'quantity'
          ? numericValue
          : updatedPart.quantity;
        const price = field === 'unit_price'
          ? numericValue
          : updatedPart.unit_price;

        // If either qty or price is null/0, set all to null
        if (!qty || !price) {
          updatedPart.quantity = null;
          updatedPart.unit_price = null;
          updatedPart.extended_price = null;
        } else {
          updatedPart.extended_price = parseFloat(qty.toString()) * parseFloat(price.toString());
        }
      } else if (field === 'qb_item_name') {
        updatedPart.qb_item_name = editValue;
      } else {
        updatedPart[field] = editValue;
      }

      // Save to API immediately
      await ordersApi.updateOrderParts(orderNumber, [{
        part_id: updatedPart.part_id,
        qb_item_name: updatedPart.qb_item_name,
        specifications: updatedPart.specifications,
        invoice_description: updatedPart.invoice_description,
        quantity: updatedPart.quantity,
        unit_price: updatedPart.unit_price,
        extended_price: updatedPart.extended_price,
        production_notes: updatedPart.production_notes
      }]);

      // Update local state after successful save
      setParts(prevParts =>
        prevParts.map(part => part.part_id === partId ? updatedPart : part)
      );

      setEditingCell(null);
      setEditValue('');
    } catch (error) {
      console.error('Error saving part:', error);
      alert('Failed to save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleCellBlur = () => {
    // Auto-save on blur
    if (editingCell) {
      handleCellSave();
    }
  };

  const formatCurrency = (value: number | string | undefined | null): string => {
    if (value == null || value === '') return '-';
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(numValue) || numValue === 0) return '-';
    return `$${numValue.toFixed(2)}`;
  };

  const formatQuantity = (value: number | string | undefined | null): string => {
    if (value == null || value === '') return '-';
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(numValue) || numValue === 0) return '-';
    return numValue % 1 === 0 ? numValue.toString() : numValue.toFixed(2).replace(/\.?0+$/, '');
  };

  const renderSpecField = (part: OrderPart, field: SpecificationField) => {
    const cellKey = `${part.part_id}-spec_${field.key}`;
    const isEditing = editingCell === cellKey;
    const currentValue = part.specifications?.[field.key] ?? '';

    // For boolean fields, display Yes/No
    const displayValue = field.type === 'boolean'
      ? (currentValue === true || currentValue === 'true' || currentValue === '1' ? 'Yes' : currentValue === false || currentValue === 'false' || currentValue === '0' ? 'No' : '')
      : currentValue;

    return (
      <div className="h-[26px] flex items-center py-1">
        {isEditing ? (
          <>
            {/* Dropdown */}
            {field.type === 'dropdown' && field.options ? (
              <select
                value={editValue}
                onChange={(e) => handleEditChange(e.target.value)}
                onBlur={handleCellBlur}
                className="w-full h-[26px] px-1.5 text-xs border border-indigo-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                autoFocus
              >
                <option value="">Select...</option>
                {field.options.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            ) : field.type === 'combobox' && field.options ? (
              /* Combobox - Text input with datalist suggestions */
              <>
                <input
                  type="text"
                  list={`${cellKey}-datalist`}
                  value={editValue}
                  onChange={(e) => handleEditChange(e.target.value)}
                  onBlur={handleCellBlur}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCellBlur();
                    if (e.key === 'Escape') handleEditCancel();
                  }}
                  className="w-full h-[26px] px-1.5 text-xs border border-indigo-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder={field.placeholder}
                  autoFocus
                />
                <datalist id={`${cellKey}-datalist`}>
                  {field.options.map(opt => (
                    <option key={opt} value={opt} />
                  ))}
                </datalist>
              </>
            ) : field.type === 'boolean' ? (
              /* Boolean - Yes/No select */
              <select
                value={editValue}
                onChange={(e) => handleEditChange(e.target.value)}
                onBlur={handleCellBlur}
                className="w-full h-[26px] px-1.5 text-xs border border-indigo-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                autoFocus
              >
                <option value="">Select...</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            ) : (
              /* Textbox */
              <input
                type="text"
                value={editValue}
                onChange={(e) => handleEditChange(e.target.value)}
                onBlur={handleCellBlur}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCellBlur();
                  if (e.key === 'Escape') handleEditCancel();
                }}
                className="w-full h-[26px] px-1.5 text-xs border border-indigo-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder={field.placeholder}
                autoFocus
              />
            )}
          </>
        ) : (
          <div
            className="w-full h-[26px] flex items-center justify-between cursor-pointer hover:bg-gray-50 px-1.5 rounded group"
            onClick={() => handleEditStart(part.part_id, `spec_${field.key}`, currentValue)}
          >
            {displayValue ? (
              <>
                <span className="text-xs text-gray-900 truncate">
                  {displayValue}
                </span>
                <Pencil className="w-3 h-3 ml-1 opacity-0 group-hover:opacity-100 text-gray-400 flex-shrink-0" />
              </>
            ) : (
              <span className="text-xs text-gray-400 italic">Click to add</span>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderQBItemDropdown = (part: OrderPart) => {
    const currentValue = part.qb_item_name || '';
    const hasValue = !!currentValue;

    const handleChange = async (value: string) => {
      // Find the selected QB item to get its description
      const selectedQBItem = qbItems.find(item => item.name === value);
      const qbDescription = selectedQBItem?.description || '';

      // Update part with both QB item name and description
      const partToUpdate = parts.find(p => p.part_id === part.part_id);
      if (!partToUpdate) return;

      try {
        setSaving(true);

        // Update local state with both fields
        const updatedPart = {
          ...partToUpdate,
          qb_item_name: value,
          specifications: {
            ...partToUpdate.specifications,
            _qb_description: qbDescription
          }
        };

        // Save to API immediately
        await ordersApi.updateOrderParts(orderNumber, [{
          part_id: updatedPart.part_id,
          qb_item_name: updatedPart.qb_item_name,
          specifications: updatedPart.specifications,
          invoice_description: updatedPart.invoice_description,
          quantity: updatedPart.quantity,
          unit_price: updatedPart.unit_price,
          extended_price: updatedPart.extended_price,
          production_notes: updatedPart.production_notes
        }]);

        // Update local state after successful save
        setParts(prevParts =>
          prevParts.map(p => p.part_id === part.part_id ? updatedPart : p)
        );
      } catch (error) {
        console.error('Error saving QB item:', error);
        alert('Failed to save QB item. Please try again.');
      } finally {
        setSaving(false);
      }
    };

    const baseClass = `w-full px-1.5 py-0.5 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 ${
      !currentValue ? 'text-gray-400' : 'text-gray-900'
    }`;

    return (
      <div className="py-1">
        <select
          value={currentValue}
          onChange={(e) => handleChange(e.target.value)}
          className={getValidInputClass(hasValue, baseClass)}
        >
          <option value="" className="text-gray-400">Select QB Item...</option>
          {qbItems.map((item) => (
            <option key={item.id} value={item.name} className="text-gray-900">
              {item.name}
            </option>
          ))}
        </select>
      </div>
    );
  };

  // Refresh parts data after specs_display_name update
  const handleRefreshParts = async () => {
    try {
      const response = await ordersApi.getOrderWithParts(orderNumber);
      if (response.parts) {
        setParts(response.parts);
        partsRef.current = response.parts;

        // Clear specRowCounts for parts that have spec templates so they auto-adjust
        const newSpecRowCounts = { ...specRowCounts };
        response.parts.forEach(part => {
          const templateCount = part.specifications
            ? Object.keys(part.specifications).filter(key => key.startsWith('_template_')).length
            : 0;
          if (templateCount > 0) {
            // Remove manual row count so it uses template count
            delete newSpecRowCounts[part.part_id];
          }
        });
        setSpecRowCounts(newSpecRowCounts);
      }
    } catch (error) {
      console.error('Error refreshing parts:', error);
    }
  };

  const renderPartRow = (part: OrderPart) => {
    const isParent = part.is_parent;

    // Get QB description from specifications (auto-filled when QB Item changes, but editable)
    const qbDescription = part.specifications?._qb_description || '';

    // Use specs_display_name if available, otherwise fall back to product_type
    const displayName = part.specs_display_name || part.product_type;

    // Calculate row count: use specRowCounts if exists, else number of templates, else default to 1
    const templateCount = part.specifications
      ? Object.keys(part.specifications).filter(key => key.startsWith('_template_')).length
      : 0;
    const rowCount = specRowCounts[part.part_id] || templateCount || 1;
    const subRows = Array.from({ length: rowCount }, (_, i) => i + 1);

    return (
      <div
        key={part.part_id}
        className="border-b-2 border-gray-300 grid gap-2 px-2"
        style={{
          gridTemplateColumns: '130px 120px 110px 110px 110px 70px 190px 410px 270px 55px 75px 85px'
        }}
      >
        {/* Item Name - editable dropdown */}
        <div className={`flex items-start ${isParent ? 'font-semibold text-gray-900 text-sm' : 'text-gray-700 text-sm'}`}>
          <ItemNameDropdown
            partId={part.part_id}
            orderNumber={orderNumber}
            currentValue={displayName}
            onUpdate={handleRefreshParts}
            isParentOrRegular={isParent}
          />
        </div>

        {/* Specifications - contains sub-rows */}
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
                  onSave={handleTemplateSave}
                  availableTemplates={availableTemplates}
                  hasValue={hasValue}
                />
              </div>
            );
          })}
        </div>

        {/* Spec 1 - contains sub-rows */}
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
                  onSave={handleSpecFieldSave}
                  hasValue={hasValue}
                />
              </div>
            );
          })}
        </div>

        {/* Spec 2 - contains sub-rows */}
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
                  onSave={handleSpecFieldSave}
                  hasValue={hasValue}
                />
              </div>
            );
          })}
        </div>

        {/* Spec 3 - contains sub-rows */}
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
                  onSave={handleSpecFieldSave}
                  hasValue={hasValue}
                />
              </div>
            );
          })}
        </div>

        {/* Actions: Toggle Base/Sub, Add/Remove Row Buttons */}
        <div className="flex flex-row items-start justify-center pt-1 space-x-1">
          <button
            onClick={() => toggleIsParent(part.part_id)}
            className={`w-6 h-6 flex items-center justify-center text-white rounded ${
              part.is_parent
                ? 'bg-blue-600 hover:bg-blue-700'
                : 'bg-gray-500 hover:bg-gray-600'
            }`}
            title={part.is_parent ? 'Convert to Sub-Item' : 'Promote to Base Item'}
          >
            <RefreshCw size={14} />
          </button>
          <button
            onClick={() => addSpecRow(part.part_id)}
            disabled={rowCount >= 20}
            className="w-6 h-6 flex items-center justify-center text-xs font-bold text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed rounded"
            title="Add row"
          >
            +
          </button>
          <button
            onClick={() => removeSpecRow(part.part_id)}
            disabled={rowCount <= 1}
            className="w-6 h-6 flex items-center justify-center text-xs font-bold text-white bg-red-600 hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed rounded"
            title="Remove row"
          >
            −
          </button>
        </div>

        {/* QB Item Name - spans full height (with divider) */}
        <div className="flex items-start border-l-2 border-gray-400 pl-2">
          {renderQBItemDropdown(part)}
        </div>

        {/* QB Description - spans full height */}
        <div className="h-full">
          <EditableTextarea
            partId={part.part_id}
            field="qb_description"
            currentValue={qbDescription}
            onSave={handleFieldSave}
            placeholder="QB Description..."
            hasValue={!!qbDescription && qbDescription.trim() !== ''}
          />
        </div>

        {/* Price Calculation - spans full height */}
        <div className="h-full">
          <EditableTextarea
            partId={part.part_id}
            field="invoice_description"
            currentValue={part.invoice_description || ''}
            onSave={handleFieldSave}
            placeholder="Description..."
            hasValue={false} // invoice_description doesn't use highlighting
          />
        </div>

        {/* Quantity - spans full height */}
        <div className="flex items-start">
          <EditableInput
            partId={part.part_id}
            field="quantity"
            currentValue={part.quantity}
            onSave={handleFieldSave}
            placeholder="Qty"
            hasValue={part.quantity !== null && part.quantity !== 0}
            align="left"
          />
        </div>

        {/* Unit Price - spans full height */}
        <div className="flex items-start text-right">
          <EditableInput
            partId={part.part_id}
            field="unit_price"
            currentValue={part.unit_price}
            onSave={handleFieldSave}
            placeholder="Price"
            hasValue={part.unit_price !== null && part.unit_price !== 0}
            align="right"
          />
        </div>

        {/* Extended Price - spans full height */}
        <div className="flex items-start justify-end">
          <span className="text-base font-semibold text-gray-900">
            {formatCurrency(part.extended_price)}
          </span>
        </div>
      </div>
    );
  };

  // Calculate invoice totals
  const invoiceSummary = React.useMemo(() => {
    // Calculate subtotal from all parts
    const subtotal = parts.reduce((sum, part) => {
      const extended = parseFloat(part.extended_price?.toString() || '0');
      return sum + extended;
    }, 0);

    // Calculate tax based on tax_name
    let taxDecimal = 0;
    let taxPercentDisplay = 0;
    if (taxName && taxRules.length > 0) {
      const taxRule = taxRules.find(rule => rule.tax_name === taxName);
      if (taxRule) {
        // tax_percent in DB is stored as decimal (e.g., 0.13 for 13%)
        taxDecimal = parseFloat(taxRule.tax_percent.toString());
        taxPercentDisplay = taxDecimal * 100; // Convert to percentage for display
      }
    }

    // Calculate tax amount (taxDecimal is already in decimal form, no division needed)
    const taxAmount = subtotal * taxDecimal;
    const total = subtotal + taxAmount;

    return {
      subtotal,
      taxPercent: taxPercentDisplay,
      taxAmount,
      total
    };
  }, [parts, taxName, taxRules]);

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      {/* Unified Table */}
      <div className="overflow-x-auto">
        {/* Header */}
        <div
          className="bg-gray-100 border-b-2 border-gray-400 grid gap-2 px-2 py-2"
          style={{
            gridTemplateColumns: '130px 120px 110px 110px 110px 70px 190px 410px 270px 55px 75px 85px'
          }}
        >
          <div className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
            Item Name
          </div>
          <div className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
            Specifications
          </div>
          <div className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
            Spec 1
          </div>
          <div className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
            Spec 2
          </div>
          <div className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
            Spec 3
          </div>
          <div className="text-xs font-semibold text-gray-700 uppercase tracking-wider text-center">
            Actions
          </div>
          <div className="text-xs font-semibold text-gray-700 uppercase tracking-wider border-l-2 border-gray-400 pl-2">
            QB Item
          </div>
          <div className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
            QB Description
          </div>
          <div className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
            Price Calculation
          </div>
          <div className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
            Qty
          </div>
          <div className="text-xs font-semibold text-gray-700 uppercase tracking-wider text-right">
            Unit Price
          </div>
          <div className="text-xs font-semibold text-gray-700 uppercase tracking-wider text-right">
            Extended
          </div>
        </div>

        {/* Body */}
        <div>
          {parts.length > 0 ? (
            parts.map(part => renderPartRow(part))
          ) : (
            <div className="p-6 text-center text-gray-500">
              No parts to display
            </div>
          )}
        </div>

        {/* Invoice Summary Footer */}
        <div className="border-t-2 border-gray-300 bg-gray-50 p-3">
          <div className="flex flex-col space-y-1 max-w-xs ml-auto">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Subtotal:</span>
              <span className="font-medium text-gray-900">
                {formatCurrency(invoiceSummary.subtotal)}
              </span>
            </div>

            <div className="flex justify-between text-sm">
              <span className="text-gray-600">
                {taxName ? `${taxName} ` : 'Tax '}({invoiceSummary.taxPercent.toFixed(2).replace(/\.00$/, '')}%):
              </span>
              <span className="font-medium text-gray-900">
                {formatCurrency(invoiceSummary.taxAmount)}
              </span>
            </div>

            <div className="flex justify-between text-base border-t pt-1">
              <span className="font-semibold text-gray-900">Total:</span>
              <span className="font-bold text-gray-900">
                {formatCurrency(invoiceSummary.total)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DualTableLayout;
