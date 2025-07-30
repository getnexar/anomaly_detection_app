// API Client for backend communication
export class APIClient {
    constructor(baseURL = '/api') {
        this.baseURL = baseURL;
        this.defaultHeaders = {
            'Content-Type': 'application/json',
        };
        
        // Request timeout (30 seconds)
        this.timeout = 30000;
        
        // Cache for GET requests
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    }
    
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const config = {
            headers: { ...this.defaultHeaders, ...options.headers },
            ...options
        };
        
        // Add timeout
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
            
            console.error(`❌ API Error: ${config.method || 'GET'} ${url}`, error);
            throw error;
        }
    }
    
    async get(endpoint, params = {}, useCache = true) {
        // Build query string
        const queryString = new URLSearchParams(params).toString();
        const fullEndpoint = queryString ? `${endpoint}?${queryString}` : endpoint;
        
        // Check cache for GET requests
        if (useCache && this.cache.has(fullEndpoint)) {
            const cached = this.cache.get(fullEndpoint);
            if (Date.now() - cached.timestamp < this.cacheTimeout) {
                console.log(`💾 Cache hit: GET ${fullEndpoint}`);
                return cached.data;
            } else {
                this.cache.delete(fullEndpoint);
            }
        }
        
        const data = await this.request(fullEndpoint, { method: 'GET' });
        
        // Cache successful GET requests
        if (useCache) {
            this.cache.set(fullEndpoint, {
                data,
                timestamp: Date.now()
            });
        }
        
        return data;
    }
    
    async post(endpoint, data = {}) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }
    
    async put(endpoint, data = {}) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }
    
    async delete(endpoint) {
        return this.request(endpoint, { method: 'DELETE' });
    }
    
    // Video API methods
    async getVideos(params = {}) {
        return this.get('/videos', params);
    }
    
    async getVideoDetails(videoId) {
        return this.get(`/videos/${videoId}`);
    }
    
    async searchVideos(searchParams) {
        // Don't cache search requests as they're dynamic
        return this.post('/videos/search', searchParams);
    }
    
    async filterVideos(filterParams) {
        // Don't cache filter requests as they're dynamic
        return this.post('/videos/filter', filterParams);
    }
    
    async getMetadataFilters() {
        return this.get('/filters/metadata');
    }
    
    // Cluster API methods
    async getClusters(includeStats = false) {
        return this.get('/clusters', { include_stats: includeStats });
    }
    
    async getClusterDetails(clusterId) {
        return this.get(`/clusters/${clusterId}`);
    }
    
    // Anomaly API methods
    async getAnomalies(params = {}) {
        return this.get('/anomalies', params);
    }
    
    // Video streaming methods (with external API support)
    async getVideoThumbnailUrl(videoId, size = 'medium') {
        try {
            const response = await this.get(`/videos/${videoId}/thumbnail?size=${size}`);
            return response.thumbnail_url || null;
        } catch (error) {
            // External service unavailable, return placeholder
            console.warn(`Thumbnail unavailable for ${videoId}:`, error.message);
            return null;
        }
    }
    
    async getVideoStreamUrl(videoId, quality = 'medium') {
        try {
            const response = await this.get(`/videos/${videoId}/stream?quality=${quality}`);
            return response.stream_url || null;
        } catch (error) {
            // External service unavailable
            console.warn(`Video stream unavailable for ${videoId}:`, error.message);
            return null;
        }
    }
    
    async getVideoDownloadUrl(videoId) {
        try {
            const response = await this.get(`/videos/${videoId}/download`);
            return response.download_url || null;
        } catch (error) {
            // External service unavailable
            console.warn(`Video download unavailable for ${videoId}:`, error.message);
            return null;
        }
    }
    
    // Health check
    async getHealth() {
        return this.get('/health', {}, false); // Don't cache health checks
    }
    
    // Batch operations
    async getVideosBatch(videoIds) {
        // Split into smaller batches to avoid URL length limits
        const batchSize = 50;
        const batches = [];
        
        for (let i = 0; i < videoIds.length; i += batchSize) {
            const batch = videoIds.slice(i, i + batchSize);
            batches.push(batch);
        }
        
        const results = await Promise.all(
            batches.map(batch => 
                Promise.all(batch.map(id => this.getVideoDetails(id)))
            )
        );
        
        return results.flat();
    }
    
    // Cache management
    clearCache() {
        this.cache.clear();
        console.log('🧹 API cache cleared');
    }
    
    getCacheSize() {
        return this.cache.size;
    }
    
    getCacheInfo() {
        const info = {
            size: this.cache.size,
            entries: [],
            totalSize: 0
        };
        
        this.cache.forEach((value, key) => {
            const size = JSON.stringify(value.data).length;
            info.entries.push({
                endpoint: key,
                timestamp: value.timestamp,
                age: Date.now() - value.timestamp,
                size: size
            });
            info.totalSize += size;
        });
        
        return info;
    }
    
    // Error handling utilities
    isNetworkError(error) {
        return error.message.includes('fetch') || 
               error.message.includes('NetworkError') ||
               error.message.includes('timeout');
    }
    
    isServerError(error) {
        return error.message.includes('HTTP 5');
    }
    
    isClientError(error) {
        return error.message.includes('HTTP 4');
    }
    
    // Retry mechanism for failed requests
    async requestWithRetry(endpoint, options = {}, maxRetries = 3) {
        let lastError;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await this.request(endpoint, options);
            } catch (error) {
                lastError = error;
                
                // Don't retry client errors (4xx)
                if (this.isClientError(error)) {
                    throw error;
                }
                
                // Only retry network errors and server errors
                if (attempt < maxRetries && (this.isNetworkError(error) || this.isServerError(error))) {
                    const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
                    console.log(`🔄 Retrying request in ${delay}ms (attempt ${attempt}/${maxRetries})`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                }
                
                break;
            }
        }
        
        throw lastError;
    }
    
    // Convenience methods with retry
    async getWithRetry(endpoint, params = {}, useCache = true) {
        const queryString = new URLSearchParams(params).toString();
        const fullEndpoint = queryString ? `${endpoint}?${queryString}` : endpoint;
        
        // Check cache first
        if (useCache && this.cache.has(fullEndpoint)) {
            const cached = this.cache.get(fullEndpoint);
            if (Date.now() - cached.timestamp < this.cacheTimeout) {
                return cached.data;
            }
        }
        
        const data = await this.requestWithRetry(fullEndpoint, { method: 'GET' });
        
        // Cache successful requests
        if (useCache) {
            this.cache.set(fullEndpoint, {
                data,
                timestamp: Date.now()
            });
        }
        
        return data;
    }
    
    async postWithRetry(endpoint, data = {}) {
        return this.requestWithRetry(endpoint, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }
    
    // Upload progress tracking (for future file uploads)
    async uploadWithProgress(endpoint, formData, onProgress) {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            
            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable && onProgress) {
                    const progress = (e.loaded / e.total) * 100;
                    onProgress(progress);
                }
            });
            
            xhr.addEventListener('load', () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        const response = JSON.parse(xhr.responseText);
                        resolve(response);
                    } catch (error) {
                        resolve(xhr.responseText);
                    }
                } else {
                    reject(new Error(`HTTP ${xhr.status}: ${xhr.statusText}`));
                }
            });
            
            xhr.addEventListener('error', () => {
                reject(new Error('Upload failed'));
            });
            
            xhr.open('POST', `${this.baseURL}${endpoint}`);
            xhr.send(formData);
        });
    }
    
    // WebSocket connection (for future real-time features)
    createWebSocket(endpoint) {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}${this.baseURL}${endpoint}`;
        
        const ws = new WebSocket(wsUrl);
        
        ws.addEventListener('open', () => {
            console.log(`🔌 WebSocket connected: ${endpoint}`);
        });
        
        ws.addEventListener('close', () => {
            console.log(`🔌 WebSocket disconnected: ${endpoint}`);
        });
        
        ws.addEventListener('error', (error) => {
            console.error(`🔌 WebSocket error: ${endpoint}`, error);
        });
        
        return ws;
    }
}