import React from 'react';
import { FileText, AlertTriangle, Edit2, Star } from 'lucide-react';
import { CustomerPreferencesData, CustomerPreferencesValidationResult } from './types/customerPreferences';
import { formatNumber } from './core/calculations/utils/priceFormatter';
import { PAGE_STYLES } from '../../constants/moduleColors';

interface CustomerPreferencesPanelProps {
  customerData: CustomerPreferencesData | null;
  validationResult: CustomerPreferencesValidationResult | null;
  onEditCustomer: () => void;
}

export const CustomerPreferencesPanel: React.FC<CustomerPreferencesPanelProps> = ({
  customerData,
  validationResult,
  onEditCustomer
}) => {
  if (!customerData || !customerData.preferences) {
    return null;
  }

  const { preferences, cashCustomer, highStandards, discount, defaultTurnaround, postalCode } = customerData;

  // Helper function to format LED preference display
  const formatLEDPreference = (): string => {
    if (!preferences.pref_leds_enabled) {
      return 'No';
    }

    // Build LED type display string
    let ledType = 'Default';
    if (preferences.pref_led_product_code || preferences.pref_led_brand) {
      // Show product code and/or brand
      const parts = [];
      if (preferences.pref_led_brand) parts.push(preferences.pref_led_brand);
      if (preferences.pref_led_product_code) parts.push(preferences.pref_led_product_code);
      ledType = parts.join(' ');

      // Add (Default) suffix if using system default (no custom LED ID set)
      if (!preferences.pref_led_id) {
        ledType += ' (Default)';
      }
    }

    return `Yes - ${ledType}`;
  };

  // Helper function to format Power Supply preference display
  const formatPowerSupplyPreference = (): string => {
    if (!preferences.pref_power_supply_required) {
      return 'No';
    }
    const psType = preferences.pref_power_supply_type || 'Default';
    return `Yes - ${psType}`;
  };

  // Helper function to format UL preference display
  const formatULPreference = (): string => {
    return preferences.pref_ul_required ? 'Yes' : 'No';
  };

  // Helper function to format Wire Length preference display
  const formatWireLengthPreference = (): string => {
    const length = preferences.pref_wire_length || 8;
    return length === 8 ? '8ft (Default)' : `${length}ft`;
  };

  // Helper function to format Plug N Play preference display
  const formatPlugNPlayPreference = (): string => {
    return preferences.pref_plug_and_play_required ? 'Yes' : 'No';
  };

  // Helper function to format Drain Holes preference display
  const formatDrainHolesPreference = (): string => {
    if (!preferences.pref_drain_holes_required) {
      return 'No';
    }
    return 'Yes (Default size)';
  };

  // Helper function to format Pattern preference display
  const formatPatternPreference = (): string => {
    if (!preferences.pref_pattern_required) {
      return 'No';
    }
    const patternType = preferences.pref_pattern_type || 'Default Paper';
    return `Yes (${patternType})`;
  };

  // Helper function to format Discount preference display
  const formatDiscountPreference = (): string => {
    if (!discount || discount <= 0) {
      return 'None';
    }
    return `${formatNumber(discount)}%`;
  };

  // Helper function to format Shipping preference display
  const formatShippingPreference = (): string => {
    if (!preferences.pref_shipping_required) {
      return 'No';
    }
    if (preferences.pref_shipping_flat) {
      return `Yes (Flat: $${formatNumber(preferences.pref_shipping_flat)})`;
    }
    if (preferences.pref_shipping_multiplier) {
      return `Yes (${formatNumber(preferences.pref_shipping_multiplier)}x)`;
    }
    return 'Yes';
  };

  // Helper function to format Turnaround preference display
  const formatTurnaroundPreference = (): string => {
    if (!defaultTurnaround) {
      return 'Standard';
    }
    return `${defaultTurnaround} business days`;
  };

  // Preference row component
  interface PreferenceRowProps {
    label: string;
    value: string;
    validationError?: boolean;
    validationSeverity?: 'red' | 'yellow';
    validationMessage?: string;
  }

  const PreferenceRow: React.FC<PreferenceRowProps> = ({
    label,
    value,
    validationError = false,
    validationSeverity = 'red',
    validationMessage
  }) => {
    const rowClasses = validationError
      ? validationSeverity === 'red'
        ? 'bg-red-50 border border-red-300 pl-0 pr-2 py-0.5 rounded'
        : 'bg-yellow-50 border border-yellow-300 pl-0 pr-2 py-0.5 rounded'
      : 'pl-0 pr-2 py-0.5';

    return (
      <div className={rowClasses}>
        <div className="flex items-start text-xs gap-3">
          <div className="flex items-center gap-1.5 justify-end w-24 flex-shrink-0">
            {validationError && (
              <AlertTriangle
                className={`w-3.5 h-3.5 flex-shrink-0 ${
                  validationSeverity === 'red' ? 'text-red-600' : 'text-yellow-600'
                }`}
              />
            )}
            <span className={`font-bold ${highStandards ? 'text-amber-900' : PAGE_STYLES.panel.text} whitespace-nowrap text-right`}>{label}:</span>
          </div>
          <span className={`${highStandards ? 'text-amber-800' : PAGE_STYLES.panel.textMuted} flex-1 text-left`}>{value}</span>
        </div>
        {validationError && validationMessage && (
          <div
            className={`text-[10px] mt-0.5 ml-[6.5rem] ${
              validationSeverity === 'red' ? 'text-red-700' : 'text-yellow-700'
            }`}
          >
            {validationMessage}
          </div>
        )}
      </div>
    );
  };

  const panelContainerClass = highStandards
    ? 'bg-gradient-to-br from-amber-100 via-yellow-50 to-amber-100 rounded-lg shadow border border-amber-400 relative overflow-hidden mb-4 w-full'
    : `${PAGE_STYLES.composites.panelContainer} mb-4 w-full`;

  const headerClass = highStandards
    ? `flex items-center justify-between p-2 border-b border-amber-400 bg-gradient-to-r from-amber-300 to-yellow-300`
    : `flex items-center justify-between p-2 border-b ${PAGE_STYLES.border}`;

  return (
    <div className={panelContainerClass}>
      {highStandards && <div className="gold-shimmer" />}
      {/* Header */}
      <div className={headerClass}>
        <div className="flex items-center gap-2">
          {highStandards ? (
            <Star className="w-4 h-4 fill-amber-500 text-amber-500" />
          ) : (
            <FileText className={`w-4 h-4 ${PAGE_STYLES.panel.textMuted}`} />
          )}
          <h3 className={`text-base font-medium ${highStandards ? 'text-amber-900' : PAGE_STYLES.panel.text}`}>Customer Preferences</h3>
          {highStandards && (
            <span className="bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded ml-1">HIGH STANDARDS</span>
          )}
        </div>
        <button
          onClick={onEditCustomer}
          className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${
            highStandards
              ? 'bg-amber-200 text-amber-900 hover:bg-amber-300'
              : `${PAGE_STYLES.header.background} ${PAGE_STYLES.header.text} ${PAGE_STYLES.interactive.hoverOnHeader} hover:${PAGE_STYLES.page.text}`
          }`}
        >
          <Edit2 className="w-3.5 h-3.5" />
          Edit Customer
        </button>
      </div>

      {/* Content - 2 Column Layout */}
      <div className="p-3">
        <div className={`grid grid-cols-[45%_55%] gap-6 divide-x ${highStandards ? 'divide-amber-300' : PAGE_STYLES.divider}`}>
          {/* Left Column - Items with Validation */}
          <div className="space-y-0.5 pr-1">
            {/* LEDs */}
            <PreferenceRow label="LEDs" value={formatLEDPreference()} />

            {/* Power Supplies */}
            <PreferenceRow label="Power Supplies" value={formatPowerSupplyPreference()} />

            {/* UL */}
            <PreferenceRow
              label="UL"
              value={formatULPreference()}
              validationError={validationResult?.ul.hasError}
              validationSeverity={validationResult?.ul.severity}
              validationMessage={validationResult?.ul.message}
            />

            {/* Wire Length */}
            <PreferenceRow
              label="Wire Length"
              value={formatWireLengthPreference()}
              validationError={validationResult?.wireLength.hasError}
              validationSeverity={validationResult?.wireLength.severity}
              validationMessage={validationResult?.wireLength.message}
            />

            {/* Plug N Play */}
            <PreferenceRow
              label="Plug N Play"
              value={formatPlugNPlayPreference()}
              validationError={validationResult?.plugNPlay.hasError}
              validationSeverity={validationResult?.plugNPlay.severity}
              validationMessage={validationResult?.plugNPlay.message}
            />

            {/* Discount */}
            <PreferenceRow
              label="Discount"
              value={formatDiscountPreference()}
              validationError={validationResult?.discount.hasError}
              validationSeverity={validationResult?.discount.severity}
              validationMessage={validationResult?.discount.message}
            />

            {/* Shipping */}
            <PreferenceRow
              label="Shipping"
              value={formatShippingPreference()}
              validationError={validationResult?.shipping.hasError}
              validationSeverity={validationResult?.shipping.severity}
              validationMessage={validationResult?.shipping.message}
            />
          </div>

          {/* Right Column - Items without Validation */}
          <div className="space-y-0.5 pl-8">
            {/* Drain Holes */}
            <PreferenceRow label="Drain Holes" value={formatDrainHolesPreference()} />

            {/* Pattern */}
            <PreferenceRow label="Pattern" value={formatPatternPreference()} />

            {/* Cash Customer */}
            <PreferenceRow label="Cash" value={cashCustomer ? 'Yes' : 'No'} />

            {/* Turnaround */}
            <PreferenceRow label="Turnaround" value={formatTurnaroundPreference()} />

            {/* Postal Code */}
            <PreferenceRow label="Postal Code" value={postalCode || 'Not set'} />

            {/* Special Instructions */}
            <PreferenceRow
              label="Special Instructions"
              value={preferences.pref_special_instructions || 'None'}
            />

            {/* Internal Comments */}
            <PreferenceRow
              label="Internal Comments"
              value={preferences.pref_manufacturing_comments || 'None'}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
