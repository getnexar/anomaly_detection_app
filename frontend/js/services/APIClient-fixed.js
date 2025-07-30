// API Client for backend communication - Fixed version for global usage
class APIClient {
    constructor(baseURL = '/api') {
        this.baseURL = baseURL;
        this.defaultHeaders = {
            'Content-Type': 'application/json',
        };
        
        this.timeout = 30000;
        
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000;
    }
    
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const config = {
            headers: { ...this.defaultHeaders, ...options.headers },
            ...options
        };
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);
        config.signal = controller.signal;
        
        try {
            console.log(`🌐 API Request: ${config.method || 'GET'} ${url}`);
            
            const response = await fetch(url, config);
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            console.log(`✅ API Response: ${config.method || 'GET'} ${url} - Success`);
            
            return data;
            
        } catch (error) {
            clearTimeout(timeoutId);
            
            if (error.name === 'AbortError') {
                throw new Error('Request timeout');
            }
            
            console.error(`❌ API Error: ${config.method || 'GET'} ${url} - ${error.message}`);
            throw error;
        }
    }
    
    async get(endpoint, params = {}, useCache = true) {
        const queryString = new URLSearchParams(params).toString();
        const fullEndpoint = queryString ? `${endpoint}?${queryString}` : endpoint;
        
        if (useCache && this.cache.has(fullEndpoint)) {
            const cached = this.cache.get(fullEndpoint);
            if (Date.now() - cached.timestamp < this.cacheTimeout) {
                console.log(`📦 Using cached response for ${fullEndpoint}`);
                return cached.data;
            }
        }
        
        const data = await this.request(fullEndpoint);
        
        if (useCache) {
            this.cache.set(fullEndpoint, {
                data,
                timestamp: Date.now()
            });
        }
        
        return data;
    }
    
    async post(endpoint, body = {}) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(body)
        });
    }
    
    async put(endpoint, body = {}) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(body)
        });
    }
    
    async delete(endpoint) {
        return this.request(endpoint, {
            method: 'DELETE'
        });
    }
    
    async getHealth() {
        try {
            const response = await this.get('/health', {}, false);
            return response;
        } catch (error) {
            console.error('❌ Health check failed:', error);
            return { status: 'error', message: error.message };
        }
    }
    
    async getVideos(params = {}) {
        const defaultParams = {
            page: 1,
            per_page: 100,
            include_metadata: true,
            include_features: false
        };
        
        return this.get('/videos', { ...defaultParams, ...params });
    }
    
    async getVideoDetails(videoId) {
        return this.get(`/videos/${videoId}`, {
            include_metadata: true,
            include_features: true,
            include_analysis: true
        });
    }
    
    async searchVideos(params) {
        return this.post('/search', params);
    }
    
    async filterVideos(params) {
        return this.post('/filter', params);
    }
    
    async getClusters(params = {}) {
        return this.get('/analysis/clusters', params);
    }
    
    async getClusterDetails(clusterId) {
        return this.get(`/analysis/clusters/${clusterId}`, {
            include_videos: true,
            include_statistics: true
        });
    }
    
    async getAnomalies(params = {}) {
        const defaultParams = {
            threshold: 0.5,
            limit: 100,
            sort_by: 'score_desc'
        };
        
        return this.get('/analysis/anomalies', { ...defaultParams, ...params });
    }
    
    async getMetadataFilters() {
        return this.get('/metadata/filters');
    }
    
    async getCoordinates(params = {}) {
        const defaultParams = {
            projection: 'tsne',
            dimensions: 3
        };
        
        return this.get('/analysis/coordinates', { ...defaultParams, ...params });
    }
    
    async getStatistics() {
        return this.get('/statistics', {}, false);
    }
    
    async runAnalysis(analysisType, params = {}) {
        return this.post(`/analysis/${analysisType}`, params);
    }
    
    clearCache() {
        this.cache.clear();
        console.log('🧹 API cache cleared');
    }
    
    setHeader(name, value) {
        this.defaultHeaders[name] = value;
    }
    
    removeHeader(name) {
        delete this.defaultHeaders[name];
    }
    
    setTimeout(timeout) {
        this.timeout = timeout;
    }
}

// Make it globally available
window.APIClient = APIClient;