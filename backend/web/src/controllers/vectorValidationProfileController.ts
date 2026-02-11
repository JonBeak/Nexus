/**
 * Vector Validation Profile Controller
 * HTTP handlers for vector validation profile management
 */

import { Request, Response } from 'express';
import { vectorValidationProfileService } from '../services/vectorValidationProfileService';
import { parseIntParam, handleServiceResult, sendErrorResponse } from '../utils/controllerHelpers';

interface AuthenticatedRequest extends Request {
  user?: { user_id: number; role: string };
}

class VectorValidationProfileController {
  async getAll(_req: AuthenticatedRequest, res: Response): Promise<void> {
    const result = await vectorValidationProfileService.getAllProfiles();
    handleServiceResult(res, result);
  }

  async getById(req: AuthenticatedRequest, res: Response): Promise<void> {
    const profileId = parseIntParam(req.params.id, 'Profile ID');
    if (profileId === null) {
      return sendErrorResponse(res, 'Invalid profile ID', 'VALIDATION_ERROR');
    }
    const result = await vectorValidationProfileService.getProfile(profileId);
    handleServiceResult(res, result);
  }

  async update(req: AuthenticatedRequest, res: Response): Promise<void> {
    const profileId = parseIntParam(req.params.id, 'Profile ID');
    if (profileId === null) {
      return sendErrorResponse(res, 'Invalid profile ID', 'VALIDATION_ERROR');
    }

    const userId = req.user?.user_id;
    if (!userId) {
      return sendErrorResponse(res, 'User not authenticated', 'UNAUTHORIZED');
    }

    const { parameters, description, is_active } = req.body;
    const result = await vectorValidationProfileService.updateProfile(
      profileId,
      { parameters, description, is_active },
      userId
    );
    handleServiceResult(res, result);
  }
}

export const vectorValidationProfileController = new VectorValidationProfileController();
