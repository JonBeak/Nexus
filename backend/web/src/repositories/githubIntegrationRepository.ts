/**
 * GitHub Integration Repository
 * Data access layer for GitHub integration and rate limiting
 *
 * Created: 2026-02-08
 * Purpose: Track Claude requests for rate limiting, update GitHub fields on feedback_requests
 */

import { query } from '../config/database';
import { ResultSetHeader, RowDataPacket } from 'mysql2';

export class GitHubIntegrationRepository {
  // ==========================================================================
  // Rate Limit Tracking
  // ==========================================================================

  /**
   * Record a Claude request for rate limiting
   */
  async recordRequest(userId: number, feedbackId: number, requestType: 'assign' | 'comment'): Promise<number> {
    const result = await query(
      `INSERT INTO github_claude_requests (user_id, feedback_id, request_type) VALUES (?, ?, ?)`,
      [userId, feedbackId, requestType]
    ) as ResultSetHeader;
    return result.insertId;
  }

  /**
   * Count requests in the last N seconds for a user
   */
  async countRecentRequests(userId: number, windowSeconds: number): Promise<number> {
    const rows = await query(
      `SELECT COUNT(*) as count FROM github_claude_requests
       WHERE user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL ? SECOND)`,
      [userId, windowSeconds]
    ) as RowDataPacket[];
    return rows[0]?.count || 0;
  }

  // ==========================================================================
  // GitHub Fields on Feedback
  // ==========================================================================

  /**
   * Update GitHub issue number on a feedback record
   */
  async updateGitHubIssue(feedbackId: number, issueNumber: number): Promise<void> {
    await query(
      `UPDATE feedback_requests
       SET github_issue_number = ?, pipeline_status = 'claude_working'
       WHERE feedback_id = ?`,
      [issueNumber, feedbackId]
    );
  }

  /**
   * Update GitHub PR fields on a feedback record
   */
  async updateGitHubPR(feedbackId: number, prNumber: number, prUrl: string, branch: string): Promise<void> {
    await query(
      `UPDATE feedback_requests
       SET github_pr_number = ?, github_pr_url = ?, github_branch = ?, pipeline_status = 'pr_ready'
       WHERE feedback_id = ?`,
      [prNumber, prUrl, branch, feedbackId]
    );
  }

  /**
   * Update pipeline status
   */
  async updatePipelineStatus(feedbackId: number, status: string): Promise<void> {
    await query(
      `UPDATE feedback_requests SET pipeline_status = ? WHERE feedback_id = ?`,
      [status, feedbackId]
    );
  }

  /**
   * Find feedback by GitHub issue number
   */
  async findByGitHubIssue(issueNumber: number): Promise<RowDataPacket | null> {
    const rows = await query(
      `SELECT * FROM feedback_requests WHERE github_issue_number = ?`,
      [issueNumber]
    ) as RowDataPacket[];
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Get GitHub integration status for a feedback record
   */
  async getGitHubStatus(feedbackId: number): Promise<RowDataPacket | null> {
    const rows = await query(
      `SELECT feedback_id, github_issue_number, github_pr_number, github_pr_url,
              github_branch, pipeline_status
       FROM feedback_requests WHERE feedback_id = ?`,
      [feedbackId]
    ) as RowDataPacket[];
    return rows.length > 0 ? rows[0] : null;
  }
}

export const githubIntegrationRepository = new GitHubIntegrationRepository();
