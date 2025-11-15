/**
 * QuickBooks Testing Routes
 * Dedicated endpoints for testing QuickBooks API behavior
 * These endpoints bypass database requirements and send test data directly to QB
 */

import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { quickbooksRepository } from '../repositories/quickbooksRepository';

const router = Router();

/**
 * POST /api/quickbooks-test/row-types
 * Test different row types in QuickBooks (DescriptionOnly, SubTotalLineDetail, etc.)
 * Sends hardcoded test data directly to QuickBooks API
 */
router.post('/row-types', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { testItems, customerName = 'Test Customer', debugMode = true, useHardcodedTest = false } = req.body;

    const realmId = await quickbooksRepository.getDefaultRealmId();
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
      makeQBApiCall,
    } = await import('../utils/quickbooks/apiClient');

    console.log('\n🧪 QUICKBOOKS SPECIAL PATTERN TEST');
    console.log('============================');
    console.log(`Customer: ${customerName}`);
    console.log(`Hardcoded Test Mode: ${useHardcodedTest}`);
    console.log(`Debug Mode: ${debugMode}\n`);

    // Lookup customer
    const qbCustomerId = await getCustomerIdByName(customerName, realmId);
    if (!qbCustomerId) {
      return res.status(400).json({
        success: false,
        error: `Customer "${customerName}" not found in QuickBooks. Please update the customerName in the request.`,
      });
    }
    console.log(`✅ Found customer: ${qbCustomerId}`);

    // Use hardcoded tax code ID (GST = 7)
    const qbTaxCodeId = '7'; // GST tax code
    console.log(`✅ Using tax code ID: ${qbTaxCodeId}\n`);

    // Build line items from test data
    const lines: any[] = [];
    let lineNum = 0;

    console.log('📝 Building Line Items:');
    console.log('------------------------');

    // HARDCODED SPECIAL PATTERN TEST MODE
    if (useHardcodedTest) {
      console.log('🎯 USING HARDCODED SPECIAL PATTERN TEST\n');

      // Get a single regular item for baseline
      const testItemId = await getItemIdByName('3" Channel Letters', realmId);
      if (!testItemId) {
        return res.status(400).json({
          success: false,
          error: 'Test item "3" Channel Letters" not found in QuickBooks.',
        });
      }

      // Line 1: Regular item for baseline
      lineNum++;
      lines.push({
        DetailType: 'SalesItemLineDetail',
        SalesItemLineDetail: {
          ItemRef: { value: testItemId, name: '3" Channel Letters' },
          Qty: 1,
          UnitPrice: 100,
          TaxCodeRef: { value: qbTaxCodeId },
        },
        Amount: 100,
        LineNum: lineNum
      });
      console.log(`${lineNum}. Regular Item: 3" Channel Letters ($100)`);

      // TEST SPECIAL PATTERNS
      const testPatterns = [
        'TEXT: This is a text line',
        'NOTE: This is a note',
        'HEADER: Section Header',
        '---',
        '===',
        'TOTAL: $100.00',
        'Tax: $5.00',
        'SUBTOTAL: $100.00',
        'Subtotal: $',
        'Subtotal: $100',
        'Discount: $10.00',
        'Section: Channel Letters',
        '>>> Custom Marker',
        '*** IMPORTANT ***',
        'LINE ITEM: Custom',
        'DESCRIPTION: Test Description'
      ];

      for (const pattern of testPatterns) {
        lineNum++;
        lines.push({
          DetailType: 'DescriptionOnly',
          Description: pattern,
          DescriptionLineDetail: {},
          LineNum: lineNum
        });
        console.log(`${lineNum}. Pattern Test: "${pattern}"`);
      }

      // Add a final regular item
      lineNum++;
      lines.push({
        DetailType: 'SalesItemLineDetail',
        SalesItemLineDetail: {
          ItemRef: { value: testItemId, name: '3" Channel Letters' },
          Qty: 1,
          UnitPrice: 50,
          TaxCodeRef: { value: qbTaxCodeId },
        },
        Amount: 50,
        LineNum: lineNum
      });
      console.log(`${lineNum}. Regular Item: 3" Channel Letters ($50)`);

      console.log(`\n✅ Created ${lines.length} test lines with special patterns\n`);
    }
    // NORMAL TEST MODE (from request body)
    else {
      if (!testItems || testItems.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No testItems provided. Either send testItems array or set useHardcodedTest=true'
        });
      }

      console.log(`Processing ${testItems.length} test items from request\n`);

      for (const item of testItems) {
      lineNum++;

      // REGULAR ITEM
      if (item.type === 'regular') {
        const qbItemId = await getItemIdByName(item.itemName, realmId);
        if (!qbItemId) {
          return res.status(400).json({
            success: false,
            error: `Item "${item.itemName}" not found in QuickBooks.`,
          });
        }

        lines.push({
          DetailType: 'SalesItemLineDetail',
          SalesItemLineDetail: {
            ItemRef: { value: qbItemId, name: item.itemName },
            Qty: item.quantity,
            UnitPrice: item.unitPrice,
            TaxCodeRef: { value: qbTaxCodeId },
          },
          Amount: item.extendedPrice,
          LineNum: lineNum
        });
        console.log(`${lineNum}. Regular Item: ${item.itemName} ($${item.extendedPrice})`);
      }

      // EMPTY ROW - Test with/without Description and TaxCodeRef
      else if (item.type === 'empty_row') {
        const lineDetail: any = {};

        // Support explicit TaxCodeRef control
        if (item.taxCodeRef) {
          lineDetail.TaxCodeRef = { value: item.taxCodeRef };
          console.log(`${lineNum}. DescriptionOnly WITH TaxCodeRef="${item.taxCodeRef}"${item.description ? `, Description: "${item.description}"` : ', NO Description'}`);
        } else {
          console.log(`${lineNum}. DescriptionOnly NO TaxCodeRef${item.description ? `, Description: "${item.description}"` : ', NO Description'}`);
        }

        const line: any = {
          DetailType: 'DescriptionOnly',
          DescriptionLineDetail: lineDetail,
          LineNum: lineNum
        };

        if (item.description && item.description.trim()) {
          line.Description = item.description;
        }

        lines.push(line);
      }

      // SUBTOTAL - Test with/without Description
      else if (item.type === 'subtotal') {
        if (item.description && item.description.trim()) {
          console.log(`${lineNum}. SubTotalLineDetail WITH Description: "${item.description}" (Amount: $${item.amount})`);
          lines.push({
            DetailType: 'SubTotalLineDetail',
            Description: item.description,
            SubTotalLineDetail: {},
            Amount: item.amount,
            LineNum: lineNum
          });
        } else {
          console.log(`${lineNum}. SubTotalLineDetail WITHOUT Description (Amount: $${item.amount})`);
          lines.push({
            DetailType: 'SubTotalLineDetail',
            SubTotalLineDetail: {},
            Amount: item.amount,
            LineNum: lineNum
          });
        }
      }

      // CUSTOM DESCRIPTION ONLY
      else if (item.type === 'custom_description') {
        const lineDetail: any = {};

        // Support explicit TaxCodeRef control
        if (item.taxCodeRef) {
          lineDetail.TaxCodeRef = { value: item.taxCodeRef };
          console.log(`${lineNum}. Custom DescriptionOnly WITH TaxCodeRef="${item.taxCodeRef}": "${item.description}"`);
        } else {
          console.log(`${lineNum}. Custom DescriptionOnly NO TaxCodeRef: "${item.description}"`);
        }

        lines.push({
          DetailType: 'DescriptionOnly',
          Description: item.description,
          DescriptionLineDetail: lineDetail,
          LineNum: lineNum
        });
      }
    } // end for loop
  } // end else (normal test mode)

    console.log('\n📤 Sending to QuickBooks API...\n');

    const qbPayload = {
      CustomerRef: { value: qbCustomerId },
      TxnDate: new Date().toISOString().split('T')[0],
      Line: lines,
    };

    const result = await createEstimate(qbPayload, realmId);

    console.log(`✅ QB Test Estimate created: ID=${result.estimateId}, Doc#=${result.docNumber}\n`);

    // DEBUG MODE: Fetch estimate back from QuickBooks for comparison
    if (debugMode) {
      console.log('🔬 DEBUG MODE: Fetching estimate back from QuickBooks...\n');
      const fetchedEstimate = await makeQBApiCall('GET', `estimate/${result.estimateId}`, realmId, {});

      console.log('═══════════════════════════════════════════════════════════');
      console.log('📤 WHAT WE SENT TO QUICKBOOKS:');
      console.log('═══════════════════════════════════════════════════════════');
      console.log(`Total Line Items Sent: ${lines.length}\n`);

      lines.forEach((line, index) => {
        console.log(`[Sent Line ${index + 1}]`);
        console.log(`  DetailType: ${line.DetailType}`);
        console.log(`  Description: ${line.Description !== undefined ? `"${line.Description}"` : '(field not included)'}`);
        console.log(`  Amount: ${line.Amount !== undefined ? line.Amount : 'N/A'}`);
        if (line.DetailType === 'DescriptionOnly') {
          console.log(`  DescriptionLineDetail: ${JSON.stringify(line.DescriptionLineDetail)}`);
        } else if (line.DetailType === 'SubTotalLineDetail') {
          console.log(`  SubTotalLineDetail: ${JSON.stringify(line.SubTotalLineDetail)}`);
        }
        console.log('');
      });

      console.log('═══════════════════════════════════════════════════════════');
      console.log('📥 WHAT QUICKBOOKS RETURNED:');
      console.log('═══════════════════════════════════════════════════════════');
      const returnedLines = fetchedEstimate.Estimate?.Line || [];
      console.log(`Total Line Items Returned: ${returnedLines.length}\n`);

      returnedLines.forEach((line: any, index: number) => {
        console.log(`[Returned Line ${index + 1}]`);
        console.log(`  QB ID: ${line.Id}`);
        console.log(`  DetailType: ${line.DetailType}`);
        console.log(`  Description: ${line.Description !== undefined ? `"${line.Description}"` : '(empty/not returned)'}`);
        console.log(`  Amount: ${line.Amount !== undefined ? line.Amount : 'N/A'}`);
        if (line.DetailType === 'DescriptionOnly') {
          const hasTaxCode = !!line.DescriptionLineDetail?.TaxCodeRef;
          console.log(`  DescriptionLineDetail: ${JSON.stringify(line.DescriptionLineDetail)}`);
          console.log(`  🔍 ${hasTaxCode ? 'HAS' : 'NO'} TaxCodeRef`);
        } else if (line.DetailType === 'SubTotalLineDetail') {
          console.log(`  SubTotalLineDetail: ${JSON.stringify(line.SubTotalLineDetail)}`);
        }
        console.log('');
      });

      console.log('═══════════════════════════════════════════════════════════');
      console.log('🔬 ANALYSIS:');
      console.log('═══════════════════════════════════════════════════════════');
      console.log(`Sent: ${lines.length} lines`);
      console.log(`Returned: ${returnedLines.length} lines`);
      if (lines.length !== returnedLines.length) {
        console.log(`⚠️  Line count mismatch! ${lines.length - returnedLines.length} line(s) were removed or modified by QuickBooks`);
      }

      const returnedDescOnly = returnedLines.filter((l: any) => l.DetailType === 'DescriptionOnly');
      console.log(`\nDescriptionOnly lines in response: ${returnedDescOnly.length}`);
      returnedDescOnly.forEach((line: any, idx: number) => {
        const hasTaxCode = !!line.DescriptionLineDetail?.TaxCodeRef;
        const hasDesc = !!line.Description;
        console.log(`  ${idx + 1}. TaxCodeRef: ${hasTaxCode ? 'YES' : 'NO'}, Description: ${hasDesc ? 'YES' : 'NO'} - "${line.Description || ''}"`);
      });

      const returnedSubtotal = returnedLines.filter((l: any) => l.DetailType === 'SubTotalLineDetail');
      console.log(`\nSubTotalLineDetail lines in response: ${returnedSubtotal.length}`);
      returnedSubtotal.forEach((line: any, idx: number) => {
        const hasDesc = !!line.Description;
        console.log(`  ${idx + 1}. Description: ${hasDesc ? 'YES' : 'NO'} - "${line.Description || ''}", Amount: $${line.Amount || 0}`);
      });

      console.log('═══════════════════════════════════════════════════════════\n');

      // Return debug data in response
      return res.json({
        success: true,
        qbEstimateId: result.estimateId,
        qbDocNumber: result.docNumber,
        linesCreated: lines.length,
        debug: {
          linesSent: lines.length,
          linesReturned: returnedLines.length,
          sentLines: lines,
          returnedLines: returnedLines,
        }
      });
    }

    res.json({
      success: true,
      qbEstimateId: result.estimateId,
      qbDocNumber: result.docNumber,
      linesCreated: lines.length,
    });
  } catch (error) {
    console.error('❌ Error in QuickBooks test endpoint:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create test estimate',
    });
  }
});

export default router;
