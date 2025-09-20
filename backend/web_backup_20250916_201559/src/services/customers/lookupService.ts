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
      'SELECT tax_id, province_short, province_long, tax_name, tax_percent, tax_description FROM provinces_tax WHERE province_short = ? AND is_active = 1',
      [province.toUpperCase()]
    );
    
    if (taxInfo.length === 0) {
      return null;
    }
    
    return taxInfo[0];
  }

  static async getAllProvincesTaxInfo() {
    const provincesData = await query(
      'SELECT tax_id, province_short, province_long, tax_name, tax_percent FROM provinces_tax WHERE is_active = 1 ORDER BY province_long',
      []
    );
    return provincesData;
  }

  static async getProvincesStates() {
    const provincesStates = await query(
      `SELECT province_short, province_long, 
        CASE 
          WHEN province_short IN ('ON', 'BC', 'AB', 'SK', 'MB', 'QC', 'NB', 'NS', 'PE', 'NL', 'YT', 'NT', 'NU') THEN 'Canada'
          WHEN province_short IN ('EXEMPT', 'ZERO', 'USA') THEN 'Special'
          ELSE 'USA'
        END as country_group
      FROM provinces_tax 
      WHERE is_active = 1 
      ORDER BY 
        CASE 
          WHEN province_short IN ('ON', 'BC', 'AB', 'SK', 'MB', 'QC', 'NB', 'NS', 'PE', 'NL', 'YT', 'NT', 'NU') THEN 1
          WHEN province_short IN ('EXEMPT', 'ZERO', 'USA') THEN 3
          ELSE 2
        END,
        province_long`,
      []
    );
    return provincesStates;
  }
}