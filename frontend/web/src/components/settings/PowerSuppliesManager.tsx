/**
 * PowerSuppliesManager - Manage Power Supply types
 * CRUD operations for power supply types used in sign specifications
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, RefreshCw, AlertCircle, X, Star, Check } from 'lucide-react';
import { powerSuppliesApi, PowerSupplyType } from '../../services/api/powerSuppliesApi';
import { Notification } from '../inventory/Notification';
import { PricingDataResource } from '../../services/pricingDataResource';

// =============================================================================
// Edit Power Supply Modal
// =============================================================================

interface EditPowerSupplyModalProps {
  isOpen: boolean;
  onClose: () => void;
  powerSupply: PowerSupplyType | null;
  onSave: (powerSupplyId: number, updates: Partial<PowerSupplyType>) => Promise<boolean>;
  saving?: boolean;
}

const EditPowerSupplyModal: React.FC<EditPowerSupplyModalProps> = ({
  isOpen,
  onClose,
  powerSupply,
  onSave,
  saving = false
}) => {
  const [formData, setFormData] = useState({
    transformer_type: '',
    watts: '',
    rated_watts: '',
    volts: '',
    price: '',
    warranty_labour_years: '',
    warranty_product_years: '',
    notes: '',
    ul_listed: false,
    is_default_ul: false,
    is_default_non_ul: false
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (powerSupply) {
      setFormData({
        transformer_type: powerSupply.transformer_type || '',
        watts: powerSupply.watts?.toString() || '',
        rated_watts: powerSupply.rated_watts?.toString() || '',
        volts: powerSupply.volts?.toString() || '',
        price: powerSupply.price?.toString() || '',
        warranty_labour_years: powerSupply.warranty_labour_years?.toString() || '',
        warranty_product_years: powerSupply.warranty_product_years?.toString() || '',
        notes: powerSupply.notes || '',
        ul_listed: powerSupply.ul_listed || false,
        is_default_ul: powerSupply.is_default_ul || false,
        is_default_non_ul: powerSupply.is_default_non_ul || false
      });
      setError(null);
    }
  }, [powerSupply]);

  if (!isOpen || !powerSupply) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.transformer_type.trim()) {
      setError('Transformer type is required');
      return;
    }

    const updates: Partial<PowerSupplyType> = {
      transformer_type: formData.transformer_type.trim(),
      watts: formData.watts ? parseInt(formData.watts) : null,
      rated_watts: formData.rated_watts ? parseInt(formData.rated_watts) : null,
      volts: formData.volts ? parseInt(formData.volts) : null,
      price: formData.price ? parseFloat(formData.price) : null,
      warranty_labour_years: formData.warranty_labour_years ? parseInt(formData.warranty_labour_years) : null,
      warranty_product_years: formData.warranty_product_years ? parseInt(formData.warranty_product_years) : null,
      notes: formData.notes.trim() || null,
      ul_listed: formData.ul_listed,
      is_default_ul: formData.is_default_ul,
      is_default_non_ul: formData.is_default_non_ul
    };

    const success = await onSave(powerSupply.power_supply_id, updates);
    if (success) onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose} />
        <div className="relative bg-white rounded-lg shadow-xl w-full max-w-lg">
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Edit Power Supply</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="h-5 w-5" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Transformer Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Transformer Type *</label>
              <input
                type="text"
                value={formData.transformer_type}
                onChange={(e) => { setFormData(prev => ({ ...prev, transformer_type: e.target.value })); setError(null); }}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${error ? 'border-red-500' : 'border-gray-300'}`}
                disabled={saving}
                autoFocus
              />
              {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
            </div>

            {/* Two columns for specs */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Watts</label>
                <input
                  type="number"
                  value={formData.watts}
                  onChange={(e) => setFormData(prev => ({ ...prev, watts: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  disabled={saving}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rated Watts</label>
                <input
                  type="number"
                  value={formData.rated_watts}
                  onChange={(e) => setFormData(prev => ({ ...prev, rated_watts: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  disabled={saving}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Volts</label>
                <input
                  type="number"
                  value={formData.volts}
                  onChange={(e) => setFormData(prev => ({ ...prev, volts: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  disabled={saving}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Price</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  disabled={saving}
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Labour Warranty (yrs)</label>
                <input
                  type="number"
                  value={formData.warranty_labour_years}
                  onChange={(e) => setFormData(prev => ({ ...prev, warranty_labour_years: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  disabled={saving}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Product Warranty (yrs)</label>
                <input
                  type="number"
                  value={formData.warranty_product_years}
                  onChange={(e) => setFormData(prev => ({ ...prev, warranty_product_years: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  disabled={saving}
                />
              </div>
            </div>

            {/* Notes (full width) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                disabled={saving}
                rows={2}
              />
            </div>

            {/* Checkboxes */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="ul_listed"
                  checked={formData.ul_listed}
                  onChange={(e) => setFormData(prev => ({ ...prev, ul_listed: e.target.checked }))}
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  disabled={saving}
                />
                <label htmlFor="ul_listed" className="text-sm text-gray-700">UL Listed</label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_default_ul"
                  checked={formData.is_default_ul}
                  onChange={(e) => setFormData(prev => ({ ...prev, is_default_ul: e.target.checked }))}
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  disabled={saving}
                />
                <label htmlFor="is_default_ul" className="text-sm text-gray-700">Set as default for UL jobs</label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_default_non_ul"
                  checked={formData.is_default_non_ul}
                  onChange={(e) => setFormData(prev => ({ ...prev, is_default_non_ul: e.target.checked }))}
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  disabled={saving}
                />
                <label htmlFor="is_default_non_ul" className="text-sm text-gray-700">Set as default for non-UL jobs</label>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
              <button type="button" onClick={onClose} disabled={saving}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg">Cancel</button>
              <button type="submit" disabled={saving || !formData.transformer_type.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// Main PowerSuppliesManager Component
// =============================================================================

export const PowerSuppliesManager: React.FC = () => {
  const [powerSupplies, setPowerSupplies] = useState<PowerSupplyType[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingPowerSupply, setEditingPowerSupply] = useState<PowerSupplyType | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error'; show: boolean }>({
    message: '', type: 'success', show: false
  });

  // New power supply form state
  const [newPowerSupply, setNewPowerSupply] = useState({
    transformer_type: '',
    watts: '',
    rated_watts: '',
    volts: '',
    price: '',
    ul_listed: false
  });

  const showNotification = useCallback((message: string, type: 'success' | 'error') => {
    setNotification({ message, type, show: true });
    setTimeout(() => setNotification(prev => ({ ...prev, show: false })), 5000);
  }, []);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await powerSuppliesApi.getAllPowerSupplies(showInactive);
      setPowerSupplies(data);
    } catch (err) {
      console.error('Failed to load power supplies:', err);
      setError('Failed to load power supplies');
    } finally {
      setLoading(false);
    }
  }, [showInactive]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleAddPowerSupply = async () => {
    const trimmedType = newPowerSupply.transformer_type.trim();
    if (!trimmedType) return;

    setSaving(true);
    try {
      await powerSuppliesApi.createPowerSupply({
        transformer_type: trimmedType,
        watts: newPowerSupply.watts ? parseInt(newPowerSupply.watts) : undefined,
        rated_watts: newPowerSupply.rated_watts ? parseInt(newPowerSupply.rated_watts) : undefined,
        volts: newPowerSupply.volts ? parseInt(newPowerSupply.volts) : undefined,
        price: newPowerSupply.price ? parseFloat(newPowerSupply.price) : undefined,
        ul_listed: newPowerSupply.ul_listed
      });
      setNewPowerSupply({ transformer_type: '', watts: '', rated_watts: '', volts: '', price: '', ul_listed: false });
      PricingDataResource.clearCache();
      showNotification('Power supply added successfully', 'success');
      loadData();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to add power supply';
      showNotification(errorMsg, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdatePowerSupply = async (powerSupplyId: number, updates: Partial<PowerSupplyType>): Promise<boolean> => {
    setSaving(true);
    try {
      await powerSuppliesApi.updatePowerSupply(powerSupplyId, updates);
      // Handle default updates in UI
      setPowerSupplies(prev => prev.map(ps => {
        if (ps.power_supply_id === powerSupplyId) {
          return { ...ps, ...updates };
        }
        // If setting a new UL default, clear others
        if (updates.is_default_ul) {
          return { ...ps, is_default_ul: false };
        }
        // If setting a new non-UL default, clear others
        if (updates.is_default_non_ul) {
          return { ...ps, is_default_non_ul: false };
        }
        return ps;
      }));
      PricingDataResource.clearCache();
      showNotification('Power supply updated successfully', 'success');
      return true;
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to update power supply';
      showNotification(errorMsg, 'error');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleToggleDefaultUL = async (ps: PowerSupplyType) => {
    const newValue = !ps.is_default_ul;
    await handleUpdatePowerSupply(ps.power_supply_id, { is_default_ul: newValue });
  };

  const handleToggleDefaultNonUL = async (ps: PowerSupplyType) => {
    const newValue = !ps.is_default_non_ul;
    await handleUpdatePowerSupply(ps.power_supply_id, { is_default_non_ul: newValue });
  };

  const handleDeactivate = async (ps: PowerSupplyType) => {
    if (!window.confirm(`Deactivate "${ps.transformer_type}"? It will no longer appear in specification dropdowns.`)) {
      return;
    }

    setSaving(true);
    try {
      await powerSuppliesApi.deactivatePowerSupply(ps.power_supply_id);
      if (showInactive) {
        setPowerSupplies(prev => prev.map(p => p.power_supply_id === ps.power_supply_id ? { ...p, is_active: false } : p));
      } else {
        setPowerSupplies(prev => prev.filter(p => p.power_supply_id !== ps.power_supply_id));
      }
      PricingDataResource.clearCache();
      showNotification('Power supply deactivated', 'success');
    } catch {
      showNotification('Failed to deactivate power supply', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleReactivate = async (ps: PowerSupplyType) => {
    setSaving(true);
    try {
      await powerSuppliesApi.updatePowerSupply(ps.power_supply_id, { is_active: true });
      setPowerSupplies(prev => prev.map(p => p.power_supply_id === ps.power_supply_id ? { ...p, is_active: true } : p));
      PricingDataResource.clearCache();
      showNotification('Power supply reactivated', 'success');
    } catch {
      showNotification('Failed to reactivate power supply', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const activePowerSupplies = powerSupplies.filter(ps => ps.is_active);
  const inactivePowerSupplies = powerSupplies.filter(ps => !ps.is_active);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-800">Power Supplies</h2>
              <p className="text-sm text-gray-500 mt-1">Manage power supply types for sign specifications</p>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={showInactive}
                  onChange={(e) => setShowInactive(e.target.checked)}
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                />
                Show inactive
              </label>
              <button onClick={loadData} disabled={loading} className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="mx-6 mt-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <span className="text-red-700">{error}</span>
          </div>
        )}

        <div className="p-6">
          {activePowerSupplies.length === 0 && !showInactive ? (
            <div className="text-center py-8 text-gray-500">No power supplies defined yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Transformer Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Watts</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rated</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Volts</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase w-24">Price</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase w-16">UL</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase w-20" title="Default for UL jobs">UL Def</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase w-20" title="Default for non-UL jobs">Non-UL Def</th>
                    <th className="px-4 py-3 w-24"></th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {(showInactive ? powerSupplies : activePowerSupplies).map(ps => (
                    <tr key={ps.power_supply_id} className={`hover:bg-gray-50 transition-colors ${!ps.is_active ? 'opacity-50' : ''}`}>
                      <td className="px-4 py-3">
                        <span className="text-gray-900 font-medium">{ps.transformer_type}</span>
                        {!ps.is_active && (
                          <span className="ml-2 text-xs text-red-500">(inactive)</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{ps.watts || '-'}</td>
                      <td className="px-4 py-3 text-gray-600">{ps.rated_watts || '-'}</td>
                      <td className="px-4 py-3 text-gray-600">{ps.volts || '-'}</td>
                      <td className="px-4 py-3 text-right text-gray-600">
                        {ps.price != null ? `$${Number(ps.price).toFixed(2)}` : '-'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {ps.ul_listed ? <Check className="w-4 h-4 text-green-600 mx-auto" /> : null}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleToggleDefaultUL(ps)}
                          disabled={saving || !ps.is_active}
                          className="p-1 hover:bg-amber-50 rounded transition-colors disabled:opacity-50"
                          title={ps.is_default_ul ? 'Remove UL default' : 'Set as UL default'}
                        >
                          <Star className={`w-4 h-4 mx-auto ${ps.is_default_ul ? 'text-amber-500 fill-current' : 'text-gray-300'}`} />
                        </button>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleToggleDefaultNonUL(ps)}
                          disabled={saving || !ps.is_active}
                          className="p-1 hover:bg-blue-50 rounded transition-colors disabled:opacity-50"
                          title={ps.is_default_non_ul ? 'Remove non-UL default' : 'Set as non-UL default'}
                        >
                          <Star className={`w-4 h-4 mx-auto ${ps.is_default_non_ul ? 'text-blue-500 fill-current' : 'text-gray-300'}`} />
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setEditingPowerSupply(ps)}
                            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="Edit power supply"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          {ps.is_active ? (
                            <button
                              onClick={() => handleDeactivate(ps)}
                              className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="Deactivate power supply"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleReactivate(ps)}
                              className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded transition-colors text-xs"
                              title="Reactivate power supply"
                            >
                              Restore
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Add New Power Supply */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Add New Power Supply</h3>
            <div className="flex flex-wrap gap-3">
              <input
                type="text"
                value={newPowerSupply.transformer_type}
                onChange={(e) => setNewPowerSupply(prev => ({ ...prev, transformer_type: e.target.value }))}
                placeholder="Transformer type *"
                className="flex-1 min-w-[200px] px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                onKeyDown={(e) => { if (e.key === 'Enter' && newPowerSupply.transformer_type.trim()) { e.preventDefault(); handleAddPowerSupply(); } }}
                disabled={saving}
              />
              <input
                type="number"
                value={newPowerSupply.watts}
                onChange={(e) => setNewPowerSupply(prev => ({ ...prev, watts: e.target.value }))}
                placeholder="Watts"
                className="w-24 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                disabled={saving}
              />
              <input
                type="number"
                value={newPowerSupply.rated_watts}
                onChange={(e) => setNewPowerSupply(prev => ({ ...prev, rated_watts: e.target.value }))}
                placeholder="Rated W"
                className="w-24 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                disabled={saving}
              />
              <input
                type="number"
                value={newPowerSupply.volts}
                onChange={(e) => setNewPowerSupply(prev => ({ ...prev, volts: e.target.value }))}
                placeholder="Volts"
                className="w-24 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                disabled={saving}
              />
              <input
                type="number"
                step="0.01"
                value={newPowerSupply.price}
                onChange={(e) => setNewPowerSupply(prev => ({ ...prev, price: e.target.value }))}
                placeholder="Price"
                className="w-24 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                disabled={saving}
              />
              <label className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg bg-white">
                <input
                  type="checkbox"
                  checked={newPowerSupply.ul_listed}
                  onChange={(e) => setNewPowerSupply(prev => ({ ...prev, ul_listed: e.target.checked }))}
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                  disabled={saving}
                />
                <span className="text-sm text-gray-700">UL</span>
              </label>
              <button
                onClick={handleAddPowerSupply}
                disabled={!newPowerSupply.transformer_type.trim() || saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add
              </button>
            </div>
          </div>

          {/* Stats */}
          <p className="mt-4 text-sm text-gray-500">
            {activePowerSupplies.length} active power suppl{activePowerSupplies.length !== 1 ? 'ies' : 'y'}
            {showInactive && inactivePowerSupplies.length > 0 && `, ${inactivePowerSupplies.length} inactive`}
          </p>
        </div>
      </div>

      <EditPowerSupplyModal
        isOpen={!!editingPowerSupply}
        onClose={() => setEditingPowerSupply(null)}
        powerSupply={editingPowerSupply}
        onSave={handleUpdatePowerSupply}
        saving={saving}
      />

      <Notification
        message={notification.message}
        type={notification.type}
        show={notification.show}
        onClose={() => setNotification(prev => ({ ...prev, show: false }))}
      />
    </div>
  );
};

export default PowerSuppliesManager;
