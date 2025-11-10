import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { flushSync } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, FileText, Pencil, Check, X } from 'lucide-react';
import { Order, OrderPart } from '../../../types/orders';
import { ordersApi, provincesApi, customerApi, ledsApi, powerSuppliesApi, materialsApi } from '../../../services/api';
import ProgressView from '../progress/ProgressView';
import StatusBadge from '../common/StatusBadge';
import DualTableLayout from './DualTableLayout';
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

  // Turnaround days calculation
  const [turnaroundDays, setTurnaroundDays] = useState<number | null>(null);
  const [daysUntilDue, setDaysUntilDue] = useState<number | null>(null);

  // Ref for scroll container
  const scrollContainerRef = useRef<HTMLDivElement>(null);

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
        console.log('[OrderDetailsPage] Using cached template data - no API calls needed');
        // Use cached data
        setLeds(getCachedLEDs());
        setPowerSupplies(getCachedPowerSupplies());
        setMaterials(getCachedMaterials());
        setSpecsDataLoaded(true);
        return;
      }

      console.log('[OrderDetailsPage] Fetching template data from API (first load)');
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
      console.log('[Scroll Restore] useLayoutEffect - Restoring scroll to:', savedScrollPosition.current);
      scrollContainerRef.current.scrollTop = savedScrollPosition.current;

      // Also schedule restoration after paint to catch any late renders
      requestAnimationFrame(() => {
        if (isSavingRef.current && savedScrollPosition.current !== null && scrollContainerRef.current) {
          console.log('[Scroll Restore] RAF - Restoring scroll to:', savedScrollPosition.current);
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

  const handleBack = () => {
    navigate('/orders');
  };

  const startEdit = (field: string, currentValue: string) => {
    setEditingField(field);
    setEditValue(currentValue || '');
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
    console.log('[Scroll Save] Captured scroll position:', savedScrollPosition.current);
    console.log('[Scroll Save] Scroll container element:', scrollContainerRef.current);
    console.log('[Scroll Save] Current scrollHeight:', scrollContainerRef.current?.scrollHeight);
    console.log('[Scroll Save] Current clientHeight:', scrollContainerRef.current?.clientHeight);

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
        console.log('[Scroll Save] Clearing scroll preservation');
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

    // time format is "HH:mm" (24-hour)
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
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'specs'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Specs & Invoice
            </button>
            <button
              onClick={() => setActiveTab('progress')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'progress'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Job Progress
            </button>
          </div>

          {/* Right: Quick Actions */}
          <div className="flex items-center space-x-3 flex-1 justify-end">
            <button className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium text-gray-700">
              <FileText className="w-4 h-4" />
              <span>View Forms</span>
            </button>
            <button className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium">
              <Download className="w-4 h-4" />
              <span>Download</span>
            </button>
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
                <div className="flex-[3] bg-white rounded-lg shadow p-4 flex gap-6" style={{ minHeight: '200px', maxHeight: '220px' }}>
                {/* Left: Placeholder Image - 32% of panel width */}
                <div className="bg-gray-200 rounded-lg flex items-center justify-center" style={{ width: '32%' }}>
                  <div className="text-center">
                    <div className="text-gray-400 text-sm font-medium">Order Image</div>
                    <div className="text-gray-400 text-xs mt-1">Placeholder</div>
                  </div>
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
                      {editingField === 'customer_po' ? (
                        <div className="flex items-center space-x-1 h-6">
                          <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, 'customer_po')}
                            className="font-medium text-gray-900 border border-indigo-300 rounded px-1 text-base w-full h-full"
                            autoFocus
                          />
                          <button onClick={() => saveEdit('customer_po')} disabled={saving} className="text-green-600 hover:text-green-700 flex-shrink-0">
                            <Check className="w-4 h-4" />
                          </button>
                          <button onClick={cancelEdit} className="text-gray-500 hover:text-gray-700 flex-shrink-0">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-2 group h-6">
                          <p className="font-medium text-gray-900 text-base">
                            {order.customer_po || '-'}
                          </p>
                          <button
                            onClick={() => startEdit('customer_po', order.customer_po || '')}
                            className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-indigo-600"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Customer Job # - Editable */}
                    <div className="flex-1">
                      <span className="text-gray-500 text-sm">Customer Job #:</span>
                      {editingField === 'customer_job_number' ? (
                        <div className="flex items-center space-x-1 h-6">
                          <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, 'customer_job_number')}
                            className="font-medium text-gray-900 border border-indigo-300 rounded px-1 text-base w-full h-full"
                            autoFocus
                          />
                          <button onClick={() => saveEdit('customer_job_number')} disabled={saving} className="text-green-600 hover:text-green-700 flex-shrink-0">
                            <Check className="w-4 h-4" />
                          </button>
                          <button onClick={cancelEdit} className="text-gray-500 hover:text-gray-700 flex-shrink-0">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-2 group h-6">
                          <p className="font-medium text-gray-900 text-base">
                            {order.customer_job_number || '-'}
                          </p>
                          <button
                            onClick={() => startEdit('customer_job_number', order.customer_job_number || '')}
                            className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-indigo-600"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Shipping Method - Dropdown (uses shipping_required boolean) */}
                    <div className="flex-1">
                      <span className="text-gray-500 text-sm">Shipping Method:</span>
                      {editingField === 'shipping_required' ? (
                        <div className="flex items-center space-x-1 h-6">
                          <select
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, 'shipping_required')}
                            className="font-medium text-gray-900 border border-indigo-300 rounded px-1 text-base w-full h-full"
                            autoFocus
                          >
                            <option value="true">Shipping</option>
                            <option value="false">Pick Up</option>
                          </select>
                          <button onClick={() => saveEdit('shipping_required')} disabled={saving} className="text-green-600 hover:text-green-700 flex-shrink-0">
                            <Check className="w-4 h-4" />
                          </button>
                          <button onClick={cancelEdit} className="text-gray-500 hover:text-gray-700 flex-shrink-0">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-2 group h-6">
                          <p className="font-medium text-gray-900 text-base">
                            {order.shipping_required ? 'Shipping' : 'Pick Up'}
                          </p>
                          <button
                            onClick={() => startEdit('shipping_required', String(order.shipping_required))}
                            className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-indigo-600"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Row 2: Due Date, Hard Due Time, Turnaround Time, Due In */}
                  <div className="flex gap-4 items-end">
                    {/* Due Date - Editable */}
                    <div className="flex-1">
                      <span className="text-gray-500 text-sm">Due Date:</span>
                      {editingField === 'due_date' ? (
                        <div className="flex items-center space-x-1 h-6">
                          <input
                            type="date"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, 'due_date')}
                            className="font-medium text-gray-900 border border-indigo-300 rounded px-1 text-base h-full"
                            autoFocus
                          />
                          <button onClick={() => saveEdit('due_date')} disabled={saving} className="text-green-600 hover:text-green-700 flex-shrink-0">
                            <Check className="w-4 h-4" />
                          </button>
                          <button onClick={cancelEdit} className="text-gray-500 hover:text-gray-700 flex-shrink-0">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-2 group h-6">
                          <p className="font-medium text-gray-900 text-base">
                            {formatDateString(order.due_date)}
                          </p>
                          <button
                            onClick={() => startEdit('due_date', order.due_date || '')}
                            className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-indigo-600"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Hard Due Time - Editable */}
                    <div className="flex-1">
                      <span className="text-gray-500 text-sm">Hard Due Time:</span>
                      {editingField === 'hard_due_date_time' ? (
                        <div className="flex items-center space-x-1 h-6">
                          <input
                            type="time"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, 'hard_due_date_time')}
                            className="font-medium text-gray-900 border border-indigo-300 rounded px-1 text-base w-full h-full"
                            autoFocus
                          />
                          <button onClick={() => saveEdit('hard_due_date_time')} disabled={saving} className="text-green-600 hover:text-green-700 flex-shrink-0">
                            <Check className="w-4 h-4" />
                          </button>
                          <button onClick={cancelEdit} className="text-gray-500 hover:text-gray-700 flex-shrink-0">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-2 group h-6">
                          <p className="font-medium text-gray-900 text-base">
                            {formatTimeTo12Hour(order.hard_due_date_time)}
                          </p>
                          <button
                            onClick={() => startEdit('hard_due_date_time', order.hard_due_date_time || '')}
                            className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-indigo-600"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
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
                            <div className="absolute top-2 right-2 flex items-center space-x-1">
                              <button
                                onClick={cancelEdit}
                                className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs hover:bg-gray-300"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => saveEdit('manufacturing_note')}
                                disabled={saving}
                                className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 disabled:opacity-50"
                              >
                                {saving ? 'Saving...' : 'Save'}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="group h-full">
                            <p className="text-base text-gray-600 whitespace-pre-wrap h-full overflow-y-auto">
                              {order.manufacturing_note || '-'}
                            </p>
                            <button
                              onClick={() => startEdit('manufacturing_note', order.manufacturing_note || '')}
                              className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-indigo-600 transition-opacity"
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
                            <div className="absolute top-2 right-2 flex items-center space-x-1">
                              <button
                                onClick={cancelEdit}
                                className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs hover:bg-gray-300"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => saveEdit('internal_note')}
                                disabled={saving}
                                className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 disabled:opacity-50"
                              >
                                {saving ? 'Saving...' : 'Save'}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="group h-full">
                            <p className="text-base text-gray-600 whitespace-pre-wrap h-full overflow-y-auto">
                              {order.internal_note || '-'}
                            </p>
                            <button
                              onClick={() => startEdit('internal_note', order.internal_note || '')}
                              className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-indigo-600 transition-opacity"
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
                <div className="flex-[2] bg-white rounded-lg shadow p-4" style={{ minHeight: '200px', maxHeight: '220px' }}>
                  <div className="h-full flex flex-col justify-between">
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
                        {editingField === 'invoice_email' ? (
                          <div className="flex items-center space-x-1 h-6">
                            <input
                              type="email"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => handleKeyDown(e, 'invoice_email')}
                              className="font-medium text-gray-900 border border-indigo-300 rounded px-1 text-base w-full h-full"
                              autoFocus
                            />
                            <button onClick={() => saveEdit('invoice_email')} disabled={saving} className="text-green-600 hover:text-green-700 flex-shrink-0">
                              <Check className="w-4 h-4" />
                            </button>
                            <button onClick={cancelEdit} className="text-gray-500 hover:text-gray-700 flex-shrink-0">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-2 group h-6">
                            <p className="font-medium text-gray-900 text-base">
                              {order.invoice_email || '-'}
                            </p>
                            <button
                              onClick={() => startEdit('invoice_email', order.invoice_email || '')}
                              className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-indigo-600"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Terms - Editable (from Customer) */}
                      <div className="flex-1">
                        <span className="text-gray-500 text-sm">Terms:</span>
                        {editingField === 'terms' ? (
                          <div className="flex items-center space-x-1 h-6">
                            <input
                              type="text"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => handleKeyDown(e, 'terms')}
                              className="font-medium text-gray-900 border border-indigo-300 rounded px-1 text-base w-full h-full"
                              autoFocus
                            />
                            <button onClick={() => saveEdit('terms')} disabled={saving} className="text-green-600 hover:text-green-700 flex-shrink-0">
                              <Check className="w-4 h-4" />
                            </button>
                            <button onClick={cancelEdit} className="text-gray-500 hover:text-gray-700 flex-shrink-0">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-2 group h-6">
                            <p className="font-medium text-gray-900 text-base">
                              {order.terms || '-'}
                            </p>
                            <button
                              onClick={() => startEdit('terms', order.terms || '')}
                              className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-indigo-600"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Middle Section: Deposit Required, Cash, Discount, Tax */}
                    <div className="flex gap-4">

                      {/* Deposit Required - Checkbox (from Customer) */}
                      <div className="flex-1">
                        <span className="text-gray-500 text-sm">Deposit Required:</span>
                        <div className="flex items-center space-x-2 group h-6">
                          <input
                            type="checkbox"
                            checked={order.deposit_required || false}
                            onChange={(e) => {
                              const newValue = String(e.target.checked);
                              setEditingField('deposit_required');
                              saveEdit('deposit_required', newValue);
                            }}
                            className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                          />
                          <p className="font-medium text-gray-900 text-base">
                            {order.deposit_required ? 'Yes' : 'No'}
                          </p>
                        </div>
                      </div>

                      {/* Cash Customer - Checkbox (from Customer) */}
                      <div className="flex-1">
                        <span className="text-gray-500 text-sm">Cash Customer:</span>
                        <div className="flex items-center space-x-2 group h-6">
                          <input
                            type="checkbox"
                            checked={order.cash || false}
                            onChange={(e) => {
                              const newValue = String(e.target.checked);
                              setEditingField('cash');
                              saveEdit('cash', newValue);
                            }}
                            className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                          />
                          <p className="font-medium text-gray-900 text-base">
                            {order.cash ? 'Yes' : 'No'}
                          </p>
                        </div>
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
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-1">Invoice Notes</h3>
                      <div className="relative" style={{ height: '48px' }}>
                        {editingField === 'invoice_notes' ? (
                          <div className="h-full">
                            <textarea
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Escape') cancelEdit();
                              }}
                              className="w-full text-sm text-gray-900 border border-indigo-300 rounded p-2 pr-28 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none box-border"
                              style={{ height: '48px' }}
                              autoFocus
                            />
                            <div className="absolute top-2 right-2 flex items-center space-x-1">
                              <button
                                onClick={cancelEdit}
                                className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs hover:bg-gray-300"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => saveEdit('invoice_notes')}
                                disabled={saving}
                                className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 disabled:opacity-50"
                              >
                                {saving ? 'Saving...' : 'Save'}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="group h-full">
                            <p className="text-base text-gray-600 whitespace-pre-wrap h-full overflow-y-auto">
                              {order.invoice_notes || '-'}
                            </p>
                            <button
                              onClick={() => startEdit('invoice_notes', order.invoice_notes || '')}
                              className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-indigo-600 transition-opacity"
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
              <div className="w-full">
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
    </div>
  );
};

export default OrderDetailsPage;
