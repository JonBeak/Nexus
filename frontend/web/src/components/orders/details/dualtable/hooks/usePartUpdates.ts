/**
 * usePartUpdates Hook
 * Extracted from DualTableLayout.tsx (Phase 3)
 *
 * Manages all part update operations:
 * - Field save handlers (invoice_description, qb_description, quantity, unit_price, part_scope)
 * - Template selection (with automatic spec data clearing)
 * - Specification field saves
 * - Row add/remove operations
 * - Parent/sub item toggle
 * - Parts refresh after external updates
 */

import { useCallback, useState, Dispatch, SetStateAction, MutableRefObject } from 'react';
import { ordersApi, orderPartsApi } from '@/services/api';
import { OrderPart } from '@/types/orders';

interface UsePartUpdatesParams {
  orderNumber: number;
  parts: OrderPart[];
  setParts: Dispatch<SetStateAction<OrderPart[]>>;
  partsRef: MutableRefObject<OrderPart[]>;
  specRowCounts: Record<number, number>;
  setSpecRowCounts: Dispatch<SetStateAction<Record<number, number>>>;
}

export const usePartUpdates = ({
  orderNumber,
  parts,
  setParts,
  partsRef,
  specRowCounts,
  setSpecRowCounts
}: UsePartUpdatesParams) => {
  const [saving, setSaving] = useState(false);

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
        // Convert empty string OR 0 to null
        const parsed = value === '' ? null : parseFloat(value);
        const numericValue = parsed === 0 ? null : parsed;
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
      } else if (field === 'part_scope') {
        updatedPart.part_scope = value;
      }

      // Save to API
      await ordersApi.updateOrderParts(orderNumber, [{
        part_id: updatedPart.part_id,
        qb_item_name: updatedPart.qb_item_name,
        part_scope: updatedPart.part_scope,
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
  }, [orderNumber, partsRef, setParts]);

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
        part_scope: updatedPart.part_scope,
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
  }, [orderNumber, partsRef, setParts]);

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
        part_scope: updatedPart.part_scope,
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
  }, [orderNumber, partsRef, setParts]);

  // Add specification row
  const addSpecRow = useCallback(async (partId: number) => {
    // Get the actual part to calculate template count
    const part = parts.find(p => p.part_id === partId);
    if (!part) return;

    // Calculate actual template count (same logic as rendering)
    const templateCount = part.specifications
      ? Object.keys(part.specifications).filter(key => key.startsWith('_template_')).length
      : 0;

    // Get current count from actual data (same fallback chain as rendering)
    const currentCount = specRowCounts[partId] ?? (templateCount || 1);
    const newCount = Math.min(currentCount + 1, 20); // Max 20 rows

    setSpecRowCounts(prev => ({
      ...prev,
      [partId]: newCount
    }));

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
        part_scope: updatedPart.part_scope,
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
  }, [orderNumber, parts, specRowCounts, setParts, setSpecRowCounts]);

  // Remove specification row
  const removeSpecRow = useCallback(async (partId: number) => {
    // Get the actual part to calculate template count
    const part = parts.find(p => p.part_id === partId);
    if (!part) return;

    // Calculate actual template count (same logic as rendering)
    const templateCount = part.specifications
      ? Object.keys(part.specifications).filter(key => key.startsWith('_template_')).length
      : 0;

    // Get current count from actual data (same fallback chain as rendering)
    const currentCount = specRowCounts[partId] ?? (templateCount || 1);
    const newCount = Math.max(currentCount - 1, 1); // Min 1 row

    setSpecRowCounts(prev => ({
      ...prev,
      [partId]: newCount
    }));

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
        part_scope: updatedPart.part_scope,
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
  }, [orderNumber, parts, specRowCounts, setParts, setSpecRowCounts]);

  // Toggle is_parent status
  const toggleIsParent = useCallback(async (partId: number) => {
    const part = parts.find(p => p.part_id === partId);
    if (!part) return;

    const newIsParent = !part.is_parent;

    // Validation: Cannot set as parent if no Item Name (specs_display_name) is selected
    if (newIsParent && !part.specs_display_name) {
      alert('Cannot promote to Base Item: Please select an Item Name first.');
      return;
    }

    try {
      setSaving(true);

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
  }, [orderNumber, parts, setParts]);

  // Refresh parts data after external updates
  const handleRefreshParts = useCallback(async () => {
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
  }, [orderNumber, setParts, partsRef, specRowCounts, setSpecRowCounts]);

  // Add a new part row to the order
  const addPartRow = useCallback(async () => {
    try {
      setSaving(true);
      await orderPartsApi.addPartRow(orderNumber);

      // Refresh parts to get the new part
      await handleRefreshParts();
    } catch (error) {
      console.error('Error adding part row:', error);
      alert('Failed to add part row. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [orderNumber, handleRefreshParts]);

  // Remove a part row from the order
  const removePartRow = useCallback(async (partId: number) => {
    const part = parts.find(p => p.part_id === partId);
    if (!part) return;

    // Confirm deletion
    if (!confirm('Are you sure you want to remove this part row? This action cannot be undone.')) {
      return;
    }

    try {
      setSaving(true);
      await orderPartsApi.removePartRow(orderNumber, partId);

      // Refresh parts to show updated list
      await handleRefreshParts();
    } catch (error) {
      console.error('Error removing part row:', error);
      alert('Failed to remove part row. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [orderNumber, parts, handleRefreshParts]);

  // Reorder parts in bulk (for drag-and-drop)
  const reorderParts = useCallback(async (partIds: number[]) => {
    try {
      setSaving(true);
      await orderPartsApi.reorderParts(orderNumber, partIds);

      // Refresh parts to get updated order and display numbers
      await handleRefreshParts();
    } catch (error) {
      console.error('Error reordering parts:', error);
      alert('Failed to reorder parts. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [orderNumber, handleRefreshParts]);

  return {
    saving,
    handleFieldSave,
    handleTemplateSave,
    handleSpecFieldSave,
    addSpecRow,
    removeSpecRow,
    toggleIsParent,
    addPartRow,
    removePartRow,
    reorderParts,
    handleRefreshParts
  };
};
