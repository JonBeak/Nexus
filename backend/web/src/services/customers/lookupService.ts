// File Clean up Finished: Nov 14, 2025 (migrated getLedTypes to use LEDService, eliminating SQL duplication)
import { query } from '../../config/database';
import { LEDService } from '../ledService';

const ledService = new LEDService();

export class LookupService {
  /**
   * Get LED types for customer preferences
   * Uses LEDService to maintain consistency across the application
   */
  static async getLedTypes() {
    return await ledService.getActiveLEDs();
  }

  static async getPowerSupplyTypes() {
    const powerSupplyTypes = await query(
      'SELECT power_supply_id, transformer_type, price, watts, volts, ul_listed, is_default_non_ul, is_default_ul FROM power_supplies WHERE is_active = 1 ORDER BY is_default_non_ul DESC, is_default_ul DESC, transformer_type',
      []
    );
    return powerSupplyTypes;
  }

  static async getTaxInfoByProvince(province: string) {
    const taxInfo = await query(
      `SELECT
        pt.tax_id,
        pt.province_short,
        pt.province_long,
        pt.tax_name,
        COALESCE(tr.tax_percent, 1.0) as tax_percent
      FROM provinces_tax pt
      LEFT JOIN tax_rules tr ON pt.tax_name = tr.tax_name AND tr.is_active = 1
      WHERE pt.province_short = ? AND pt.is_active = 1`,
      [province.toUpperCase()]
    );

    if (taxInfo.length === 0) {
      return null;
    }

    return taxInfo[0];
  }

  static async getAllProvincesTaxInfo() {
    const provincesData = await query(
      `SELECT
        pt.tax_id,
        pt.province_short,
        pt.province_long,
        pt.tax_name,
        COALESCE(tr.tax_percent, 1.0) as tax_percent
      FROM provinces_tax pt
      LEFT JOIN tax_rules tr ON pt.tax_name = tr.tax_name AND tr.is_active = 1
      WHERE pt.is_active = 1
      ORDER BY pt.province_long`,
      []
    );
    return provincesData;
  }

  static async getProvincesStates() {
    const provincesStates = await query(
      `SELECT
        province_short,
        province_long,
        country as country_group
      FROM provinces_tax
      WHERE is_active = 1
      ORDER BY
        CASE
          WHEN country = 'Canada' THEN 1
          WHEN country = 'United States' THEN 2
          ELSE 3
        END,
        province_long`,
      []
    );
    return provincesStates;
  }

  static async getAllTaxRules() {
    const taxRules = await query(
      `SELECT
        tax_rule_id,
        tax_name,
        tax_percent,
        is_active
      FROM tax_rules
      WHERE is_active = 1
      ORDER BY tax_name`,
      []
    );
    return taxRules;
  }
}