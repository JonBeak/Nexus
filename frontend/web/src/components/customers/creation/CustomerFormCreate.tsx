import React from 'react';
import { CustomerFormCreateProps } from './CustomerCreationTypes';
import { CustomerCreationValidation } from './CustomerCreationValidation';

export const CustomerFormCreate: React.FC<CustomerFormCreateProps> = ({
  formData,
  ledTypes,
  powerSupplyTypes,
  onInputChange
}) => {
  // Helper function to format discount percentage
  const formatDiscount = (discount: number | undefined | null): string => {
    if (!discount) return '0';
    return parseFloat(discount.toString()).toString();
  };

  // Get validation styling for fields
  const getFieldClass = (fieldName: string, value: any) => {
    const error = CustomerCreationValidation.validateField(fieldName, value, formData);
    return CustomerCreationValidation.getValidationClass(fieldName, value, !!error);
  };

  return (
    <div className="space-y-8">
      {/* Basic Information */}
      <div>
        <h4 className="text-lg font-bold text-gray-800 mb-4 border-b border-gray-200 pb-2">Basic Information</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-1">Company Name *</label>
            <input
              type="text"
              required
              value={formData.company_name || ''}
              onChange={(e) => onInputChange('company_name', e.target.value)}
              className={getFieldClass('company_name', formData.company_name)}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-1">QuickBooks Name</label>
            <input
              type="text"
              value={formData.quickbooks_name || ''}
              onChange={(e) => onInputChange('quickbooks_name', e.target.value)}
              className={getFieldClass('quickbooks_name', formData.quickbooks_name)}
              placeholder="Auto-filled from Company Name"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-1">Contact First Name</label>
            <input
              type="text"
              value={formData.contact_first_name || ''}
              onChange={(e) => onInputChange('contact_first_name', e.target.value)}
              className={getFieldClass('contact_first_name', formData.contact_first_name)}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-1">Contact Last Name</label>
            <input
              type="text"
              value={formData.contact_last_name || ''}
              onChange={(e) => onInputChange('contact_last_name', e.target.value)}
              className={getFieldClass('contact_last_name', formData.contact_last_name)}
            />
          </div>
        </div>
      </div>

      {/* Contact Information */}
      <div>
        <h4 className="text-lg font-bold text-gray-800 mb-4 border-b border-gray-200 pb-2">Contact Information</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-1">Email</label>
            <input
              type="email"
              value={formData.email || ''}
              onChange={(e) => onInputChange('email', e.target.value)}
              className={getFieldClass('email', formData.email)}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-1">Phone</label>
            <input
              type="text"
              value={formData.phone || ''}
              onChange={(e) => onInputChange('phone', e.target.value)}
              className={getFieldClass('phone', formData.phone)}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-1">Invoice Email</label>
            <input
              type="email"
              value={formData.invoice_email || ''}
              onChange={(e) => onInputChange('invoice_email', e.target.value)}
              className={getFieldClass('invoice_email', formData.invoice_email)}
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-semibold text-gray-600 mb-1">Invoice Preference</label>
            <textarea
              rows={2}
              value={formData.invoice_email_preference || ''}
              onChange={(e) => onInputChange('invoice_email_preference', e.target.value)}
              className={getFieldClass('invoice_email_preference', formData.invoice_email_preference)}
              placeholder="e.g., Include Job # and PO# in Subject Line. Include Point Person and Accounting"
            />
          </div>
        </div>
      </div>

      {/* Payment & Terms */}
      <div>
        <h4 className="text-lg font-bold text-gray-800 mb-4 border-b border-gray-200 pb-2">Payment & Terms</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-1">Payment Terms</label>
            <select
              value={formData.payment_terms || ''}
              onChange={(e) => onInputChange('payment_terms', e.target.value)}
              className={getFieldClass('payment_terms', formData.payment_terms)}
            >
              <option value="">Select Payment Terms</option>
              <option value="Due on Receipt">Due on Receipt</option>
              <option value="Net 15">Net 15</option>
              <option value="Net 30">Net 30</option>
              <option value="Net 60">Net 60</option>
              <option value="Net 90">Net 90</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-1">Discount (%)</label>
            <input
              type="number"
              step="0.01"
              value={formatDiscount(formData.discount)}
              onChange={(e) => onInputChange('discount', parseFloat(e.target.value) || 0)}
              className={getFieldClass('discount', formData.discount)}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-1">Default Turnaround (days)</label>
            <input
              type="number"
              value={formData.default_turnaround || 10}
              onChange={(e) => onInputChange('default_turnaround', parseInt(e.target.value) || 10)}
              className={getFieldClass('default_turnaround', formData.default_turnaround)}
            />
          </div>
        </div>
        
        {/* Payment Options */}
        <div className="mt-4 space-y-3">
          <div className="flex items-center">
            <input
              type="checkbox"
              id="cash_payment"
              checked={formData.cash_yes_or_no || false}
              onChange={(e) => onInputChange('cash_yes_or_no', e.target.checked)}
              className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
            />
            <label htmlFor="cash_payment" className="ml-2 text-sm font-semibold text-gray-600">Cash Payment Accepted</label>
          </div>
        </div>
      </div>

      {/* Product Preferences */}
      <div>
        <h4 className="text-lg font-bold text-gray-800 mb-4 border-b border-gray-200 pb-2">Product Preferences</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* LEDs */}
          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-1">LEDs</label>
            <select
              value={formData.leds_yes_or_no ? 'yes' : 'no'}
              onChange={(e) => onInputChange('leds_yes_or_no', e.target.value === 'yes')}
              className={getFieldClass('leds_yes_or_no', formData.leds_yes_or_no)}
            >
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
            {formData.leds_yes_or_no && (
              <select
                value={formData.led_id || ''}
                onChange={(e) => onInputChange('led_id', e.target.value)}
                className={`${getFieldClass('led_id', formData.led_id)} mt-2`}
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
          
          {/* Wire Length */}
          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-1">Wire Length (feet)</label>
            <input
              type="number"
              min="0"
              placeholder="Default Length"
              value={formData.wire_length || ''}
              onChange={(e) => onInputChange('wire_length', e.target.value ? parseInt(e.target.value) : undefined)}
              className={getFieldClass('wire_length', formData.wire_length)}
            />
          </div>

          {/* Power Supply */}
          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-1">Power Supply</label>
            <select
              value={formData.powersupply_yes_or_no ? 'yes' : 'no'}
              onChange={(e) => onInputChange('powersupply_yes_or_no', e.target.value === 'yes')}
              className={getFieldClass('powersupply_yes_or_no', formData.powersupply_yes_or_no)}
            >
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
            {formData.powersupply_yes_or_no && (
              <select
                value={formData.power_supply_id || ''}
                onChange={(e) => onInputChange('power_supply_id', e.target.value)}
                className={`${getFieldClass('power_supply_id', formData.power_supply_id)} mt-2`}
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

          {/* Additional preferences */}
          <div className="md:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="ul_listed"
                checked={formData.ul_yes_or_no || false} // CORRECTED field name
                onChange={(e) => onInputChange('ul_yes_or_no', e.target.checked)} // CORRECTED field name
                className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
              />
              <label htmlFor="ul_listed" className="ml-2 text-sm font-semibold text-gray-600">UL Listed</label>
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                id="drain_holes"
                checked={formData.drain_holes_yes_or_no || false}
                onChange={(e) => onInputChange('drain_holes_yes_or_no', e.target.checked)}
                className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
              />
              <label htmlFor="drain_holes" className="ml-2 text-sm font-semibold text-gray-600">Drain Holes</label>
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                id="pattern"
                checked={formData.pattern_yes_or_no || false}
                onChange={(e) => onInputChange('pattern_yes_or_no', e.target.checked)}
                className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
              />
              <label htmlFor="pattern" className="ml-2 text-sm font-semibold text-gray-600">Pattern</label>
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                id="plug_play"
                checked={formData.plug_n_play_yes_or_no || false} // CORRECTED field name
                onChange={(e) => onInputChange('plug_n_play_yes_or_no', e.target.checked)} // CORRECTED field name
                className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
              />
              <label htmlFor="plug_play" className="ml-2 text-sm font-semibold text-gray-600">Plug & Play</label>
            </div>
          </div>

          {/* Pattern Type - CORRECTED field name */}
          {formData.pattern_yes_or_no && (
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">Pattern Type</label>
              <select
                value={formData.pattern_type || 'Paper'} // CORRECTED field name
                onChange={(e) => onInputChange('pattern_type', e.target.value)} // CORRECTED field name
                className={getFieldClass('pattern_type', formData.pattern_type)}
              >
                <option value="Paper">Paper</option>
                <option value="Digital">Digital</option>
              </select>
            </div>
          )}

          {/* Wiring Diagram Type - CORRECTED field name */}
          {formData.wiring_diagram_yes_or_no && (
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">Wiring Diagram Type</label>
              <select
                value={formData.wiring_diagram_type || 'Paper'} // CORRECTED field name
                onChange={(e) => onInputChange('wiring_diagram_type', e.target.value)} // CORRECTED field name
                className={getFieldClass('wiring_diagram_type', formData.wiring_diagram_type)}
              >
                <option value="Paper">Paper</option>
                <option value="Digital">Digital</option>
              </select>
            </div>
          )}
        </div>

        {/* Shipping Section */}
        <div className="mt-6">
          <h5 className="text-md font-semibold text-gray-700 mb-3">Shipping Options</h5>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="shipping"
                checked={formData.shipping_yes_or_no || false}
                onChange={(e) => onInputChange('shipping_yes_or_no', e.target.checked)}
                className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
              />
              <label htmlFor="shipping" className="ml-2 text-sm font-semibold text-gray-600">Enable Shipping</label>
            </div>
            
            {formData.shipping_yes_or_no && (
              <>
                <div>
                  <label className="block text-sm font-semibold text-gray-600 mb-1">Shipping Multiplier</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={formData.shipping_multiplier || 1.5}
                    onChange={(e) => onInputChange('shipping_multiplier', parseFloat(e.target.value) || 1.5)}
                    className={getFieldClass('shipping_multiplier', formData.shipping_multiplier)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-600 mb-1">Flat Shipping Rate ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.shipping_flat || ''} // CORRECTED field name
                    onChange={(e) => onInputChange('shipping_flat', e.target.value ? parseFloat(e.target.value) : null)} // CORRECTED field name
                    className={getFieldClass('shipping_flat', formData.shipping_flat)}
                    placeholder="Optional flat rate"
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Notes & Instructions */}
      <div>
        <h4 className="text-lg font-bold text-gray-800 mb-4 border-b border-gray-200 pb-2">Notes & Instructions</h4>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-1">Comments</label>
            <textarea
              rows={3}
              value={formData.comments || ''}
              onChange={(e) => onInputChange('comments', e.target.value)}
              className={getFieldClass('comments', formData.comments)}
              placeholder="General comments about this customer..."
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-1">Special Instructions</label>
            <textarea
              rows={3}
              value={formData.special_instructions || ''}
              onChange={(e) => onInputChange('special_instructions', e.target.value)}
              className={getFieldClass('special_instructions', formData.special_instructions)}
              placeholder="Special handling or processing instructions..."
            />
          </div>
        </div>
      </div>
    </div>
  );
};