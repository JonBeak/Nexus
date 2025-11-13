import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, Pencil, Check, X, Printer, ChevronDown, Plus, Minus } from 'lucide-react';
import { Order, OrderPart } from '../../../types/orders';
import { ordersApi, provincesApi, customerApi, ledsApi, powerSuppliesApi, materialsApi, printApi } from '../../../services/api';
import ProgressView from '../progress/ProgressView';
import StatusBadge from '../common/StatusBadge';
import DualTableLayout from './DualTableLayout';
import OrderImage from '../common/OrderImage';
import {
  populateLEDOptions,
  populatePowerSupplyOptions,
  populateMaterialOptions,
  areTemplatesPopulated,
  getCachedLEDs,
  getCachedPowerSupplies,
  getCachedMaterials
} from '../../../config/orderProductTemplates';
import type { LEDType, PowerSupplyType } from '../../../config/specificationConstants';

interface TaxRule {
  tax_rule_id: number;
  tax_name: string;
  tax_percent: number;
  is_active: number;
}

// Field configuration object to centralize all field definitions
const FIELD_CONFIGS = {
  // Order Information Fields
  customer_po: {
    type: 'text' as const,
    label: 'Customer PO',
    section: 'order',
    placeholder: 'Enter PO number'
  },
  customer_job_number: {
    type: 'text' as const,
    label: 'Customer Job #',
    section: 'order',
    placeholder: 'Enter job number'
  },
  shipping_required: {
    type: 'select' as const,
    label: 'Shipping Method',
    section: 'order',
    options: [
      { value: 'true', label: 'Shipping' },
      { value: 'false', label: 'Pick Up' }
    ],
    displayFormatter: (val: any) => val ? 'Shipping' : 'Pick Up',
    valueTransform: (val: string) => val === 'true'
  },
  due_date: {
    type: 'date' as const,
    label: 'Due Date',
    section: 'order',
    displayFormatter: (val: any) => {
      if (!val) return '-';
      const [year, month, day] = val.split('T')[0].split('-');
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      return date.toLocaleDateString();
    },
    recalculateDays: true // Triggers turnaround/days until recalculation
  },
  hard_due_date_time: {
    type: 'time' as const,
    label: 'Hard Due Time',
    section: 'order',
    displayFormatter: (val: any) => {
      if (!val) return '-';
      const [hours, minutes] = val.split(':').map(Number);
      const period = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours % 12 || 12;
      return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
    },
    valueTransform: (val: string) => val ? `${val.trim()}:00` : null,
    extractValue: (val: string) => val ? val.substring(0, 5) : '' // Extract HH:mm from HH:mm:ss
  },

  // Invoice Fields
  invoice_email: {
    type: 'email' as const,
    label: 'Accounting Email',
    section: 'invoice',
    placeholder: 'accounting@company.com'
  },
  terms: {
    type: 'text' as const,
    label: 'Terms',
    section: 'invoice',
    placeholder: 'Net 30'
  },
  deposit_required: {
    type: 'checkbox' as const,
    label: 'Deposit Required',
    section: 'invoice',
    valueTransform: (val: string) => val === 'true'
  },
  cash: {
    type: 'checkbox' as const,
    label: 'Cash Customer',
    section: 'invoice',
    valueTransform: (val: string) => val === 'true'
  },
  discount: {
    type: 'number' as const,
    label: 'Discount',
    section: 'invoice',
    readOnly: true, // Display only field
    displayFormatter: (val: any) => {
      if (val && parseFloat(String(val)) > 0) {
        return `${parseFloat(String(val))}%`;
      }
      return '-';
    }
  },
  tax_name: {
    type: 'select' as const,
    label: 'Tax',
    section: 'invoice',
    customRender: true, // Uses custom dropdown with tax rules
    valueTransform: (val: string) => val
  },

  // Textarea Fields (Notes)
  manufacturing_note: {
    type: 'textarea' as const,
    label: 'Special Instructions',
    section: 'order',
    height: '60px',
    placeholder: 'Enter special manufacturing instructions...'
  },
  internal_note: {
    type: 'textarea' as const,
    label: 'Internal Notes',
    section: 'order',
    height: '60px',
    placeholder: 'Enter internal notes...'
  },
  invoice_notes: {
    type: 'textarea' as const,
    label: 'Invoice Notes',
    section: 'invoice',
    height: '60px',
    placeholder: 'Enter invoice notes...'
  }
};

// Helper function to get field config
const getFieldConfig = (field: keyof typeof FIELD_CONFIGS) => {
  return FIELD_CONFIGS[field];
};

// Reusable EditableField component to reduce repetition
interface EditableFieldProps {
  field: string;
  value: any;
  label?: string;
  type?: 'text' | 'date' | 'time' | 'email' | 'select' | 'checkbox' | 'textarea';
  options?: Array<{ value: string; label: string }>;
  isEditing: boolean;
  isSaving: boolean;
  onEdit: (field: string, currentValue: string) => void;
  onSave: (field: string) => void;
  onCancel: () => void;
  editValue?: string;
  onEditValueChange?: (value: string) => void;
  displayFormatter?: (value: any) => string;
  className?: string;
  height?: string; // For textarea height
  placeholder?: string; // For textarea placeholder
}

const EditableField: React.FC<EditableFieldProps> = ({
  field,
  value,
  type = 'text',
  options = [],
  isEditing,
  isSaving,
  onEdit,
  onSave,
  onCancel,
  editValue = '',
  onEditValueChange,
  displayFormatter,
  className = '',
  height = '60px',
  placeholder = ''
}) => {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // For textarea, don't trigger save on Enter (allow multiline)
    if (type === 'textarea') {
      if (e.key === 'Escape') {
        onCancel();
      }
    } else {
      if (e.key === 'Enter') {
        onSave(field);
      } else if (e.key === 'Escape') {
        onCancel();
      }
    }
  };

  const displayValue = displayFormatter ? displayFormatter(value) : (value || '-');

  if (type === 'checkbox') {
    return (
      <div className="flex items-center space-x-2 group h-6">
        <input
          type="checkbox"
          checked={value || false}
          onChange={(e) => {
            onEdit(field, String(e.target.checked));
            onSave(field);
          }}
          className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
        />
        <p className="font-medium text-gray-900 text-base">
          {value ? 'Yes' : 'No'}
        </p>
      </div>
    );
  }

  // Handle textarea type
  if (type === 'textarea') {
    if (isEditing) {
      return (
        <div className="relative" style={{ height }}>
          <div className="h-full">
            <textarea
              value={editValue}
              onChange={(e) => onEditValueChange?.(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              className="w-full text-sm text-gray-900 border border-indigo-300 rounded p-2 pr-28 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none box-border"
              style={{ height }}
              autoFocus
            />
            <div className="absolute top-1 right-6 flex flex-col space-y-1">
              <button
                onClick={() => onSave(field)}
                disabled={isSaving}
                className="px-2 py-0.5 bg-green-600 text-white rounded text-xs hover:bg-green-700 disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={onCancel}
                className="px-2 py-0.5 bg-gray-200 text-gray-700 rounded text-xs hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      );
    }

    // Display mode for textarea
    return (
      <div className="relative group" style={{ height }}>
        <p className="text-base text-gray-600 whitespace-pre-wrap h-full overflow-y-auto border border-gray-300 rounded px-2 py-1">
          {displayValue}
        </p>
        <button
          onClick={() => onEdit(field, String(value || ''))}
          className="absolute top-1 right-5 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-indigo-600 transition-opacity"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  // Default behavior for non-textarea types
  if (isEditing) {
    return (
      <div className="flex items-center space-x-1 h-6">
        {type === 'select' ? (
          <select
            value={editValue}
            onChange={(e) => onEditValueChange?.(e.target.value)}
            onKeyDown={handleKeyDown}
            className="font-medium text-gray-900 border border-indigo-300 rounded px-1 text-base w-full h-full"
            autoFocus
          >
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ) : (
          <input
            type={type}
            value={editValue}
            onChange={(e) => onEditValueChange?.(e.target.value)}
            onKeyDown={handleKeyDown}
            className={`font-medium text-gray-900 border border-indigo-300 rounded px-1 text-base w-full h-full ${className}`}
            autoFocus
          />
        )}
        <button
          onClick={() => onSave(field)}
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
        {displayValue}
      </p>
      <button
        onClick={() => onEdit(field, String(value || ''))}
        className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-indigo-600"
      >
        <Pencil className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

export const OrderDetailsPage: React.FC = () => {
  const { orderNumber } = useParams<{ orderNumber: string }>();
  const navigate = useNavigate();

  // Group 1: Order Data (4 states → 1)
  const [orderData, setOrderData] = useState<{
    order: Order | null;
    parts: OrderPart[];
    taxRules: TaxRule[];
    customerDiscount: number;
  }>({
    order: null,
    parts: [],
    taxRules: [],
    customerDiscount: 0
  });

  // Group 2: UI State (9 states → 1)
  const [uiState, setUiState] = useState<{
    loading: boolean;
    initialLoad: boolean;
    error: string | null;
    activeTab: 'specs' | 'progress';
    saving: boolean;
    generatingForms: boolean;
    printingForm: boolean;
    showFormsDropdown: boolean;
    showPrintModal: boolean;
  }>({
    loading: true,
    initialLoad: true,
    error: null,
    activeTab: 'specs',
    saving: false,
    generatingForms: false,
    printingForm: false,
    showFormsDropdown: false,
    showPrintModal: false
  });

  // Group 3: Edit State (2 states → 1)
  const [editState, setEditState] = useState<{
    editingField: string | null;
    editValue: string;
  }>({
    editingField: null,
    editValue: ''
  });

  // Group 4: Calculated Values & Specs Data (6 states → 1)
  const [calculatedValues, setCalculatedValues] = useState<{
    turnaroundDays: number | null;
    daysUntilDue: number | null;
    specsDataLoaded: boolean;
    leds: LEDType[];
    powerSupplies: PowerSupplyType[];
    materials: string[];
  }>({
    turnaroundDays: null,
    daysUntilDue: null,
    specsDataLoaded: false,
    leds: [],
    powerSupplies: [],
    materials: []
  });

  // Group 5: Print Configuration (1 state stays as is)
  const [printConfig, setPrintConfig] = useState({
    master: 1,
    estimate: 1,
    shop: 2,
    packing: 2
  });

  // Ref for scroll container
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Ref for dropdown container
  const formsDropdownRef = useRef<HTMLDivElement>(null);

  // Persistent scroll preservation during async save operations
  const savedScrollPosition = useRef<number | null>(null);
  const isSavingRef = useRef<boolean>(false);

  useEffect(() => {
    if (orderNumber) {
      fetchOrder(parseInt(orderNumber), true);
    }
    // Fetch tax rules for dropdown
    fetchTaxRules();
    // Fetch and cache LED and Power Supply data for specification templates
    fetchSpecificationData();
  }, [orderNumber]);

  const fetchTaxRules = async () => {
    try {
      const rules = await provincesApi.getTaxRules();
      setOrderData(prev => ({ ...prev, taxRules: rules }));
    } catch (err) {
      console.error('Error fetching tax rules:', err);
    }
  };

  const fetchSpecificationData = async () => {
    try {
      // Check if templates are already populated (cached)
      if (areTemplatesPopulated()) {
        // Use cached data
        setCalculatedValues(prev => ({
          ...prev,
          leds: getCachedLEDs(),
          powerSupplies: getCachedPowerSupplies(),
          materials: getCachedMaterials(),
          specsDataLoaded: true
        }));
        return;
      }
      // Fetch LEDs, Power Supplies, and Materials in parallel
      const [ledsData, powerSuppliesData, materialsData] = await Promise.all([
        ledsApi.getActiveLEDs(),
        powerSuppliesApi.getActivePowerSupplies(),
        materialsApi.getActiveSubstrates()
      ]);

      setCalculatedValues(prev => ({
        ...prev,
        leds: ledsData,
        powerSupplies: powerSuppliesData,
        materials: materialsData,
        specsDataLoaded: true
      }));

      // Populate template options with fetched data (also caches it)
      populateLEDOptions(ledsData);
      populatePowerSupplyOptions(powerSuppliesData);
      populateMaterialOptions(materialsData);
    } catch (err) {
      console.error('Error fetching specification data:', err);
      // Non-critical error - specs will just have empty dropdowns
    }
  };

  useEffect(() => {
    // Calculate turnaround days when order loads
    if (orderData.order && orderData.order.due_date) {
      calculateTurnaround();
      calculateDaysUntil();
    }
  }, [orderData.order?.order_date, orderData.order?.due_date]);

  // Scroll preservation: Restore scroll position synchronously before each paint during save operations
  useLayoutEffect(() => {
    if (isSavingRef.current && savedScrollPosition.current !== null && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = savedScrollPosition.current;

      // Also schedule restoration after paint to catch any late renders
      requestAnimationFrame(() => {
        if (isSavingRef.current && savedScrollPosition.current !== null && scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = savedScrollPosition.current;
        }
      });
    }
  }, [orderData.order, editState.editingField, calculatedValues.turnaroundDays, calculatedValues.daysUntilDue, uiState.saving]);

  const fetchOrder = async (orderNum: number, isInitial: boolean = false) => {
    try {
      if (isInitial) {
        setUiState(prev => ({ ...prev, loading: true }));
      }
      setUiState(prev => ({ ...prev, error: null }));
      const { order: orderDetails, parts: partsData } = await ordersApi.getOrderWithParts(orderNum);
      setOrderData(prev => ({ ...prev, order: orderDetails, parts: partsData }));

      // Fetch customer discount
      if (orderDetails.customer_id) {
        try {
          const customerData = await customerApi.getCustomer(orderDetails.customer_id);
          setOrderData(prev => ({ ...prev, customerDiscount: customerData.discount || 0 }));
        } catch (err) {
          console.error('Error fetching customer discount:', err);
          setOrderData(prev => ({ ...prev, customerDiscount: 0 }));
        }
      }
    } catch (err) {
      setUiState(prev => ({ ...prev, error: err instanceof Error ? err.message : 'Failed to fetch order' }));
      console.error('Error fetching order:', err);
    } finally {
      if (isInitial) {
        setUiState(prev => ({ ...prev, loading: false, initialLoad: false }));
      }
    }
  };

  const calculateTurnaround = async () => {
    if (!orderData.order || !orderData.order.due_date) return;

    try {
      const result = await ordersApi.calculateBusinessDays(
        orderData.order.order_date.split('T')[0], // Ensure YYYY-MM-DD format
        orderData.order.due_date.split('T')[0]
      );
      setCalculatedValues(prev => ({ ...prev, turnaroundDays: result.businessDays }));
    } catch (err) {
      console.error('Error calculating turnaround days:', err);
      setCalculatedValues(prev => ({ ...prev, turnaroundDays: null }));
    }
  };

  const calculateDaysUntil = async () => {
    if (!orderData.order || !orderData.order.due_date) return;

    try {
      const today = new Date().toISOString().split('T')[0];
      const result = await ordersApi.calculateBusinessDays(
        today,
        orderData.order.due_date.split('T')[0]
      );
      setCalculatedValues(prev => ({ ...prev, daysUntilDue: result.businessDays }));
    } catch (err) {
      console.error('Error calculating days until due:', err);
      setCalculatedValues(prev => ({ ...prev, daysUntilDue: null }));
    }
  };

  const handleGenerateForms = async () => {
    if (!orderData.order) return;

    try {
      setUiState(prev => ({ ...prev, generatingForms: true }));
      await ordersApi.generateOrderForms(orderData.order.order_number, false);
      alert('Order forms generated successfully!');
    } catch (err) {
      console.error('Error generating forms:', err);
      alert('Failed to generate order forms. Please try again.');
    } finally {
      setUiState(prev => ({ ...prev, generatingForms: false }));
    }
  };

  const calculateShopCount = (orderParts: OrderPart[]): number => {
    // Start with base count of 2 (Vinyl/CNC, QC & Packing)
    let count = 2;

    // Define specification checks - each adds 1 to shop count if found
    const specChecks = [
      // Check for Return
      (specs: any) => specs.return || specs.Return,

      // Check for Trim
      (specs: any) => specs.trim || specs.Trim,

      // Check for Pins with count OR D-Tape/Mounting
      (specs: any) => {
        const hasPins = specs.pins || specs.Pins;
        const hasDTape = specs['D-Tape'] || specs['d-tape'] || specs.dtape ||
                         specs.Dtape || specs.DTape || specs.mounting || specs.Mounting;
        return (hasPins && parseInt(String(hasPins)) > 0) || hasDTape;
      },

      // Check for LEDs or LED Neon
      (specs: any) => {
        const hasLEDs = specs.leds || specs.LEDs || specs.led || specs.LED;
        const hasLEDNeon = specs.led_neon || specs['LED Neon'] || specs.ledNeon;
        if (hasLEDs || hasLEDNeon) {
          const ledCount = parseInt(String(hasLEDs)) || 0;
          const neonCount = parseInt(String(hasLEDNeon)) || 0;
          return ledCount > 0 || neonCount > 0 || hasLEDs === true || hasLEDNeon === true;
        }
        return false;
      },

      // Check for Painting
      (specs: any) => specs.painting || specs.Painting
    ];

    // Apply each check - add 1 to count if any part matches
    for (const check of specChecks) {
      if (orderParts.some(part => check(part.specifications || {}))) {
        count++;
      }
    }

    return count;
  };

  const handleOpenPrintModal = () => {
    // Calculate shop count based on specs
    const shopCount = calculateShopCount(orderData.parts);

    // Set default quantities
    setPrintConfig({
      master: 1,
      estimate: 1,
      shop: shopCount,
      packing: 2
    });

    setUiState(prev => ({ ...prev, showPrintModal: true }));
  };

  const handlePrintForms = async () => {
    if (!orderData.order) return;

    try {
      setUiState(prev => ({ ...prev, printingForm: true }));
      const result = await printApi.printOrderFormsBatch(orderData.order.order_number, printConfig);

      if (result.success) {
        const { summary } = result;
        let message = `Successfully printed ${summary.printedCopies} forms in a single job!\n\n` +
          `Master: ${summary.master}\n` +
          `Estimate: ${summary.estimate}\n` +
          `Shop: ${summary.shop}\n` +
          `Packing: ${summary.packing}\n\n` +
          `Job ID: ${result.jobId}`;

        if (summary.skipped && summary.skipped.length > 0) {
          message += `\n\n⚠️ Note: ${summary.skipped.join(', ')} not found and skipped`;
        }

        alert(message);
      } else {
        alert('Failed to print forms. Please check the printer and try again.');
      }

      setUiState(prev => ({ ...prev, showPrintModal: false }));
    } catch (err: any) {
      console.error('Error printing forms:', err);
      alert(err.response?.data?.message || 'Failed to print forms. Please check that CUPS is installed and a printer is configured.');
    } finally {
      setUiState(prev => ({ ...prev, printingForm: false }));
    }
  };

  const handlePrintMasterForm = async () => {
    if (!orderData.order) return;

    try {
      setUiState(prev => ({ ...prev, printingForm: true }));
      const result = await printApi.printOrderForm(orderData.order.order_number, 'master');
      alert(`Print job submitted successfully! Job ID: ${result.jobId || 'unknown'}`);
    } catch (err: any) {
      console.error('Error printing master form:', err);
      alert(err.response?.data?.message || 'Failed to print master form. Please check that CUPS is installed and a printer is configured.');
    } finally {
      setUiState(prev => ({ ...prev, printingForm: false }));
    }
  };

  const buildFormUrls = () => {
    if (!orderData.order || !orderData.order.folder_name) return null;

    // Get base URL for PDFs (remove /api suffix since order-images is served from root)
    const apiUrl = (import.meta.env.VITE_API_URL || 'http://192.168.2.14:3001').replace(/\/api$/, '');
    const folderName = orderData.order.folder_name; // e.g., "Job Name ----- Customer Name"
    const orderNum = orderData.order.order_number;
    const jobName = orderData.order.order_name;

    // Add cache buster using current timestamp to ensure browser fetches latest PDF
    const cacheBuster = `?v=${Date.now()}`;

    // Build URLs using actual folder structure and new file names
    return {
      master: `${apiUrl}/order-images/Orders/${folderName}/${orderNum} - ${jobName}.pdf${cacheBuster}`,
      shop: `${apiUrl}/order-images/Orders/${folderName}/${orderNum} - ${jobName} - Shop.pdf${cacheBuster}`,
      customer: `${apiUrl}/order-images/Orders/${folderName}/Specs/${orderNum} - ${jobName} - Specs.pdf${cacheBuster}`,
      packing: `${apiUrl}/order-images/Orders/${folderName}/Specs/${orderNum} - ${jobName} - Packing List.pdf${cacheBuster}`
    };
  };

  const handleViewForms = () => {
    const urls = buildFormUrls();
    if (!urls) return;

    // Open all 4 forms in new tabs
    Object.values(urls).forEach((url) => {
      window.open(url, '_blank');
    });
  };

  const handleViewSingleForm = (formType: 'master' | 'shop' | 'customer' | 'packing') => {
    const urls = buildFormUrls();
    if (!urls) return;

    window.open(urls[formType], '_blank');
    setUiState(prev => ({ ...prev, showFormsDropdown: false }));
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (formsDropdownRef.current && !formsDropdownRef.current.contains(event.target as Node)) {
        setUiState(prev => ({ ...prev, showFormsDropdown: false }));
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleBack = () => {
    navigate('/orders');
  };

  const startEdit = (field: string, currentValue: string) => {
    const fieldConfig = getFieldConfig(field as keyof typeof FIELD_CONFIGS);

    // Use extractValue from config if available (e.g., for time fields)
    if (fieldConfig && fieldConfig.extractValue) {
      const extractedValue = fieldConfig.extractValue(currentValue);
      setEditState({ editingField: field, editValue: extractedValue });
    } else {
      setEditState({ editingField: field, editValue: currentValue || '' });
    }
  };

  const cancelEdit = () => {
    setEditState({ editingField: null, editValue: '' });
  };

  const saveEdit = async (field: string, overrideValue?: string) => {
    if (!orderData.order) return;

    // Mark that we're saving and capture scroll position ONCE
    isSavingRef.current = true;
    savedScrollPosition.current = scrollContainerRef.current?.scrollTop || 0;

    try {
      setUiState(prev => ({ ...prev, saving: true }));

      // Use override value if provided, otherwise use editValue from state
      const rawValue = overrideValue !== undefined ? overrideValue : editState.editValue;

      // Get field configuration for value transformation
      const fieldConfig = getFieldConfig(field as keyof typeof FIELD_CONFIGS);

      // Apply value transformation from field config if available
      let valueToSave: any = rawValue;
      if (fieldConfig && fieldConfig.valueTransform) {
        valueToSave = fieldConfig.valueTransform(rawValue);
      } else if (field === 'discount') {
        // Special case for discount (not directly editable)
        valueToSave = parseFloat(rawValue) || 0;
      }

      // Call API to update the order
      await ordersApi.updateOrder(orderData.order.order_number, {
        [field]: valueToSave
      });

      // Update local state
      const updatedOrder = { ...orderData.order, [field]: valueToSave };
      setOrderData(prev => ({ ...prev, order: updatedOrder }));
      setEditState({ editingField: null, editValue: '' });

      // Recalculate turnaround days and days until if specified in field config
      if (fieldConfig && fieldConfig.recalculateDays && rawValue) {
        try {
          const turnaroundResult = await ordersApi.calculateBusinessDays(
            orderData.order.order_date.split('T')[0],
            rawValue
          );
          setCalculatedValues(prev => ({ ...prev, turnaroundDays: turnaroundResult.businessDays }));

          const today = new Date().toISOString().split('T')[0];
          const daysUntilResult = await ordersApi.calculateBusinessDays(
            today,
            rawValue
          );
          setCalculatedValues(prev => ({ ...prev, daysUntilDue: daysUntilResult.businessDays }));
        } catch (err) {
          console.error('Error recalculating days:', err);
        }
      }
    } catch (err) {
      console.error('Error updating order:', err);
      alert('Failed to update orderData.order. Please try again.');
    } finally {
      setUiState(prev => ({ ...prev, saving: false }));

      // Clear scroll preservation AFTER all operations complete
      // Using setTimeout to ensure the final render has completed
      setTimeout(() => {
        isSavingRef.current = false;
        savedScrollPosition.current = null;
      }, 0);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, field: string) => {
    if (e.key === 'Enter') {
      saveEdit(field);
    } else if (e.key === 'Escape') {
      cancelEdit();
    }
  };

  if (uiState.initialLoad) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-500">Loading orderData.order...</div>
      </div>
    );
  }

  if (uiState.error || !orderData.order) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{uiState.error || 'Order not found'}</p>
          <button
            onClick={handleBack}
            className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
          >
            Back to orders
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header with Tabs in Middle */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Left: Order Info */}
          <div className="flex items-center space-x-4 flex-1">
            <button
              onClick={handleBack}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <div className="flex items-center space-x-3">
                <h1 className="text-2xl font-bold text-gray-900">
                  {orderData.order.order_name}
                </h1>
                <StatusBadge status={orderData.order.status} />
              </div>
              <p className="text-lg font-semibold text-gray-800 mt-1">{orderData.order.customer_name}</p>
              <p className="text-sm text-gray-600">Order #{orderData.order.order_number}</p>
            </div>
          </div>

          {/* Center: Tab Navigation */}
          <div className="flex items-center space-x-8 flex-1 justify-center">
            <button
              onClick={() => setUiState(prev => ({ ...prev, activeTab: 'specs' }))}
              className={`py-4 px-1 font-medium text-base transition-colors ${
                uiState.activeTab === 'specs'
                  ? 'border-b-4 border-indigo-600 text-indigo-600'
                  : 'border-b-2 border-gray-300 text-gray-500 hover:text-gray-700 hover:border-gray-400'
              }`}
            >
              Specs & Invoice
            </button>
            <button
              onClick={() => setUiState(prev => ({ ...prev, activeTab: 'progress' }))}
              className={`py-4 px-1 font-medium text-base transition-colors ${
                uiState.activeTab === 'progress'
                  ? 'border-b-4 border-indigo-600 text-indigo-600'
                  : 'border-b-2 border-gray-300 text-gray-500 hover:text-gray-700 hover:border-gray-400'
              }`}
            >
              Job Progress
            </button>
          </div>

          {/* Right: Quick Actions */}
          <div className="flex items-center space-x-3 flex-1 justify-end">
            <button
              onClick={handleGenerateForms}
              disabled={uiState.generatingForms}
              className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm font-medium"
            >
              <FileText className="w-4 h-4" />
              <span>{uiState.generatingForms ? 'Generating...' : 'Generate Order Forms'}</span>
            </button>
            <button
              onClick={handleOpenPrintModal}
              disabled={uiState.printingForm}
              className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm font-medium"
            >
              <Printer className="w-4 h-4" />
              <span>{uiState.printingForm ? 'Printing...' : 'Print Forms'}</span>
            </button>
            {/* Split Button: View Forms with Dropdown */}
            <div ref={formsDropdownRef} className="relative">
              <div className="flex">
                {/* Main Button - Opens All Forms */}
                <button
                  onClick={handleViewForms}
                  className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-300 rounded-l-lg hover:bg-gray-50 text-sm font-medium text-gray-700"
                >
                  <FileText className="w-4 h-4" />
                  <span>View Forms</span>
                </button>

                {/* Dropdown Toggle Button */}
                <button
                  onClick={() => setUiState(prev => ({ ...prev, showFormsDropdown: !prev.showFormsDropdown }))}
                  className="px-2 py-2 bg-white border-t border-r border-b border-gray-300 border-l border-gray-200 rounded-r-lg hover:bg-gray-50 text-gray-700"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>

              {/* Dropdown Menu */}
              {uiState.showFormsDropdown && (
                <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                  <div className="py-1">
                    <button
                      onClick={() => handleViewSingleForm('master')}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                    >
                      <FileText className="w-4 h-4" />
                      <span>Master Form</span>
                    </button>
                    <button
                      onClick={() => handleViewSingleForm('shop')}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                    >
                      <FileText className="w-4 h-4" />
                      <span>Shop Form</span>
                    </button>
                    <button
                      onClick={() => handleViewSingleForm('customer')}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                    >
                      <FileText className="w-4 h-4" />
                      <span>Specs Form</span>
                    </button>
                    <button
                      onClick={() => handleViewSingleForm('packing')}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                    >
                      <FileText className="w-4 h-4" />
                      <span>Packing List</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        </div>
      </div>

      {/* Main Content: Tabbed Layout */}
      <div ref={scrollContainerRef} className="flex-1 overflow-auto">
        <div className="px-4 py-4 h-full">
          {/* TAB 1: Specs & Invoice - Full Width */}
          {uiState.activeTab === 'specs' && (
            <div className="flex flex-col gap-4 h-full">
              {/* Top Row: Order Info (Left) and Invoice Info (Right) */}
              <div className="flex gap-4">
                {/* Left: Order Info Panel - Narrower */}
                <div className="flex-shrink-0 bg-white rounded-lg shadow p-4 flex gap-6" style={{ width: '1123px', minHeight: '240px', maxHeight: '250px' }}>
                {/* Left: Order Image - 32% of panel width */}
                <div style={{ width: '32%' }}>
                  <OrderImage
                    orderNumber={orderData.order.order_number}
                    signImagePath={orderData.order.sign_image_path}
                    cropTop={orderData.order.crop_top}
                    cropRight={orderData.order.crop_right}
                    cropBottom={orderData.order.crop_bottom}
                    cropLeft={orderData.order.crop_left}
                    folderName={orderData.order.folder_name}
                    folderLocation={orderData.order.folder_location}
                    isMigrated={orderData.order.is_migrated}
                    onImageUpdated={() => fetchOrder(orderData.order.order_number)}
                  />
                </div>

                {/* Right: Order Details - 68% of panel width */}
                <div className="flex flex-col gap-4" style={{ width: '68%' }}>
                  {/* Row 1: Order Date, Customer PO, Customer Job #, Shipping Method */}
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <span className="text-gray-500 text-sm">Order Date:</span>
                      <p className="font-medium text-gray-900 text-base">
                        {FIELD_CONFIGS.due_date.displayFormatter(orderData.order.order_date)}
                      </p>
                    </div>

                    {/* Customer PO - Editable */}
                    <div className="flex-1">
                      <span className="text-gray-500 text-sm">{FIELD_CONFIGS.customer_po.label}:</span>
                      <EditableField
                        field="customer_po"
                        value={orderData.order.customer_po}
                        type={FIELD_CONFIGS.customer_po.type}
                        isEditing={editState.editingField === 'customer_po'}
                        isSaving={uiState.saving}
                        onEdit={startEdit}
                        onSave={saveEdit}
                        onCancel={cancelEdit}
                        editValue={editState.editValue}
                        onEditValueChange={(value) => setEditState(prev => ({ ...prev, editValue: value }))}
                      />
                    </div>

                    {/* Customer Job # - Editable */}
                    <div className="flex-1">
                      <span className="text-gray-500 text-sm">Customer Job #:</span>
                      <EditableField
                        field="customer_job_number"
                        value={orderData.order.customer_job_number}
                        type="text"
                        isEditing={editState.editingField === 'customer_job_number'}
                        isSaving={uiState.saving}
                        onEdit={startEdit}
                        onSave={saveEdit}
                        onCancel={cancelEdit}
                        editValue={editState.editValue}
                        onEditValueChange={(value) => setEditState(prev => ({ ...prev, editValue: value }))}
                      />
                    </div>

                    {/* Shipping Method - Dropdown (uses shipping_required boolean) */}
                    <div className="flex-1">
                      <span className="text-gray-500 text-sm">{FIELD_CONFIGS.shipping_required.label}:</span>
                      <EditableField
                        field="shipping_required"
                        value={orderData.order.shipping_required}
                        type={FIELD_CONFIGS.shipping_required.type}
                        options={FIELD_CONFIGS.shipping_required.options}
                        isEditing={editState.editingField === 'shipping_required'}
                        isSaving={uiState.saving}
                        onEdit={startEdit}
                        onSave={saveEdit}
                        onCancel={cancelEdit}
                        editValue={editState.editValue}
                        onEditValueChange={(value) => setEditState(prev => ({ ...prev, editValue: value }))}
                        displayFormatter={FIELD_CONFIGS.shipping_required.displayFormatter}
                      />
                    </div>
                  </div>

                  {/* Row 2: Due Date, Hard Due Time, Turnaround Time, Due In */}
                  <div className="flex gap-4 items-end">
                    {/* Due Date - Editable */}
                    <div className="flex-1">
                      <span className="text-gray-500 text-sm">{FIELD_CONFIGS.due_date.label}:</span>
                      <EditableField
                        field="due_date"
                        value={orderData.order.due_date}
                        type={FIELD_CONFIGS.due_date.type}
                        isEditing={editState.editingField === 'due_date'}
                        isSaving={uiState.saving}
                        onEdit={startEdit}
                        onSave={saveEdit}
                        onCancel={cancelEdit}
                        editValue={editState.editValue}
                        onEditValueChange={(value) => setEditState(prev => ({ ...prev, editValue: value }))}
                        displayFormatter={FIELD_CONFIGS.due_date.displayFormatter}
                      />
                    </div>

                    {/* Hard Due Time - Editable */}
                    <div className="flex-1">
                      <span className="text-gray-500 text-sm">{FIELD_CONFIGS.hard_due_date_time.label}:</span>
                      <EditableField
                        field="hard_due_date_time"
                        value={orderData.order.hard_due_date_time}
                        type={FIELD_CONFIGS.hard_due_date_time.type}
                        isEditing={editState.editingField === 'hard_due_date_time'}
                        isSaving={uiState.saving}
                        onEdit={startEdit}
                        onSave={saveEdit}
                        onCancel={cancelEdit}
                        editValue={editState.editValue}
                        onEditValueChange={(value) => setEditState(prev => ({ ...prev, editValue: value }))}
                        displayFormatter={FIELD_CONFIGS.hard_due_date_time.displayFormatter}
                      />
                    </div>

                    {/* Turnaround Time */}
                    <div className="flex-1">
                      <span className="text-gray-500 text-sm">Turnaround Time:</span>
                      <p className="font-medium text-gray-900 text-base h-6 flex items-center">
                        {calculatedValues.turnaroundDays !== null ? `${calculatedValues.turnaroundDays} days` : 'Calculating...'}
                      </p>
                    </div>

                    {/* Due In */}
                    <div className="flex-1">
                      <span className="text-gray-500 text-sm">Due in:</span>
                      <p className="font-medium text-gray-900 text-base h-6 flex items-center">
                        {calculatedValues.daysUntilDue !== null ? `${calculatedValues.daysUntilDue} days` : 'Calculating...'}
                      </p>
                    </div>
                  </div>

                  {/* Row 3: Special Instructions & Internal Notes - Side by Side */}
                  <div className="mt-2 flex gap-4">
                    {/* Special Instructions */}
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-gray-700 mb-1">Special Instructions</h3>
                      <EditableField
                        field="manufacturing_note"
                        value={orderData.order.manufacturing_note}
                        type="textarea"
                        height="60px"
                        placeholder="Enter special manufacturing instructions..."
                        isEditing={editState.editingField === 'manufacturing_note'}
                        isSaving={uiState.saving}
                        onEdit={startEdit}
                        onSave={saveEdit}
                        onCancel={cancelEdit}
                        editValue={editState.editValue}
                        onEditValueChange={(value) => setEditState(prev => ({ ...prev, editValue: value }))}
                      />
                    </div>

                    {/* Internal Notes */}
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-gray-700 mb-1">Internal Notes</h3>
                      <EditableField
                        field="internal_note"
                        value={orderData.order.internal_note}
                        type="textarea"
                        height="60px"
                        placeholder="Enter internal notes..."
                        isEditing={editState.editingField === 'internal_note'}
                        isSaving={uiState.saving}
                        onEdit={startEdit}
                        onSave={saveEdit}
                        onCancel={cancelEdit}
                        editValue={editState.editValue}
                        onEditValueChange={(value) => setEditState(prev => ({ ...prev, editValue: value }))}
                      />
                    </div>
                  </div>
                </div>
              </div>

                {/* Right: Contact & Invoice Details Panel */}
                <div className="flex-shrink-0 bg-white rounded-lg shadow p-4" style={{ width: '749px', minHeight: '240px', maxHeight: '250px' }}>
                  <div className="h-full flex flex-col gap-4">
                    {/* Top Section: Point Persons, Accounting Email, Terms */}
                    <div className="flex gap-4">
                      {/* Point Persons - Display only, flex-2 (managed via order_point_persons table) */}
                      <div className="flex-[2]">
                        <span className="text-gray-500 text-sm">Point Person(s):</span>
                        <div className="space-y-1">
                          {orderData.order.point_persons && orderData.order.point_persons.length > 0 ? (
                            orderData.order.point_persons.map((person, index) => (
                              <p key={person.id} className="font-medium text-gray-900 text-base">
                                {person.contact_email}
                                {person.contact_name && ` (${person.contact_name})`}
                              </p>
                            ))
                          ) : (
                            <p className="font-medium text-gray-900 text-base">-</p>
                          )}
                        </div>
                      </div>

                      {/* Accounting Email - Editable (from Customer) */}
                      <div className="flex-1">
                        <span className="text-gray-500 text-sm">Accounting Email:</span>
                        <EditableField
                          field="invoice_email"
                          value={orderData.order.invoice_email}
                          type="email"
                          isEditing={editState.editingField === 'invoice_email'}
                          isSaving={uiState.saving}
                          onEdit={startEdit}
                          onSave={saveEdit}
                          onCancel={cancelEdit}
                          editValue={editState.editValue}
                          onEditValueChange={(value) => setEditState(prev => ({ ...prev, editValue: value }))}
                        />
                      </div>

                      {/* Terms - Editable (from Customer) */}
                      <div className="flex-1">
                        <span className="text-gray-500 text-sm">Terms:</span>
                        <EditableField
                          field="terms"
                          value={orderData.order.terms}
                          type="text"
                          isEditing={editState.editingField === 'terms'}
                          isSaving={uiState.saving}
                          onEdit={startEdit}
                          onSave={saveEdit}
                          onCancel={cancelEdit}
                          editValue={editState.editValue}
                          onEditValueChange={(value) => setEditState(prev => ({ ...prev, editValue: value }))}
                        />
                      </div>
                    </div>

                    {/* Middle Section: Deposit Required, Cash, Discount, Tax */}
                    <div className="flex gap-4">

                      {/* Deposit Required - Checkbox (from Customer) */}
                      <div className="flex-1">
                        <span className="text-gray-500 text-sm">Deposit Required:</span>
                        <EditableField
                          field="deposit_required"
                          value={orderData.order.deposit_required}
                          type="checkbox"
                          isEditing={false}
                          isSaving={uiState.saving}
                          onEdit={(field, value) => {
                            setEditState(prev => ({ ...prev, editingField: field }));
                            saveEdit(field, value);
                          }}
                          onSave={saveEdit}
                          onCancel={cancelEdit}
                          editValue={editState.editValue}
                          onEditValueChange={(value) => setEditState(prev => ({ ...prev, editValue: value }))}
                        />
                      </div>

                      {/* Cash Customer - Checkbox (from Customer) */}
                      <div className="flex-1">
                        <span className="text-gray-500 text-sm">Cash Customer:</span>
                        <EditableField
                          field="cash"
                          value={orderData.order.cash}
                          type="checkbox"
                          isEditing={false}
                          isSaving={uiState.saving}
                          onEdit={(field, value) => {
                            setEditState(prev => ({ ...prev, editingField: field }));
                            saveEdit(field, value);
                          }}
                          onSave={saveEdit}
                          onCancel={cancelEdit}
                          editValue={editState.editValue}
                          onEditValueChange={(value) => setEditState(prev => ({ ...prev, editValue: value }))}
                        />
                      </div>

                      {/* Discount - Display Only (from Customer) */}
                      <div className="flex-1">
                        <span className="text-gray-500 text-sm">Discount:</span>
                        <div className="flex items-center h-6">
                          <p className="font-medium text-gray-900 text-base">
                            {orderData.customerDiscount && parseFloat(String(orderData.customerDiscount)) > 0
                              ? `${parseFloat(String(orderData.customerDiscount))}%`
                              : '-'}
                          </p>
                        </div>
                      </div>

                      {/* Tax - Editable Dropdown (from billing address) */}
                      <div className="flex-1">
                        <span className="text-gray-500 text-sm">Tax:</span>
                        {editState.editingField === 'tax_name' ? (
                          <div className="flex items-center space-x-1 h-6">
                            <select
                              value={editValue}
                              onChange={(e) => setEditState(prev => ({ ...prev, editValue: e.target.value }))}
                              onKeyDown={(e) => handleKeyDown(e, 'tax_name')}
                              className="font-medium text-gray-900 border border-indigo-300 rounded px-1 text-base w-full h-full"
                              autoFocus
                            >
                              {orderData.taxRules.map((rule) => (
                                <option key={rule.tax_rule_id} value={rule.tax_name}>
                                  {rule.tax_name} ({(rule.tax_percent * 100).toFixed(1)}%)
                                </option>
                              ))}
                            </select>
                            <button onClick={() => saveEdit('tax_name')} disabled={uiState.saving} className="text-green-600 hover:text-green-700 flex-shrink-0">
                              <Check className="w-4 h-4" />
                            </button>
                            <button onClick={cancelEdit} className="text-gray-500 hover:text-gray-700 flex-shrink-0">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-2 group h-6">
                            <p className="font-medium text-gray-900 text-base">
                              {orderData.order.tax_name ? (
                                <>
                                  {orderData.order.tax_name} ({((orderData.taxRules.find(r => r.tax_name === orderData.order.tax_name)?.tax_percent || 0) * 100).toFixed(1)}%)
                                </>
                              ) : '-'}
                            </p>
                            <button
                              onClick={() => startEdit('tax_name', orderData.order.tax_name || '')}
                              className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-indigo-600"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Bottom Section: Invoice Notes - Editable (from Customer) */}
                    <div className="mt-2">
                      <h3 className="text-sm font-semibold text-gray-700 mb-1">Invoice Notes</h3>
                      <EditableField
                        field="invoice_notes"
                        value={orderData.order.invoice_notes}
                        type="textarea"
                        height="60px"
                        placeholder="Enter invoice notes..."
                        isEditing={editState.editingField === 'invoice_notes'}
                        isSaving={uiState.saving}
                        onEdit={startEdit}
                        onSave={saveEdit}
                        onCancel={cancelEdit}
                        editValue={editState.editValue}
                        onEditValueChange={(value) => setEditState(prev => ({ ...prev, editValue: value }))}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Row: Job Details & Invoice (Dual-Table) - Full Width */}
              <div className="flex-shrink-0" style={{ width: '1888px' }}>
                <DualTableLayout
                  orderNumber={orderData.order.order_number}
                  initialParts={orderData.parts}
                  taxName={orderData.order.tax_name}
                />
              </div>
            </div>
          )}

          {/* TAB 2: Job Progress - 2/3 Width Centered */}
          {uiState.activeTab === 'progress' && (
            <div className="flex justify-center h-full">
              <div className="w-full max-w-[1280px]">
                <ProgressView
                  orderNumber={orderData.order.order_number}
                  currentStatus={orderData.order.status}
                  productionNotes={orderData.order.production_notes}
                  onOrderUpdated={() => fetchOrder(orderData.order.order_number)}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Print Modal */}
      {uiState.showPrintModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-[500px]">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Print Forms</h2>
            <p className="text-sm text-gray-600 mb-6">Select quantity for each form type</p>

            <div className="space-y-4 mb-6">
              {/* Master Form */}
              <div className="flex items-center justify-between">
                <span className="text-base font-medium text-gray-700">Master Form</span>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => setPrintConfig(prev => ({ ...prev, master: Math.max(0, prev.master - 1) }))}
                    className="p-1 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-12 text-center text-lg font-semibold text-gray-900">{printConfig.master}</span>
                  <button
                    onClick={() => setPrintConfig(prev => ({ ...prev, master: prev.master + 1 }))}
                    className="p-1 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Estimate Form */}
              <div className="flex items-center justify-between">
                <span className="text-base font-medium text-gray-700">Estimate Form</span>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => setPrintConfig(prev => ({ ...prev, estimate: Math.max(0, prev.estimate - 1) }))}
                    className="p-1 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-12 text-center text-lg font-semibold text-gray-900">{printConfig.estimate}</span>
                  <button
                    onClick={() => setPrintConfig(prev => ({ ...prev, estimate: prev.estimate + 1 }))}
                    className="p-1 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Shop Form */}
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-base font-medium text-gray-700">Shop Form</span>
                  <p className="text-xs text-gray-500 mt-0.5">Auto-calculated from specs</p>
                </div>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => setPrintConfig(prev => ({ ...prev, shop: Math.max(0, prev.shop - 1) }))}
                    className="p-1 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-12 text-center text-lg font-semibold text-gray-900">{printConfig.shop}</span>
                  <button
                    onClick={() => setPrintConfig(prev => ({ ...prev, shop: prev.shop + 1 }))}
                    className="p-1 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Packing List */}
              <div className="flex items-center justify-between">
                <span className="text-base font-medium text-gray-700">Packing List</span>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => setPrintConfig(prev => ({ ...prev, packing: Math.max(0, prev.packing - 1) }))}
                    className="p-1 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-12 text-center text-lg font-semibold text-gray-900">{printConfig.packing}</span>
                  <button
                    onClick={() => setPrintConfig(prev => ({ ...prev, packing: prev.packing + 1 }))}
                    className="p-1 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end space-x-3">
              <button
                onClick={() => setUiState(prev => ({ ...prev, showPrintModal: false }))}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handlePrintForms}
                disabled={uiState.printingForm}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                <Printer className="w-4 h-4" />
                <span>{uiState.printingForm ? 'Printing...' : 'Print'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderDetailsPage;
