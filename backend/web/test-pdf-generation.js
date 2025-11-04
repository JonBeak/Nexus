/**
 * Test Script for PDF Generation
 * Tests Phase 1.c PDF form generation for Order #200000
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'localhost';
const PORT = 3001;

// Helper function to make HTTP requests
function makeRequest(method, path, data = null, token = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: BASE_URL,
      port: PORT,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

async function testPDFGeneration() {
  console.log('='.repeat(60));
  console.log('Phase 1.c: PDF Generation Test');
  console.log('='.repeat(60));
  console.log('');

  try {
    // Step 1: Login
    console.log('Step 1: Logging in as jonbeak...');
    const loginResponse = await makeRequest('POST', '/api/auth/login', {
      username: 'jonbeak',
      password: 'owner123'
    });

    if (loginResponse.status !== 200 || !loginResponse.data.accessToken) {
      console.error('❌ Login failed:', loginResponse.data);
      return;
    }

    const token = loginResponse.data.accessToken;
    console.log('✅ Login successful!');
    console.log('   Token received:', token.substring(0, 30) + '...');
    console.log('');

    // Step 2: Check if order exists
    console.log('Step 2: Checking Order #200000 (order_id: 200003)...');
    const orderResponse = await makeRequest('GET', '/api/orders/200003', null, token);

    if (orderResponse.status !== 200) {
      console.error('❌ Order not found:', orderResponse.data);
      return;
    }

    console.log('✅ Order found!');
    console.log('   Order Name:', orderResponse.data.data.order_name);
    console.log('   Customer:', orderResponse.data.data.customer_name || 'N/A');
    console.log('   Parts:', orderResponse.data.data.parts?.length || 0);
    console.log('');

    // Step 3: Generate PDFs
    console.log('Step 3: Generating PDF forms...');
    console.log('   Generating: Master, Shop, Customer, Packing List');

    const generateResponse = await makeRequest('POST', '/api/orders/200003/forms', {
      createNewVersion: false
    }, token);

    console.log('');
    console.log('Response Status:', generateResponse.status);
    console.log('Response Data:', JSON.stringify(generateResponse.data, null, 2));
    console.log('');

    if (generateResponse.status !== 200) {
      console.error('❌ PDF generation failed!');
      console.error('   Error:', generateResponse.data);
      return;
    }

    console.log('✅ PDF generation successful!');
    console.log('');

    // Step 4: Check generated files
    console.log('Step 4: Checking generated files...');
    const orderDir = '/mnt/channelletter/NexusTesting/Order-200000';

    try {
      const files = fs.readdirSync(orderDir);
      console.log('✅ Directory exists:', orderDir);
      console.log('');
      console.log('Files generated:');

      const expectedFiles = ['master-form.pdf', 'shop-form.pdf', 'customer-form.pdf', 'packing-list.pdf'];

      expectedFiles.forEach(fileName => {
        const filePath = path.join(orderDir, fileName);
        if (fs.existsSync(filePath)) {
          const stats = fs.statSync(filePath);
          const sizeKB = (stats.size / 1024).toFixed(2);
          console.log(`   ✅ ${fileName} (${sizeKB} KB)`);
        } else {
          console.log(`   ❌ ${fileName} - NOT FOUND`);
        }
      });

      console.log('');
      console.log('All files in directory:');
      files.forEach(file => {
        const filePath = path.join(orderDir, file);
        const stats = fs.statSync(filePath);
        if (stats.isFile()) {
          const sizeKB = (stats.size / 1024).toFixed(2);
          console.log(`   - ${file} (${sizeKB} KB)`);
        } else if (stats.isDirectory()) {
          console.log(`   - ${file}/ (directory)`);
        }
      });

    } catch (err) {
      console.error('❌ Error checking files:', err.message);
    }

    console.log('');
    console.log('='.repeat(60));
    console.log('✅ TEST COMPLETE!');
    console.log('='.repeat(60));
    console.log('');
    console.log('Next steps:');
    console.log('1. Open the PDFs to verify formatting');
    console.log('2. Test regeneration with createNewVersion: true');
    console.log('3. Verify archiving works correctly');
    console.log('');

  } catch (error) {
    console.error('');
    console.error('❌ Test failed with error:');
    console.error(error);
  }
}

// Run the test
testPDFGeneration();
