// Main application entry point
import { VideoVisualization3D } from './components/VideoVisualization3D.js';
import { ControlPanel } from './components/ControlPanel.js';
import { DetailModal } from './components/DetailModal.js';
import { VideoPlayer } from './components/VideoPlayer.js';
import { APIClient } from './services/APIClient.js';
import { EventBus } from './utils/EventBus.js';
import { PerformanceMonitor } from './utils/PerformanceMonitor.js';

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
            currentViewMode: 'clusters', // clusters, anomalies, events
            isLoading: false,
            totalVideos: 0
        };
        
        // Initialize application
        this.init();
    }
    
    async init() {
        try {
            console.log('🚀 Initializing Video Analysis App...');
            console.log('Step 1: Starting initialization');
            
            // Show loading
            this.showLoading(true, 'Initializing application...');
            console.log('Step 2: Loading screen shown');
            
            // Initialize performance monitoring
            try {
                this.performanceMonitor.start();
                console.log('Step 3: Performance monitor started');
            } catch (e) {
                console.error('Step 3 FAILED:', e);
                throw e;
            }
            
            // Initialize components
            console.log('Step 4: About to initialize components');
            try {
                await this.initializeComponents();
                console.log('Step 5: Components initialized');
            } catch (e) {
                console.error('Step 5 FAILED - Component initialization error:', e);
                console.error('Error details:', e.stack);
                throw e;
            }
            
            // Set up event listeners
            console.log('Step 6: Setting up event listeners');
            try {
                this.setupEventListeners();
                console.log('Step 7: Event listeners set up');
            } catch (e) {
                console.error('Step 7 FAILED:', e);
                throw e;
            }
            
            // Load initial data
            console.log('Step 8: About to load initial data');
            try {
                await this.loadInitialData();
                console.log('Step 9: Initial data loaded');
            } catch (e) {
                console.error('Step 9 FAILED - Data loading error:', e);
                console.error('Error details:', e.stack);
                // Don't throw here, try to continue
            }
            
            // Start render loop
            console.log('Step 10: Starting render loop');
            try {
                this.startRenderLoop();
                console.log('Step 11: Render loop started');
            } catch (e) {
                console.error('Step 11 FAILED:', e);
                // Don't throw here, try to continue
            }
            
            // Hide loading
            console.log('Step 12: Hiding loading screen');
            this.showLoading(false);
            
            console.log('✅ Video Analysis App initialized successfully');
            
        } catch (error) {
            console.error('❌ CRITICAL: Failed to initialize app:', error);
            console.error('Error type:', error.constructor.name);
            console.error('Error message:', error.message);
            console.error('Error stack:', error.stack);
            
            // Try to hide loading anyway
            try {
                this.showLoading(false);
            } catch (e) {
                console.error('Could not hide loading:', e);
            }
            
            this.showError(`Failed to initialize: ${error.message}`);
        }
    }
    
    async initializeComponents() {
        console.log('🔧 Initializing components...');
        
        try {
            // Check if elements exist
            const canvasEl = document.getElementById('three-canvas');
            console.log('Canvas element:', canvasEl ? 'Found' : 'NOT FOUND');
            
            const controlEl = document.getElementById('control-panel');
            console.log('Control panel element:', controlEl ? 'Found' : 'NOT FOUND');
            
            const modalEl = document.getElementById('detail-modal');
            console.log('Detail modal element:', modalEl ? 'Found' : 'NOT FOUND');
            
            const playerEl = document.getElementById('video-player-modal');
            console.log('Video player element:', playerEl ? 'Found' : 'NOT FOUND');
            
            // Initialize 3D visualization
            console.log('Creating VideoVisualization3D...');
            this.visualization = new VideoVisualization3D({
                container: canvasEl || document.createElement('div'),
                eventBus: this.eventBus,
                apiClient: this.apiClient
            });
            console.log('VideoVisualization3D created');
            
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
            console.log('Initializing components in parallel...');
            try {
                await Promise.all([
                    this.visualization.init().catch(e => {
                        console.error('Visualization init failed:', e);
                        throw e;
                    }),
                    this.controlPanel.init().catch(e => {
                        console.error('ControlPanel init failed:', e);
                        throw e;
                    }),
                    this.detailModal.init().catch(e => {
                        console.error('DetailModal init failed:', e);
                        throw e;
                    }),
                    this.videoPlayer.init().catch(e => {
                        console.error('VideoPlayer init failed:', e);
                        throw e;
                    })
                ]);
                console.log('✅ All components initialized');
            } catch (e) {
                console.error('Component initialization failed:', e);
                throw e;
            }
            
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
        this.eventBus.on('point.doubleclick', (data) => this.handlePointDoubleClick(data));
        this.eventBus.on('point.hover.end', () => this.handlePointHoverEnd());
        
        // Filter events
        this.eventBus.on('filter.apply', (filters) => this.handleFilterApply(filters));
        this.eventBus.on('filter.clear', () => this.handleFilterClear());
        
        // Search events\n        this.eventBus.on('search.execute', (query) => this.handleSearch(query));
        this.eventBus.on('search.clear', () => this.handleSearchClear());
        
        // Cluster events
        this.eventBus.on('cluster.highlight', (clusterId) => this.handleClusterHighlight(clusterId));
        this.eventBus.on('cluster.focus', (clusterId) => this.handleClusterFocus(clusterId));
        this.eventBus.on('cluster.clear', () => this.handleClusterClear());
        
        // Anomaly events
        this.eventBus.on('anomaly.toggle', (enabled) => this.handleAnomalyToggle(enabled));
        this.eventBus.on('anomaly.focus', () => this.handleAnomalyFocus());
        
        // Video player events
        this.eventBus.on('video.play', (videoId) => this.handleVideoPlay(videoId));
        this.eventBus.on('video.close', () => this.handleVideoClose());
        
        // View mode events
        this.eventBus.on('view.change', (mode) => this.handleViewModeChange(mode));
        
        // UI events
        this.setupUIEventListeners();
        
        console.log('✅ Event listeners configured');
    }
    
    setupUIEventListeners() {
        // Search bar functionality
        const searchBar = document.getElementById('search-bar');
        const searchBtn = document.getElementById('search-btn');
        let searchTimeout;
        
        const handleSearch = () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                const query = searchBar.value.trim();
                if (query) {
                    this.eventBus.emit('search.execute', query);
                } else {
                    this.eventBus.emit('search.clear');
                }
            }, 300); // Debounce
        };
        
        searchBar.addEventListener('input', handleSearch);
        searchBtn.addEventListener('click', handleSearch);
        
        // Navigation controls
        document.getElementById('reset-camera')?.addEventListener('click', () => {
            this.visualization.resetCamera();
        });
        
        document.getElementById('fit-all')?.addEventListener('click', () => {
            this.visualization.fitAllPoints();
        });
        
        document.getElementById('zoom-in')?.addEventListener('click', () => {
            this.visualization.zoomIn();
        });
        
        document.getElementById('zoom-out')?.addEventListener('click', () => {
            this.visualization.zoomOut();
        });
        
        document.getElementById('toggle-fullscreen')?.addEventListener('click', () => {
            this.toggleFullscreen();
        });
        
        // View mode buttons
        const viewButtons = document.querySelectorAll('.view-btn');
        viewButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const mode = btn.id.replace('-view', '');
                this.eventBus.emit('view.change', mode);
            });
        });
        
        // Panel toggle
        document.getElementById('toggle-panel')?.addEventListener('click', () => {
            this.toggleControlPanel();
        });
        
        // Modal controls
        this.setupModalControls();
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            this.handleKeyboardShortcuts(e);
        });
        
        // Window resize
        window.addEventListener('resize', () => {
            this.visualization?.handleResize();
        });
        
        // Prevent context menu on canvas
        document.getElementById('three-canvas')?.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });
    }
    
    setupModalControls() {
        // Settings modal
        const settingsBtn = document.getElementById('settings-btn');
        const settingsModal = document.getElementById('settings-modal');
        
        settingsBtn?.addEventListener('click', () => {
            this.showModal('settings-modal');
        });
        
        // Help modal
        const helpBtn = document.getElementById('help-btn');
        const helpModal = document.getElementById('help-modal');
        
        helpBtn?.addEventListener('click', () => {
            this.showModal('help-modal');
        });
        
        // Close buttons for all modals
        document.querySelectorAll('.close-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal');
                if (modal) {
                    this.hideModal(modal.id);
                }
            });
        });
        
        // Click outside to close modals
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal || e.target.classList.contains('modal-backdrop')) {
                    this.hideModal(modal.id);
                }
            });
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
            console.log('Fetching videos from API...');
            const videosResponse = await this.apiClient.getVideos({
                page: 1,
                per_page: 5000  // Start with reasonable batch
            });
            
            console.log(`📹 Loaded ${videosResponse.videos.length} videos`);
            console.log('First video:', videosResponse.videos[0]);
            
            // Update app state
            this.appState.totalVideos = videosResponse.pagination.total;
            this.appState.visiblePoints = videosResponse.videos;
            console.log('App state updated');
            
            // Initialize visualization with data
            console.log('About to call visualization.loadVideoData...');
            if (this.visualization && this.visualization.loadVideoData) {
                await this.visualization.loadVideoData(videosResponse.videos);
                console.log('Visualization data loaded');
            } else {
                console.error('Visualization not ready or loadVideoData method missing!');
                console.log('this.visualization:', this.visualization);
            }
            
            // Load metadata filters
            try {
                const filtersResponse = await this.apiClient.getMetadataFilters();
                this.controlPanel.updateFilters(filtersResponse);
            } catch (error) {
                console.warn('⚠️ Could not load filters:', error);
            }
            
            // Load cluster information
            try {
                const clustersResponse = await this.apiClient.getClusters();
                this.controlPanel.updateClusters(clustersResponse.clusters);
                this.updateStatistics({
                    totalVideos: this.appState.totalVideos,
                    visibleVideos: videosResponse.videos.length,
                    totalClusters: clustersResponse.clusters.length
                });
            } catch (error) {
                console.warn('⚠️ Could not load clusters:', error);
            }
            
            // Load anomaly information
            try {
                const anomaliesResponse = await this.apiClient.getAnomalies({ limit: 100 });
                this.controlPanel.updateAnomalies(anomaliesResponse.anomalies);
                this.updateStatistics({
                    anomalyCount: anomaliesResponse.anomalies.length
                });
            } catch (error) {
                console.warn('⚠️ Could not load anomalies:', error);
            }
            
            console.log('✅ Initial data loaded successfully');
            
        } catch (error) {
            console.error('❌ Failed to load initial data:', error);
            this.showError('Failed to load video data. Some features may not work properly.');
        }
    }
    
    // Event Handlers
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
            
            // Show detail modal with loading state
            this.detailModal.show(null, true); // Show with loading
            
            // Fetch detailed video information
            const videoDetails = await this.apiClient.getVideoDetails(data.videoId);
            
            // Update modal with data
            this.detailModal.updateContent(videoDetails);
            
            // Animate camera to point
            if (data.coordinates) {
                this.visualization.animateCameraToPoint(data.coordinates);
            }
            
        } catch (error) {
            console.error('❌ Failed to handle point click:', error);
            this.showError('Failed to load video details');
            this.detailModal.hide();
        }
    }
    
    handlePointDoubleClick(data) {
        // Double click to play video immediately
        console.log('⚡ Double click - playing video:', data.videoId);
        this.eventBus.emit('video.play', data.videoId);
    }
    
    async handleFilterApply(filters) {
        try {
            console.log('🔍 Applying filters:', filters);
            
            this.showLoading(true, 'Applying filters...');
            this.appState.activeFilters = filters;
            
            // Apply filters via API
            const filteredVideos = await this.apiClient.filterVideos({
                filters: filters,
                page: 1,
                per_page: 5000
            });
            
            console.log(`✅ Filtered to ${filteredVideos.videos.length} videos`);
            
            // Update visualization
            await this.visualization.updateVisiblePoints(filteredVideos.videos);
            
            // Update state
            this.appState.visiblePoints = filteredVideos.videos;
            
            // Update statistics
            this.updateStatistics({
                visibleVideos: filteredVideos.videos.length,
                filteredOut: this.appState.totalVideos - filteredVideos.videos.length
            });
            
            this.showLoading(false);
            
        } catch (error) {
            console.error('❌ Failed to apply filters:', error);
            this.showError('Failed to apply filters');
            this.showLoading(false);
        }
    }
    
    handleFilterClear() {
        console.log('🧹 Clearing filters');
        this.appState.activeFilters = {};
        // Reload initial data
        this.loadInitialData();
    }
    
    async handleSearch(query) {
        try {
            console.log('🔍 Searching for:', query);
            
            this.showLoading(true, 'Searching...');
            
            // Perform semantic search
            const searchResults = await this.apiClient.searchVideos({
                query: query,
                limit: 100,
                similarity_threshold: 0.6,
                include_metadata: true
            });
            
            console.log(`🔍 Found ${searchResults.results.length} results`);
            
            // Highlight search results in visualization
            this.visualization.highlightSearchResults(searchResults.results);
            
            // Update control panel with results
            this.controlPanel.updateSearchResults(searchResults);
            
            // Animate to first result if available
            if (searchResults.results.length > 0) {
                const firstResult = searchResults.results[0];
                if (firstResult.coordinates) {
                    this.visualization.animateCameraToPoint(firstResult.coordinates);
                }
            }
            
            this.showLoading(false);
            
        } catch (error) {
            console.error('❌ Search failed:', error);
            this.showError('Search failed. Please try again.');
            this.showLoading(false);
        }
    }
    
    handleSearchClear() {
        console.log('🧹 Clearing search');
        this.visualization.clearSearchHighlight();
        this.controlPanel.clearSearchResults();
    }
    
    handleClusterHighlight(clusterId) {
        console.log('🎯 Toggling cluster highlight:', clusterId);
        
        if (this.appState.clusterHighlights.has(clusterId)) {
            this.appState.clusterHighlights.delete(clusterId);
        } else {
            this.appState.clusterHighlights.add(clusterId);
        }
        
        this.visualization.updateClusterHighlights(this.appState.clusterHighlights);
        this.controlPanel.updateClusterHighlights(this.appState.clusterHighlights);
    }
    
    async handleClusterFocus(clusterId) {
        try {
            console.log('🔍 Focusing on cluster:', clusterId);
            
            // Get cluster details
            const clusterInfo = await this.apiClient.getClusterDetails(clusterId);
            
            // Focus camera on cluster
            this.visualization.focusOnCluster(clusterInfo);
            
            // Show cluster info in control panel
            this.controlPanel.showClusterInfo(clusterInfo);
            
        } catch (error) {
            console.error('❌ Failed to focus on cluster:', error);
            this.showError('Failed to focus on cluster');
        }
    }
    
    handleClusterClear() {
        console.log('🧹 Clearing cluster highlights');
        this.appState.clusterHighlights.clear();
        this.visualization.updateClusterHighlights(this.appState.clusterHighlights);
        this.controlPanel.updateClusterHighlights(this.appState.clusterHighlights);
    }
    
    handleAnomalyToggle(enabled) {
        console.log('⚠️ Toggling anomaly highlight:', enabled);
        this.appState.anomalyHighlightEnabled = enabled;
        this.visualization.toggleAnomalyHighlight(enabled);
    }
    
    async handleAnomalyFocus() {
        try {
            console.log('⚠️ Focusing on anomalies');
            
            this.showLoading(true, 'Loading anomalies...');
            
            // Get top anomalies
            const anomalies = await this.apiClient.getAnomalies({ limit: 50, threshold: 0.5 });
            
            // Focus on anomalies in visualization
            this.visualization.focusOnAnomalies(anomalies.anomalies);
            
            // Update control panel
            this.controlPanel.updateAnomalies(anomalies.anomalies);
            
            this.showLoading(false);
            
        } catch (error) {
            console.error('❌ Failed to focus on anomalies:', error);
            this.showError('Failed to focus on anomalies');
            this.showLoading(false);
        }
    }
    
    async handleVideoPlay(videoId) {
        try {
            console.log('▶️ Playing video:', videoId);
            
            // Get video details if we don't have them
            let videoData = this.appState.visiblePoints.find(v => v.video_id === videoId);
            if (!videoData) {
                videoData = await this.apiClient.getVideoDetails(videoId);
            }
            
            // Show video player
            this.videoPlayer.show(videoId, videoData);
            
        } catch (error) {
            console.error('❌ Failed to play video:', error);
            this.showError('Failed to load video');
        }
    }
    
    handleVideoClose() {
        console.log('⏹️ Closing video player');
        this.videoPlayer.hide();
    }
    
    handleViewModeChange(mode) {
        console.log('👁️ Changing view mode to:', mode);
        
        this.appState.currentViewMode = mode;
        
        // Update view buttons
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.getElementById(`${mode}-view`)?.classList.add('active');
        
        // Update visualization
        this.visualization.setViewMode(mode);
    }
    
    // Utility Methods
    showHoverTooltip(data) {
        const tooltip = document.getElementById('hover-tooltip');
        const titleEl = tooltip.querySelector('.tooltip-title');
        const detailsEl = tooltip.querySelector('.tooltip-details');
        
        titleEl.textContent = data.title || 'Unknown Video';
        detailsEl.innerHTML = `
            <div>Event: ${data.main_event || 'Unknown'}</div>
            <div>Location: ${data.location || 'Unknown'}</div>
            <div>Anomaly: ${((data.anomaly_score || 0) * 100).toFixed(1)}%</div>
            ${data.cluster_id !== undefined ? `<div>Cluster: ${data.cluster_id}</div>` : ''}
        `;
        
        tooltip.style.display = 'block';
        
        // Position tooltip near mouse
        document.addEventListener('mousemove', this.updateTooltipPosition);
    }
    
    hideHoverTooltip() {
        const tooltip = document.getElementById('hover-tooltip');
        tooltip.style.display = 'none';
        document.removeEventListener('mousemove', this.updateTooltipPosition);
    }
    
    updateTooltipPosition = (e) => {
        const tooltip = document.getElementById('hover-tooltip');
        const rect = tooltip.getBoundingClientRect();
        
        let x = e.clientX + 15;
        let y = e.clientY - 15;
        
        // Keep tooltip in viewport
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
        const text = loader.querySelector('.loading-text');
        
        if (show) {
            text.textContent = message;
            loader.style.display = 'flex';
            this.appState.isLoading = true;
        } else {
            loader.style.display = 'none';
            this.appState.isLoading = false;
        }
    }
    
    showError(message) {
        console.error('🚨 Error:', message);
        
        // Create error notification
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-notification';
        errorDiv.innerHTML = `
            <div class="error-content">
                <span class="error-icon">⚠️</span>
                <span class="error-message">${message}</span>
                <button class="error-close">×</button>
            </div>
        `;
        
        // Add styles
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: var(--accent-red);
            color: white;
            padding: 16px;
            border-radius: var(--border-radius);
            box-shadow: var(--shadow-heavy);
            z-index: 5000;
            max-width: 400px;
            animation: slideInRight 0.3s ease-out;
        `;
        
        document.body.appendChild(errorDiv);
        
        // Auto remove after 5 seconds
        const removeError = () => {
            errorDiv.style.animation = 'slideOutRight 0.3s ease-out';
            setTimeout(() => errorDiv.remove(), 300);
        };
        
        setTimeout(removeError, 5000);
        
        // Manual close
        errorDiv.querySelector('.error-close').addEventListener('click', removeError);
    }
    
    updateStatistics(stats) {
        if (stats.totalVideos !== undefined) {
            document.getElementById('total-videos').textContent = stats.totalVideos.toLocaleString();
        }
        if (stats.visibleVideos !== undefined) {
            document.getElementById('visible-videos').textContent = stats.visibleVideos.toLocaleString();
        }
        if (stats.totalClusters !== undefined) {
            document.getElementById('cluster-count').textContent = stats.totalClusters.toLocaleString();
        }
        if (stats.anomalyCount !== undefined) {
            document.getElementById('anomaly-count').textContent = stats.anomalyCount.toLocaleString();
        }
    }
    
    showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    }
    
    hideModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('closing');
            setTimeout(() => {
                modal.classList.remove('active', 'closing');
                document.body.style.overflow = '';
            }, 200);
        }
    }
    
    toggleControlPanel() {
        const panel = document.getElementById('control-panel');
        const button = document.getElementById('toggle-panel');
        
        panel.classList.toggle('collapsed');
        button.textContent = panel.classList.contains('collapsed') ? '▶' : '◀';
    }
    
    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.warn('Cannot enter fullscreen:', err);
            });
        } else {
            document.exitFullscreen();
        }
    }
    
    handleKeyboardShortcuts(e) {
        // Don't handle shortcuts if typing in input
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            return;
        }
        
        if (e.ctrlKey || e.metaKey) {
            switch (e.key.toLowerCase()) {
                case 'f':
                    e.preventDefault();
                    document.getElementById('search-bar').focus();
                    break;
                case 'r':
                    e.preventDefault();
                    this.visualization.resetCamera();
                    break;
            }
        } else {
            switch (e.key.toLowerCase()) {
                case 'escape':
                    // Close any open modals
                    document.querySelectorAll('.modal.active').forEach(modal => {
                        this.hideModal(modal.id);
                    });
                    // Close video player
                    if (this.videoPlayer.isVisible()) {
                        this.videoPlayer.hide();
                    }
                    break;
                case 'r':
                    this.visualization.resetCamera();
                    break;
                case 'f':
                    this.visualization.fitAllPoints();
                    break;
                case 'a':
                    this.handleAnomalyFocus();
                    break;
                case '1':
                    this.handleViewModeChange('clusters');
                    break;
                case '2':
                    this.handleViewModeChange('anomalies');
                    break;
                case '3':
                    this.handleViewModeChange('events');
                    break;
                case 'h':
                    this.showModal('help-modal');
                    break;
            }
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
                    
                    // Color code FPS
                    if (fps >= 55) {
                        fpsCounter.style.color = 'var(--accent-green)';
                    } else if (fps >= 30) {
                        fpsCounter.style.color = 'var(--accent-orange)';
                    } else {
                        fpsCounter.style.color = 'var(--accent-red)';
                    }
                }
                
                // Update point count
                const pointCount = document.getElementById('point-count');
                if (pointCount) {
                    pointCount.textContent = `Points: ${this.appState.visiblePoints.length.toLocaleString()}`;
                }
                
                // Update render time
                const renderTime = document.getElementById('render-time');
                if (renderTime) {
                    renderTime.textContent = `Render: ${this.performanceMonitor.getLastFrameTime()}ms`;
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
document.addEventListener('DOMContentLoaded', () => {
    console.log('🌟 DOM loaded, starting Video Analysis App...');
    window.videoAnalysisApp = new VideoAnalysisApp();
});

// Handle page visibility changes
document.addEventListener('visibilitychange', () => {
    if (window.videoAnalysisApp) {
        if (document.hidden) {
            console.log('📱 Page hidden, pausing performance monitoring');
            window.videoAnalysisApp.performanceMonitor.pause();
        } else {
            console.log('📱 Page visible, resuming performance monitoring');
            window.videoAnalysisApp.performanceMonitor.resume();
        }
    }
});

// Handle unload
window.addEventListener('beforeunload', () => {
    if (window.videoAnalysisApp) {
        console.log('👋 App unloading, cleaning up...');
        window.videoAnalysisApp.performanceMonitor.stop();
    }
});

// Global error handlers for debugging
window.addEventListener('error', (event) => {
    console.error('🚨 Global JavaScript Error:', event.error);
    console.error('Error details:', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack
    });
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('🚨 Unhandled Promise Rejection:', event.reason);
    console.error('Rejection details:', event);
});

// Initialize the application when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log('📄 DOM loaded, creating VideoAnalysisApp');
        window.videoAnalysisApp = new VideoAnalysisApp();
    });
} else {
    console.log('📄 DOM already loaded, creating VideoAnalysisApp');
    window.videoAnalysisApp = new VideoAnalysisApp();
}