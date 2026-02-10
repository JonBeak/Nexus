/**
 * Feedback Repository
 * Data access layer for feedback system tables
 *
 * Created: 2026-01-16
 * Purpose: Handle database operations for feedback_requests and feedback_responses
 */

import { query } from '../config/database';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import {
  FeedbackRequest,
  FeedbackResponse,
  FeedbackFilters,
  FeedbackStatus,
  FeedbackPriority,
  CreateFeedbackData
} from '../types/feedback';

export class FeedbackRepository {
  // ==========================================================================
  // Feedback CRUD Operations
  // ==========================================================================

  /**
   * Create a new feedback request
   */
  async createFeedback(
    data: CreateFeedbackData,
    userId: number,
    userAgent?: string,
    screenshotDriveId?: string
  ): Promise<number> {
    const result = await query(
      `INSERT INTO feedback_requests
       (submitted_by, title, description, screenshot_drive_id, screenshot_filename, screenshot_mime_type, page_url, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        data.title,
        data.description,
        screenshotDriveId || null,
        data.screenshot_filename || null,
        data.screenshot_mime_type || null,
        data.page_url || null,
        userAgent || null
      ]
    ) as ResultSetHeader;
    return result.insertId;
  }

  /**
   * Get a single feedback request by ID with submitter info
   */
  async getFeedbackById(feedbackId: number): Promise<FeedbackRequest | null> {
    const rows = await query(
      `SELECT fr.*,
              u.first_name as submitter_first_name,
              u.last_name as submitter_last_name
       FROM feedback_requests fr
       LEFT JOIN users u ON fr.submitted_by = u.user_id
       WHERE fr.feedback_id = ?`,
      [feedbackId]
    ) as RowDataPacket[];
    return rows[0] as FeedbackRequest || null;
  }

  /**
   * Get paginated list of feedback requests (excludes screenshot_data for performance)
   */
  async getFeedbackList(filters: FeedbackFilters): Promise<{ items: FeedbackRequest[]; total: number }> {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filters.status) {
      conditions.push('fr.status = ?');
      params.push(filters.status);
    }
    if (filters.priority) {
      conditions.push('fr.priority = ?');
      params.push(filters.priority);
    }
    if (filters.submittedBy) {
      conditions.push('fr.submitted_by = ?');
      params.push(filters.submittedBy);
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) as total FROM feedback_requests fr ${whereClause}`,
      params
    ) as RowDataPacket[];
    const total = countResult[0]?.total || 0;

    // Get items
    const limit = filters.limit || 20;
    const offset = filters.offset || 0;

    // Note: LIMIT/OFFSET embedded directly as mysql2 prepared statements can have issues with them
    const items = await query(
      `SELECT fr.feedback_id, fr.submitted_by, fr.title, fr.description, fr.status, fr.priority,
              fr.screenshot_drive_id, fr.screenshot_filename, fr.screenshot_mime_type, fr.page_url,
              fr.created_at, fr.updated_at, fr.resolved_at, fr.closed_at,
              fr.github_issue_number, fr.github_pr_number, fr.github_pr_url, fr.github_branch, fr.pipeline_status,
              fr.slack_thread_ts, fr.slack_last_polled_at, fr.last_github_comment_id,
              u.first_name as submitter_first_name, u.last_name as submitter_last_name
       FROM feedback_requests fr
       LEFT JOIN users u ON fr.submitted_by = u.user_id
       ${whereClause}
       ORDER BY fr.created_at DESC
       LIMIT ${Number(limit)} OFFSET ${Number(offset)}`,
      params
    ) as FeedbackRequest[];

    return { items, total };
  }

  /**
   * Update feedback status
   */
  async updateStatus(feedbackId: number, status: FeedbackStatus): Promise<void> {
    let timestampUpdate = '';
    if (status === 'resolved') {
      timestampUpdate = ', resolved_at = NOW()';
    } else if (status === 'closed') {
      timestampUpdate = ', closed_at = NOW()';
    }

    await query(
      `UPDATE feedback_requests SET status = ?${timestampUpdate} WHERE feedback_id = ?`,
      [status, feedbackId]
    );
  }

  /**
   * Update feedback priority
   */
  async updatePriority(feedbackId: number, priority: FeedbackPriority): Promise<void> {
    await query(
      'UPDATE feedback_requests SET priority = ? WHERE feedback_id = ?',
      [priority, feedbackId]
    );
  }

  // ==========================================================================
  // Feedback Responses
  // ==========================================================================

  /**
   * Add a response to a feedback request
   */
  async addResponse(
    feedbackId: number,
    userId: number,
    message: string,
    isInternal: boolean,
    isClaudeMessage: boolean = false
  ): Promise<number> {
    const result = await query(
      `INSERT INTO feedback_responses (feedback_id, responded_by, message, is_internal, is_claude_message)
       VALUES (?, ?, ?, ?, ?)`,
      [feedbackId, userId, message, isInternal, isClaudeMessage]
    ) as ResultSetHeader;
    return result.insertId;
  }

  /**
   * Get all responses for a feedback request
   * @param includeInternal - If false, excludes internal notes (for non-managers)
   */
  async getResponses(feedbackId: number, includeInternal: boolean): Promise<FeedbackResponse[]> {
    const internalClause = includeInternal ? '' : 'AND fr.is_internal = FALSE';
    return await query(
      `SELECT fr.*,
              u.first_name as responder_first_name,
              u.last_name as responder_last_name
       FROM feedback_responses fr
       LEFT JOIN users u ON fr.responded_by = u.user_id
       WHERE fr.feedback_id = ? AND fr.is_claude_message = FALSE ${internalClause}
       ORDER BY fr.created_at ASC`,
      [feedbackId]
    ) as FeedbackResponse[];
  }

  /**
   * Get Claude messages for a feedback request (manager-only)
   */
  async getClaudeMessages(feedbackId: number): Promise<FeedbackResponse[]> {
    return await query(
      `SELECT fr.*,
              u.first_name as responder_first_name,
              u.last_name as responder_last_name
       FROM feedback_responses fr
       LEFT JOIN users u ON fr.responded_by = u.user_id
       WHERE fr.feedback_id = ? AND fr.is_claude_message = TRUE
       ORDER BY fr.created_at ASC`,
      [feedbackId]
    ) as FeedbackResponse[];
  }

  // ==========================================================================
  // Screenshot Management
  // ==========================================================================

  /**
   * Get screenshot Drive ID for a feedback request
   */
  async getScreenshotDriveId(feedbackId: number): Promise<string | null> {
    const rows = await query(
      'SELECT screenshot_drive_id FROM feedback_requests WHERE feedback_id = ?',
      [feedbackId]
    ) as RowDataPacket[];
    return rows[0]?.screenshot_drive_id || null;
  }

  /**
   * Update screenshot Drive ID for a feedback request
   */
  async updateScreenshotDriveId(feedbackId: number, driveId: string): Promise<void> {
    await query(
      'UPDATE feedback_requests SET screenshot_drive_id = ? WHERE feedback_id = ?',
      [driveId, feedbackId]
    );
  }

  // ==========================================================================
  // Statistics
  // ==========================================================================

  /**
   * Get count of open/in_progress feedback requests
   */
  async getOpenCount(): Promise<number> {
    const result = await query(
      "SELECT COUNT(*) as count FROM feedback_requests WHERE status IN ('open', 'in_progress')"
    ) as RowDataPacket[];
    return result[0]?.count || 0;
  }

  /**
   * Get count of open feedback for a specific user
   */
  async getOpenCountForUser(userId: number): Promise<number> {
    const result = await query(
      "SELECT COUNT(*) as count FROM feedback_requests WHERE submitted_by = ? AND status IN ('open', 'in_progress')",
      [userId]
    ) as RowDataPacket[];
    return result[0]?.count || 0;
  }
}

export const feedbackRepository = new FeedbackRepository();
