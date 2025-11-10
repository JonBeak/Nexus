import { Request, Response } from 'express';
import { pool } from '../config/database';
import { RowDataPacket } from 'mysql2';

/**
 * Get all active power supply types
 * Used for specification dropdowns in order parts
 */
export const getActivePowerSupplies = async (req: Request, res: Response) => {
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT
        power_supply_id,
        transformer_type,
        watts,
        rated_watts,
        volts,
        ul_listed,
        is_default_non_ul,
        is_default_ul
      FROM power_supplies
      WHERE is_active = 1
      ORDER BY
        CASE
          WHEN is_default_ul = 1 THEN 1
          WHEN is_default_non_ul = 1 THEN 2
          ELSE 3
        END,
        transformer_type ASC`
    );

    res.json({
      success: true,
      powerSupplies: rows
    });
  } catch (error) {
    console.error('Error fetching active power supplies:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch power supply types'
    });
  }
};
