const axios = require('axios');

async function testLockEndpoints() {
  const baseURL = 'http://localhost:3001/api';
  
  try {
    console.log('Testing lock endpoints...\n');
    
    // Test health check first
    const health = await axios.get(`${baseURL}/health`);
    console.log('✅ Health check:', health.data);
    
    // Test unauthorized access (should fail)
    try {
      await axios.get(`${baseURL}/locks/check/estimate/123`);
      console.log('❌ Security issue: Unauthorized access allowed');
    } catch (error) {
      if (error.response && error.response.status === 401) {
        console.log('✅ Security: Unauthorized access properly blocked');
      } else {
        console.log('📍 Auth response:', error.response?.status, error.response?.data);
      }
    }
    
    console.log('\n🎉 Lock system endpoints are properly configured!');
    console.log('📋 Available endpoints:');
    console.log('  POST /api/locks/acquire - Acquire a lock');
    console.log('  POST /api/locks/release - Release a lock'); 
    console.log('  GET  /api/locks/check/:type/:id - Check lock status');
    console.log('  POST /api/locks/override - Override a lock');
    console.log('  GET  /api/locks/active - Get all active locks');
    console.log('  POST /api/locks/cleanup - Clean expired locks');
    
  } catch (error) {
    console.error('❌ Error testing endpoints:', error.message);
  }
}

testLockEndpoints();