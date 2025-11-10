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
router.get('/config-status', authenticateToken, async (req: Request, res: Response) => {
  const validation = await validateConfig();

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
    const { authUrl, state } = await getAuthorizationUrl();

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

    // Success page - show success for 2 seconds then auto-close
    res.send(`
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
 * GET /api/quickbooks/test-logging
 * Test endpoint to verify logging is working
 */
router.get('/test-logging', authenticateToken, async (req: Request, res: Response) => {
  console.log('\n🧪 QUICKBOOKS LOGGING TEST');
  console.log('==========================');
  console.log('✅ Logging is working!');
  console.log('Timestamp:', new Date().toISOString());
  console.log('==========================\n');

  res.json({
    success: true,
    message: 'Logging test successful - check PM2 logs',
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /api/quickbooks/estimate-test/:id
 * TEST ENDPOINT - Fetch an estimate from QuickBooks WITHOUT AUTH (for debugging only)
 */
router.get('/estimate-test/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Estimate ID is required'
      });
    }

    const realmId = await getDefaultRealmId();
    if (!realmId) {
      return res.status(400).json({
        success: false,
        error: 'Not connected to QuickBooks'
      });
    }

    console.log('\n🔍 [TEST ENDPOINT] FETCHING QUICKBOOKS ESTIMATE');
    console.log('================================');
    console.log(`Estimate ID: ${id}`);
    console.log(`Realm ID: ${realmId}`);

    // Import QB API functions
    const { makeQBApiCall } = await import('../utils/quickbooks/apiClient');

    // Fetch the estimate from QuickBooks
    const response = await makeQBApiCall('GET', `estimate/${id}`, realmId, {});
    const estimate = response.Estimate;

    if (!estimate) {
      return res.status(404).json({
        success: false,
        error: 'Estimate not found'
      });
    }

    console.log('\n📋 QUICKBOOKS ESTIMATE STRUCTURE');
    console.log('==================================');
    console.log(`Doc Number: ${estimate.DocNumber}`);
    console.log(`Total Amount: ${estimate.TotalAmt}`);
    console.log(`Line Items: ${estimate.Line ? estimate.Line.length : 0}`);

    if (estimate.Line && estimate.Line.length > 0) {
      console.log('\n📝 LINE ITEMS DETAIL:');
      console.log('---------------------');

      estimate.Line.forEach((line: any, idx: number) => {
        console.log(`\n[Line ${idx + 1}]`);
        console.log(`  DetailType: ${line.DetailType}`);

        if (line.Description) {
          console.log(`  Description: "${line.Description}"`);
        }

        if (line.Amount !== undefined) {
          console.log(`  Amount: $${line.Amount}`);
        }

        // Log specific details based on DetailType
        if (line.DetailType === 'SalesItemLineDetail' && line.SalesItemLineDetail) {
          const detail = line.SalesItemLineDetail;
          console.log(`  Item: ${detail.ItemRef?.name} (ID: ${detail.ItemRef?.value})`);
          console.log(`  Qty: ${detail.Qty}`);
          console.log(`  UnitPrice: ${detail.UnitPrice}`);
          if (detail.TaxCodeRef) {
            console.log(`  TaxCode: ${detail.TaxCodeRef.value}`);
          }
        } else if (line.DetailType === 'SubTotalLineDetail') {
          console.log(`  ** SUBTOTAL LINE **`);
          if (line.SubTotalLineDetail) {
            console.log(`  SubTotalLineDetail:`, JSON.stringify(line.SubTotalLineDetail));
          }
        } else if (line.DetailType === 'DescriptionOnly') {
          console.log(`  ** DESCRIPTION ONLY LINE **`);
          if (line.DescriptionLineDetail) {
            console.log(`  DescriptionLineDetail:`, JSON.stringify(line.DescriptionLineDetail));
          }
        } else if (line.DetailType === 'DiscountLineDetail') {
          console.log(`  ** DISCOUNT LINE **`);
          if (line.DiscountLineDetail) {
            console.log(`  DiscountLineDetail:`, JSON.stringify(line.DiscountLineDetail));
          }
        }

        // Log all fields for special analysis
        console.log(`  All fields: ${Object.keys(line).join(', ')}`);
      });

      console.log('\n\n🔬 RAW LINE ITEMS JSON:');
      console.log('------------------------');
      console.log(JSON.stringify(estimate.Line, null, 2));
    }

    // Return the full estimate structure
    res.json({
      success: true,
      warning: 'TEST ENDPOINT - REMOVE IN PRODUCTION',
      estimate: {
        id: estimate.Id,
        docNumber: estimate.DocNumber,
        totalAmount: estimate.TotalAmt,
        lineCount: estimate.Line ? estimate.Line.length : 0,
        lines: estimate.Line || []
      },
      raw: estimate // Include raw response for analysis
    });

  } catch (error) {
    console.error('❌ Error fetching QB estimate:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch estimate'
    });
  }
});

/**
 * GET /api/quickbooks/estimate/:id
 * Fetch an estimate from QuickBooks to analyze its structure
 */
router.get('/estimate/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Estimate ID is required'
      });
    }

    const realmId = await getDefaultRealmId();
    if (!realmId) {
      return res.status(400).json({
        success: false,
        error: 'Not connected to QuickBooks'
      });
    }

    console.log('\n🔍 FETCHING QUICKBOOKS ESTIMATE');
    console.log('================================');
    console.log(`Estimate ID: ${id}`);
    console.log(`Realm ID: ${realmId}`);

    // Import QB API functions
    const { makeQBApiCall } = await import('../utils/quickbooks/apiClient');

    // Fetch the estimate from QuickBooks
    const response = await makeQBApiCall('GET', `estimate/${id}`, realmId, {});
    const estimate = response.Estimate;

    if (!estimate) {
      return res.status(404).json({
        success: false,
        error: 'Estimate not found'
      });
    }

    console.log('\n📋 QUICKBOOKS ESTIMATE STRUCTURE');
    console.log('==================================');
    console.log(`Doc Number: ${estimate.DocNumber}`);
    console.log(`Total Amount: ${estimate.TotalAmt}`);
    console.log(`Line Items: ${estimate.Line ? estimate.Line.length : 0}`);

    if (estimate.Line && estimate.Line.length > 0) {
      console.log('\n📝 LINE ITEMS DETAIL:');
      console.log('---------------------');

      estimate.Line.forEach((line: any, idx: number) => {
        console.log(`\n[Line ${idx + 1}]`);
        console.log(`  DetailType: ${line.DetailType}`);

        if (line.Description) {
          console.log(`  Description: "${line.Description}"`);
        }

        if (line.Amount !== undefined) {
          console.log(`  Amount: $${line.Amount}`);
        }

        // Log specific details based on DetailType
        if (line.DetailType === 'SalesItemLineDetail' && line.SalesItemLineDetail) {
          const detail = line.SalesItemLineDetail;
          console.log(`  Item: ${detail.ItemRef?.name} (ID: ${detail.ItemRef?.value})`);
          console.log(`  Qty: ${detail.Qty}`);
          console.log(`  UnitPrice: ${detail.UnitPrice}`);
          if (detail.TaxCodeRef) {
            console.log(`  TaxCode: ${detail.TaxCodeRef.value}`);
          }
        } else if (line.DetailType === 'SubTotalLineDetail') {
          console.log(`  ** SUBTOTAL LINE **`);
          if (line.SubTotalLineDetail) {
            console.log(`  SubTotalLineDetail:`, JSON.stringify(line.SubTotalLineDetail));
          }
        } else if (line.DetailType === 'DescriptionOnly') {
          console.log(`  ** DESCRIPTION ONLY LINE **`);
          if (line.DescriptionLineDetail) {
            console.log(`  DescriptionLineDetail:`, JSON.stringify(line.DescriptionLineDetail));
          }
        } else if (line.DetailType === 'DiscountLineDetail') {
          console.log(`  ** DISCOUNT LINE **`);
          if (line.DiscountLineDetail) {
            console.log(`  DiscountLineDetail:`, JSON.stringify(line.DiscountLineDetail));
          }
        }

        // Log all fields for special analysis
        console.log(`  All fields: ${Object.keys(line).join(', ')}`);
      });

      console.log('\n\n🔬 RAW LINE ITEMS JSON:');
      console.log('------------------------');
      console.log(JSON.stringify(estimate.Line, null, 2));
    }

    // Return the full estimate structure
    res.json({
      success: true,
      estimate: {
        id: estimate.Id,
        docNumber: estimate.DocNumber,
        totalAmount: estimate.TotalAmt,
        lineCount: estimate.Line ? estimate.Line.length : 0,
        lines: estimate.Line || []
      },
      raw: estimate // Include raw response for analysis
    });

  } catch (error) {
    console.error('❌ Error fetching QB estimate:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch estimate'
    });
  }
});

/**
 * GET /api/quickbooks/items
 * Fetch all QuickBooks items from qb_item_mappings table
 * Used for dropdown population in Custom product forms
 */
router.get('/items', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { pool } = await import('../config/database');

    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT id, item_name, description, qb_item_id, qb_item_type
       FROM qb_item_mappings
       ORDER BY item_name ASC`
    );

    console.log(`✅ Fetched ${rows.length} QuickBooks items for dropdown`);

    res.json({
      success: true,
      items: rows.map((row: any) => ({
        id: row.id,
        name: row.item_name,
        description: row.description,
        qbItemId: row.qb_item_id,
        qbItemType: row.qb_item_type
      }))
    });
  } catch (error) {
    console.error('❌ Error fetching QB items:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch QuickBooks items'
    });
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
    const { estimateId, estimatePreviewData, debugMode = false } = req.body;
    const user = (req as AuthRequest).user;

    // TEMPORARY: Log what we're receiving
    console.log('\n📥 CREATE-ESTIMATE REQUEST:');
    console.log(`  estimateId: ${estimateId}`);
    console.log(`  debugMode: ${debugMode} (type: ${typeof debugMode})`);
    console.log(`  items count: ${estimatePreviewData?.items?.length || 0}`);

    if (!estimateId || !estimatePreviewData) {
      return res.status(400).json({
        success: false,
        error: 'Missing estimateId or estimatePreviewData',
      });
    }

    if (debugMode) {
      console.log('\n🔬 DEBUG MODE ENABLED - Will fetch estimate back for comparison\n');
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

    // Validate: QuickBooks name is configured
    if (!estimatePreviewData.customerName || !estimatePreviewData.customerName.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Customer QuickBooks name is not configured. Please set the QuickBooks name in customer settings to match the exact DisplayName in QuickBooks.',
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
    const lines: any[] = [];
    const missingItems: string[] = [];
    let lineNum = 0;
    let grandTotal = 0; // Track total of all regular items for automatic final subtotal

    for (const item of estimatePreviewData.items) {
      lineNum++;

      // Handle special item types

      // DIVIDER (Product Type 25) - Skip entirely, don't send to QuickBooks
      if (item.productTypeId === 25) {
        console.log(`   ↳ Skipping Divider item at line ${lineNum}`);
        continue;
      }

      // SUBTOTAL (Product Type 21) - DescriptionOnly row with formatted text
      // Frontend provides calculationDisplay with format:
      //   {Optional Note}
      //   --------------------------------------
      //   Subtotal = $XXX.XX
      //   Tax (5%) = $XX.XX
      //   Section Total = $XXX.XX
      //   --------------------------------------
      // NOTE: Must replace "Subtotal:" with "Subtotal =" to avoid QB's magic pattern
      if (item.productTypeId === 21) {
        const displayText = item.calculationDisplay || item.itemName || '';

        console.log(`   ↳ Processing Subtotal at line ${lineNum}${displayText ? ` with display: "${displayText.substring(0, 50)}..."` : ''}`);

        if (displayText) {
          // Replace colons with equals for consistency and to avoid QB's magic patterns
          // "Subtotal: $X.XX" would trigger QB's auto-calculated subtotal
          const processedText = displayText
            .replace(/Subtotal:/g, 'Subtotal =')
            .replace(/Tax\s*\(/g, 'Tax (')  // Ensure space after "Tax": "Tax(" -> "Tax ("
            .replace(/Tax\s*\([^)]+\):/g, (match: string) => match.replace(':', ' ='))  // "Tax(5%):" -> "Tax (5%) ="
            .replace(/Section Total:/g, 'Section Total =')
            .replace(/Total:/g, 'Total =');

          // Add separator lines before and after
          const safeDescription = '--------------------------------------\n' + processedText + '\n--------------------------------------';

          lines.push({
            DetailType: 'DescriptionOnly',
            Description: safeDescription,
            DescriptionLineDetail: {},
            LineNum: lineNum
          });
          console.log(`   ↳ Added subtotal section (DescriptionOnly, no tax code)`);
        } else {
          // No display text - create formatted separator block
          // Avoid "Subtotal" + dollar amount pattern (triggers QB magic subtotal)
          const emptySubtotal = '--------------------------------------\nSection Total = $0.00\n--------------------------------------';
          lines.push({
            DetailType: 'DescriptionOnly',
            Description: emptySubtotal,
            DescriptionLineDetail: {},
            LineNum: lineNum
          });
          console.log(`   ↳ Added empty subtotal section`);
        }
        continue;
      }

      // EMPTY ROW (Product Type 27) - DescriptionOnly for spacing/comments
      if (item.productTypeId === 27) {
        const description = item.calculationDisplay || item.itemName || ' ';
        console.log(`   ↳ Adding Empty Row at line ${lineNum}${description.trim() ? ` with comment: "${description}"` : ''}`);

        lines.push({
          DetailType: 'DescriptionOnly',
          Description: description,  // Use comment if available, otherwise single space
          DescriptionLineDetail: {},
          LineNum: lineNum
        });
        continue;
      }

      // CUSTOM (Product Type 9) with only description - Use DescriptionOnly
      if (item.productTypeId === 9) {
        // Check if this is description-only (price === 0 signals description-only)
        const hasPrice = item.unitPrice && item.unitPrice > 0;

        // Description-only: unitPrice is 0 AND has calculationDisplay text
        if (!hasPrice && item.calculationDisplay && item.calculationDisplay.trim()) {
          // Description-only custom item
          console.log(`   ↳ Adding Custom (description-only) at line ${lineNum}: "${item.calculationDisplay}"`);
          lines.push({
            DetailType: 'DescriptionOnly',
            Description: item.calculationDisplay,
            DescriptionLineDetail: {},
            LineNum: lineNum
          });
          continue;
        }
        // If it has price, fall through to regular item handling
        console.log(`   ↳ Custom item at line ${lineNum} has price, treating as regular item`);
      }

      // DISCOUNT/FEE (Product Type 22) - These are REGULAR QuickBooks items/products
      // They should be looked up and sent as SalesItemLineDetail, not skipped
      // (No special handling needed - they fall through to regular item logic below)

      // MULTIPLIER (Product Type 23) - Already applied to items, skip the multiplier line itself
      if (item.productTypeId === 23) {
        console.log(`   ↳ Skipping Multiplier at line ${lineNum} (already applied to items)`);
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
        LineNum: lineNum
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

    // DETAILED LOGGING OF API PAYLOAD
    console.log('\n🔍 DETAILED QB API PAYLOAD:');
    console.log('================================');
    console.log(`Customer: ${qbCustomerId}`);
    console.log(`Date: ${qbPayload.TxnDate}`);
    console.log(`Total Line Items: ${lines.length}`);
    console.log('\nLine Items Detail:');
    console.log('------------------');

    lines.forEach((line, index) => {
      console.log(`\n[Line ${index + 1}]`);
      console.log(`  DetailType: ${line.DetailType}`);

      if (line.DetailType === 'SalesItemLineDetail') {
        console.log(`  Item: ${line.SalesItemLineDetail?.ItemRef?.name} (ID: ${line.SalesItemLineDetail?.ItemRef?.value})`);
        console.log(`  Quantity: ${line.SalesItemLineDetail?.Qty}`);
        console.log(`  Unit Price: ${line.SalesItemLineDetail?.UnitPrice}`);
        console.log(`  Amount: ${line.Amount}`);
        if (line.Description) {
          console.log(`  Description: "${line.Description}"`);
        }
      } else if (line.DetailType === 'SubTotalLineDetail') {
        console.log(`  Type: SUBTOTAL`);
        console.log(`  Amount: ${line.Amount}`);
        if (line.Description) {
          console.log(`  Description: "${line.Description}"`);
        }
      } else if (line.DetailType === 'DescriptionOnly') {
        console.log(`  Type: DESCRIPTION ONLY`);
        console.log(`  Description: "${line.Description}"`);
      }

      if (line.LineNum) {
        console.log(`  LineNum: ${line.LineNum}`);
      }
    });

    console.log('\n================================');
    console.log('FULL JSON PAYLOAD:');
    console.log(JSON.stringify(qbPayload, null, 2));
    console.log('================================\n');

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

    // DEBUG MODE: Fetch estimate back from QuickBooks for comparison
    if (debugMode) {
      console.log('\n🔬 DEBUG MODE: Fetching estimate back from QuickBooks...');
      try {
        const { makeQBApiCall } = await import('../utils/quickbooks/apiClient');
        const fetchedEstimate = await makeQBApiCall('GET', `estimate/${result.estimateId}`, realmId, {});

        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('📤 WHAT WE SENT TO QUICKBOOKS:');
        console.log('═══════════════════════════════════════════════════════════');
        console.log(`Total Line Items Sent: ${lines.length}\n`);

        lines.forEach((line, index) => {
          console.log(`\n[Sent Line ${index + 1}]`);
          console.log(`  DetailType: ${line.DetailType}`);
          console.log(`  LineNum: ${line.LineNum || 'N/A'}`);

          if (line.DetailType === 'SalesItemLineDetail') {
            console.log(`  Product/Service: "${line.SalesItemLineDetail?.ItemRef?.name}" (ID: ${line.SalesItemLineDetail?.ItemRef?.value})`);
            console.log(`  Quantity: ${line.SalesItemLineDetail?.Qty}`);
            console.log(`  Unit Price: $${line.SalesItemLineDetail?.UnitPrice}`);
            console.log(`  Extended Amount: $${line.Amount}`);
            console.log(`  Tax Code: ${line.SalesItemLineDetail?.TaxCodeRef?.value || 'N/A'}`);
            if (line.Description) {
              console.log(`  Description: "${line.Description.substring(0, 100)}${line.Description.length > 100 ? '...' : ''}"`);
            }
          } else if (line.DetailType === 'SubTotalLineDetail') {
            console.log(`  Subtotal Amount: $${line.Amount}`);
          } else if (line.DetailType === 'DescriptionOnly') {
            console.log(`  Text: "${line.Description || '(empty)'}"`);
          } else if (line.DetailType === 'DiscountLineDetail') {
            console.log(`  Discount Amount: $${line.Amount}`);
          }
        });

        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('📥 WHAT QUICKBOOKS RETURNED:');
        console.log('═══════════════════════════════════════════════════════════');
        const returnedLines = fetchedEstimate.Estimate?.Line || [];
        console.log(`Total Line Items Returned: ${returnedLines.length}\n`);

        returnedLines.forEach((line: any, index: number) => {
          console.log(`\n[Returned Line ${index + 1}]`);
          console.log(`  DetailType: ${line.DetailType}`);
          console.log(`  LineNum: ${line.LineNum || 'N/A'}`);
          console.log(`  QB Line ID: ${line.Id || 'N/A'}`);

          if (line.DetailType === 'SalesItemLineDetail') {
            console.log(`  Product/Service: "${line.SalesItemLineDetail?.ItemRef?.name}" (ID: ${line.SalesItemLineDetail?.ItemRef?.value})`);
            console.log(`  Quantity: ${line.SalesItemLineDetail?.Qty}`);
            console.log(`  Unit Price: $${line.SalesItemLineDetail?.UnitPrice}`);
            console.log(`  Extended Amount: $${line.Amount}`);
            console.log(`  Tax Code: ${line.SalesItemLineDetail?.TaxCodeRef?.value || 'N/A'}`);
            if (line.Description) {
              console.log(`  Description: "${line.Description.substring(0, 100)}${line.Description.length > 100 ? '...' : ''}"`);
            }
          } else if (line.DetailType === 'SubTotalLineDetail') {
            console.log(`  Subtotal Amount: $${line.Amount}`);
          } else if (line.DetailType === 'DescriptionOnly') {
            console.log(`  Text: "${line.Description || '(empty)'}"`);
          } else if (line.DetailType === 'DiscountLineDetail') {
            console.log(`  Discount Amount: $${line.Amount}`);
            if (line.DiscountLineDetail) {
              console.log(`  Discount Details:`, JSON.stringify(line.DiscountLineDetail, null, 2));
            }
          }
        });

        console.log('═══════════════════════════════════════════════════════════');
        console.log(`📊 COMPARISON: Sent ${lines.length} lines, QB returned ${returnedLines.length} lines`);
        if (lines.length !== returnedLines.length) {
          console.log(`⚠️  WARNING: Line count mismatch! ${lines.length - returnedLines.length} line(s) were removed or modified by QuickBooks`);
        }
        console.log('═══════════════════════════════════════════════════════════\n');

        // Return debug data in response
        return res.json({
          success: true,
          qbEstimateId: result.estimateId,
          qbDocNumber: result.docNumber,
          qbEstimateUrl,
          linesCreated: lines.length,
          debug: {
            linesSent: lines.length,
            linesReturned: returnedLines.length,
            sentLines: lines,
            returnedLines: returnedLines,
            fullEstimate: fetchedEstimate.Estimate
          }
        });
      } catch (fetchError) {
        console.error('⚠️  DEBUG MODE: Failed to fetch estimate back:', fetchError);
        // Continue with normal response even if fetch fails
      }
    }

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
