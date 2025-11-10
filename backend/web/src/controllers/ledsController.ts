import { Request, Response } from 'express';
import { pool } from '../config/database';
import { RowDataPacket } from 'mysql2';

/**
 * Get all active LED types
 * Used for specification dropdowns in order parts
 */
export const getActiveLEDs = async (req: Request, res: Response) => {
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT
        led_id,
        product_code,
        colour,
        watts,
        volts,
        brand,
        model,
        is_default
      FROM leds
      WHERE is_active = 1
      ORDER BY is_default DESC, brand ASC, product_code ASC`
    );

    res.json({
      success: true,
      leds: rows
    });
  } catch (error) {
    console.error('Error fetching active LEDs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch LED types'
    });
  }
};
