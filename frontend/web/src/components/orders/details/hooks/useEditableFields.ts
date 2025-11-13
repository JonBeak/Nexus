import { useState, useRef } from 'react';
import { ordersApi } from '../../../../services/api';
import { Order } from '../../../../types/orders';
import { orderFieldConfigs } from '../constants/orderFieldConfigs';

interface EditState {
  editingField: string | null;
  editValue: string;
}

interface OrderData {
  order: Order | null;
  parts: any[];
  taxRules: any[];
  customerDiscount: number;
}

export function useEditableFields(
  orderData: OrderData,
  setOrderData: (updater: (prev: OrderData) => OrderData) => void,
  uiState: any,
  setUiState: (updater: (prev: any) => any) => void,
  setCalculatedValues: (updater: (prev: any) => any) => void,
  scrollContainerRef: React.RefObject<HTMLDivElement>
) {
  // Edit State
  const [editState, setEditState] = useState<EditState>({
    editingField: null,
    editValue: ''
  });

  // Persistent scroll preservation during async save operations
  const savedScrollPosition = useRef<number | null>(null);
  const isSavingRef = useRef<boolean>(false);

  const startEdit = (field: string, currentValue: string) => {
    const fieldConfig = orderFieldConfigs[field as keyof typeof orderFieldConfigs];

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
      setUiState((prev: any) => ({ ...prev, saving: true }));

      // Use override value if provided, otherwise use editValue from state
      const rawValue = overrideValue !== undefined ? overrideValue : editState.editValue;

      // Get field configuration for value transformation
      const fieldConfig = orderFieldConfigs[field as keyof typeof orderFieldConfigs];

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
          setCalculatedValues((prev: any) => ({ ...prev, turnaroundDays: turnaroundResult.businessDays }));

          const today = new Date().toISOString().split('T')[0];
          const daysUntilResult = await ordersApi.calculateBusinessDays(
            today,
            rawValue
          );
          setCalculatedValues((prev: any) => ({ ...prev, daysUntilDue: daysUntilResult.businessDays }));
        } catch (err) {
          console.error('Error recalculating days:', err);
        }
      }
    } catch (err) {
      console.error('Error updating order:', err);
      alert('Failed to update order. Please try again.');
    } finally {
      setUiState((prev: any) => ({ ...prev, saving: false }));

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

  // Return refs for scroll preservation
  const getScrollPreservationRefs = () => ({
    savedScrollPosition,
    isSavingRef
  });

  return {
    editState,
    setEditState,
    startEdit,
    cancelEdit,
    saveEdit,
    handleKeyDown,
    isEditing: editState.editingField !== null,
    getScrollPreservationRefs
  };
}