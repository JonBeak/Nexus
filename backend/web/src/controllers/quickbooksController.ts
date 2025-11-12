/**
 * QuickBooks Controller
 * HTTP Request Handlers for QuickBooks Integration
 *
 * Responsibilities:
 * - Extract request parameters
 * - Validate input format
 * - Call service methods
 * - Format HTTP responses
 * - Handle errors and status codes
 */

import { Request, Response } from 'express';
import { AuthRequest } from '../types';
import { quickbooksService } from '../services/quickbooksService';
import { getDefaultRealmId } from '../utils/quickbooks/dbManager';

/**
 * QuickBooks Controller Class
 * Pure HTTP layer - NO business logic, NO database access
 */
export class QuickBooksController {

  // =============================================
  // OAUTH FLOW ENDPOINTS
  // =============================================

  /**
   * GET /api/quickbooks/config-status
   * Check if QuickBooks credentials are configured
   */
  async checkConfigStatus(req: Request, res: Response): Promise<void> {
    try {
      const status = await quickbooksService.checkConfigStatus();

      res.json(status);
    } catch (error) {
      console.error('❌ Error checking config status:', error);
      res.status(500).json({
        configured: false,
        errors: ['Failed to check configuration'],
        environment: process.env.QB_ENVIRONMENT || 'sandbox',
      });
    }
  }

  /**
   * GET /api/quickbooks/start-auth
   * Initiate OAuth flow - redirects to QuickBooks authorization page
   */
  async startAuth(req: Request, res: Response): Promise<void> {
    try {
      const { authUrl, state } = await quickbooksService.initiateOAuth();

      console.log(`🔗 Redirecting to QuickBooks authorization with state: ${state.substring(0, 8)}...`);

      res.redirect(authUrl);
    } catch (error) {
      console.error('❌ Error starting OAuth flow:', error);

      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to start QuickBooks authorization',
      });
    }
  }

  /**
   * GET /api/quickbooks/callback
   * OAuth callback - exchanges code for tokens
   */
  async handleCallback(req: Request, res: Response): Promise<void> {
    const { code, realmId, state, error } = req.query;

    // Handle authorization errors from QuickBooks
    if (error) {
      console.error('❌ OAuth callback error:', error);
      res.send(this.renderErrorPage(
        'Authorization Failed',
        `Error: ${error}`,
        'You can close this window and try again.'
      ));
      return;
    }

    // Validate required parameters
    if (!code || !realmId || !state) {
      console.error('❌ Missing code, realmId, or state in callback');
      res.send(this.renderErrorPage(
        'Authorization Error',
        'Missing required authorization parameters.',
        'You can close this window and try again.'
      ));
      return;
    }

    try {
      // Process callback (validates CSRF, exchanges code, stores tokens)
      await quickbooksService.processCallback(
        code as string,
        realmId as string,
        state as string
      );

      console.log(`✅ QuickBooks connected successfully for Realm ID: ${realmId}`);

      // Success page with auto-close
      res.send(this.renderSuccessPage());
    } catch (error) {
      console.error('❌ Error processing OAuth callback:', error);

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // CSRF validation error
      if (errorMessage.includes('Invalid or expired state token')) {
        res.send(this.renderCsrfErrorPage());
        return;
      }

      // Generic error page
      res.send(this.renderErrorPage(
        'Connection Error',
        'Failed to connect to QuickBooks',
        errorMessage
      ));
    }
  }

  /**
   * POST /api/quickbooks/disconnect
   * Disconnect from QuickBooks (delete tokens)
   */
  async disconnect(req: Request, res: Response): Promise<void> {
    try {
      const realmId = await getDefaultRealmId();

      if (!realmId) {
        res.json({
          success: false,
          message: 'Not connected to QuickBooks',
        });
        return;
      }

      await quickbooksService.disconnect(realmId);

      res.json({
        success: true,
        message: 'Disconnected from QuickBooks',
      });
    } catch (error) {
      console.error('❌ Error disconnecting from QB:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to disconnect from QuickBooks',
      });
    }
  }

  // =============================================
  // CONNECTION & DATA ENDPOINTS
  // =============================================

  /**
   * GET /api/quickbooks/status
   * Check connection status
   */
  async getStatus(req: Request, res: Response): Promise<void> {
    try {
      const realmId = await getDefaultRealmId();
      const status = await quickbooksService.checkConnectionStatus(realmId);

      res.json(status);
    } catch (error) {
      console.error('❌ Error checking QB status:', error);
      res.status(500).json({
        connected: false,
        error: 'Failed to check connection status',
      });
    }
  }

  /**
   * GET /api/quickbooks/items
   * Fetch all QuickBooks items from database
   * Used for dropdown population in Custom product forms
   */
  async getItems(req: Request, res: Response): Promise<void> {
    try {
      const items = await quickbooksService.getQuickBooksItems();

      res.json({
        success: true,
        items,
      });
    } catch (error) {
      console.error('❌ Error fetching QB items:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch QuickBooks items',
      });
    }
  }

  /**
   * POST /api/quickbooks/create-estimate
   * Create estimate in QuickBooks from Nexus estimate data
   * IMPORTANT: Only works with DRAFT estimates - finalizes them after successful creation
   */
  async createEstimate(req: Request, res: Response): Promise<void> {
    try {
      const { estimateId, estimatePreviewData, debugMode = false } = req.body;
      const user = (req as AuthRequest).user;

      // Validate required fields
      if (!estimateId || !estimatePreviewData) {
        res.status(400).json({
          success: false,
          error: 'Missing estimateId or estimatePreviewData',
        });
        return;
      }

      // OWNER-ONLY: Debug mode access control
      if (debugMode && user?.role !== 'owner') {
        res.status(403).json({
          success: false,
          error: 'Debug mode is only available to system owners',
        });
        return;
      }

      if (debugMode) {
        console.log('\n🔬 DEBUG MODE ENABLED - Will fetch estimate back for comparison\n');
      }

      // Create estimate in QuickBooks
      const result = await quickbooksService.createEstimateInQuickBooks(
        estimateId,
        estimatePreviewData,
        user?.user_id || 0,
        debugMode
      );

      res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      console.error('❌ Error creating QB estimate:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create estimate',
      });
    }
  }

  // =============================================
  // DEBUG/TEST ENDPOINTS
  // =============================================

  /**
   * GET /api/quickbooks/test-logging
   * Test endpoint to verify logging is working
   */
  testLogging(req: Request, res: Response): void {
    const result = quickbooksService.testLogging();
    res.json(result);
  }

  /**
   * GET /api/quickbooks/estimate/:id
   * Fetch an estimate from QuickBooks for analysis
   */
  async getEstimate(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          success: false,
          error: 'Estimate ID is required',
        });
        return;
      }

      const realmId = await getDefaultRealmId();
      if (!realmId) {
        res.status(400).json({
          success: false,
          error: 'Not connected to QuickBooks',
        });
        return;
      }

      const estimate = await quickbooksService.fetchEstimateForAnalysis(id, realmId);

      res.json({
        success: true,
        estimate,
      });
    } catch (error) {
      console.error('❌ Error fetching QB estimate:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch estimate',
      });
    }
  }

  // =============================================
  // HTML TEMPLATES FOR OAUTH CALLBACK
  // =============================================

  /**
   * Render success page (auto-closes after 2 seconds)
   * PRIVATE: Used by handleCallback
   */
  private renderSuccessPage(): string {
    return `
      <html>
        <head>
          <title>QuickBooks Connected</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              max-width: 500px;
              margin: 80px auto;
              text-align: center;
              padding: 40px;
              background: #f5f5f5;
            }
            .success {
              color: #2e7d32;
              font-size: 64px;
              margin-bottom: 20px;
              animation: fadeIn 0.3s ease-in;
            }
            h1 {
              color: #333;
              font-size: 24px;
              margin: 10px 0;
            }
            .message {
              font-size: 16px;
              color: #666;
              margin: 20px 0;
            }
            @keyframes fadeIn {
              from { opacity: 0; transform: scale(0.8); }
              to { opacity: 1; transform: scale(1); }
            }
          </style>
        </head>
        <body>
          <div class="success">✅</div>
          <h1>QuickBooks Connected!</h1>
          <p class="message">This window will close in <span id="countdown">2</span> seconds...</p>
          <script>
            let count = 2;
            const countdownEl = document.getElementById('countdown');

            // Update countdown every second
            const interval = setInterval(() => {
              count--;
              if (countdownEl) {
                countdownEl.textContent = count;
              }
              if (count <= 0) {
                clearInterval(interval);
              }
            }, 1000);

            // Close after 2 seconds
            setTimeout(() => {
              try {
                window.close();
              } catch (e) {
                // If can't close, show manual close message
                document.body.innerHTML = '<div style="font-family: Arial; text-align: center; padding: 80px 20px;"><div style="font-size: 64px; color: #2e7d32; margin-bottom: 20px;">✅</div><h1 style="font-size: 24px; color: #333;">QuickBooks Connected!</h1><p style="color: #666; margin-top: 20px;">Please close this window.</p></div>';
              }
            }, 2000);
          </script>
        </body>
      </html>
    `;
  }

  /**
   * Render CSRF error page
   * PRIVATE: Used by handleCallback
   */
  private renderCsrfErrorPage(): string {
    return `
      <html>
        <head><title>QuickBooks Authorization Error</title></head>
        <body style="font-family: Arial; max-width: 600px; margin: 50px auto; text-align: center;">
          <h1 style="color: #d32f2f;">🔒 Security Validation Failed</h1>
          <p>The authorization request could not be validated.</p>
          <p style="color: #666;">This may be due to:</p>
          <ul style="text-align: left; color: #666;">
            <li>The authorization link expired (valid for 10 minutes)</li>
            <li>The authorization link was already used</li>
            <li>A potential security issue</li>
          </ul>
          <p style="color: #666;">Please close this window and start the authorization process again.</p>
        </body>
      </html>
    `;
  }

  /**
   * Render generic error page
   * PRIVATE: Used by handleCallback
   */
  private renderErrorPage(title: string, message: string, detail: string): string {
    return `
      <html>
        <head><title>QuickBooks ${title}</title></head>
        <body style="font-family: Arial; max-width: 600px; margin: 50px auto; text-align: center;">
          <h1 style="color: #d32f2f;">❌ ${title}</h1>
          <p>${message}</p>
          <p style="color: #666; font-size: 14px;">${detail}</p>
          <p style="color: #666;">You can close this window and try again.</p>
        </body>
      </html>
    `;
  }
}

// Export singleton instance
export const quickbooksController = new QuickBooksController();
