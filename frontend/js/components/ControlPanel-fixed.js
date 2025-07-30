// ControlPanel component - Fixed version for global usage
class ControlPanel {
    constructor(options) {
        this.container = options.container;
        this.eventBus = options.eventBus;
        this.apiClient = options.apiClient;
        
        // State
        this.filters = {};
        this.clusters = [];
        this.anomalies = [];
    }
    
    async init() {
        console.log('🎛️ Initializing ControlPanel...');
        
        if (!this.container) {
            console.warn('ControlPanel container not found');
            return;
        }
        
        // Create basic UI
        this.render();
        
        // Set up event listeners
        this.setupEventListeners();
        
        console.log('✅ ControlPanel initialized');
    }
    
    render() {
        this.container.innerHTML = `
            <div class="panel-section">
                <h3 class="section-title">Statistics</h3>
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-label">Total Videos</div>
                        <div class="stat-value" id="panel-total-videos">0</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-label">Clusters</div>
                        <div class="stat-value" id="panel-clusters">0</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-label">Anomalies</div>
                        <div class="stat-value" id="panel-anomalies">0</div>
                    </div>
                </div>
            </div>
            
            <div class="panel-section">
                <h3 class="section-title">View Mode</h3>
                <div class="view-buttons">
                    <button class="view-btn active" id="clusters-view">Clusters</button>
                    <button class="view-btn" id="anomalies-view">Anomalies</button>
                    <button class="view-btn" id="timeline-view">Timeline</button>
                </div>
            </div>
            
            <div class="panel-section">
                <h3 class="section-title">Filters</h3>
                <div class="filters-container">
                    <button class="filter-btn" id="clear-filters">Clear Filters</button>
                </div>
            </div>
        `;
    }
    
    setupEventListeners() {
        // View mode buttons
        const viewButtons = this.container.querySelectorAll('.view-btn');
        viewButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                viewButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const mode = btn.id.replace('-view', '');
                this.eventBus.emit('view.change', mode);
            });
        });
        
        // Clear filters button
        const clearBtn = this.container.querySelector('#clear-filters');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                this.eventBus.emit('filter.clear');
            });
        }
    }
    
    updateFilters(filterData) {
        this.filters = filterData;
        // Update UI with new filters
    }
    
    updateClusters(clusterData) {
        this.clusters = clusterData;
        const clusterCount = this.container.querySelector('#panel-clusters');
        if (clusterCount) {
            clusterCount.textContent = clusterData.length;
        }
    }
    
    updateAnomalies(anomalyData) {
        this.anomalies = anomalyData;
        const anomalyCount = this.container.querySelector('#panel-anomalies');
        if (anomalyCount) {
            anomalyCount.textContent = anomalyData.length;
        }
    }
    
    updateSearchResults(results) {
        console.log('Search results:', results);
    }
    
    clearSearchResults() {
        // Clear search results UI
    }
    
    updateClusterHighlights(highlights) {
        // Update cluster highlight UI
    }
    
    showClusterInfo(clusterInfo) {
        console.log('Cluster info:', clusterInfo);
    }
}

// Make it globally available
window.ControlPanel = ControlPanel;