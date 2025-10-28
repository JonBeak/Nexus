/**
 * QuickBooks OAuth and API Routes
 */

import { Router, Request, Response } from 'express';
import { RowDataPacket } from 'mysql2';
import { authenticateToken } from '../middleware/auth';
import { AuthRequest } from '../types';
import {
  getAuthorizationUrl,
  exchangeCodeForTokens,
  validateConfig,
  OAuthError,
} from '../utils/quickbooks/oauthClient';
import {
  storeTokens,
  getActiveTokens,
  getDefaultRealmId,
  setDefaultRealmId,
  storeOAuthState,
  validateAndConsumeOAuthState,
} from '../utils/quickbooks/dbManager';

const router = Router();

// =============================================
// OAUTH FLOW ROUTES
// =============================================

/**
 * GET /api/quickbooks/config-status
 * Check if QuickBooks credentials are configured
 */
router.get('/config-status', authenticateToken, (req: Request, res: Response) => {
  const validation = validateConfig();

  res.json({
    configured: validation.valid,
    errors: validation.errors,
    environment: process.env.QB_ENVIRONMENT || 'sandbox',
  });
});

/**
 * Custom auth middleware that accepts token from query parameter
 * (needed for window.open() OAuth flow)
 */
const authenticateTokenFromQuery = async (req: Request, res: Response, next: Function) => {
  // Check query parameter first (for OAuth popup), then fall back to header
  const token = (req.query.token as string) ||
                (req.headers['authorization'] && (req.headers['authorization'] as string).split(' ')[1]);

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET!);

    // Simple validation - just check token is valid
    // We don't need full user lookup for OAuth redirect
    (req as AuthRequest).user = { userId: decoded.userId } as any;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

/**
 * GET /api/quickbooks/start-auth
 * Initiate OAuth flow - redirects to QuickBooks authorization page
 */
router.get('/start-auth', authenticateTokenFromQuery, async (req: Request, res: Response) => {
  try {
    const { authUrl, state } = getAuthorizationUrl();

    // Store state token for CSRF validation (expires in 10 minutes)
    await storeOAuthState(state, 600);
    console.log(`🔗 Redirecting to QuickBooks authorization with state: ${state.substring(0, 8)}...`);

    res.redirect(authUrl);
  } catch (error) {
    console.error('❌ Error starting OAuth flow:', error);

    if (error instanceof OAuthError) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to start QuickBooks authorization',
    });
  }
});

/**
 * GET /api/quickbooks/callback
 * OAuth callback - exchanges code for tokens
 */
router.get('/callback', async (req: Request, res: Response) => {
  const { code, realmId, state, error } = req.query;

  // Handle authorization errors
  if (error) {
    console.error('❌ OAuth callback error:', error);
    return res.send(`
      <html>
        <head><title>QuickBooks Authorization Failed</title></head>
        <body style="font-family: Arial; max-width: 600px; margin: 50px auto; text-align: center;">
          <h1 style="color: #d32f2f;">❌ Authorization Failed</h1>
          <p>Error: ${error}</p>
          <p style="color: #666;">You can close this window and try again.</p>
        </body>
      </html>
    `);
  }

  // Validate required parameters
  if (!code || !realmId || !state) {
    console.error('❌ Missing code, realmId, or state in callback');
    return res.send(`
      <html>
        <head><title>QuickBooks Authorization Error</title></head>
        <body style="font-family: Arial; max-width: 600px; margin: 50px auto; text-align: center;">
          <h1 style="color: #d32f2f;">❌ Authorization Error</h1>
          <p>Missing required authorization parameters.</p>
          <p style="color: #666;">You can close this window and try again.</p>
        </body>
      </html>
    `);
  }

  // CSRF Protection: Validate state token
  const isValidState = await validateAndConsumeOAuthState(state as string);
  if (!isValidState) {
    console.error('❌ Invalid or expired state token (possible CSRF attack)');
    return res.send(`
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
    `);
  }

  try {
    console.log(`🔐 Processing OAuth callback for Realm ID: ${realmId}`);

    // Exchange code for tokens
    const tokenData = await exchangeCodeForTokens(code as string);

    // Store tokens in database
    await storeTokens(realmId as string, tokenData);

    // Set as default realm if this is the first/only connection
    const currentDefault = await getDefaultRealmId();
    if (!currentDefault) {
      await setDefaultRealmId(realmId as string);
      console.log(`✅ Set Realm ID ${realmId} as default`);
    }

    console.log(`✅ QuickBooks connected successfully for Realm ID: ${realmId}`);

    // Success page
    res.send(`
      <html>
        <head>
          <title>QuickBooks Connected</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              max-width: 600px;
              margin: 50px auto;
              text-align: center;
              padding: 20px;
            }
            .success {
              color: #2e7d32;
              font-size: 48px;
              margin-bottom: 20px;
            }
            .message {
              font-size: 18px;
              color: #333;
              margin: 20px 0;
            }
            .info {
              background: #e3f2fd;
              padding: 15px;
              border-radius: 8px;
              margin: 20px 0;
              color: #0277bd;
            }
            .btn {
              display: inline-block;
              background: #2196f3;
              color: white;
              padding: 12px 24px;
              text-decoration: none;
              border-radius: 4px;
              margin-top: 20px;
            }
          </style>
        </head>
        <body>
          <div class="success">✅</div>
          <h1>QuickBooks Connected!</h1>
          <div class="message">
            Your QuickBooks account has been successfully connected to Nexus.
          </div>
          <div class="info">
            <strong>Company ID:</strong> ${realmId}
          </div>
          <p style="color: #666;">You can now close this window and return to Nexus.</p>
          <a href="${process.env.CORS_ORIGIN}/job-estimation" class="btn">Return to Job Estimation</a>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('❌ Error processing OAuth callback:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    res.send(`
      <html>
        <head><title>QuickBooks Connection Error</title></head>
        <body style="font-family: Arial; max-width: 600px; margin: 50px auto; text-align: center;">
          <h1 style="color: #d32f2f;">❌ Connection Error</h1>
          <p>Failed to connect to QuickBooks</p>
          <p style="color: #666; font-size: 14px;">${errorMessage}</p>
          <p style="color: #666;">You can close this window and try again.</p>
        </body>
      </html>
    `);
  }
});

/**
 * GET /api/quickbooks/status
 * Check connection status
 */
router.get('/status', authenticateToken, async (req: Request, res: Response) => {
  try {
    const realmId = await getDefaultRealmId();

    if (!realmId) {
      return res.json({
        connected: false,
        message: 'Not connected to QuickBooks',
      });
    }

    const tokenData = await getActiveTokens(realmId);

    if (!tokenData) {
      return res.json({
        connected: false,
        realmId,
        message: 'Token expired or invalid. Please reconnect.',
      });
    }

    res.json({
      connected: true,
      realmId,
      environment: process.env.QB_ENVIRONMENT || 'sandbox',
      tokenExpiresAt: tokenData.access_token_expires_at,
      message: 'Connected to QuickBooks',
    });
  } catch (error) {
    console.error('❌ Error checking QB status:', error);
    res.status(500).json({
      connected: false,
      error: 'Failed to check connection status',
    });
  }
});

/**
 * POST /api/quickbooks/disconnect
 * Disconnect from QuickBooks (delete tokens)
 */
router.post('/disconnect', authenticateToken, async (req: Request, res: Response) => {
  try {
    const realmId = await getDefaultRealmId();

    if (!realmId) {
      return res.json({
        success: false,
        message: 'Not connected to QuickBooks',
      });
    }

    // Delete tokens from database
    const { pool } = await import('../config/database');
    await pool.execute('DELETE FROM qb_oauth_tokens WHERE realm_id = ?', [realmId]);

    console.log(`✅ Disconnected from QuickBooks (Realm ID: ${realmId})`);

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
});

// =============================================
// ESTIMATE CREATION
// =============================================

/**
 * POST /api/quickbooks/create-estimate
 * Create estimate in QuickBooks from Nexus estimate data
 * IMPORTANT: Only works with DRAFT estimates - finalizes them after successful creation
 */
router.post('/create-estimate', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { estimateId, estimatePreviewData } = req.body;
    const user = (req as AuthRequest).user;

    if (!estimateId || !estimatePreviewData) {
      return res.status(400).json({
        success: false,
        error: 'Missing estimateId or estimatePreviewData',
      });
    }

    const realmId = await getDefaultRealmId();
    if (!realmId) {
      return res.status(400).json({
        success: false,
        error: 'Not connected to QuickBooks. Please connect first.',
      });
    }

    // Import QB API functions
    const {
      createEstimate,
      getCustomerIdByName,
      getTaxCodeIdByName,
      getItemIdByName,
      getEstimatePdfUrl,
    } = await import('../utils/quickbooks/apiClient');

    const {
      getQBCustomerIdByLocalId,
      storeCustomerMapping,
      getQBTaxCodeId,
      storeTaxCodeMapping,
      getQBItemId,
      storeItemMapping,
    } = await import('../utils/quickbooks/dbManager');

    const { pool } = await import('../config/database');

    // Get estimate details from database
    const [estimateRows] = await pool.execute<RowDataPacket[]>(
      `SELECT customer_id, is_draft, qb_estimate_id, job_id
       FROM job_estimates
       WHERE id = ?`,
      [estimateId]
    );

    if (estimateRows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Estimate not found',
      });
    }

    const { customer_id, is_draft, qb_estimate_id, job_id } = estimateRows[0];

    // Validate: Only drafts can be sent to QB
    if (!is_draft) {
      return res.status(400).json({
        success: false,
        error: 'Only draft estimates can be sent to QuickBooks. This estimate is already finalized.',
      });
    }

    // Validate: Not already sent
    if (qb_estimate_id) {
      return res.status(400).json({
        success: false,
        error: 'Estimate already sent to QuickBooks.',
        qbEstimateUrl: getEstimatePdfUrl(qb_estimate_id, realmId),
      });
    }

    // 1. RESOLVE CUSTOMER ID (with caching)
    let qbCustomerId = await getQBCustomerIdByLocalId(customer_id);

    if (!qbCustomerId) {
      console.log(`Looking up customer in QB: ${estimatePreviewData.customerName}`);
      qbCustomerId = await getCustomerIdByName(estimatePreviewData.customerName, realmId);

      if (!qbCustomerId) {
        return res.status(400).json({
          success: false,
          error: `Customer "${estimatePreviewData.customerName}" not found in QuickBooks. Please create this customer in QuickBooks first.`,
        });
      }

      await storeCustomerMapping({
        customer_id,
        qb_customer_id: qbCustomerId,
        qb_customer_name: estimatePreviewData.customerName,
      });
      console.log(`✅ Cached customer mapping: ${customer_id} → ${qbCustomerId}`);
    } else {
      console.log(`✅ Using cached customer ID: ${qbCustomerId}`);
    }

    // 2. RESOLVE TAX CODE (with caching)
    // Map tax_rate to tax_name via tax_rules table
    const [taxRuleRows] = await pool.execute<RowDataPacket[]>(
      `SELECT tax_name FROM tax_rules
       WHERE ABS(tax_percent - ?) < 0.001 AND is_active = 1
       ORDER BY tax_rule_id ASC LIMIT 1`,
      [estimatePreviewData.taxRate]
    );

    const taxName = taxRuleRows[0]?.tax_name;
    if (!taxName) {
      return res.status(400).json({
        success: false,
        error: `No active tax rule found for rate ${(estimatePreviewData.taxRate * 100).toFixed(1)}%. Please check tax_rules table.`,
      });
    }

    console.log(`Tax rate ${estimatePreviewData.taxRate} mapped to: "${taxName}"`);

    let qbTaxCodeId = await getQBTaxCodeId(taxName);

    if (!qbTaxCodeId) {
      console.log(`Looking up tax code in QB: "${taxName}"`);
      qbTaxCodeId = await getTaxCodeIdByName(taxName, realmId);

      if (!qbTaxCodeId) {
        // Try fallback to "TAX"
        console.log(`Tax code "${taxName}" not found, trying fallback "TAX"`);
        qbTaxCodeId = await getTaxCodeIdByName('TAX', realmId);

        if (!qbTaxCodeId) {
          return res.status(400).json({
            success: false,
            error: `Tax code "${taxName}" not found in QuickBooks. Please create this tax code in QuickBooks first.`,
          });
        }
      }

      await storeTaxCodeMapping({
        tax_name: taxName,
        qb_tax_code_id: qbTaxCodeId,
        tax_rate: estimatePreviewData.taxRate,
      });
      console.log(`✅ Cached tax code mapping: "${taxName}" → ${qbTaxCodeId}`);
    } else {
      console.log(`✅ Using cached tax code ID: ${qbTaxCodeId}`);
    }

    // 3. BUILD LINE ITEMS (with item ID caching) - ALL MUST SUCCEED
    const lines = [];
    const missingItems: string[] = [];

    for (const item of estimatePreviewData.items) {
      // Skip subtotal items (productTypeId 21)
      if (item.productTypeId === 21) {
        continue;
      }

      // Resolve item ID and description (with caching)
      let qbItemData = await getQBItemId(item.itemName);
      let qbItemId: string | null = qbItemData?.qb_item_id || null;
      let qbDescription: string | null = qbItemData?.description || null;

      if (!qbItemId) {
        console.log(`Looking up item in QB: "${item.itemName}"`);
        qbItemId = await getItemIdByName(item.itemName, realmId);

        if (!qbItemId) {
          missingItems.push(item.itemName);
          continue; // Continue checking all items to report ALL missing items
        }

        await storeItemMapping({
          item_name: item.itemName,
          qb_item_id: qbItemId,
        });
        console.log(`✅ Cached item mapping: "${item.itemName}" → ${qbItemId}`);
      } else {
        console.log(`✅ Using cached item ID for "${item.itemName}": ${qbItemId}`);
      }

      lines.push({
        DetailType: 'SalesItemLineDetail',
        SalesItemLineDetail: {
          ItemRef: {
            value: qbItemId,
            name: item.itemName,
          },
          Qty: item.quantity,
          UnitPrice: item.unitPrice,
          TaxCodeRef: {
            value: qbTaxCodeId,
          },
        },
        Amount: item.extendedPrice,
        Description: qbDescription || '',
      });
    }

    // FAIL if any items are missing
    if (missingItems.length > 0) {
      return res.status(400).json({
        success: false,
        error: `The following items were not found in QuickBooks. Please create them in QuickBooks first:\n${missingItems.join('\n')}`,
        missingItems,
      });
    }

    if (lines.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid line items found in estimate.',
      });
    }

    // 4. CREATE ESTIMATE IN QUICKBOOKS
    const qbPayload = {
      CustomerRef: { value: qbCustomerId },
      TxnDate: new Date().toISOString().split('T')[0], // Today's date YYYY-MM-DD
      Line: lines,
    };

    console.log(`📤 Creating estimate in QB with ${lines.length} line items...`);
    const result = await createEstimate(qbPayload, realmId);

    const qbEstimateUrl = getEstimatePdfUrl(result.estimateId, realmId);

    console.log(`✅ QB Estimate created: ID=${result.estimateId}, Doc#=${result.docNumber}`);

    // 5. FINALIZE THE ESTIMATE (make immutable)
    await pool.execute(
      `UPDATE job_estimates
       SET is_draft = FALSE,
           status = 'sent',
           is_sent = TRUE,
           finalized_at = NOW(),
           finalized_by_user_id = ?,
           qb_estimate_id = ?,
           sent_to_qb_at = NOW(),
           subtotal = ?,
           tax_amount = ?,
           total_amount = ?
       WHERE id = ? AND is_draft = TRUE`,
      [
        user?.user_id,
        result.estimateId,
        estimatePreviewData.subtotal,
        estimatePreviewData.taxAmount,
        estimatePreviewData.total,
        estimateId
      ]
    );

    console.log(`✅ Estimate ${estimateId} finalized and linked to QB estimate ${result.estimateId}`);

    res.json({
      success: true,
      qbEstimateId: result.estimateId,
      qbDocNumber: result.docNumber,
      qbEstimateUrl,
      linesCreated: lines.length,
    });
  } catch (error) {
    console.error('❌ Error creating QB estimate:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create estimate',
    });
  }
});

export default router;
