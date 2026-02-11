/**
 * Vector Validation Profile Repository
 * Data access for vector_validation_profiles table
 */

import { query } from '../config/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export interface VectorValidationProfile {
  profile_id: number;
  spec_type_key: string;
  display_name: string;
  description: string | null;
  parameters: Record<string, any>;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  updated_by: number | null;
}

class VectorValidationProfileRepository {
  /**
   * Get all profiles (active and inactive)
   */
  async getAll(): Promise<VectorValidationProfile[]> {
    const rows = await query(
      'SELECT * FROM vector_validation_profiles ORDER BY profile_id ASC'
    ) as RowDataPacket[];
    return rows.map(r => this.parseRow(r));
  }

  /**
   * Get all active profiles
   */
  async getActive(): Promise<VectorValidationProfile[]> {
    const rows = await query(
      'SELECT * FROM vector_validation_profiles WHERE is_active = TRUE ORDER BY profile_id ASC'
    ) as RowDataPacket[];
    return rows.map(r => this.parseRow(r));
  }

  /**
   * Get a single profile by ID
   */
  async getById(profileId: number): Promise<VectorValidationProfile | null> {
    const rows = await query(
      'SELECT * FROM vector_validation_profiles WHERE profile_id = ?',
      [profileId]
    ) as RowDataPacket[];
    if (rows.length === 0) return null;
    return this.parseRow(rows[0]);
  }

  /**
   * Get a profile by spec_type_key
   */
  async getBySpecTypeKey(specTypeKey: string): Promise<VectorValidationProfile | null> {
    const rows = await query(
      'SELECT * FROM vector_validation_profiles WHERE spec_type_key = ?',
      [specTypeKey]
    ) as RowDataPacket[];
    if (rows.length === 0) return null;
    return this.parseRow(rows[0]);
  }

  /**
   * Update profile parameters and metadata
   */
  async updateProfile(
    profileId: number,
    data: {
      parameters?: Record<string, any>;
      description?: string | null;
      is_active?: boolean;
      updated_by?: number;
    }
  ): Promise<void> {
    const updates: string[] = [];
    const params: any[] = [];

    if (data.parameters !== undefined) {
      updates.push('parameters = ?');
      params.push(JSON.stringify(data.parameters));
    }
    if (data.description !== undefined) {
      updates.push('description = ?');
      params.push(data.description);
    }
    if (data.is_active !== undefined) {
      updates.push('is_active = ?');
      params.push(data.is_active);
    }
    if (data.updated_by !== undefined) {
      updates.push('updated_by = ?');
      params.push(data.updated_by);
    }

    if (updates.length === 0) return;

    params.push(profileId);
    await query(
      `UPDATE vector_validation_profiles SET ${updates.join(', ')} WHERE profile_id = ?`,
      params
    );
  }

  private parseRow(row: RowDataPacket): VectorValidationProfile {
    return {
      profile_id: row.profile_id,
      spec_type_key: row.spec_type_key,
      display_name: row.display_name,
      description: row.description,
      parameters: typeof row.parameters === 'string'
        ? JSON.parse(row.parameters)
        : row.parameters,
      is_active: !!row.is_active,
      created_at: row.created_at,
      updated_at: row.updated_at,
      updated_by: row.updated_by,
    };
  }
}

export const vectorValidationProfileRepository = new VectorValidationProfileRepository();
