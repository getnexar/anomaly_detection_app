// Debug script to test API directly from browser
console.log('🔍 Starting API debug...');

async function testAPI() {
    console.log('\n📍 Testing /api/health...');
    try {
        const response = await fetch('/api/health');
        const data = await response.json();
        console.log('✅ Health response:', data);
    } catch (error) {
        console.error('❌ Health error:', error);
    }

    console.log('\n📍 Testing /api/videos...');
    try {
        const response = await fetch('/api/videos?page=1&per_page=5');
        const data = await response.json();
        console.log('✅ Videos response:', data);
        console.log(`   Found ${data.videos.length} videos`);
    } catch (error) {
        console.error('❌ Videos error:', error);
    }

    console.log('\n📍 Testing /api/clusters...');
    try {
        const response = await fetch('/api/clusters');
        const data = await response.json();
        console.log('✅ Clusters response:', data);
        console.log(`   Found ${data.clusters.length} clusters`);
    } catch (error) {
        console.error('❌ Clusters error:', error);
    }
}

// Run tests
testAPI().then(() => {
    console.log('\n✅ Debug complete! Check the responses above.');
});