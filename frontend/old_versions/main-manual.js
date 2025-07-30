// Main application with manual camera controls
// Global app class
window.VideoAnalysisApp = class VideoAnalysisApp {
    constructor() {
        this.apiClient = new APIClient('/api');
        this.eventBus = new EventBus();
        this.performanceMonitor = new PerformanceMonitor();
        
        // Core components
        this.visualization = null;
        this.controlPanel = null;
        this.detailModal = null;
        this.videoPlayer = null;
        
        // Application state
        this.appState = {
            selectedVideo: null,
            activeFilters: {},
            visiblePoints: [],
            hoveredPoint: null,
            cameraPosition: null,
            clusterHighlights: new Set(),
            anomalyHighlightEnabled: false,
            currentViewMode: 'clusters',
            isLoading: false,
            totalVideos: 0
        };
        
        // Initialize application
        this.init();
    }
    
    async init() {
        try {
            console.log('🚀 Initializing Video Analysis App with manual controls...');
            
            // Show loading
            this.showLoading(true, 'Initializing application...');
            
            // Initialize performance monitoring
            this.performanceMonitor.start();
            
            // Initialize components
            await this.initializeComponents();
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Load initial data
            await this.loadInitialData();
            
            // Start render loop
            this.startRenderLoop();
            
            // Hide loading
            this.showLoading(false);
            
            console.log('✅ Video Analysis App initialized successfully');
            
        } catch (error) {
            console.error('❌ Failed to initialize app:', error);
            this.showLoading(false);
            this.showError(`Failed to initialize: ${error.message}`);
        }
    }
    
    async initializeComponents() {
        console.log('🔧 Initializing components...');
        
        try {
            const canvasEl = document.getElementById('three-canvas');
            
            // Initialize 3D visualization with manual controls
            this.visualization = new VideoVisualization3D({
                container: canvasEl,
                eventBus: this.eventBus,
                apiClient: this.apiClient
            });
            
            // Initialize control panel if exists
            const controlEl = document.getElementById('control-panel');
            if (controlEl && typeof ControlPanel !== 'undefined') {
                this.controlPanel = new ControlPanel({
                    container: controlEl,
                    eventBus: this.eventBus,
                    apiClient: this.apiClient
                });
            }
            
            // Initialize detail modal if exists
            const modalEl = document.getElementById('detail-modal');
            if (modalEl && typeof DetailModal !== 'undefined') {
                this.detailModal = new DetailModal({
                    container: modalEl,
                    eventBus: this.eventBus,
                    apiClient: this.apiClient
                });
            }
            
            // Initialize video player if exists
            const playerEl = document.getElementById('video-player-modal');
            if (playerEl && typeof VideoPlayer !== 'undefined') {
                this.videoPlayer = new VideoPlayer({
                    container: playerEl,
                    eventBus: this.eventBus,
                    apiClient: this.apiClient
                });
            }
            
            // Initialize all components
            const initPromises = [this.visualization.init()];
            
            if (this.controlPanel) initPromises.push(this.controlPanel.init());
            if (this.detailModal) initPromises.push(this.detailModal.init());
            if (this.videoPlayer) initPromises.push(this.videoPlayer.init());
            
            await Promise.all(initPromises);
            
            console.log('✅ All components initialized');
            
        } catch (error) {
            console.error('❌ Component initialization failed:', error);
            throw error;
        }
    }
    
    setupEventListeners() {
        console.log('🎧 Setting up event listeners...');
        
        // Point interaction events
        this.eventBus.on('point.hover', (data) => this.handlePointHover(data));
        this.eventBus.on('point.click', (data) => this.handlePointClick(data));
        this.eventBus.on('point.hover.end', () => this.handlePointHoverEnd());
        
        // Filter events
        this.eventBus.on('filter.apply', (filters) => this.handleFilterApply(filters));
        this.eventBus.on('filter.clear', () => this.handleFilterClear());
        
        // Search events
        this.eventBus.on('search.execute', (query) => this.handleSearch(query));
        this.eventBus.on('search.clear', () => this.handleSearchClear());
        
        // View mode events
        this.eventBus.on('view.change', (mode) => this.handleViewModeChange(mode));
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            switch(e.key.toLowerCase()) {
                case 'r':
                    if (!e.ctrlKey && !e.metaKey) {
                        this.visualization.resetCamera();
                    }
                    break;
                case 'f':
                    if (!e.ctrlKey && !e.metaKey) {
                        this.visualization.fitAllPoints();
                    }
                    break;
                case 'escape':
                    this.handleEscape();
                    break;
            }
        });
        
        // Window resize
        window.addEventListener('resize', () => {
            this.visualization?.handleResize();
        });
        
        console.log('✅ Event listeners configured');
    }
    
    async loadInitialData() {
        console.log('📊 Loading initial data...');
        
        try {
            this.showLoading(true, 'Loading video data...');
            
            // Load videos
            const videosResponse = await this.apiClient.getVideos({
                page: 1,
                per_page: 5000
            });
            
            console.log(`📹 Loaded ${videosResponse.videos.length} videos`);
            
            // Update app state
            this.appState.totalVideos = videosResponse.pagination.total;
            this.appState.visiblePoints = videosResponse.videos;
            
            // Update UI stats
            document.getElementById('total-videos').textContent = videosResponse.videos.length;
            document.getElementById('visible-videos').textContent = videosResponse.videos.length;
            
            // Initialize visualization with data
            await this.visualization.loadVideoData(videosResponse.videos);
            
            // Load additional data if control panel exists
            if (this.controlPanel) {
                try {
                    const filtersResponse = await this.apiClient.getMetadataFilters();
                    this.controlPanel.updateFilters(filtersResponse);
                } catch (error) {
                    console.warn('Could not load filters:', error);
                }
                
                try {
                    const clustersResponse = await this.apiClient.getClusters();
                    this.controlPanel.updateClusters(clustersResponse.clusters);
                } catch (error) {
                    console.warn('Could not load clusters:', error);
                }
            }
            
            console.log('✅ Initial data loaded successfully');
            
        } catch (error) {
            console.error('❌ Failed to load initial data:', error);
            this.showError('Failed to load video data. Please refresh the page.');
        }
    }
    
    // Event Handlers
    handlePointHover(data) {
        const hoverInfo = document.getElementById('hover-info');
        if (hoverInfo) {
            hoverInfo.innerHTML = `
                <strong>${data.title || data.videoId}</strong><br>
                Event: ${data.main_event || 'Unknown'}<br>
                Location: ${data.location || 'Unknown'}<br>
                Anomaly: ${((data.anomaly_score || 0) * 100).toFixed(1)}%<br>
                ${data.cluster_id !== undefined ? `Cluster: ${data.cluster_id}` : ''}
            `;
            hoverInfo.style.display = 'block';
            
            // Position near mouse
            const updatePosition = (e) => {
                hoverInfo.style.left = e.clientX + 10 + 'px';
                hoverInfo.style.top = e.clientY - 10 + 'px';
            };
            
            document.addEventListener('mousemove', updatePosition);
            hoverInfo._updatePosition = updatePosition;
        }
    }
    
    handlePointHoverEnd() {
        const hoverInfo = document.getElementById('hover-info');
        if (hoverInfo) {
            hoverInfo.style.display = 'none';
            if (hoverInfo._updatePosition) {
                document.removeEventListener('mousemove', hoverInfo._updatePosition);
                delete hoverInfo._updatePosition;
            }
        }
    }
    
    async handlePointClick(data) {
        try {
            // Update selected info panel
            const selectedInfo = document.getElementById('selected-info');
            if (selectedInfo && data.video) {
                selectedInfo.innerHTML = `
                    <h3>Selected Video</h3>
                    <strong>${data.video.title || data.videoId}</strong><br><br>
                    <strong>Details:</strong><br>
                    Event: ${data.video.main_event || 'Unknown'}<br>
                    Location: ${data.video.location || 'Unknown'}<br>
                    Time: ${data.video.event_time || 'Unknown'}<br>
                    Duration: ${data.video.duration || 'Unknown'}s<br><br>
                    <strong>Analysis:</strong><br>
                    Anomaly Score: ${((data.video.anomaly_score || 0) * 100).toFixed(1)}%<br>
                    Cluster ID: ${data.video.cluster_id !== undefined ? data.video.cluster_id : 'N/A'}<br>
                    Weather: ${data.video.weather_condition || 'Unknown'}<br>
                    Scene: ${data.video.scene_description || 'N/A'}
                `;
                selectedInfo.style.display = 'block';
            }
            
            // Update status
            document.getElementById('status').textContent = `Selected: ${data.video?.title || data.videoId}`;
            
            // Show detail modal if available
            if (this.detailModal && data.videoId) {
                this.detailModal.show(null, true);
                const videoDetails = await this.apiClient.getVideoDetails(data.videoId);
                this.detailModal.updateContent(videoDetails);
            }
            
        } catch (error) {
            console.error('Failed to handle point click:', error);
        }
    }
    
    async handleFilterApply(filters) {
        try {
            console.log('Applying filters:', filters);
            this.showLoading(true, 'Applying filters...');
            
            const filteredVideos = await this.apiClient.filterVideos({
                filters: filters,
                page: 1,
                per_page: 5000
            });
            
            await this.visualization.updateVisiblePoints(filteredVideos.videos);
            
            // Update stats
            document.getElementById('visible-videos').textContent = filteredVideos.videos.length;
            
            this.showLoading(false);
            
        } catch (error) {
            console.error('Failed to apply filters:', error);
            this.showError('Failed to apply filters');
            this.showLoading(false);
        }
    }
    
    handleFilterClear() {
        console.log('Clearing filters');
        this.loadInitialData();
    }
    
    async handleSearch(query) {
        try {
            console.log('Searching for:', query);
            this.showLoading(true, 'Searching...');
            
            const searchResults = await this.apiClient.searchVideos({
                query: query,
                limit: 100,
                similarity_threshold: 0.6
            });
            
            this.visualization.highlightSearchResults(searchResults.results);
            
            if (this.controlPanel) {
                this.controlPanel.updateSearchResults(searchResults);
            }
            
            this.showLoading(false);
            
        } catch (error) {
            console.error('Search failed:', error);
            this.showError('Search failed');
            this.showLoading(false);
        }
    }
    
    handleSearchClear() {
        this.visualization.clearSearchHighlight();
        if (this.controlPanel) {
            this.controlPanel.clearSearchResults();
        }
    }
    
    handleViewModeChange(mode) {
        console.log('Changing view mode to:', mode);
        this.appState.currentViewMode = mode;
        this.visualization.setViewMode(mode);
    }
    
    handleEscape() {
        // Hide selected info
        const selectedInfo = document.getElementById('selected-info');
        if (selectedInfo) {
            selectedInfo.style.display = 'none';
        }
        
        // Close modals
        if (this.detailModal?.isVisible()) {
            this.detailModal.hide();
        }
        if (this.videoPlayer?.isVisible()) {
            this.videoPlayer.hide();
        }
    }
    
    // Utility Methods
    showLoading(show, message = 'Loading...') {
        const loader = document.getElementById('loading-indicator');
        if (loader) {
            const text = loader.querySelector('.loading-text');
            if (text) text.textContent = message;
            loader.style.display = show ? 'flex' : 'none';
        }
        this.appState.isLoading = show;
    }
    
    showError(message) {
        console.error('Error:', message);
        
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-notification';
        errorDiv.innerHTML = `
            <span>${message}</span>
            <button onclick="this.parentElement.remove()">×</button>
        `;
        
        document.body.appendChild(errorDiv);
        
        setTimeout(() => errorDiv.remove(), 5000);
    }
    
    startRenderLoop() {
        const render = () => {
            try {
                // Update performance metrics
                this.performanceMonitor.update();
                
                // Update visualization
                if (this.visualization) {
                    this.visualization.render();
                }
                
                // Update FPS counter
                const fpsCounter = document.getElementById('fps-counter');
                if (fpsCounter) {
                    const fps = this.performanceMonitor.getFPS();
                    fpsCounter.textContent = Math.round(fps);
                }
                
            } catch (error) {
                console.error('Render loop error:', error);
            }
            
            requestAnimationFrame(render);
        };
        
        render();
    }
}

// Initialize app when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log('DOM loaded, creating VideoAnalysisApp');
        window.videoAnalysisApp = new VideoAnalysisApp();
    });
} else {
    console.log('DOM already loaded, creating VideoAnalysisApp');
    window.videoAnalysisApp = new VideoAnalysisApp();
}