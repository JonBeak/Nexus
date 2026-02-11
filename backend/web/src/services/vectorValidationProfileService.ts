/**
 * Vector Validation Profile Service
 * Business logic for managing vector validation profiles
 */

import { vectorValidationProfileRepository, VectorValidationProfile } from '../repositories/vectorValidationProfileRepository';
import { ServiceResult } from '../types/serviceResults';

class VectorValidationProfileService {
  /**
   * Get all profiles (for settings UI)
   */
  async getAllProfiles(): Promise<ServiceResult<VectorValidationProfile[]>> {
    try {
      const profiles = await vectorValidationProfileRepository.getAll();
      return { success: true, data: profiles };
    } catch (error) {
      console.error('[VectorValidationProfileService] Error getting profiles:', error);
      return { success: false, error: 'Failed to load vector validation profiles', code: 'INTERNAL_ERROR' };
    }
  }

  /**
   * Get a single profile by ID
   */
  async getProfile(profileId: number): Promise<ServiceResult<VectorValidationProfile>> {
    try {
      const profile = await vectorValidationProfileRepository.getById(profileId);
      if (!profile) {
        return { success: false, error: 'Profile not found', code: 'NOT_FOUND' };
      }
      return { success: true, data: profile };
    } catch (error) {
      console.error('[VectorValidationProfileService] Error getting profile:', error);
      return { success: false, error: 'Failed to load profile', code: 'INTERNAL_ERROR' };
    }
  }

  /**
   * Update a profile's parameters (and optionally description/is_active)
   */
  async updateProfile(
    profileId: number,
    data: {
      parameters?: Record<string, any>;
      description?: string | null;
      is_active?: boolean;
    },
    userId: number
  ): Promise<ServiceResult<VectorValidationProfile>> {
    try {
      const existing = await vectorValidationProfileRepository.getById(profileId);
      if (!existing) {
        return { success: false, error: 'Profile not found', code: 'NOT_FOUND' };
      }

      await vectorValidationProfileRepository.updateProfile(profileId, {
        ...data,
        updated_by: userId,
      });

      const updated = await vectorValidationProfileRepository.getById(profileId);
      if (!updated) {
        return { success: false, error: 'Failed to retrieve updated profile', code: 'INTERNAL_ERROR' };
      }

      console.log(`[VectorValidationProfileService] Profile ${existing.spec_type_key} updated by user ${userId}`);
      return { success: true, data: updated };
    } catch (error) {
      console.error('[VectorValidationProfileService] Error updating profile:', error);
      return { success: false, error: 'Failed to update profile', code: 'INTERNAL_ERROR' };
    }
  }

  /**
   * Get all active profiles keyed by spec_type_key (for validation engine)
   */
  async getActiveProfileMap(): Promise<Map<string, VectorValidationProfile>> {
    const profiles = await vectorValidationProfileRepository.getActive();
    const map = new Map<string, VectorValidationProfile>();
    for (const p of profiles) {
      map.set(p.spec_type_key, p);
    }
    return map;
  }
}

export const vectorValidationProfileService = new VectorValidationProfileService();
