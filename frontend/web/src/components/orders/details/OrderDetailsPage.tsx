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

// Reusable EditableField component to reduce repetition
interface EditableFieldProps {
  field: string;
  value: any;
  label?: string;
  type?: 'text' | 'date' | 'time' | 'email' | 'select' | 'checkbox';
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
  className = ''
}) => {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onSave(field);
    } else if (e.key === 'Escape') {
      onCancel();
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
  const [order, setOrder] = useState<Order | null>(null);
  const [parts, setParts] = useState<OrderPart[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialLoad, setInitialLoad] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [taxRules, setTaxRules] = useState<TaxRule[]>([]);
  const [customerDiscount, setCustomerDiscount] = useState<number>(0);

  // Cache LED, Power Supply, and Materials data for specification templates
  const [leds, setLeds] = useState<LEDType[]>([]);
  const [powerSupplies, setPowerSupplies] = useState<PowerSupplyType[]>([]);
  const [materials, setMaterials] = useState<string[]>([]);
  const [specsDataLoaded, setSpecsDataLoaded] = useState(false);

  // Tab state
  const [activeTab, setActiveTab] = useState<'specs' | 'progress'>('specs');

  // Editing states
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [saving, setSaving] = useState(false);

  // Form generation state
  const [generatingForms, setGeneratingForms] = useState(false);
  const [printingForm, setPrintingForm] = useState(false);
  const [showFormsDropdown, setShowFormsDropdown] = useState(false);

  // Print modal state
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printQuantities, setPrintQuantities] = useState({
    master: 1,
    estimate: 1,
    shop: 2,
    packing: 2
  });

  // Turnaround days calculation
  const [turnaroundDays, setTurnaroundDays] = useState<number | null>(null);
  const [daysUntilDue, setDaysUntilDue] = useState<number | null>(null);

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
      setTaxRules(rules);
    } catch (err) {
      console.error('Error fetching tax rules:', err);
    }
  };

  const fetchSpecificationData = async () => {
    try {
      // Check if templates are already populated (cached)
      if (areTemplatesPopulated()) {
        // Use cached data
        setLeds(getCachedLEDs());
        setPowerSupplies(getCachedPowerSupplies());
        setMaterials(getCachedMaterials());
        setSpecsDataLoaded(true);
        return;
      }
      // Fetch LEDs, Power Supplies, and Materials in parallel
      const [ledsData, powerSuppliesData, materialsData] = await Promise.all([
        ledsApi.getActiveLEDs(),
        powerSuppliesApi.getActivePowerSupplies(),
        materialsApi.getActiveSubstrates()
      ]);

      setLeds(ledsData);
      setPowerSupplies(powerSuppliesData);
      setMaterials(materialsData);

      // Populate template options with fetched data (also caches it)
      populateLEDOptions(ledsData);
      populatePowerSupplyOptions(powerSuppliesData);
      populateMaterialOptions(materialsData);

      setSpecsDataLoaded(true);
    } catch (err) {
      console.error('Error fetching specification data:', err);
      // Non-critical error - specs will just have empty dropdowns
    }
  };

  useEffect(() => {
    // Calculate turnaround days when order loads
    if (order && order.due_date) {
      calculateTurnaround();
      calculateDaysUntil();
    }
  }, [order?.order_date, order?.due_date]);

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
  }, [order, editingField, turnaroundDays, daysUntilDue, saving]);

  const fetchOrder = async (orderNum: number, isInitial: boolean = false) => {
    try {
      if (isInitial) {
        setLoading(true);
      }
      setError(null);
      const { order: orderData, parts: partsData } = await ordersApi.getOrderWithParts(orderNum);
      setOrder(orderData);
      setParts(partsData);

      // Fetch customer discount
      if (orderData.customer_id) {
        try {
          const customerData = await customerApi.getCustomer(orderData.customer_id);
          setCustomerDiscount(customerData.discount || 0);
        } catch (err) {
          console.error('Error fetching customer discount:', err);
          setCustomerDiscount(0);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch order');
      console.error('Error fetching order:', err);
    } finally {
      if (isInitial) {
        setLoading(false);
        setInitialLoad(false);
      }
    }
  };

  const calculateTurnaround = async () => {
    if (!order || !order.due_date) return;

    try {
      const result = await ordersApi.calculateBusinessDays(
        order.order_date.split('T')[0], // Ensure YYYY-MM-DD format
        order.due_date.split('T')[0]
      );
      setTurnaroundDays(result.businessDays);
    } catch (err) {
      console.error('Error calculating turnaround days:', err);
      setTurnaroundDays(null);
    }
  };

  const calculateDaysUntil = async () => {
    if (!order || !order.due_date) return;

    try {
      const today = new Date().toISOString().split('T')[0];
      const result = await ordersApi.calculateBusinessDays(
        today,
        order.due_date.split('T')[0]
      );
      setDaysUntilDue(result.businessDays);
    } catch (err) {
      console.error('Error calculating days until due:', err);
      setDaysUntilDue(null);
    }
  };

  const handleGenerateForms = async () => {
    if (!order) return;

    try {
      setGeneratingForms(true);
      await ordersApi.generateOrderForms(order.order_number, false);
      alert('Order forms generated successfully!');
    } catch (err) {
      console.error('Error generating forms:', err);
      alert('Failed to generate order forms. Please try again.');
    } finally {
      setGeneratingForms(false);
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
    const shopCount = calculateShopCount(parts);

    // Set default quantities
    setPrintQuantities({
      master: 1,
      estimate: 1,
      shop: shopCount,
      packing: 2
    });

    setShowPrintModal(true);
  };

  const handlePrintForms = async () => {
    if (!order) return;

    try {
      setPrintingForm(true);
      const result = await printApi.printOrderFormsBatch(order.order_number, printQuantities);

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

      setShowPrintModal(false);
    } catch (err: any) {
      console.error('Error printing forms:', err);
      alert(err.response?.data?.message || 'Failed to print forms. Please check that CUPS is installed and a printer is configured.');
    } finally {
      setPrintingForm(false);
    }
  };

  const handlePrintMasterForm = async () => {
    if (!order) return;

    try {
      setPrintingForm(true);
      const result = await printApi.printOrderForm(order.order_number, 'master');
      alert(`Print job submitted successfully! Job ID: ${result.jobId || 'unknown'}`);
    } catch (err: any) {
      console.error('Error printing master form:', err);
      alert(err.response?.data?.message || 'Failed to print master form. Please check that CUPS is installed and a printer is configured.');
    } finally {
      setPrintingForm(false);
    }
  };

  const buildFormUrls = () => {
    if (!order || !order.folder_name) return null;

    // Get base URL for PDFs (remove /api suffix since order-images is served from root)
    const apiUrl = (import.meta.env.VITE_API_URL || 'http://192.168.2.14:3001').replace(/\/api$/, '');
    const folderName = order.folder_name; // e.g., "Job Name ----- Customer Name"
    const orderNum = order.order_number;
    const jobName = order.order_name;

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
    setShowFormsDropdown(false);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (formsDropdownRef.current && !formsDropdownRef.current.contains(event.target as Node)) {
        setShowFormsDropdown(false);
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
    setEditingField(field);

    // For hard_due_date_time, extract just the time portion (HH:mm)
    if (field === 'hard_due_date_time' && currentValue) {
      // currentValue is TIME format like "16:00:00", extract "16:00"
      const timePart = currentValue.substring(0, 5); // Get HH:mm from HH:mm:ss
      setEditValue(timePart);
    } else {
      setEditValue(currentValue || '');
    }
  };

  const cancelEdit = () => {
    setEditingField(null);
    setEditValue('');
  };

  const saveEdit = async (field: string, overrideValue?: string) => {
    if (!order) return;

    // Mark that we're saving and capture scroll position ONCE
    isSavingRef.current = true;
    savedScrollPosition.current = scrollContainerRef.current?.scrollTop || 0;

    try {
      setSaving(true);

      // Use override value if provided, otherwise use editValue from state
      const rawValue = overrideValue !== undefined ? overrideValue : editValue;

      // Convert string to boolean for boolean fields
      let valueToSave: any = rawValue;
      if (field === 'shipping_required' || field === 'deposit_required' || field === 'cash') {
        valueToSave = rawValue === 'true';
      } else if (field === 'discount') {
        valueToSave = parseFloat(rawValue) || 0;
      } else if (field === 'hard_due_date_time') {
        // For hard_due_date_time, just send the time value (database column is TIME type)
        // rawValue is like "16:00" from the time input
        // MySQL TIME format needs "HH:mm:ss"
        if (rawValue && rawValue.trim()) {
          valueToSave = `${rawValue.trim()}:00`; // Convert "16:00" to "16:00:00"
        } else {
          valueToSave = null; // If empty, clear the time
        }
      }

      // Call API to update the order
      await ordersApi.updateOrder(order.order_number, {
        [field]: valueToSave
      });

      // Update local state
      const updatedOrder = { ...order, [field]: valueToSave };
      setOrder(updatedOrder);
      setEditingField(null);
      setEditValue('');

      // Recalculate turnaround days and days until if due_date was changed
      if (field === 'due_date' && editValue) {
        try {
          const turnaroundResult = await ordersApi.calculateBusinessDays(
            order.order_date.split('T')[0],
            editValue
          );
          setTurnaroundDays(turnaroundResult.businessDays);

          const today = new Date().toISOString().split('T')[0];
          const daysUntilResult = await ordersApi.calculateBusinessDays(
            today,
            editValue
          );
          setDaysUntilDue(daysUntilResult.businessDays);
        } catch (err) {
          console.error('Error recalculating days:', err);
        }
      }
    } catch (err) {
      console.error('Error updating order:', err);
      alert('Failed to update order. Please try again.');
    } finally {
      setSaving(false);

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

  const formatTimeTo12Hour = (time: string | undefined): string => {
    if (!time) return '-';

    // time format is "HH:mm:ss" (24-hour TIME from database)
    const [hours, minutes] = time.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12; // Convert 0 to 12 for midnight

    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  const formatDateString = (dateString: string | undefined): string => {
    if (!dateString) return '-';

    // Parse YYYY-MM-DD directly without timezone conversion
    const [year, month, day] = dateString.split('T')[0].split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));

    return date.toLocaleDateString();
  };

  if (initialLoad) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-500">Loading order...</div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error || 'Order not found'}</p>
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
                  {order.order_name}
                </h1>
                <StatusBadge status={order.status} />
              </div>
              <p className="text-lg font-semibold text-gray-800 mt-1">{order.customer_name}</p>
              <p className="text-sm text-gray-600">Order #{order.order_number}</p>
            </div>
          </div>

          {/* Center: Tab Navigation */}
          <div className="flex items-center space-x-8 flex-1 justify-center">
            <button
              onClick={() => setActiveTab('specs')}
              className={`py-4 px-1 font-medium text-base transition-colors ${
                activeTab === 'specs'
                  ? 'border-b-4 border-indigo-600 text-indigo-600'
                  : 'border-b-2 border-gray-300 text-gray-500 hover:text-gray-700 hover:border-gray-400'
              }`}
            >
              Specs & Invoice
            </button>
            <button
              onClick={() => setActiveTab('progress')}
              className={`py-4 px-1 font-medium text-base transition-colors ${
                activeTab === 'progress'
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
              disabled={generatingForms}
              className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm font-medium"
            >
              <FileText className="w-4 h-4" />
              <span>{generatingForms ? 'Generating...' : 'Generate Order Forms'}</span>
            </button>
            <button
              onClick={handleOpenPrintModal}
              disabled={printingForm}
              className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm font-medium"
            >
              <Printer className="w-4 h-4" />
              <span>{printingForm ? 'Printing...' : 'Print Forms'}</span>
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
                  onClick={() => setShowFormsDropdown(!showFormsDropdown)}
                  className="px-2 py-2 bg-white border-t border-r border-b border-gray-300 border-l border-gray-200 rounded-r-lg hover:bg-gray-50 text-gray-700"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>

              {/* Dropdown Menu */}
              {showFormsDropdown && (
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
          {activeTab === 'specs' && (
            <div className="flex flex-col gap-4 h-full">
              {/* Top Row: Order Info (Left) and Invoice Info (Right) */}
              <div className="flex gap-4">
                {/* Left: Order Info Panel - Narrower */}
                <div className="flex-shrink-0 bg-white rounded-lg shadow p-4 flex gap-6" style={{ width: '1123px', minHeight: '240px', maxHeight: '250px' }}>
                {/* Left: Order Image - 32% of panel width */}
                <div style={{ width: '32%' }}>
                  <OrderImage
                    orderNumber={order.order_number}
                    signImagePath={order.sign_image_path}
                    cropTop={order.crop_top}
                    cropRight={order.crop_right}
                    cropBottom={order.crop_bottom}
                    cropLeft={order.crop_left}
                    folderName={order.folder_name}
                    folderLocation={order.folder_location}
                    isMigrated={order.is_migrated}
                    onImageUpdated={() => fetchOrder(order.order_number)}
                  />
                </div>

                {/* Right: Order Details - 68% of panel width */}
                <div className="flex flex-col gap-4" style={{ width: '68%' }}>
                  {/* Row 1: Order Date, Customer PO, Customer Job #, Shipping Method */}
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <span className="text-gray-500 text-sm">Order Date:</span>
                      <p className="font-medium text-gray-900 text-base">
                        {formatDateString(order.order_date)}
                      </p>
                    </div>

                    {/* Customer PO - Editable */}
                    <div className="flex-1">
                      <span className="text-gray-500 text-sm">Customer PO:</span>
                      <EditableField
                        field="customer_po"
                        value={order.customer_po}
                        type="text"
                        isEditing={editingField === 'customer_po'}
                        isSaving={saving}
                        onEdit={startEdit}
                        onSave={saveEdit}
                        onCancel={cancelEdit}
                        editValue={editValue}
                        onEditValueChange={setEditValue}
                      />
                    </div>

                    {/* Customer Job # - Editable */}
                    <div className="flex-1">
                      <span className="text-gray-500 text-sm">Customer Job #:</span>
                      <EditableField
                        field="customer_job_number"
                        value={order.customer_job_number}
                        type="text"
                        isEditing={editingField === 'customer_job_number'}
                        isSaving={saving}
                        onEdit={startEdit}
                        onSave={saveEdit}
                        onCancel={cancelEdit}
                        editValue={editValue}
                        onEditValueChange={setEditValue}
                      />
                    </div>

                    {/* Shipping Method - Dropdown (uses shipping_required boolean) */}
                    <div className="flex-1">
                      <span className="text-gray-500 text-sm">Shipping Method:</span>
                      <EditableField
                        field="shipping_required"
                        value={order.shipping_required}
                        type="select"
                        options={[
                          { value: 'true', label: 'Shipping' },
                          { value: 'false', label: 'Pick Up' }
                        ]}
                        isEditing={editingField === 'shipping_required'}
                        isSaving={saving}
                        onEdit={startEdit}
                        onSave={saveEdit}
                        onCancel={cancelEdit}
                        editValue={editValue}
                        onEditValueChange={setEditValue}
                        displayFormatter={(val) => val ? 'Shipping' : 'Pick Up'}
                      />
                    </div>
                  </div>

                  {/* Row 2: Due Date, Hard Due Time, Turnaround Time, Due In */}
                  <div className="flex gap-4 items-end">
                    {/* Due Date - Editable */}
                    <div className="flex-1">
                      <span className="text-gray-500 text-sm">Due Date:</span>
                      <EditableField
                        field="due_date"
                        value={order.due_date}
                        type="date"
                        isEditing={editingField === 'due_date'}
                        isSaving={saving}
                        onEdit={startEdit}
                        onSave={saveEdit}
                        onCancel={cancelEdit}
                        editValue={editValue}
                        onEditValueChange={setEditValue}
                        displayFormatter={formatDateString}
                      />
                    </div>

                    {/* Hard Due Time - Editable */}
                    <div className="flex-1">
                      <span className="text-gray-500 text-sm">Hard Due Time:</span>
                      <EditableField
                        field="hard_due_date_time"
                        value={order.hard_due_date_time}
                        type="time"
                        isEditing={editingField === 'hard_due_date_time'}
                        isSaving={saving}
                        onEdit={startEdit}
                        onSave={saveEdit}
                        onCancel={cancelEdit}
                        editValue={editValue}
                        onEditValueChange={setEditValue}
                        displayFormatter={formatTimeTo12Hour}
                      />
                    </div>

                    {/* Turnaround Time */}
                    <div className="flex-1">
                      <span className="text-gray-500 text-sm">Turnaround Time:</span>
                      <p className="font-medium text-gray-900 text-base h-6 flex items-center">
                        {turnaroundDays !== null ? `${turnaroundDays} days` : 'Calculating...'}
                      </p>
                    </div>

                    {/* Due In */}
                    <div className="flex-1">
                      <span className="text-gray-500 text-sm">Due in:</span>
                      <p className="font-medium text-gray-900 text-base h-6 flex items-center">
                        {daysUntilDue !== null ? `${daysUntilDue} days` : 'Calculating...'}
                      </p>
                    </div>
                  </div>

                  {/* Row 3: Special Instructions & Internal Notes - Side by Side */}
                  <div className="mt-2 flex gap-4">
                    {/* Special Instructions */}
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-gray-700 mb-1">Special Instructions</h3>
                      <div className="relative" style={{ height: '60px' }}>
                        {editingField === 'manufacturing_note' ? (
                          <div className="h-full">
                            <textarea
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Escape') cancelEdit();
                              }}
                              className="w-full text-sm text-gray-900 border border-indigo-300 rounded p-2 pr-28 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none box-border"
                              style={{ height: '60px' }}
                              autoFocus
                            />
                            <div className="absolute top-1 right-6 flex flex-col space-y-1">
                              <button
                                onClick={() => saveEdit('manufacturing_note')}
                                disabled={saving}
                                className="px-2 py-0.5 bg-green-600 text-white rounded text-xs hover:bg-green-700 disabled:opacity-50"
                              >
                                {saving ? 'Saving...' : 'Save'}
                              </button>
                              <button
                                onClick={cancelEdit}
                                className="px-2 py-0.5 bg-gray-200 text-gray-700 rounded text-xs hover:bg-gray-300"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="group h-full">
                            <p className="text-base text-gray-600 whitespace-pre-wrap h-full overflow-y-auto border border-gray-300 rounded px-2 py-1">
                              {order.manufacturing_note || '-'}
                            </p>
                            <button
                              onClick={() => startEdit('manufacturing_note', order.manufacturing_note || '')}
                              className="absolute top-1 right-5 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-indigo-600 transition-opacity"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Internal Notes */}
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-gray-700 mb-1">Internal Notes</h3>
                      <div className="relative" style={{ height: '60px' }}>
                        {editingField === 'internal_note' ? (
                          <div className="h-full">
                            <textarea
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Escape') cancelEdit();
                              }}
                              className="w-full text-sm text-gray-900 border border-indigo-300 rounded p-2 pr-28 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none box-border"
                              style={{ height: '60px' }}
                              autoFocus
                            />
                            <div className="absolute top-1 right-6 flex flex-col space-y-1">
                              <button
                                onClick={() => saveEdit('internal_note')}
                                disabled={saving}
                                className="px-2 py-0.5 bg-green-600 text-white rounded text-xs hover:bg-green-700 disabled:opacity-50"
                              >
                                {saving ? 'Saving...' : 'Save'}
                              </button>
                              <button
                                onClick={cancelEdit}
                                className="px-2 py-0.5 bg-gray-200 text-gray-700 rounded text-xs hover:bg-gray-300"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="group h-full">
                            <p className="text-base text-gray-600 whitespace-pre-wrap h-full overflow-y-auto border border-gray-300 rounded px-2 py-1">
                              {order.internal_note || '-'}
                            </p>
                            <button
                              onClick={() => startEdit('internal_note', order.internal_note || '')}
                              className="absolute top-1 right-5 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-indigo-600 transition-opacity"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
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
                          {order.point_persons && order.point_persons.length > 0 ? (
                            order.point_persons.map((person, index) => (
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
                          value={order.invoice_email}
                          type="email"
                          isEditing={editingField === 'invoice_email'}
                          isSaving={saving}
                          onEdit={startEdit}
                          onSave={saveEdit}
                          onCancel={cancelEdit}
                          editValue={editValue}
                          onEditValueChange={setEditValue}
                        />
                      </div>

                      {/* Terms - Editable (from Customer) */}
                      <div className="flex-1">
                        <span className="text-gray-500 text-sm">Terms:</span>
                        <EditableField
                          field="terms"
                          value={order.terms}
                          type="text"
                          isEditing={editingField === 'terms'}
                          isSaving={saving}
                          onEdit={startEdit}
                          onSave={saveEdit}
                          onCancel={cancelEdit}
                          editValue={editValue}
                          onEditValueChange={setEditValue}
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
                          value={order.deposit_required}
                          type="checkbox"
                          isEditing={false}
                          isSaving={saving}
                          onEdit={(field, value) => {
                            setEditingField(field);
                            saveEdit(field, value);
                          }}
                          onSave={saveEdit}
                          onCancel={cancelEdit}
                          editValue={editValue}
                          onEditValueChange={setEditValue}
                        />
                      </div>

                      {/* Cash Customer - Checkbox (from Customer) */}
                      <div className="flex-1">
                        <span className="text-gray-500 text-sm">Cash Customer:</span>
                        <EditableField
                          field="cash"
                          value={order.cash}
                          type="checkbox"
                          isEditing={false}
                          isSaving={saving}
                          onEdit={(field, value) => {
                            setEditingField(field);
                            saveEdit(field, value);
                          }}
                          onSave={saveEdit}
                          onCancel={cancelEdit}
                          editValue={editValue}
                          onEditValueChange={setEditValue}
                        />
                      </div>

                      {/* Discount - Display Only (from Customer) */}
                      <div className="flex-1">
                        <span className="text-gray-500 text-sm">Discount:</span>
                        <div className="flex items-center h-6">
                          <p className="font-medium text-gray-900 text-base">
                            {customerDiscount && parseFloat(String(customerDiscount)) > 0
                              ? `${parseFloat(String(customerDiscount))}%`
                              : '-'}
                          </p>
                        </div>
                      </div>

                      {/* Tax - Editable Dropdown (from billing address) */}
                      <div className="flex-1">
                        <span className="text-gray-500 text-sm">Tax:</span>
                        {editingField === 'tax_name' ? (
                          <div className="flex items-center space-x-1 h-6">
                            <select
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => handleKeyDown(e, 'tax_name')}
                              className="font-medium text-gray-900 border border-indigo-300 rounded px-1 text-base w-full h-full"
                              autoFocus
                            >
                              {taxRules.map((rule) => (
                                <option key={rule.tax_rule_id} value={rule.tax_name}>
                                  {rule.tax_name} ({(rule.tax_percent * 100).toFixed(1)}%)
                                </option>
                              ))}
                            </select>
                            <button onClick={() => saveEdit('tax_name')} disabled={saving} className="text-green-600 hover:text-green-700 flex-shrink-0">
                              <Check className="w-4 h-4" />
                            </button>
                            <button onClick={cancelEdit} className="text-gray-500 hover:text-gray-700 flex-shrink-0">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-2 group h-6">
                            <p className="font-medium text-gray-900 text-base">
                              {order.tax_name ? (
                                <>
                                  {order.tax_name} ({((taxRules.find(r => r.tax_name === order.tax_name)?.tax_percent || 0) * 100).toFixed(1)}%)
                                </>
                              ) : '-'}
                            </p>
                            <button
                              onClick={() => startEdit('tax_name', order.tax_name || '')}
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
                      <div className="relative" style={{ height: '60px' }}>
                        {editingField === 'invoice_notes' ? (
                          <div className="h-full">
                            <textarea
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Escape') cancelEdit();
                              }}
                              className="w-full text-sm text-gray-900 border border-indigo-300 rounded p-2 pr-28 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none box-border"
                              style={{ height: '60px' }}
                              autoFocus
                            />
                            <div className="absolute top-1 right-6 flex flex-col space-y-1">
                              <button
                                onClick={() => saveEdit('invoice_notes')}
                                disabled={saving}
                                className="px-2 py-0.5 bg-green-600 text-white rounded text-xs hover:bg-green-700 disabled:opacity-50"
                              >
                                {saving ? 'Saving...' : 'Save'}
                              </button>
                              <button
                                onClick={cancelEdit}
                                className="px-2 py-0.5 bg-gray-200 text-gray-700 rounded text-xs hover:bg-gray-300"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="group h-full">
                            <p className="text-base text-gray-600 whitespace-pre-wrap h-full overflow-y-auto border border-gray-300 rounded px-2 py-1">
                              {order.invoice_notes || '-'}
                            </p>
                            <button
                              onClick={() => startEdit('invoice_notes', order.invoice_notes || '')}
                              className="absolute top-1 right-5 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-indigo-600 transition-opacity"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Row: Job Details & Invoice (Dual-Table) - Full Width */}
              <div className="flex-shrink-0" style={{ width: '1888px' }}>
                <DualTableLayout
                  orderNumber={order.order_number}
                  initialParts={parts}
                  taxName={order.tax_name}
                />
              </div>
            </div>
          )}

          {/* TAB 2: Job Progress - 2/3 Width Centered */}
          {activeTab === 'progress' && (
            <div className="flex justify-center h-full">
              <div className="w-full max-w-[1280px]">
                <ProgressView
                  orderNumber={order.order_number}
                  currentStatus={order.status}
                  productionNotes={order.production_notes}
                  onOrderUpdated={() => fetchOrder(order.order_number)}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Print Modal */}
      {showPrintModal && (
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
                    onClick={() => setPrintQuantities(prev => ({ ...prev, master: Math.max(0, prev.master - 1) }))}
                    className="p-1 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-12 text-center text-lg font-semibold text-gray-900">{printQuantities.master}</span>
                  <button
                    onClick={() => setPrintQuantities(prev => ({ ...prev, master: prev.master + 1 }))}
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
                    onClick={() => setPrintQuantities(prev => ({ ...prev, estimate: Math.max(0, prev.estimate - 1) }))}
                    className="p-1 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-12 text-center text-lg font-semibold text-gray-900">{printQuantities.estimate}</span>
                  <button
                    onClick={() => setPrintQuantities(prev => ({ ...prev, estimate: prev.estimate + 1 }))}
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
                    onClick={() => setPrintQuantities(prev => ({ ...prev, shop: Math.max(0, prev.shop - 1) }))}
                    className="p-1 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-12 text-center text-lg font-semibold text-gray-900">{printQuantities.shop}</span>
                  <button
                    onClick={() => setPrintQuantities(prev => ({ ...prev, shop: prev.shop + 1 }))}
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
                    onClick={() => setPrintQuantities(prev => ({ ...prev, packing: Math.max(0, prev.packing - 1) }))}
                    className="p-1 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-12 text-center text-lg font-semibold text-gray-900">{printQuantities.packing}</span>
                  <button
                    onClick={() => setPrintQuantities(prev => ({ ...prev, packing: prev.packing + 1 }))}
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
                onClick={() => setShowPrintModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handlePrintForms}
                disabled={printingForm}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                <Printer className="w-4 h-4" />
                <span>{printingForm ? 'Printing...' : 'Print'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderDetailsPage;
