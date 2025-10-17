import { query } from '../../config/database';

export class LookupService {
  static async getLedTypes() {
    const ledTypes = await query(
      'SELECT led_id, product_code, price, watts, colour, brand, is_default FROM leds WHERE is_active = 1 ORDER BY is_default DESC, product_code',
      []
    );
    return ledTypes;
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
}