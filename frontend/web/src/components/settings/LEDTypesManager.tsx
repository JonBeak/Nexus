/**
 * LEDTypesManager - Manage LED product types
 * CRUD operations for LED types used in sign specifications
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, RefreshCw, AlertCircle, X, Star } from 'lucide-react';
import { ledsApi, LEDType } from '../../services/api/ledsApi';
import { Notification } from '../inventory/Notification';

// =============================================================================
// Edit LED Modal
// =============================================================================

interface EditLEDModalProps {
  isOpen: boolean;
  onClose: () => void;
  led: LEDType | null;
  onSave: (ledId: number, updates: Partial<LEDType>) => Promise<boolean>;
  saving?: boolean;
}

const EditLEDModal: React.FC<EditLEDModalProps> = ({
  isOpen,
  onClose,
  led,
  onSave,
  saving = false
}) => {
  const [formData, setFormData] = useState({
    product_code: '',
    colour: '',
    watts: '',
    volts: '',
    brand: '',
    model: '',
    supplier: '',
    lumens: '',
    is_default: false
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (led) {
      setFormData({
        product_code: led.product_code || '',
        colour: led.colour || '',
        watts: led.watts?.toString() || '',
        volts: led.volts?.toString() || '',
        brand: led.brand || '',
        model: led.model || '',
        supplier: led.supplier || '',
        lumens: led.lumens || '',
        is_default: led.is_default || false
      });
      setError(null);
    }
  }, [led]);

  if (!isOpen || !led) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.product_code.trim()) {
      setError('Product code is required');
      return;
    }

    const updates: Partial<LEDType> = {
      product_code: formData.product_code.trim(),
      colour: formData.colour.trim() || null,
      watts: formData.watts ? parseFloat(formData.watts) : null,
      volts: formData.volts ? parseInt(formData.volts) : null,
      brand: formData.brand.trim() || null,
      model: formData.model.trim() || null,
      supplier: formData.supplier.trim() || null,
      lumens: formData.lumens.trim() || null,
      is_default: formData.is_default
    };

    const success = await onSave(led.led_id, updates);
    if (success) onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose} />
        <div className="relative bg-white rounded-lg shadow-xl w-full max-w-lg">
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Edit LED Type</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="h-5 w-5" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Product Code */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Product Code *</label>
              <input
                type="text"
                value={formData.product_code}
                onChange={(e) => { setFormData(prev => ({ ...prev, product_code: e.target.value })); setError(null); }}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${error ? 'border-red-500' : 'border-gray-300'}`}
                disabled={saving}
                autoFocus
              />
              {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
            </div>

            {/* Two columns for details */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Colour</label>
                <input
                  type="text"
                  value={formData.colour}
                  onChange={(e) => setFormData(prev => ({ ...prev, colour: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  disabled={saving}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Brand</label>
                <input
                  type="text"
                  value={formData.brand}
                  onChange={(e) => setFormData(prev => ({ ...prev, brand: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  disabled={saving}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Watts</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.watts}
                  onChange={(e) => setFormData(prev => ({ ...prev, watts: e.target.value }))}
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
                <input
                  type="text"
                  value={formData.model}
                  onChange={(e) => setFormData(prev => ({ ...prev, model: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  disabled={saving}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Lumens</label>
                <input
                  type="text"
                  value={formData.lumens}
                  onChange={(e) => setFormData(prev => ({ ...prev, lumens: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  disabled={saving}
                />
              </div>
            </div>

            {/* Supplier (full width) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
              <input
                type="text"
                value={formData.supplier}
                onChange={(e) => setFormData(prev => ({ ...prev, supplier: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                disabled={saving}
              />
            </div>

            {/* Default checkbox */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_default"
                checked={formData.is_default}
                onChange={(e) => setFormData(prev => ({ ...prev, is_default: e.target.checked }))}
                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                disabled={saving}
              />
              <label htmlFor="is_default" className="text-sm text-gray-700">Set as default LED type</label>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
              <button type="button" onClick={onClose} disabled={saving}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg">Cancel</button>
              <button type="submit" disabled={saving || !formData.product_code.trim()}
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
// Main LEDTypesManager Component
// =============================================================================

export const LEDTypesManager: React.FC = () => {
  const [leds, setLeds] = useState<LEDType[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingLed, setEditingLed] = useState<LEDType | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error'; show: boolean }>({
    message: '', type: 'success', show: false
  });

  // New LED form state
  const [newLed, setNewLed] = useState({
    product_code: '',
    colour: '',
    watts: '',
    volts: '',
    brand: ''
  });

  const showNotification = useCallback((message: string, type: 'success' | 'error') => {
    setNotification({ message, type, show: true });
    setTimeout(() => setNotification(prev => ({ ...prev, show: false })), 5000);
  }, []);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await ledsApi.getAllLEDs(showInactive);
      setLeds(data);
    } catch (err) {
      console.error('Failed to load LEDs:', err);
      setError('Failed to load LED types');
    } finally {
      setLoading(false);
    }
  }, [showInactive]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleAddLed = async () => {
    const trimmedCode = newLed.product_code.trim();
    if (!trimmedCode) return;

    setSaving(true);
    try {
      await ledsApi.createLED({
        product_code: trimmedCode,
        colour: newLed.colour.trim() || undefined,
        watts: newLed.watts ? parseFloat(newLed.watts) : undefined,
        volts: newLed.volts ? parseInt(newLed.volts) : undefined,
        brand: newLed.brand.trim() || undefined
      });
      setNewLed({ product_code: '', colour: '', watts: '', volts: '', brand: '' });
      showNotification('LED type added successfully', 'success');
      loadData();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to add LED type';
      showNotification(errorMsg, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateLed = async (ledId: number, updates: Partial<LEDType>): Promise<boolean> => {
    setSaving(true);
    try {
      await ledsApi.updateLED(ledId, updates);
      setLeds(prev => prev.map(l => l.led_id === ledId ? { ...l, ...updates } : l));
      showNotification('LED type updated successfully', 'success');
      return true;
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to update LED type';
      showNotification(errorMsg, 'error');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (led: LEDType) => {
    if (!window.confirm(`Deactivate "${led.product_code}"? It will no longer appear in specification dropdowns.`)) {
      return;
    }

    setSaving(true);
    try {
      await ledsApi.deactivateLED(led.led_id);
      if (showInactive) {
        setLeds(prev => prev.map(l => l.led_id === led.led_id ? { ...l, is_active: false } : l));
      } else {
        setLeds(prev => prev.filter(l => l.led_id !== led.led_id));
      }
      showNotification('LED type deactivated', 'success');
    } catch {
      showNotification('Failed to deactivate LED type', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleReactivate = async (led: LEDType) => {
    setSaving(true);
    try {
      await ledsApi.updateLED(led.led_id, { is_active: true });
      setLeds(prev => prev.map(l => l.led_id === led.led_id ? { ...l, is_active: true } : l));
      showNotification('LED type reactivated', 'success');
    } catch {
      showNotification('Failed to reactivate LED type', 'error');
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

  const activeLeds = leds.filter(l => l.is_active);
  const inactiveLeds = leds.filter(l => !l.is_active);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-800">LED Types</h2>
              <p className="text-sm text-gray-500 mt-1">Manage LED product types for sign specifications</p>
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
          {activeLeds.length === 0 && !showInactive ? (
            <div className="text-center py-8 text-gray-500">No LED types defined yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product Code</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Colour</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Watts</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Volts</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Brand</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase w-20">Default</th>
                    <th className="px-4 py-3 w-24"></th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {(showInactive ? leds : activeLeds).map(led => (
                    <tr key={led.led_id} className={`hover:bg-gray-50 transition-colors ${!led.is_active ? 'opacity-50' : ''}`}>
                      <td className="px-4 py-3">
                        <span className="text-gray-900 font-medium">{led.product_code}</span>
                        {!led.is_active && (
                          <span className="ml-2 text-xs text-red-500">(inactive)</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{led.colour || '-'}</td>
                      <td className="px-4 py-3 text-gray-600">{led.watts || '-'}</td>
                      <td className="px-4 py-3 text-gray-600">{led.volts || '-'}</td>
                      <td className="px-4 py-3 text-gray-600">{led.brand || '-'}</td>
                      <td className="px-4 py-3 text-center">
                        {led.is_default && <Star className="w-4 h-4 text-amber-500 mx-auto fill-current" />}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setEditingLed(led)}
                            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="Edit LED type"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          {led.is_active ? (
                            <button
                              onClick={() => handleDeactivate(led)}
                              className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="Deactivate LED type"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleReactivate(led)}
                              className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded transition-colors text-xs"
                              title="Reactivate LED type"
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

          {/* Add New LED */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Add New LED Type</h3>
            <div className="flex flex-wrap gap-3">
              <input
                type="text"
                value={newLed.product_code}
                onChange={(e) => setNewLed(prev => ({ ...prev, product_code: e.target.value }))}
                placeholder="Product code *"
                className="flex-1 min-w-[200px] px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                onKeyDown={(e) => { if (e.key === 'Enter' && newLed.product_code.trim()) { e.preventDefault(); handleAddLed(); } }}
                disabled={saving}
              />
              <input
                type="text"
                value={newLed.colour}
                onChange={(e) => setNewLed(prev => ({ ...prev, colour: e.target.value }))}
                placeholder="Colour"
                className="w-32 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                disabled={saving}
              />
              <input
                type="number"
                step="0.01"
                value={newLed.watts}
                onChange={(e) => setNewLed(prev => ({ ...prev, watts: e.target.value }))}
                placeholder="Watts"
                className="w-24 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                disabled={saving}
              />
              <input
                type="number"
                value={newLed.volts}
                onChange={(e) => setNewLed(prev => ({ ...prev, volts: e.target.value }))}
                placeholder="Volts"
                className="w-24 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                disabled={saving}
              />
              <input
                type="text"
                value={newLed.brand}
                onChange={(e) => setNewLed(prev => ({ ...prev, brand: e.target.value }))}
                placeholder="Brand"
                className="w-32 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                disabled={saving}
              />
              <button
                onClick={handleAddLed}
                disabled={!newLed.product_code.trim() || saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add
              </button>
            </div>
          </div>

          {/* Stats */}
          <p className="mt-4 text-sm text-gray-500">
            {activeLeds.length} active LED type{activeLeds.length !== 1 ? 's' : ''}
            {showInactive && inactiveLeds.length > 0 && `, ${inactiveLeds.length} inactive`}
          </p>
        </div>
      </div>

      <EditLEDModal
        isOpen={!!editingLed}
        onClose={() => setEditingLed(null)}
        led={editingLed}
        onSave={handleUpdateLed}
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

export default LEDTypesManager;
