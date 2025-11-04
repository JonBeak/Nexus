/**
 * QuickBooks Create & Fetch Test Script
 * Creates a test estimate in QB and immediately fetches it back for analysis
 */

const axios = require('axios');

const API_BASE = 'http://localhost:3001/api';

// Test estimate data - customize this as needed
const testEstimateData = {
  customerName: "Test Customer", // Change to a real QB customer name
  items: [
    // Regular item
    {
      itemName: "Channel Letters",
      quantity: 10,
      unitPrice: 31.50,
      extendedPrice: 315.00,
      productTypeId: 1
    },
    // Another regular item
    {
      itemName: "LEDs",
      quantity: 2,
      unitPrice: 35.00,
      extendedPrice: 70.00,
      productTypeId: 2
    },
    // Subtotal
    {
      itemName: "Subtotal",
      calculationDisplay: "Subtotal: Section 1",
      productTypeId: 21,
      extendedPrice: 385.00
    },
    // Another regular item
    {
      itemName: "Vinyl",
      quantity: 5,
      unitPrice: 19.00,
      extendedPrice: 95.00,
      productTypeId: 3
    },
    // Empty row
    {
      itemName: "Empty Row",
      calculationDisplay: " ",
      productTypeId: 27
    },
    // Discount/Fee
    {
      itemName: "Discount",
      calculationDisplay: "10% Discount",
      quantity: 1,
      unitPrice: -48.00,
      extendedPrice: -48.00,
      productTypeId: 22
    },
    // Final subtotal
    {
      itemName: "Subtotal",
      calculationDisplay: "Final Subtotal",
      productTypeId: 21,
      extendedPrice: 432.00
    }
  ],
  subtotal: 432.00,
  taxRate: 0.05, // 5% tax
  taxAmount: 21.60,
  total: 453.60
};

async function loginAndGetToken() {
  console.log('🔐 Logging in...');
  try {
    const response = await axios.post(`${API_BASE}/auth/login`, {
      username: 'admin',
      password: 'admin123'
    });

    if (response.data.success && response.data.accessToken) {
      console.log('✅ Login successful');
      return response.data.accessToken;
    } else {
      throw new Error('Login failed - no access token received');
    }
  } catch (error) {
    console.error('❌ Login failed:', error.response?.data || error.message);
    throw error;
  }
}

async function createTestEstimateInDB(token) {
  console.log('\n📝 Creating test estimate in Nexus database...');

  // For this test, we'll use an existing estimate ID or create a minimal one
  // You may need to adjust this based on your database structure

  console.log('⚠️  Note: Using mock estimate ID. In production, create a real estimate first.');
  return 999; // Mock ID - replace with actual creation if needed
}

async function sendToQuickBooks(token, estimateId) {
  console.log(`\n📤 Sending estimate ${estimateId} to QuickBooks with DEBUG MODE...`);

  try {
    const response = await axios.post(
      `${API_BASE}/quickbooks/create-estimate`,
      {
        estimateId: estimateId,
        estimatePreviewData: testEstimateData,
        debugMode: true  // Enable debug mode to see sent vs received comparison
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.data.success) {
      console.log('✅ Estimate created in QuickBooks!');
      console.log(`   QB Estimate ID: ${response.data.qbEstimateId}`);
      console.log(`   Doc Number: ${response.data.qbDocNumber}`);
      console.log(`   URL: ${response.data.qbEstimateUrl}`);

      if (response.data.debug) {
        console.log(`   🔬 Debug data available - check logs for comparison`);
      }

      return response.data;
    } else {
      throw new Error('Failed to create estimate');
    }
  } catch (error) {
    console.error('❌ Failed to create estimate in QB:', error.response?.data || error.message);
    throw error;
  }
}

// fetchFromQuickBooks is no longer needed - debugMode does this automatically!

async function main() {
  console.log('🚀 QuickBooks Create & Fetch Test (with Debug Mode)');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // Step 1: Login
    const token = await loginAndGetToken();

    // Step 2: Send to QuickBooks (debugMode automatically fetches it back)
    const result = await sendToQuickBooks(token, 999);

    console.log('\n✅ Test completed successfully!');
    console.log(`\nCheck PM2 logs for detailed sent vs received comparison:`);
    console.log(`pm2 logs signhouse-backend --lines 100`);

    if (result.debug) {
      console.log(`\n📊 Quick Stats:`);
      console.log(`   Lines Sent: ${result.debug.linesSent}`);
      console.log(`   Lines Returned: ${result.debug.linesReturned}`);
      if (result.debug.linesSent !== result.debug.linesReturned) {
        console.log(`   ⚠️  ${result.debug.linesSent - result.debug.linesReturned} line(s) removed by QuickBooks`);
      }
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run the test
main();
