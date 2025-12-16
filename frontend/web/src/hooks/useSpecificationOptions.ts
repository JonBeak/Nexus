/**
 * useSpecificationOptions Hook
 * State management for specification options with loading/error states and CRUD operations
 */

import { useState, useEffect, useCallback } from 'react';
import { settingsApi, SpecificationCategory, SpecificationOption } from '../services/api/settings';

export const useSpecificationOptions = () => {
  // State
  const [categories, setCategories] = useState<SpecificationCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [options, setOptions] = useState<SpecificationOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // -------------------------------------------------------------------------
  // Load Categories
  // -------------------------------------------------------------------------
  const loadCategories = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await settingsApi.getSpecificationCategories();
      setCategories(data);
      // Auto-select first category if none selected
      if (data.length > 0 && !selectedCategory) {
        setSelectedCategory(data[0].category);
      }
    } catch (err) {
      console.error('Failed to load categories:', err);
      setError('Failed to load specification categories');
    } finally {
      setLoading(false);
    }
  }, [selectedCategory]);

  // -------------------------------------------------------------------------
  // Load Options for Selected Category
  // -------------------------------------------------------------------------
  const loadOptions = useCallback(async () => {
    if (!selectedCategory) {
      setOptions([]);
      return;
    }

    setLoadingOptions(true);
    setError(null);
    try {
      const data = await settingsApi.getOptionsByCategory(selectedCategory);
      setOptions(data);
    } catch (err) {
      console.error('Failed to load options:', err);
      setError('Failed to load options for this category');
    } finally {
      setLoadingOptions(false);
    }
  }, [selectedCategory]);

  // Load categories on mount
  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  // Load options when category changes
  useEffect(() => {
    loadOptions();
  }, [loadOptions]);

  // -------------------------------------------------------------------------
  // Add Option
  // -------------------------------------------------------------------------
  const addOption = useCallback(async (value: string): Promise<boolean> => {
    if (!selectedCategory || !value.trim()) return false;

    setSaving(true);
    setError(null);
    try {
      await settingsApi.createOption(selectedCategory, value.trim());
      await loadOptions(); // Refresh the list
      // Update category count
      setCategories(prev => prev.map(cat =>
        cat.category === selectedCategory
          ? { ...cat, count: cat.count + 1 }
          : cat
      ));
      return true;
    } catch (err) {
      console.error('Failed to add option:', err);
      setError('Failed to add option');
      return false;
    } finally {
      setSaving(false);
    }
  }, [selectedCategory, loadOptions]);

  // -------------------------------------------------------------------------
  // Update Option
  // -------------------------------------------------------------------------
  const updateOption = useCallback(async (
    optionId: number,
    updates: { option_value?: string }
  ): Promise<boolean> => {
    if (!selectedCategory) return false;

    setSaving(true);
    setError(null);
    try {
      await settingsApi.updateOption(selectedCategory, optionId, updates);
      // Optimistic update
      setOptions(prev => prev.map(opt =>
        opt.option_id === optionId
          ? { ...opt, ...updates }
          : opt
      ));
      return true;
    } catch (err) {
      console.error('Failed to update option:', err);
      setError('Failed to update option');
      await loadOptions(); // Rollback by reloading
      return false;
    } finally {
      setSaving(false);
    }
  }, [selectedCategory, loadOptions]);

  // -------------------------------------------------------------------------
  // Deactivate Option
  // -------------------------------------------------------------------------
  const deactivateOption = useCallback(async (optionId: number): Promise<boolean> => {
    if (!selectedCategory) return false;

    setSaving(true);
    setError(null);
    try {
      await settingsApi.deactivateOption(selectedCategory, optionId);
      // Remove from list
      setOptions(prev => prev.filter(opt => opt.option_id !== optionId));
      // Update category count
      setCategories(prev => prev.map(cat =>
        cat.category === selectedCategory
          ? { ...cat, count: Math.max(0, cat.count - 1) }
          : cat
      ));
      return true;
    } catch (err) {
      console.error('Failed to deactivate option:', err);
      setError('Failed to deactivate option');
      return false;
    } finally {
      setSaving(false);
    }
  }, [selectedCategory]);

  // -------------------------------------------------------------------------
  // Reorder Options
  // -------------------------------------------------------------------------
  const reorderOptions = useCallback(async (
    newOrder: SpecificationOption[]
  ): Promise<boolean> => {
    if (!selectedCategory) return false;

    // Optimistic update
    const previousOptions = [...options];
    setOptions(newOrder);

    setSaving(true);
    setError(null);
    try {
      const orders = newOrder.map((opt, idx) => ({
        option_id: opt.option_id,
        display_order: idx + 1
      }));
      await settingsApi.reorderOptions(selectedCategory, orders);
      return true;
    } catch (err) {
      console.error('Failed to reorder options:', err);
      setError('Failed to save new order');
      // Rollback
      setOptions(previousOptions);
      return false;
    } finally {
      setSaving(false);
    }
  }, [selectedCategory, options]);

  // -------------------------------------------------------------------------
  // Refresh
  // -------------------------------------------------------------------------
  const refreshOptions = useCallback(() => {
    return loadOptions();
  }, [loadOptions]);

  const refreshCategories = useCallback(() => {
    return loadCategories();
  }, [loadCategories]);

  // -------------------------------------------------------------------------
  // Return
  // -------------------------------------------------------------------------
  return {
    // State
    categories,
    selectedCategory,
    setSelectedCategory,
    options,
    loading,
    loadingOptions,
    saving,
    error,

    // Actions
    addOption,
    updateOption,
    deactivateOption,
    reorderOptions,
    refreshOptions,
    refreshCategories
  };
};
