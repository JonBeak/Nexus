import React from 'react';
import { Customer, LedType, PowerSupplyType } from '../../types/index';
import { PAGE_STYLES, MODULE_COLORS } from '../../constants/moduleColors';

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

  // Shared input class for all form fields
  const inputClass = `w-full px-3 py-2 border ${PAGE_STYLES.input.border} ${PAGE_STYLES.input.background} ${PAGE_STYLES.input.text} ${PAGE_STYLES.input.placeholder} rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500`;
  const displayClass = `${PAGE_STYLES.panel.text} ${PAGE_STYLES.header.background} p-2 rounded`;

  return (
    <div className="space-y-8">
      {/* Basic Information */}
      <div>
        <h4 className={`text-lg font-bold ${PAGE_STYLES.panel.text} mb-4 border-b ${PAGE_STYLES.panel.border} pb-2`}>Basic Information</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={`text-sm font-semibold ${PAGE_STYLES.panel.textSecondary}`}>Company Name</label>
            {isEditing ? (
              <input
                type="text"
                value={formData.company_name || ''}
                onChange={(e) => onInputChange('company_name', e.target.value)}
                className={inputClass}
              />
            ) : (
              <p className={displayClass}>{formData.company_name}</p>
            )}
          </div>
          <div>
            <label className={`text-sm font-semibold ${PAGE_STYLES.panel.textSecondary}`}>QuickBooks Name</label>
            {isEditing ? (
              <input
                type="text"
                value={formData.quickbooks_name || ''}
                onChange={(e) => onInputChange('quickbooks_name', e.target.value)}
                className={inputClass}
              />
            ) : (
              <p className={displayClass}>{formData.quickbooks_name || '-'}</p>
            )}
          </div>
        </div>
      </div>

      {/* Payment & Terms */}
      <div>
        <h4 className={`text-lg font-bold ${PAGE_STYLES.panel.text} mb-4 border-b ${PAGE_STYLES.panel.border} pb-2`}>Payment & Terms</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={`text-sm font-semibold ${PAGE_STYLES.panel.textSecondary}`}>Payment Terms</label>
            {isEditing ? (
              <input
                type="text"
                value={formData.payment_terms || ''}
                onChange={(e) => onInputChange('payment_terms', e.target.value)}
                className={inputClass}
                placeholder="e.g., Net 30, Due on Receipt"
              />
            ) : (
              <p className={displayClass}>{formData.payment_terms || '-'}</p>
            )}
          </div>
          <div>
            <label className={`text-sm font-semibold ${PAGE_STYLES.panel.textSecondary}`}>Discount (%)</label>
            {isEditing ? (
              <input
                type="number"
                step="0.01"
                value={formatDiscount(formData.discount)}
                onChange={(e) => onInputChange('discount', parseFloat(e.target.value) || 0)}
                className={inputClass}
              />
            ) : (
              <p className={displayClass}>{formatDiscount(formData.discount)}%</p>
            )}
          </div>
          <div>
            <label className={`text-sm font-semibold ${PAGE_STYLES.panel.textSecondary}`}>Cash Payment</label>
            {isEditing ? (
              <select
                value={formData.cash_yes_or_no ? 'yes' : 'no'}
                onChange={(e) => onInputChange('cash_yes_or_no', e.target.value === 'yes')}
                className={inputClass}
              >
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            ) : (
              <p className={displayClass}>{formData.cash_yes_or_no ? 'Yes' : 'No'}</p>
            )}
          </div>
          <div>
            <label className={`text-sm font-semibold ${PAGE_STYLES.panel.textSecondary}`}>High Standards</label>
            {isEditing ? (
              <select
                value={formData.high_standards ? 'yes' : 'no'}
                onChange={(e) => onInputChange('high_standards', e.target.value === 'yes')}
                className={inputClass}
              >
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            ) : (
              <p className={displayClass}>{formData.high_standards ? 'Yes' : 'No'}</p>
            )}
          </div>
          <div>
            <label className={`text-sm font-semibold ${PAGE_STYLES.panel.textSecondary}`}>Hide Sign House from Order Forms</label>
            {isEditing ? (
              <select
                value={formData.hide_company_name ? 'yes' : 'no'}
                onChange={(e) => onInputChange('hide_company_name', e.target.value === 'yes')}
                className={inputClass}
              >
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            ) : (
              <p className={displayClass}>{formData.hide_company_name ? 'Yes' : 'No'}</p>
            )}
          </div>
          <div>
            <label className={`text-sm font-semibold ${PAGE_STYLES.panel.textSecondary}`}>Default Turnaround (days)</label>
            {isEditing ? (
              <input
                type="number"
                value={formData.default_turnaround || 10}
                onChange={(e) => onInputChange('default_turnaround', parseInt(e.target.value) || 10)}
                className={inputClass}
              />
            ) : (
              <p className={displayClass}>{formData.default_turnaround || 10} days</p>
            )}
          </div>
          <div>
            <label className={`text-sm font-semibold ${PAGE_STYLES.panel.textSecondary}`}>Purchase Order Required</label>
            {isEditing ? (
              <select
                value={formData.po_required ? 'yes' : 'no'}
                onChange={(e) => onInputChange('po_required', e.target.value === 'yes')}
                className={inputClass}
              >
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            ) : (
              <p className={displayClass}>{formData.po_required ? 'Yes' : 'No'}</p>
            )}
          </div>
          <div className="md:col-span-2">
            <label className={`text-sm font-semibold ${PAGE_STYLES.panel.textSecondary}`}>Invoice Preference</label>
            {isEditing ? (
              <textarea
                rows={2}
                value={formData.invoice_email_preference || ''}
                onChange={(e) => onInputChange('invoice_email_preference', e.target.value)}
                className={inputClass}
                placeholder="e.g., Include Job # and PO# in Subject Line. Include Point Person and Accounting"
              />
            ) : (
              <p className={displayClass}>{formData.invoice_email_preference || '-'}</p>
            )}
          </div>
        </div>
      </div>

      {/* Product Preferences */}
      <div>
        <h4 className={`text-lg font-bold ${PAGE_STYLES.panel.text} mb-4 border-b ${PAGE_STYLES.panel.border} pb-2`}>Product Preferences</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={`text-sm font-semibold ${PAGE_STYLES.panel.textSecondary}`}>LEDs</label>
            {isEditing ? (
              <div className="space-y-2">
                <select
                  value={formData.leds_yes_or_no ? 'yes' : 'no'}
                  onChange={(e) => onInputChange('leds_yes_or_no', e.target.value === 'yes')}
                  className={inputClass}
                >
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
                {formData.leds_yes_or_no && (
                  <select
                    value={formData.led_id || ''}
                    onChange={(e) => onInputChange('led_id', e.target.value)}
                    className={inputClass}
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
              <p className={displayClass}>
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
            <label className={`text-sm font-semibold ${PAGE_STYLES.panel.textSecondary}`}>Wire Length</label>
            {isEditing ? (
              <input
                type="number"
                min="0"
                value={formData.wire_length || ''}
                onChange={(e) => onInputChange('wire_length', e.target.value ? parseInt(e.target.value) : undefined)}
                className={inputClass}
              />
            ) : (
              <p className={displayClass}>{formData.wire_length || 'Default'} feet</p>
            )}
          </div>
          <div>
            <label className={`text-sm font-semibold ${PAGE_STYLES.panel.textSecondary}`}>Power Supply</label>
            {isEditing ? (
              <div className="space-y-2">
                <select
                  value={formData.powersupply_yes_or_no ? 'yes' : 'no'}
                  onChange={(e) => onInputChange('powersupply_yes_or_no', e.target.value === 'yes')}
                  className={inputClass}
                >
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
                {formData.powersupply_yes_or_no && (
                  <select
                    value={formData.power_supply_id || ''}
                    onChange={(e) => onInputChange('power_supply_id', e.target.value)}
                    className={inputClass}
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
              <p className={displayClass}>
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
            <label className={`text-sm font-semibold ${PAGE_STYLES.panel.textSecondary}`}>UL Listed</label>
            {isEditing ? (
              <select
                value={formData.ul_yes_or_no ? 'yes' : 'no'}
                onChange={(e) => onInputChange('ul_yes_or_no', e.target.value === 'yes')}
                className={inputClass}
              >
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            ) : (
              <p className={displayClass}>{formData.ul_yes_or_no ? 'Yes' : 'No'}</p>
            )}
          </div>
          <div>
            <label className={`text-sm font-semibold ${PAGE_STYLES.panel.textSecondary}`}>Drain Holes</label>
            {isEditing ? (
              <select
                value={formData.drain_holes_yes_or_no ? 'yes' : 'no'}
                onChange={(e) => onInputChange('drain_holes_yes_or_no', e.target.value === 'yes')}
                className={inputClass}
              >
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            ) : (
              <p className={displayClass}>{formData.drain_holes_yes_or_no ? 'Yes' : 'No'}</p>
            )}
          </div>
          <div>
            <label className={`text-sm font-semibold ${PAGE_STYLES.panel.textSecondary}`}>Pattern</label>
            {isEditing ? (
              <div className="space-y-2">
                <select
                  value={formData.pattern_yes_or_no ? 'yes' : 'no'}
                  onChange={(e) => onInputChange('pattern_yes_or_no', e.target.value === 'yes')}
                  className={inputClass}
                >
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
                {!!formData.pattern_yes_or_no && (
                  <input
                    type="text"
                    value={formData.pattern_type || 'Paper'}
                    onChange={(e) => onInputChange('pattern_type', e.target.value)}
                    className={inputClass}
                    placeholder="Pattern type (e.g., Paper, Digital)"
                  />
                )}
              </div>
            ) : (
              <p className={displayClass}>
                {formData.pattern_yes_or_no ? `Yes - ${formData.pattern_type || 'Paper'}` : 'No'}
              </p>
            )}
          </div>
          <div>
            <label className={`text-sm font-semibold ${PAGE_STYLES.panel.textSecondary}`}>Wiring Diagram</label>
            {isEditing ? (
              <div className="space-y-2">
                <select
                  value={formData.wiring_diagram_yes_or_no ? 'yes' : 'no'}
                  onChange={(e) => onInputChange('wiring_diagram_yes_or_no', e.target.value === 'yes')}
                  className={inputClass}
                >
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
                {!!formData.wiring_diagram_yes_or_no && (
                  <input
                    type="text"
                    value={formData.wiring_diagram_type || 'Paper'}
                    onChange={(e) => onInputChange('wiring_diagram_type', e.target.value)}
                    className={inputClass}
                    placeholder="Diagram type (e.g., Paper, Digital)"
                  />
                )}
              </div>
            ) : (
              <p className={displayClass}>
                {formData.wiring_diagram_yes_or_no ? `Yes - ${formData.wiring_diagram_type || 'Paper'}` : 'No'}
              </p>
            )}
          </div>
          <div>
            <label className={`text-sm font-semibold ${PAGE_STYLES.panel.textSecondary}`}>Plug & Play</label>
            {isEditing ? (
              <select
                value={formData.plug_n_play_yes_or_no ? 'yes' : 'no'}
                onChange={(e) => onInputChange('plug_n_play_yes_or_no', e.target.value === 'yes')}
                className={inputClass}
              >
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            ) : (
              <p className={displayClass}>{formData.plug_n_play_yes_or_no ? 'Yes' : 'No'}</p>
            )}
          </div>
        </div>
      </div>

      {/* Shipping */}
      <div>
        <h4 className={`text-lg font-bold ${PAGE_STYLES.panel.text} mb-4 border-b ${PAGE_STYLES.panel.border} pb-2`}>Shipping</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={`text-sm font-semibold ${PAGE_STYLES.panel.textSecondary}`}>Shipping</label>
            {isEditing ? (
              <select
                value={formData.shipping_yes_or_no ? 'yes' : 'no'}
                onChange={(e) => onInputChange('shipping_yes_or_no', e.target.value === 'yes')}
                className={inputClass}
              >
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            ) : (
              <p className={displayClass}>
                {formData.shipping_yes_or_no === true ? 'Yes' : 'No'}
              </p>
            )}
          </div>
          {formData.shipping_yes_or_no === true && (
            <>
              <div>
                <label className={`text-sm font-semibold ${PAGE_STYLES.panel.textSecondary}`}>Shipping Multiplier</label>
                {isEditing ? (
                  <input
                    type="number"
                    step="0.01"
                    value={formData.shipping_multiplier || 1.5}
                    onChange={(e) => onInputChange('shipping_multiplier', parseFloat(e.target.value) || 1.5)}
                    className={inputClass}
                  />
                ) : (
                  <p className={displayClass}>
                    {formData.shipping_multiplier ? `${formData.shipping_multiplier}x` : '1.5x'}
                  </p>
                )}
              </div>
              <div>
                <label className={`text-sm font-semibold ${PAGE_STYLES.panel.textSecondary}`}>Flat Shipping Rate ($)</label>
                {isEditing ? (
                  <input
                    type="number"
                    step="0.01"
                    value={formData.shipping_flat || ''}
                    onChange={(e) => onInputChange('shipping_flat', e.target.value ? parseFloat(e.target.value) : null)}
                    className={inputClass}
                    placeholder="Optional flat rate"
                  />
                ) : (
                  <p className={displayClass}>
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
        <h4 className={`text-lg font-bold ${PAGE_STYLES.panel.text} mb-4 border-b ${PAGE_STYLES.panel.border} pb-2`}>Notes & Instructions</h4>
        <div className="space-y-4">
          <div>
            <label className={`text-sm font-semibold ${PAGE_STYLES.panel.textSecondary}`}>Internal Notes</label>
            {isEditing ? (
              <textarea
                rows={3}
                value={formData.comments || ''}
                onChange={(e) => onInputChange('comments', e.target.value)}
                className={inputClass}
              />
            ) : (
              <p className={displayClass}>{formData.comments || '-'}</p>
            )}
          </div>
          <div>
            <label className={`text-sm font-semibold ${PAGE_STYLES.panel.textSecondary}`}>Special Instructions</label>
            {isEditing ? (
              <textarea
                rows={3}
                value={formData.special_instructions || ''}
                onChange={(e) => onInputChange('special_instructions', e.target.value)}
                className={inputClass}
              />
            ) : (
              <p className={displayClass}>{formData.special_instructions || '-'}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default CustomerForm;
