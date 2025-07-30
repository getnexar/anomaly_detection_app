// Control Panel component for filters, search, and clustering controls
export class ControlPanel {
    constructor({ container, eventBus, apiClient, performanceMonitor }) {
        this.container = container;
        this.eventBus = eventBus;
        this.apiClient = apiClient;
        this.performanceMonitor = performanceMonitor;
        
        // UI state
        this.isCollapsed = false;
        this.activeFilters = {};
        this.availableFilters = {};
        this.clusters = [];
        this.searchQuery = '';
        this.searchResults = [];
        this.isSearching = false;
        
        // View mode
        this.currentViewMode = 'clusters';
        this.anomalyThreshold = 0.5;
        
        // Performance settings
        this.performanceMode = false;
        this.maxVisiblePoints = 50000;
        
        // Animation state
        this.animationFrame = null;
        
        // Bind methods
        this.handleSearch = this.handleSearch.bind(this);
        this.handleFilterChange = this.handleFilterChange.bind(this);
        this.handleKeyPress = this.handleKeyPress.bind(this);
    }
    
    async init() {
        try {
            console.log('🎛️ Initializing Control Panel...');
            
            await this.loadFilters();
            await this.loadClusters();
            this.createUI();
            this.setupEventListeners();
            this.setupKeyboardShortcuts();
            
            console.log('✅ Control Panel initialized');
            
        } catch (error) {
            console.error('❌ Failed to initialize Control Panel:', error);
            this.showError('Failed to initialize control panel');
        }
    }
    
    async loadFilters() {
        try {
            this.availableFilters = await this.apiClient.getMetadataFilters();
            console.log('📋 Filters loaded:', Object.keys(this.availableFilters));
        } catch (error) {
            console.error('❌ Failed to load filters:', error);
            this.availableFilters = {};
        }
    }
    
    async loadClusters() {
        try {
            const response = await this.apiClient.getClusters(true);
            this.clusters = response.clusters || [];
            console.log(`📊 Loaded ${this.clusters.length} clusters`);
        } catch (error) {
            console.error('❌ Failed to load clusters:', error);
            this.clusters = [];
        }
    }
    
    createUI() {
        this.container.innerHTML = `
            <div class="control-panel ${this.isCollapsed ? 'collapsed' : ''}">
                <!-- Header -->
                <div class="control-header">
                    <h2 class="control-title">
                        <i class="icon-settings"></i>
                        Controls
                    </h2>
                    <button class="collapse-btn" title="Toggle Panel">
                        <i class="icon-chevron-${this.isCollapsed ? 'right' : 'left'}"></i>
                    </button>
                </div>
                
                <div class="control-content">
                    <!-- Search Section -->
                    <div class="control-section">
                        <h3 class="section-title">
                            <i class="icon-search"></i>
                            Search
                        </h3>
                        <div class="search-container">
                            <input type="text" 
                                   id="search-input" 
                                   placeholder="Search videos..."
                                   class="search-input"
                                   autocomplete="off">
                            <button id="search-btn" class="search-btn" title="Search">
                                <i class="icon-search"></i>
                            </button>
                            <button id="clear-search-btn" class="clear-btn" title="Clear Search" style="display: none;">
                                <i class="icon-x"></i>
                            </button>
                        </div>
                        <div class="search-results" id="search-results" style="display: none;">
                            <div class="results-header">
                                <span class="results-count">0 results</span>
                                <button class="results-close">×</button>
                            </div>
                            <div class="results-list"></div>
                        </div>
                    </div>
                    
                    <!-- View Mode Section -->
                    <div class="control-section">
                        <h3 class="section-title">
                            <i class="icon-eye"></i>
                            View Mode
                        </h3>
                        <div class="view-mode-buttons">
                            <button class="view-mode-btn active" data-mode="clusters">
                                <i class="icon-layers"></i>
                                Clusters
                            </button>
                            <button class="view-mode-btn" data-mode="anomalies">
                                <i class="icon-alert-triangle"></i>
                                Anomalies
                            </button>
                            <button class="view-mode-btn" data-mode="events">
                                <i class="icon-calendar"></i>
                                Events
                            </button>
                        </div>
                    </div>
                    
                    <!-- Clusters Section -->
                    <div class="control-section" id="clusters-section">
                        <h3 class="section-title">
                            <i class="icon-layers"></i>
                            Clusters
                            <span class="cluster-count">${this.clusters.length}</span>
                        </h3>
                        <div class="clusters-container">
                            <div class="clusters-list" id="clusters-list">
                                ${this.renderClustersList()}
                            </div>
                        </div>
                    </div>
                    
                    <!-- Anomalies Section -->
                    <div class="control-section" id="anomalies-section" style="display: none;">
                        <h3 class="section-title">
                            <i class="icon-alert-triangle"></i>
                            Anomaly Detection
                        </h3>
                        <div class="anomaly-controls">
                            <label class="threshold-label">
                                Threshold: <span id="threshold-value">${this.anomalyThreshold}</span>
                            </label>
                            <input type="range" 
                                   id="anomaly-threshold" 
                                   class="threshold-slider"
                                   min="0" 
                                   max="1" 
                                   step="0.1" 
                                   value="${this.anomalyThreshold}">
                            <div class="anomaly-actions">
                                <button id="highlight-anomalies-btn" class="btn-secondary">
                                    Highlight Anomalies
                                </button>
                                <button id="focus-anomalies-btn" class="btn-secondary">
                                    Focus on Anomalies
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Filters Section -->
                    <div class="control-section">
                        <h3 class="section-title">
                            <i class="icon-filter"></i>
                            Filters
                        </h3>
                        <div class="filters-container">
                            ${this.renderFilters()}
                        </div>
                        <div class="filter-actions">
                            <button id="apply-filters-btn" class="btn-primary">Apply Filters</button>
                            <button id="clear-filters-btn" class="btn-secondary">Clear All</button>
                        </div>
                    </div>
                    
                    <!-- Performance Section -->
                    <div class="control-section">
                        <h3 class="section-title">
                            <i class="icon-zap"></i>
                            Performance
                        </h3>
                        <div class="performance-controls">
                            <label class="performance-toggle">
                                <input type="checkbox" id="performance-mode" ${this.performanceMode ? 'checked' : ''}>
                                <span class="toggle-slider"></span>
                                Performance Mode
                            </label>
                            <div class="performance-stats">
                                <div class="stat-item">
                                    <span class="stat-label">FPS:</span>
                                    <span class="stat-value" id="fps-display">--</span>
                                </div>
                                <div class="stat-item">
                                    <span class="stat-label">Points:</span>
                                    <span class="stat-value" id="points-display">--</span>
                                </div>
                                <div class="stat-item">
                                    <span class="stat-label">Memory:</span>
                                    <span class="stat-value" id="memory-display">--</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Camera Controls Section -->
                    <div class="control-section">
                        <h3 class="section-title">
                            <i class="icon-camera"></i>
                            Camera
                        </h3>
                        <div class="camera-controls">
                            <button id="reset-camera-btn" class="btn-secondary">
                                <i class="icon-home"></i>
                                Reset View
                            </button>
                            <button id="fit-all-btn" class="btn-secondary">
                                <i class="icon-maximize"></i>
                                Fit All
                            </button>
                            <button id="zoom-in-btn" class="btn-secondary">
                                <i class="icon-zoom-in"></i>
                                Zoom In
                            </button>
                            <button id="zoom-out-btn" class="btn-secondary">
                                <i class="icon-zoom-out"></i>
                                Zoom Out
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    renderClustersList() {
        if (this.clusters.length === 0) {
            return '<div class="empty-state">No clusters available</div>';
        }
        
        return this.clusters.map(cluster => `
            <div class="cluster-item" data-cluster-id="${cluster.cluster_id}">
                <div class="cluster-header">
                    <div class="cluster-color" style="background-color: ${cluster.color || '#666'}"></div>
                    <div class="cluster-info">
                        <div class="cluster-label">${cluster.label || `Cluster ${cluster.cluster_id}`}</div>
                        <div class="cluster-stats">${cluster.size || 0} videos</div>
                    </div>
                    <div class="cluster-actions">
                        <button class="cluster-toggle" data-action="toggle" title="Toggle visibility">
                            <i class="icon-eye"></i>
                        </button>
                        <button class="cluster-focus" data-action="focus" title="Focus on cluster">
                            <i class="icon-target"></i>
                        </button>
                    </div>
                </div>
                <div class="cluster-description">
                    ${cluster.description || 'No description available'}
                </div>
            </div>
        `).join('');
    }
    
    renderFilters() {
        if (Object.keys(this.availableFilters).length === 0) {
            return '<div class="empty-state">No filters available</div>';
        }
        
        return Object.entries(this.availableFilters).map(([filterName, options]) => `
            <div class="filter-group">
                <label class="filter-label">${this.formatFilterName(filterName)}</label>
                <select class="filter-select" data-filter="${filterName}" multiple>
                    <option value="">All ${this.formatFilterName(filterName)}</option>
                    ${options.map(option => `
                        <option value="${option.value}">${option.label} (${option.count})</option>
                    `).join('')}
                </select>
            </div>
        `).join('');
    }
    
    formatFilterName(name) {
        return name.split('-').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
    }
    
    setupEventListeners() {
        // Collapse button
        this.container.querySelector('.collapse-btn').addEventListener('click', () => {
            this.toggleCollapse();
        });
        
        // Search
        const searchInput = this.container.querySelector('#search-input');
        const searchBtn = this.container.querySelector('#search-btn');
        const clearSearchBtn = this.container.querySelector('#clear-search-btn');
        
        searchInput.addEventListener('input', this.handleSearch);
        searchInput.addEventListener('keypress', this.handleKeyPress);
        searchBtn.addEventListener('click', () => this.performSearch());
        clearSearchBtn.addEventListener('click', () => this.clearSearch());
        
        // View mode buttons
        this.container.querySelectorAll('.view-mode-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.setViewMode(e.target.dataset.mode);
            });
        });
        
        // Anomaly threshold
        const thresholdSlider = this.container.querySelector('#anomaly-threshold');
        const thresholdValue = this.container.querySelector('#threshold-value');
        
        if (thresholdSlider) {
            thresholdSlider.addEventListener('input', (e) => {
                this.anomalyThreshold = parseFloat(e.target.value);
                thresholdValue.textContent = this.anomalyThreshold;
                this.eventBus.emit('anomaly.threshold.change', this.anomalyThreshold);
            });
        }
        
        // Anomaly buttons
        const highlightBtn = this.container.querySelector('#highlight-anomalies-btn');
        const focusBtn = this.container.querySelector('#focus-anomalies-btn');
        
        if (highlightBtn) {
            highlightBtn.addEventListener('click', () => this.highlightAnomalies());
        }
        if (focusBtn) {
            focusBtn.addEventListener('click', () => this.focusOnAnomalies());
        }
        
        // Cluster interactions
        this.container.querySelector('#clusters-list').addEventListener('click', (e) => {
            this.handleClusterAction(e);
        });
        
        // Filter controls
        this.container.querySelectorAll('.filter-select').forEach(select => {
            select.addEventListener('change', this.handleFilterChange);
        });
        
        const applyFiltersBtn = this.container.querySelector('#apply-filters-btn');
        const clearFiltersBtn = this.container.querySelector('#clear-filters-btn');
        
        if (applyFiltersBtn) {
            applyFiltersBtn.addEventListener('click', () => this.applyFilters());
        }
        if (clearFiltersBtn) {
            clearFiltersBtn.addEventListener('click', () => this.clearFilters());
        }
        
        // Performance mode
        const performanceModeToggle = this.container.querySelector('#performance-mode');
        if (performanceModeToggle) {
            performanceModeToggle.addEventListener('change', (e) => {
                this.setPerformanceMode(e.target.checked);
            });
        }
        
        // Camera controls
        const resetCameraBtn = this.container.querySelector('#reset-camera-btn');
        const fitAllBtn = this.container.querySelector('#fit-all-btn');
        const zoomInBtn = this.container.querySelector('#zoom-in-btn');
        const zoomOutBtn = this.container.querySelector('#zoom-out-btn');
        
        if (resetCameraBtn) {
            resetCameraBtn.addEventListener('click', () => {
                this.eventBus.emit('camera.reset');
            });
        }
        if (fitAllBtn) {
            fitAllBtn.addEventListener('click', () => {
                this.eventBus.emit('camera.fit-all');
            });
        }
        if (zoomInBtn) {
            zoomInBtn.addEventListener('click', () => {
                this.eventBus.emit('camera.zoom-in');
            });
        }
        if (zoomOutBtn) {
            zoomOutBtn.addEventListener('click', () => {
                this.eventBus.emit('camera.zoom-out');
            });
        }
        
        // Search results close
        const resultsClose = this.container.querySelector('.results-close');
        if (resultsClose) {
            resultsClose.addEventListener('click', () => {
                this.hideSearchResults();
            });
        }
    }
    
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl+F to focus search
            if (e.ctrlKey && e.key === 'f') {
                e.preventDefault();
                this.focusSearch();
            }
            
            // Escape to clear search/close modals
            if (e.key === 'Escape') {
                this.clearSearch();
                this.hideSearchResults();
            }
            
            // Number keys for view modes
            if (e.key >= '1' && e.key <= '3') {
                const modes = ['clusters', 'anomalies', 'events'];
                const mode = modes[parseInt(e.key) - 1];
                if (mode) {
                    this.setViewMode(mode);
                }
            }
            
            // R for reset camera
            if (e.key === 'r' || e.key === 'R') {
                this.eventBus.emit('camera.reset');
            }
            
            // F for fit all
            if (e.key === 'f' || e.key === 'F') {
                if (!e.ctrlKey) {
                    this.eventBus.emit('camera.fit-all');
                }
            }
            
            // A for focus anomalies
            if (e.key === 'a' || e.key === 'A') {
                this.focusOnAnomalies();
            }
        });
    }
    
    handleSearch() {
        const searchInput = this.container.querySelector('#search-input');
        this.searchQuery = searchInput.value.trim();
        
        // Clear previous search timeout
        if (this.searchTimeout) {
            clearTimeout(this.searchTimeout);
        }
        
        // Debounce search
        this.searchTimeout = setTimeout(() => {
            if (this.searchQuery.length >= 2) {
                this.performSearch();
            } else if (this.searchQuery.length === 0) {
                this.clearSearch();
            }
        }, 300);
    }
    
    handleKeyPress(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            this.performSearch();
        }
    }
    
    async performSearch() {
        if (!this.searchQuery || this.searchQuery.length < 2) return;
        
        try {
            this.setSearching(true);
            
            const results = await this.apiClient.searchVideos({
                query: this.searchQuery,
                limit: 100
            });
            
            this.searchResults = results.videos || [];
            this.showSearchResults();
            
            // Emit search results for visualization
            this.eventBus.emit('search.results', {
                query: this.searchQuery,
                results: this.searchResults
            });
            
        } catch (error) {
            console.error('❌ Search failed:', error);
            this.showError('Search failed. Please try again.');
        } finally {
            this.setSearching(false);
        }
    }
    
    clearSearch() {
        this.searchQuery = '';
        this.searchResults = [];
        
        const searchInput = this.container.querySelector('#search-input');
        searchInput.value = '';
        
        this.hideSearchResults();
        this.updateSearchButtons();
        
        // Emit clear search event
        this.eventBus.emit('search.clear');
    }
    
    setSearching(isSearching) {
        this.isSearching = isSearching;
        this.updateSearchButtons();
    }
    
    updateSearchButtons() {
        const searchBtn = this.container.querySelector('#search-btn');
        const clearBtn = this.container.querySelector('#clear-search-btn');
        
        if (this.isSearching) {
            searchBtn.innerHTML = '<i class="icon-loader"></i>';
            searchBtn.disabled = true;
        } else {
            searchBtn.innerHTML = '<i class="icon-search"></i>';
            searchBtn.disabled = false;
        }
        
        clearBtn.style.display = this.searchQuery || this.searchResults.length > 0 ? 'block' : 'none';
    }
    
    showSearchResults() {
        const resultsContainer = this.container.querySelector('#search-results');
        const resultsCount = this.container.querySelector('.results-count');
        const resultsList = this.container.querySelector('.results-list');
        
        resultsCount.textContent = `${this.searchResults.length} result${this.searchResults.length !== 1 ? 's' : ''}`;
        
        resultsList.innerHTML = this.searchResults.map(video => `
            <div class="result-item" data-video-id="${video.video_id}">
                <div class="result-thumbnail">
                    <img src="${this.apiClient.getVideoThumbnailUrl(video.video_id, 'small')}" 
                         alt="Thumbnail" 
                         onerror="this.style.display='none'">
                </div>
                <div class="result-info">
                    <div class="result-title">${video.title || 'Untitled'}</div>
                    <div class="result-event">${video.main_event || 'Unknown'}</div>
                    <div class="result-score">Score: ${(video.similarity_score || 0).toFixed(2)}</div>
                </div>
            </div>
        `).join('');
        
        // Add click handlers for results
        resultsList.querySelectorAll('.result-item').forEach(item => {
            item.addEventListener('click', () => {
                const videoId = item.dataset.videoId;
                this.eventBus.emit('video.select', { videoId });
            });
        });
        
        resultsContainer.style.display = 'block';
        this.updateSearchButtons();
    }
    
    hideSearchResults() {
        const resultsContainer = this.container.querySelector('#search-results');
        resultsContainer.style.display = 'none';
    }
    
    focusSearch() {
        const searchInput = this.container.querySelector('#search-input');
        searchInput.focus();
        searchInput.select();
    }
    
    setViewMode(mode) {
        this.currentViewMode = mode;
        
        // Update button states
        this.container.querySelectorAll('.view-mode-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });
        
        // Show/hide relevant sections
        const clustersSection = this.container.querySelector('#clusters-section');
        const anomaliesSection = this.container.querySelector('#anomalies-section');
        
        clustersSection.style.display = mode === 'clusters' ? 'block' : 'none';
        anomaliesSection.style.display = mode === 'anomalies' ? 'block' : 'none';
        
        // Emit view mode change
        this.eventBus.emit('view.mode.change', mode);
        
        console.log(`👁️ View mode changed to: ${mode}`);
    }
    
    handleClusterAction(e) {
        const action = e.target.dataset.action;
        const clusterItem = e.target.closest('.cluster-item');
        
        if (!action || !clusterItem) return;
        
        const clusterId = parseInt(clusterItem.dataset.clusterId);
        const cluster = this.clusters.find(c => c.cluster_id === clusterId);
        
        if (!cluster) return;
        
        switch (action) {
            case 'toggle':
                this.toggleClusterVisibility(cluster);
                break;
            case 'focus':
                this.focusOnCluster(cluster);
                break;
        }
    }
    
    toggleClusterVisibility(cluster) {
        cluster.visible = !cluster.visible;
        
        // Update UI
        const clusterItem = this.container.querySelector(`[data-cluster-id="${cluster.cluster_id}"]`);
        const toggleBtn = clusterItem.querySelector('.cluster-toggle i');
        
        toggleBtn.className = cluster.visible ? 'icon-eye' : 'icon-eye-off';
        clusterItem.classList.toggle('hidden', !cluster.visible);
        
        // Emit event
        this.eventBus.emit('cluster.visibility.toggle', {
            clusterId: cluster.cluster_id,
            visible: cluster.visible
        });
    }
    
    focusOnCluster(cluster) {
        this.eventBus.emit('cluster.focus', cluster);
    }
    
    highlightAnomalies() {
        this.eventBus.emit('anomalies.highlight', {
            threshold: this.anomalyThreshold,
            enabled: true
        });
    }
    
    async focusOnAnomalies() {
        try {
            const anomalies = await this.apiClient.getAnomalies({
                threshold: this.anomalyThreshold,
                limit: 100
            });
            
            this.eventBus.emit('anomalies.focus', anomalies.videos || []);
            
        } catch (error) {
            console.error('❌ Failed to load anomalies:', error);
            this.showError('Failed to load anomalies');
        }
    }
    
    handleFilterChange(e) {
        const filterName = e.target.dataset.filter;
        const selectedOptions = Array.from(e.target.selectedOptions).map(option => option.value).filter(Boolean);
        
        if (selectedOptions.length > 0) {
            this.activeFilters[filterName] = selectedOptions;
        } else {
            delete this.activeFilters[filterName];
        }
        
        // Update apply button state
        this.updateFilterButtons();
    }
    
    updateFilterButtons() {
        const applyBtn = this.container.querySelector('#apply-filters-btn');
        const clearBtn = this.container.querySelector('#clear-filters-btn');
        
        const hasFilters = Object.keys(this.activeFilters).length > 0;
        
        applyBtn.disabled = !hasFilters;
        clearBtn.disabled = !hasFilters;
    }
    
    async applyFilters() {
        try {
            console.log('🔍 Applying filters:', this.activeFilters);
            
            const filteredVideos = await this.apiClient.filterVideos(this.activeFilters);
            
            this.eventBus.emit('videos.filtered', {
                filters: this.activeFilters,
                videos: filteredVideos.videos || []
            });
            
        } catch (error) {
            console.error('❌ Failed to apply filters:', error);
            this.showError('Failed to apply filters');
        }
    }
    
    clearFilters() {
        this.activeFilters = {};
        
        // Clear all select elements
        this.container.querySelectorAll('.filter-select').forEach(select => {
            select.selectedIndex = 0;
            Array.from(select.options).forEach(option => {
                option.selected = false;
            });
        });
        
        this.updateFilterButtons();
        
        // Emit clear filters event
        this.eventBus.emit('filters.clear');
    }
    
    setPerformanceMode(enabled) {
        this.performanceMode = enabled;
        
        this.eventBus.emit('performance.mode.change', {
            enabled,
            maxPoints: enabled ? this.maxVisiblePoints : -1
        });
        
        console.log(`⚡ Performance mode ${enabled ? 'enabled' : 'disabled'}`);
    }
    
    updatePerformanceStats() {
        if (!this.performanceMonitor) return;
        
        const fpsDisplay = this.container.querySelector('#fps-display');
        const pointsDisplay = this.container.querySelector('#points-display');
        const memoryDisplay = this.container.querySelector('#memory-display');
        
        if (fpsDisplay) {
            fpsDisplay.textContent = this.performanceMonitor.getFPS();
        }
        
        if (memoryDisplay) {
            const memory = this.performanceMonitor.getMemoryUsage();
            if (memory) {
                memoryDisplay.textContent = `${(memory.used / 1024 / 1024).toFixed(1)}MB`;
            }
        }
    }
    
    startPerformanceUpdates() {
        const updateStats = () => {
            this.updatePerformanceStats();
            this.animationFrame = requestAnimationFrame(updateStats);
        };
        
        updateStats();
    }
    
    stopPerformanceUpdates() {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
    }
    
    toggleCollapse() {
        this.isCollapsed = !this.isCollapsed;
        this.container.querySelector('.control-panel').classList.toggle('collapsed', this.isCollapsed);
        
        const chevron = this.container.querySelector('.collapse-btn i');
        chevron.className = `icon-chevron-${this.isCollapsed ? 'right' : 'left'}`;
        
        // Emit collapse event
        this.eventBus.emit('control.panel.collapse', this.isCollapsed);
    }
    
    showError(message) {
        console.error('❌ Control Panel Error:', message);
        
        // Create temporary error notification
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-notification';
        errorDiv.textContent = message;
        
        this.container.appendChild(errorDiv);
        
        setTimeout(() => {
            errorDiv.remove();
        }, 5000);
    }
    
    updatePointsCount(count) {
        const pointsDisplay = this.container.querySelector('#points-display');
        if (pointsDisplay) {
            pointsDisplay.textContent = count.toLocaleString();
        }
    }
    
    // Public API methods
    getActiveFilters() {
        return { ...this.activeFilters };
    }
    
    getCurrentViewMode() {
        return this.currentViewMode;
    }
    
    getSearchQuery() {
        return this.searchQuery;
    }
    
    getAnomalyThreshold() {
        return this.anomalyThreshold;
    }
    
    isPerformanceModeEnabled() {
        return this.performanceMode;
    }
    
    dispose() {
        this.stopPerformanceUpdates();
        
        if (this.searchTimeout) {
            clearTimeout(this.searchTimeout);
        }
        
        console.log('🧹 Control Panel disposed');
    }
}