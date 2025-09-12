const axios = require('axios');

// Test marking vinyl as used
async function testMarkVinylAsUsed() {
    try {
        // First login to get token
        const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
            username: 'admin',
            password: 'admin123'
        });
        
        const { accessToken } = loginResponse.data;
        console.log('✅ Login successful');
        
        // Create axios instance with auth
        const api = axios.create({
            baseURL: 'http://localhost:3001/api',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });
        
        // Test marking vinyl ID 1 as used
        const vinylId = 1;
        console.log(`\n📦 Testing marking vinyl ID ${vinylId} as used...`);
        
        // First, try to get the vinyl item
        try {
            const getResponse = await api.get(`/vinyl/${vinylId}`);
            console.log(`✅ Successfully fetched vinyl ID ${vinylId}:`, {
                brand: getResponse.data.brand,
                series: getResponse.data.series,
                disposition: getResponse.data.disposition
            });
        } catch (getError) {
            console.error(`❌ Error fetching vinyl ID ${vinylId}:`, getError.response?.data || getError.message);
        }
        
        // Now try to mark it as used
        try {
            const markUsedResponse = await api.put(`/vinyl/${vinylId}/use`, {
                usage_note: 'Test usage from script',
                job_ids: []
            });
            console.log(`✅ Successfully marked vinyl ID ${vinylId} as used:`, markUsedResponse.data);
        } catch (markError) {
            console.error(`❌ Error marking vinyl ID ${vinylId} as used:`, markError.response?.data || markError.message);
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.response?.data || error.message);
    }
}

testMarkVinylAsUsed();