/**
 * Vacation Controller
 * HTTP request/response handling for vacation period operations
 *
 * Created: Nov 13, 2025
 * Part of accounts route refactoring - Phase 2
 */

import { Request, Response } from 'express';
import { vacationService, CreateVacationData } from '../services/vacationService';

export class VacationController {
  /**
   * Get all vacation periods
   */
  async getAllVacations(req: Request, res: Response): Promise<void> {
    try {
      const vacations = await vacationService.getVacations();
      res.json(vacations);
    } catch (error) {
      console.error('Error in getAllVacations controller:', error);
      res.status(500).json({
        error: 'Failed to fetch vacation periods',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get vacation periods for a specific user
   * Route param: userId
   */
  async getUserVacations(req: Request, res: Response): Promise<void> {
    try {
      const userId = parseInt(req.params.userId);

      if (isNaN(userId)) {
        res.status(400).json({ error: 'Invalid user ID' });
        return;
      }

      const vacations = await vacationService.getUserVacations(userId);
      res.json(vacations);
    } catch (error) {
      console.error('Error in getUserVacations controller:', error);
      res.status(500).json({
        error: 'Failed to fetch user vacation periods',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Create a new vacation period
   * Body: CreateVacationData
   */
  async createVacation(req: Request, res: Response): Promise<void> {
    try {
      const authUser = (req as any).user;

      if (!authUser) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const vacationData: CreateVacationData = {
        user_id: req.body.user_id,
        start_date: req.body.start_date,
        end_date: req.body.end_date,
        description: req.body.description
      };

      // Create vacation via service (all business logic handled there)
      const vacationId = await vacationService.createVacation(vacationData, authUser.user_id);

      res.json({
        message: 'Vacation period created successfully',
        vacation_id: vacationId
      });
    } catch (error) {
      console.error('Error in createVacation controller:', error);

      // Handle specific error cases
      if (error instanceof Error) {
        if (error.message.includes('Missing required fields')) {
          res.status(400).json({ error: error.message });
          return;
        }
        if (error.message.includes('Start date must be')) {
          res.status(400).json({ error: error.message });
          return;
        }
      }

      res.status(500).json({
        error: 'Failed to create vacation period',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Delete a vacation period
   * Route param: vacationId
   */
  async deleteVacation(req: Request, res: Response): Promise<void> {
    try {
      const authUser = (req as any).user;

      if (!authUser) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const vacationId = parseInt(req.params.vacationId);

      if (isNaN(vacationId)) {
        res.status(400).json({ error: 'Invalid vacation ID' });
        return;
      }

      // Delete vacation via service (all business logic handled there)
      await vacationService.deleteVacation(vacationId, authUser.user_id);

      res.json({ message: 'Vacation period deleted successfully' });
    } catch (error) {
      console.error('Error in deleteVacation controller:', error);

      // Handle specific error cases
      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          res.status(404).json({ error: error.message });
          return;
        }
      }

      res.status(500).json({
        error: 'Failed to delete vacation period',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}

// Export singleton instance
export const vacationController = new VacationController();
