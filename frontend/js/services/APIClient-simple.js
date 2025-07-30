// Simple APIClient for non-module usage
window.APIClient = class APIClient {
    constructor(baseURL = '/api') {
        this.baseURL = baseURL;
    }
    
    async request(endpoint, options = {}) {
        try {
            const response = await fetch(`${this.baseURL}${endpoint}`, {
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('API request failed:', error);
            throw error;
        }
    }
    
    async getHealth() {
        return this.request('/health');
    }
    
    async getVideos(params = {}) {
        const queryParams = new URLSearchParams({
            page: params.page || 1,
            per_page: params.per_page || 100,
            ...params
        });
        return this.request(`/videos?${queryParams}`);
    }
    
    async getVideoDetails(videoId) {
        return this.request(`/videos/${videoId}`);
    }
    
    async filterVideos(params) {
        return this.request('/videos/filter', {
            method: 'POST',
            body: JSON.stringify(params)
        });
    }
    
    async searchVideos(params) {
        return this.request('/search', {
            method: 'POST',
            body: JSON.stringify(params)
        });
    }
    
    async getClusters() {
        return this.request('/clusters');
    }
    
    async getClusterDetails(clusterId) {
        return this.request(`/clusters/${clusterId}`);
    }
    
    async getAnomalies(params = {}) {
        const queryParams = new URLSearchParams(params);
        return this.request(`/anomalies?${queryParams}`);
    }
    
    async getMetadataFilters() {
        return this.request('/metadata/filters');
    }
}