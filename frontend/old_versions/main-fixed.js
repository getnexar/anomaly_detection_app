// Main application entry point - Fixed version that uses global THREE
// Wait for Three.js to load before initializing
(function() {
    'use strict';
    
    // Check if Three.js is loaded
    function waitForThree(callback) {
        if (typeof THREE !== 'undefined' && THREE.OrbitControls) {
            callback();
        } else {
            setTimeout(() => waitForThree(callback), 100);
        }
    }
    
    class VideoAnalysisApp {
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
                console.log('🚀 Initializing Video Analysis App...');
                
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
            
            // Initialize 3D visualization
            this.visualization = new VideoVisualization3D({
                container: document.getElementById('three-canvas'),
                eventBus: this.eventBus,
                apiClient: this.apiClient
            });
            
            // Initialize control panel
            this.controlPanel = new ControlPanel({
                container: document.getElementById('control-panel'),
                eventBus: this.eventBus,
                apiClient: this.apiClient
            });
            
            // Initialize detail modal
            this.detailModal = new DetailModal({
                container: document.getElementById('detail-modal'),
                eventBus: this.eventBus,
                apiClient: this.apiClient
            });
            
            // Initialize video player
            this.videoPlayer = new VideoPlayer({
                container: document.getElementById('video-player-modal'),
                eventBus: this.eventBus,
                apiClient: this.apiClient
            });
            
            // Initialize all components
            await Promise.all([
                this.visualization.init(),
                this.controlPanel.init(),
                this.detailModal.init(),
                this.videoPlayer.init()
            ]);
            
            console.log('✅ All components initialized');
        }
        
        setupEventListeners() {
            console.log('🎧 Setting up event listeners...');
            
            // Point interaction events
            this.eventBus.on('point.hover', (data) => this.handlePointHover(data));
            this.eventBus.on('point.click', (data) => this.handlePointClick(data));
            this.eventBus.on('point.doubleclick', (data) => this.handlePointDoubleClick(data));
            this.eventBus.on('point.hover.end', () => this.handlePointHoverEnd());
            
            // Filter events
            this.eventBus.on('filter.apply', (filters) => this.handleFilterApply(filters));
            this.eventBus.on('filter.clear', () => this.handleFilterClear());
            
            // Search events
            this.eventBus.on('search.execute', (query) => this.handleSearch(query));
            this.eventBus.on('search.clear', () => this.handleSearchClear());
            
            // UI events
            this.setupUIEventListeners();
            
            console.log('✅ Event listeners configured');
        }
        
        setupUIEventListeners() {
            // Search functionality
            const searchBar = document.getElementById('search-bar');
            const searchBtn = document.getElementById('search-btn');
            let searchTimeout;
            
            if (searchBar) {
                searchBar.addEventListener('input', () => {
                    clearTimeout(searchTimeout);
                    searchTimeout = setTimeout(() => {
                        const query = searchBar.value.trim();
                        if (query) {
                            this.eventBus.emit('search.execute', query);
                        } else {
                            this.eventBus.emit('search.clear');
                        }
                    }, 300);
                });
            }
            
            if (searchBtn) {
                searchBtn.addEventListener('click', () => {
                    const query = searchBar.value.trim();
                    if (query) {
                        this.eventBus.emit('search.execute', query);
                    }
                });
            }
            
            // Window resize
            window.addEventListener('resize', () => {
                if (this.visualization) {
                    this.visualization.handleResize();
                }
            });
        }
        
        async loadInitialData() {
            console.log('📊 Loading initial data...');
            
            try {
                this.showLoading(true, 'Loading video data...');
                
                // Load health check first
                const health = await this.apiClient.getHealth();
                console.log('🏥 System health:', health);
                
                // Load initial batch of videos
                const videosResponse = await this.apiClient.getVideos({
                    page: 1,
                    per_page: 500
                });
                
                console.log(`📹 Loaded ${videosResponse.videos.length} videos`);
                
                // Update app state
                this.appState.totalVideos = videosResponse.pagination.total;
                this.appState.visiblePoints = videosResponse.videos;
                
                // Initialize visualization with data
                await this.visualization.loadVideoData(videosResponse.videos);
                
                // Update statistics
                this.updateStatistics({
                    totalVideos: this.appState.totalVideos,
                    visibleVideos: videosResponse.videos.length
                });
                
                console.log('✅ Initial data loaded successfully');
                
            } catch (error) {
                console.error('❌ Failed to load initial data:', error);
                this.showError('Failed to load video data');
            }
        }
        
        handlePointHover(data) {
            this.appState.hoveredPoint = data.videoId;
            this.showHoverTooltip(data);
        }
        
        handlePointHoverEnd() {
            this.appState.hoveredPoint = null;
            this.hideHoverTooltip();
        }
        
        async handlePointClick(data) {
            try {
                this.appState.selectedVideo = data.videoId;
                console.log('🎯 Point clicked:', data.videoId);
                
                // Show detail modal
                this.detailModal.show(null, true);
                
                // Fetch detailed video information
                const videoDetails = await this.apiClient.getVideoDetails(data.videoId);
                
                // Update modal with data
                this.detailModal.updateContent(videoDetails);
                
            } catch (error) {
                console.error('❌ Failed to handle point click:', error);
                this.showError('Failed to load video details');
                this.detailModal.hide();
            }
        }
        
        handlePointDoubleClick(data) {
            console.log('⚡ Double click - playing video:', data.videoId);
            this.eventBus.emit('video.play', data.videoId);
        }
        
        showHoverTooltip(data) {
            const tooltip = document.getElementById('hover-tooltip');
            if (!tooltip) return;
            
            const titleEl = tooltip.querySelector('.tooltip-title');
            const detailsEl = tooltip.querySelector('.tooltip-details');
            
            if (titleEl) titleEl.textContent = data.title || 'Unknown Video';
            if (detailsEl) {
                detailsEl.innerHTML = `
                    <div>Event: ${data.main_event || 'Unknown'}</div>
                    <div>Location: ${data.location || 'Unknown'}</div>
                    <div>Anomaly: ${((data.anomaly_score || 0) * 100).toFixed(1)}%</div>
                `;
            }
            
            tooltip.style.display = 'block';
            document.addEventListener('mousemove', this.updateTooltipPosition);
        }
        
        hideHoverTooltip() {
            const tooltip = document.getElementById('hover-tooltip');
            if (tooltip) {
                tooltip.style.display = 'none';
            }
            document.removeEventListener('mousemove', this.updateTooltipPosition);
        }
        
        updateTooltipPosition = (e) => {
            const tooltip = document.getElementById('hover-tooltip');
            if (!tooltip) return;
            
            const rect = tooltip.getBoundingClientRect();
            let x = e.clientX + 15;
            let y = e.clientY - 15;
            
            if (x + rect.width > window.innerWidth) {
                x = e.clientX - rect.width - 15;
            }
            if (y < 0) {
                y = e.clientY + 15;
            }
            
            tooltip.style.left = x + 'px';
            tooltip.style.top = y + 'px';
        }
        
        showLoading(show, message = 'Loading...') {
            const loader = document.getElementById('loading-indicator');
            if (!loader) return;
            
            const text = loader.querySelector('.loading-text');
            
            if (show) {
                if (text) text.textContent = message;
                loader.style.display = 'flex';
                this.appState.isLoading = true;
            } else {
                loader.style.display = 'none';
                this.appState.isLoading = false;
            }
        }
        
        showError(message) {
            console.error('🚨 Error:', message);
            
            const errorDiv = document.createElement('div');
            errorDiv.className = 'error-notification';
            errorDiv.innerHTML = `
                <div class="error-content">
                    <span class="error-icon">⚠️</span>
                    <span class="error-message">${message}</span>
                    <button class="error-close">×</button>
                </div>
            `;
            
            errorDiv.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: #dc3545;
                color: white;
                padding: 16px;
                border-radius: 4px;
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                z-index: 5000;
                max-width: 400px;
            `;
            
            document.body.appendChild(errorDiv);
            
            const removeError = () => {
                errorDiv.remove();
            };
            
            setTimeout(removeError, 5000);
            
            errorDiv.querySelector('.error-close').addEventListener('click', removeError);
        }
        
        updateStatistics(stats) {
            if (stats.totalVideos !== undefined) {
                const el = document.getElementById('total-videos');
                if (el) el.textContent = stats.totalVideos.toLocaleString();
            }
            if (stats.visibleVideos !== undefined) {
                const el = document.getElementById('visible-videos');
                if (el) el.textContent = stats.visibleVideos.toLocaleString();
            }
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
                        fpsCounter.textContent = `FPS: ${fps}`;
                    }
                    
                } catch (error) {
                    console.error('Render loop error:', error);
                }
                
                requestAnimationFrame(render);
            };
            
            render();
        }
        
        // Stub methods for missing functionality
        async handleFilterApply(filters) {
            console.log('🔍 Applying filters:', filters);
        }
        
        handleFilterClear() {
            console.log('🧹 Clearing filters');
            this.loadInitialData();
        }
        
        async handleSearch(query) {
            console.log('🔍 Searching for:', query);
        }
        
        handleSearchClear() {
            console.log('🧹 Clearing search');
        }
    }
    
    // Wait for all dependencies to load
    function initializeApp() {
        console.log('🌟 All dependencies loaded, starting Video Analysis App...');
        
        // Make sure all required globals are available
        if (typeof APIClient === 'undefined') {
            console.error('APIClient not loaded!');
            return;
        }
        if (typeof EventBus === 'undefined') {
            console.error('EventBus not loaded!');
            return;
        }
        if (typeof PerformanceMonitor === 'undefined') {
            console.error('PerformanceMonitor not loaded!');
            return;
        }
        if (typeof VideoVisualization3D === 'undefined') {
            console.error('VideoVisualization3D not loaded!');
            return;
        }
        if (typeof ControlPanel === 'undefined') {
            console.error('ControlPanel not loaded!');
            return;
        }
        if (typeof DetailModal === 'undefined') {
            console.error('DetailModal not loaded!');
            return;
        }
        if (typeof VideoPlayer === 'undefined') {
            console.error('VideoPlayer not loaded!');
            return;
        }
        
        window.videoAnalysisApp = new VideoAnalysisApp();
    }
    
    // Initialize when DOM is ready and Three.js is loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            waitForThree(initializeApp);
        });
    } else {
        waitForThree(initializeApp);
    }
})();