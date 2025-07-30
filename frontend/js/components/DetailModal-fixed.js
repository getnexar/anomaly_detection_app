// DetailModal component - Fixed version for global usage
class DetailModal {
    constructor(options) {
        this.container = options.container;
        this.eventBus = options.eventBus;
        this.apiClient = options.apiClient;
        
        this.currentVideo = null;
    }
    
    async init() {
        console.log('📋 Initializing DetailModal...');
        
        if (!this.container) {
            console.warn('DetailModal container not found');
            return;
        }
        
        // Set up close button
        const closeBtn = this.container.querySelector('.close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.hide());
        }
        
        // Click backdrop to close
        this.container.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-backdrop')) {
                this.hide();
            }
        });
        
        console.log('✅ DetailModal initialized');
    }
    
    show(videoData = null, loading = false) {
        this.container.style.display = 'block';
        this.container.classList.add('active');
        document.body.style.overflow = 'hidden';
        
        if (loading) {
            this.showLoading();
        } else if (videoData) {
            this.updateContent(videoData);
        }
    }
    
    hide() {
        this.container.classList.add('closing');
        setTimeout(() => {
            this.container.style.display = 'none';
            this.container.classList.remove('active', 'closing');
            document.body.style.overflow = '';
        }, 200);
    }
    
    showLoading() {
        const modalBody = this.container.querySelector('.modal-body');
        if (modalBody) {
            modalBody.innerHTML = `
                <div class="loading-content">
                    <div class="loading-spinner"></div>
                    <div class="loading-text">Loading video details...</div>
                </div>
            `;
        }
    }
    
    updateContent(videoData) {
        this.currentVideo = videoData;
        
        const modalBody = this.container.querySelector('.modal-body');
        if (!modalBody) return;
        
        modalBody.innerHTML = `
            <div class="detail-grid">
                <div class="detail-section">
                    <h3>Video Information</h3>
                    <div class="detail-item">
                        <span class="detail-label">Title:</span>
                        <span class="detail-value">${videoData.title || 'Unknown'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">ID:</span>
                        <span class="detail-value">${videoData.video_id || 'Unknown'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Event:</span>
                        <span class="detail-value">${videoData.main_event || 'Unknown'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Location:</span>
                        <span class="detail-value">${videoData.location || 'Unknown'}</span>
                    </div>
                </div>
                
                <div class="detail-section">
                    <h3>Analysis Results</h3>
                    <div class="detail-item">
                        <span class="detail-label">Anomaly Score:</span>
                        <span class="detail-value ${videoData.anomaly_score > 0.7 ? 'anomaly-high' : ''}">${
                            ((videoData.anomaly_score || 0) * 100).toFixed(1)
                        }%</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Cluster:</span>
                        <span class="detail-value">${videoData.cluster_id !== undefined ? videoData.cluster_id : 'Unknown'}</span>
                    </div>
                </div>
                
                <div class="detail-actions">
                    <button class="action-btn play-btn" onclick="window.videoAnalysisApp.eventBus.emit('video.play', '${videoData.video_id}')">
                        ▶️ Play Video
                    </button>
                </div>
            </div>
        `;
    }
}

// Make it globally available
window.DetailModal = DetailModal;