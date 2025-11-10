import { Request, Response } from 'express';
import { pool } from '../config/database';
import { RowDataPacket } from 'mysql2';

/**
 * Get all active substrate materials
 * Used for specification dropdowns in order parts (Material template)
 */
export const getActiveSubstrates = async (req: Request, res: Response) => {
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT DISTINCT
        substrate_name
      FROM substrate_cut_pricing
      WHERE is_active = 1
      ORDER BY substrate_name ASC`
    );

    // Extract just the substrate names into a simple string array
    const substrates = rows.map(row => row.substrate_name);

    res.json({
      success: true,
      substrates
    });
  } catch (error) {
    console.error('Error fetching active substrates:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch substrate materials'
    });
  }
};
