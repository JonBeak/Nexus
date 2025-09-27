import React from 'react';
import { Customer, LedType, PowerSupplyType } from '../../types/index';

interface CustomerFormProps {
  formData: Customer;
  isEditing: boolean;
  ledTypes: LedType[];
  powerSupplyTypes: PowerSupplyType[];
  onInputChange: <K extends keyof Customer>(field: K, value: Customer[K] | null) => void;
}

function CustomerForm({ formData, isEditing, ledTypes, powerSupplyTypes, onInputChange }: CustomerFormProps) {
  // Helper function to format discount percentage
  const formatDiscount = (discount: number | undefined | null): string => {
    if (!discount) return '0';
    // Remove trailing zeros and unnecessary decimal point
    const formatted = parseFloat(discount.toString()).toString();
    return formatted;
  };

  return (
    <div className="space-y-8">
      {/* Basic Information */}
      <div>
        <h4 className="text-lg font-bold text-gray-800 mb-4 border-b border-gray-200 pb-2">Basic Information</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-semibold text-gray-600">Company Name</label>
            {isEditing ? (
              <input
                type="text"
                value={formData.company_name || ''}
                onChange={(e) => onInputChange('company_name', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-red focus:border-primary-red"
              />
            ) : (
              <p className="text-gray-800 bg-gray-50 p-2 rounded">{formData.company_name}</p>
            )}
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-600">QuickBooks Name</label>
            {isEditing ? (
              <input
                type="text"
                value={formData.quickbooks_name || ''}
                onChange={(e) => onInputChange('quickbooks_name', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-red focus:border-primary-red"
              />
            ) : (
              <p className="text-gray-800 bg-gray-50 p-2 rounded">{formData.quickbooks_name || '-'}</p>
            )}
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-600">Contact First Name</label>
            {isEditing ? (
              <input
                type="text"
                value={formData.contact_first_name || ''}
                onChange={(e) => onInputChange('contact_first_name', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-red focus:border-primary-red"
              />
            ) : (
              <p className="text-gray-800 bg-gray-50 p-2 rounded">{formData.contact_first_name || '-'}</p>
            )}
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-600">Contact Last Name</label>
            {isEditing ? (
              <input
                type="text"
                value={formData.contact_last_name || ''}
                onChange={(e) => onInputChange('contact_last_name', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-red focus:border-primary-red"
              />
            ) : (
              <p className="text-gray-800 bg-gray-50 p-2 rounded">{formData.contact_last_name || '-'}</p>
            )}
          </div>
        </div>
      </div>

      {/* Contact Information */}
      <div>
        <h4 className="text-lg font-bold text-gray-800 mb-4 border-b border-gray-200 pb-2">Contact Information</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-semibold text-gray-600">Email</label>
            {isEditing ? (
              <input
                type="email"
                value={formData.email || ''}
                onChange={(e) => onInputChange('email', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-red focus:border-primary-red"
              />
            ) : (
              <p className="text-gray-800 bg-gray-50 p-2 rounded">{formData.email || '-'}</p>
            )}
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-600">Phone</label>
            {isEditing ? (
              <input
                type="text"
                value={formData.phone || ''}
                onChange={(e) => onInputChange('phone', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-red focus:border-primary-red"
              />
            ) : (
              <p className="text-gray-800 bg-gray-50 p-2 rounded">{formData.phone || '-'}</p>
            )}
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-600">Invoice Email</label>
            {isEditing ? (
              <input
                type="email"
                value={formData.invoice_email || ''}
                onChange={(e) => onInputChange('invoice_email', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-red focus:border-primary-red"
              />
            ) : (
              <p className="text-gray-800 bg-gray-50 p-2 rounded">{formData.invoice_email || '-'}</p>
            )}
          </div>
          <div className="md:col-span-2">
            <label className="text-sm font-semibold text-gray-600">Invoice Preference</label>
            {isEditing ? (
              <textarea
                rows={2}
                value={formData.invoice_email_preference || ''}
                onChange={(e) => onInputChange('invoice_email_preference', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-red focus:border-primary-red"
                placeholder="e.g., Include Job # and PO# in Subject Line. Include Point Person and Accounting"
              />
            ) : (
              <p className="text-gray-800 bg-gray-50 p-2 rounded">{formData.invoice_email_preference || '-'}</p>
            )}
          </div>
        </div>
      </div>

      {/* Payment & Terms */}
      <div>
        <h4 className="text-lg font-bold text-gray-800 mb-4 border-b border-gray-200 pb-2">Payment & Terms</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-semibold text-gray-600">Payment Terms</label>
            {isEditing ? (
              <input
                type="text"
                value={formData.payment_terms || ''}
                onChange={(e) => onInputChange('payment_terms', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-red focus:border-primary-red"
                placeholder="e.g., Net 30, Due on Receipt"
              />
            ) : (
              <p className="text-gray-800 bg-gray-50 p-2 rounded">{formData.payment_terms || '-'}</p>
            )}
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-600">Discount (%)</label>
            {isEditing ? (
              <input
                type="number"
                step="0.01"
                value={formatDiscount(formData.discount)}
                onChange={(e) => onInputChange('discount', parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-red focus:border-primary-red"
              />
            ) : (
              <p className="text-gray-800 bg-gray-50 p-2 rounded">{formatDiscount(formData.discount)}%</p>
            )}
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-600">Cash Payment</label>
            {isEditing ? (
              <select
                value={formData.cash_yes_or_no ? 'yes' : 'no'}
                onChange={(e) => onInputChange('cash_yes_or_no', e.target.value === 'yes')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-red focus:border-primary-red"
              >
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            ) : (
              <p className="text-gray-800 bg-gray-50 p-2 rounded">{formData.cash_yes_or_no ? 'Yes' : 'No'}</p>
            )}
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-600">Default Turnaround (days)</label>
            {isEditing ? (
              <input
                type="number"
                value={formData.default_turnaround || 10}
                onChange={(e) => onInputChange('default_turnaround', parseInt(e.target.value) || 10)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-red focus:border-primary-red"
              />
            ) : (
              <p className="text-gray-800 bg-gray-50 p-2 rounded">{formData.default_turnaround || 10} days</p>
            )}
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-600">Purchase Order Required</label>
            {isEditing ? (
              <select
                value={formData.po_required ? 'yes' : 'no'}
                onChange={(e) => onInputChange('po_required', e.target.value === 'yes')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-red focus:border-primary-red"
              >
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            ) : (
              <p className="text-gray-800 bg-gray-50 p-2 rounded">{formData.po_required ? 'Yes' : 'No'}</p>
            )}
          </div>
        </div>
      </div>

      {/* Product Preferences */}
      <div>
        <h4 className="text-lg font-bold text-gray-800 mb-4 border-b border-gray-200 pb-2">Product Preferences</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-semibold text-gray-600">LEDs</label>
            {isEditing ? (
              <div className="space-y-2">
                <select
                  value={formData.leds_yes_or_no ? 'yes' : 'no'}
                  onChange={(e) => onInputChange('leds_yes_or_no', e.target.value === 'yes')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-red focus:border-primary-red"
                >
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
                {formData.leds_yes_or_no && (
                  <select
                    value={formData.led_id || ''}
                    onChange={(e) => onInputChange('led_id', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-red focus:border-primary-red"
                  >
                    <option value="">Use System Default</option>
                    {ledTypes.map((type) => (
                      <option key={type.led_id} value={type.led_id}>
                        {type.product_code} - {type.brand} ({type.watts}W, {type.colour}) {type.is_default ? '(Default)' : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            ) : (
              <p className="text-gray-800 bg-gray-50 p-2 rounded">
                {formData.leds_yes_or_no ? 
                  (formData.led_product_code ? 
                    `${formData.led_product_code} - ${formData.led_brand} (${formData.led_watts}W, ${formData.led_colour})` 
                    : 'System Default'
                  ) : 'No'
                }
              </p>
            )}
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-600">Wire Length</label>
            {isEditing ? (
              <input
                type="number"
                min="0"
                value={formData.wire_length || ''}
                onChange={(e) => onInputChange('wire_length', e.target.value ? parseInt(e.target.value) : undefined)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-red focus:border-primary-red"
              />
            ) : (
              <p className="text-gray-800 bg-gray-50 p-2 rounded">{formData.wire_length || 'Default'} feet</p>
            )}
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-600">Power Supply</label>
            {isEditing ? (
              <div className="space-y-2">
                <select
                  value={formData.powersupply_yes_or_no ? 'yes' : 'no'}
                  onChange={(e) => onInputChange('powersupply_yes_or_no', e.target.value === 'yes')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-red focus:border-primary-red"
                >
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
                {formData.powersupply_yes_or_no && (
                  <select
                    value={formData.power_supply_id || ''}
                    onChange={(e) => onInputChange('power_supply_id', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-red focus:border-primary-red"
                  >
                    <option value="">Use System Default</option>
                    {powerSupplyTypes.map((type) => (
                      <option key={type.power_supply_id} value={type.power_supply_id}>
                        {type.transformer_type} - {type.watts}W, {type.volts}V {type.ul_listed ? '(UL)' : ''} {type.is_default_non_ul || type.is_default_ul ? '(Default)' : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            ) : (
              <p className="text-gray-800 bg-gray-50 p-2 rounded">
                {formData.powersupply_yes_or_no ? 
                  (formData.power_supply_type ? 
                    `${formData.power_supply_type} - ${formData.power_supply_watts}W, ${formData.power_supply_volts}V ${formData.power_supply_ul_listed ? '(UL)' : ''}` 
                    : 'System Default'
                  ) : 'No'
                }
              </p>
            )}
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-600">UL Listed</label>
            {isEditing ? (
              <select
                value={formData.ul_yes_or_no ? 'yes' : 'no'}
                onChange={(e) => onInputChange('ul_yes_or_no', e.target.value === 'yes')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-red focus:border-primary-red"
              >
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            ) : (
              <p className="text-gray-800 bg-gray-50 p-2 rounded">{formData.ul_yes_or_no ? 'Yes' : 'No'}</p>
            )}
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-600">Drain Holes</label>
            {isEditing ? (
              <select
                value={formData.drain_holes_yes_or_no !== false ? 'yes' : 'no'}
                onChange={(e) => onInputChange('drain_holes_yes_or_no', e.target.value === 'yes')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-red focus:border-primary-red"
              >
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            ) : (
              <p className="text-gray-800 bg-gray-50 p-2 rounded">{formData.drain_holes_yes_or_no !== false ? 'Yes' : 'No'}</p>
            )}
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-600">Pattern</label>
            {isEditing ? (
              <div className="space-y-2">
                <select
                  value={formData.pattern_yes_or_no !== false ? 'yes' : 'no'}
                  onChange={(e) => onInputChange('pattern_yes_or_no', e.target.value === 'yes')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-red focus:border-primary-red"
                >
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
                {formData.pattern_yes_or_no !== false && (
                  <input
                    type="text"
                    value={formData.pattern_type || 'Paper'}
                    onChange={(e) => onInputChange('pattern_type', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-red focus:border-primary-red"
                    placeholder="Pattern type (e.g., Paper, Digital)"
                  />
                )}
              </div>
            ) : (
              <p className="text-gray-800 bg-gray-50 p-2 rounded">
                {formData.pattern_yes_or_no !== false ? `Yes - ${formData.pattern_type || 'Paper'}` : 'No'}
              </p>
            )}
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-600">Wiring Diagram</label>
            {isEditing ? (
              <div className="space-y-2">
                <select
                  value={formData.wiring_diagram_yes_or_no !== false ? 'yes' : 'no'}
                  onChange={(e) => onInputChange('wiring_diagram_yes_or_no', e.target.value === 'yes')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-red focus:border-primary-red"
                >
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
                {formData.wiring_diagram_yes_or_no !== false && (
                  <input
                    type="text"
                    value={formData.wiring_diagram_type || 'Paper'}
                    onChange={(e) => onInputChange('wiring_diagram_type', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-red focus:border-primary-red"
                    placeholder="Diagram type (e.g., Paper, Digital)"
                  />
                )}
              </div>
            ) : (
              <p className="text-gray-800 bg-gray-50 p-2 rounded">
                {formData.wiring_diagram_yes_or_no !== false ? `Yes - ${formData.wiring_diagram_type || 'Paper'}` : 'No'}
              </p>
            )}
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-600">Plug & Play</label>
            {isEditing ? (
              <select
                value={formData.plug_n_play_yes_or_no ? 'yes' : 'no'}
                onChange={(e) => onInputChange('plug_n_play_yes_or_no', e.target.value === 'yes')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-red focus:border-primary-red"
              >
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            ) : (
              <p className="text-gray-800 bg-gray-50 p-2 rounded">{formData.plug_n_play_yes_or_no ? 'Yes' : 'No'}</p>
            )}
          </div>
        </div>
      </div>

      {/* Shipping */}
      <div>
        <h4 className="text-lg font-bold text-gray-800 mb-4 border-b border-gray-200 pb-2">Shipping</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-semibold text-gray-600">Shipping</label>
            {isEditing ? (
              <select
                value={formData.shipping_yes_or_no ? 'yes' : 'no'}
                onChange={(e) => onInputChange('shipping_yes_or_no', e.target.value === 'yes')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-red focus:border-primary-red"
              >
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            ) : (
              <p className="text-gray-800 bg-gray-50 p-2 rounded">
                {formData.shipping_yes_or_no === true ? 'Yes' : 'No'}
              </p>
            )}
          </div>
          {formData.shipping_yes_or_no === true && (
            <>
              <div>
                <label className="text-sm font-semibold text-gray-600">Shipping Multiplier</label>
                {isEditing ? (
                  <input
                    type="number"
                    step="0.01"
                    value={formData.shipping_multiplier || 1.5}
                    onChange={(e) => onInputChange('shipping_multiplier', parseFloat(e.target.value) || 1.5)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-red focus:border-primary-red"
                  />
                ) : (
                  <p className="text-gray-800 bg-gray-50 p-2 rounded">
                    {formData.shipping_multiplier ? `${formData.shipping_multiplier}x` : '1.5x'}
                  </p>
                )}
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-600">Flat Shipping Rate ($)</label>
                {isEditing ? (
                  <input
                    type="number"
                    step="0.01"
                    value={formData.shipping_flat || ''}
                    onChange={(e) => onInputChange('shipping_flat', e.target.value ? parseFloat(e.target.value) : null)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-red focus:border-primary-red"
                    placeholder="Optional flat rate"
                  />
                ) : (
                  <p className="text-gray-800 bg-gray-50 p-2 rounded">
                    {formData.shipping_flat ? `$${formData.shipping_flat}` : '-'}
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Notes & Instructions */}
      <div>
        <h4 className="text-lg font-bold text-gray-800 mb-4 border-b border-gray-200 pb-2">Notes & Instructions</h4>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-semibold text-gray-600">Comments</label>
            {isEditing ? (
              <textarea
                rows={3}
                value={formData.comments || ''}
                onChange={(e) => onInputChange('comments', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-red focus:border-primary-red"
              />
            ) : (
              <p className="text-gray-800 bg-gray-50 p-2 rounded">{formData.comments || '-'}</p>
            )}
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-600">Special Instructions</label>
            {isEditing ? (
              <textarea
                rows={3}
                value={formData.special_instructions || ''}
                onChange={(e) => onInputChange('special_instructions', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-red focus:border-primary-red"
              />
            ) : (
              <p className="text-gray-800 bg-gray-50 p-2 rounded">{formData.special_instructions || '-'}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default CustomerForm;
