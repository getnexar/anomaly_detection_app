// Detail Modal component for showing video information
export class DetailModal {
    constructor({ container, eventBus, apiClient }) {
        this.container = container;
        this.eventBus = eventBus;
        this.apiClient = apiClient;
        
        // Modal state
        this.isVisible = false;
        this.currentVideo = null;
        this.videoPlayer = null;
        
        // Animation properties
        this.animationDuration = 300;
        this.backdropOpacity = 0.8;
        
        // Content sections
        this.activeTab = 'overview';
        this.availableTabs = ['overview', 'analysis', 'metadata', 'similar'];
        
        // Similar videos cache
        this.similarVideos = [];
        this.loadingSimilar = false;
        
        // Bind methods
        this.handleKeyPress = this.handleKeyPress.bind(this);
        this.handleBackdropClick = this.handleBackdropClick.bind(this);
    }
    
    init() {
        console.log('📄 Initializing Detail Modal...');
        
        this.createModal();
        this.setupEventListeners();
        this.setupKeyboardShortcuts();
        
        console.log('✅ Detail Modal initialized');
    }
    
    createModal() {
        // Create modal container
        const modalHTML = `
            <div class="detail-modal-backdrop" style="display: none;">
                <div class="detail-modal">
                    <div class="modal-header">
                        <div class="modal-nav">
                            <button class="nav-btn prev-btn" title="Previous Video">
                                <i class="icon-chevron-left"></i>
                            </button>
                            <div class="modal-title">
                                <h2 class="video-title">Loading...</h2>
                                <div class="video-subtitle"></div>
                            </div>
                            <button class="nav-btn next-btn" title="Next Video">
                                <i class="icon-chevron-right"></i>
                            </button>
                        </div>
                        <div class="modal-actions">
                            <button class="action-btn download-btn" title="Download Video">
                                <i class="icon-download"></i>
                            </button>
                            <button class="action-btn fullscreen-btn" title="Fullscreen">
                                <i class="icon-maximize"></i>
                            </button>
                            <button class="action-btn close-btn" title="Close">
                                <i class="icon-x"></i>
                            </button>
                        </div>
                    </div>
                    
                    <div class="modal-content">
                        <div class="content-left">
                            <div class="video-container">
                                <div class="video-player-wrapper">
                                    <video class="video-player" 
                                           controls 
                                           preload="none"
                                           style="display: none;">
                                        Your browser does not support video playback.
                                    </video>
                                    <div class="video-thumbnail">
                                        <img class="thumbnail-image" alt="Video thumbnail">
                                        <button class="play-overlay">
                                            <i class="icon-play"></i>
                                        </button>
                                    </div>
                                    <div class="video-loading" style="display: none;">
                                        <div class="loading-spinner"></div>
                                        <div class="loading-text">Loading video...</div>
                                    </div>
                                </div>
                                
                                <div class="video-info">
                                    <div class="info-row">
                                        <span class="info-label">Event:</span>
                                        <span class="info-value event-type">--</span>
                                    </div>
                                    <div class="info-row">
                                        <span class="info-label">Location:</span>
                                        <span class="info-value location">--</span>
                                    </div>
                                    <div class="info-row">
                                        <span class="info-label">Anomaly Score:</span>
                                        <span class="info-value anomaly-score">--</span>
                                        <div class="anomaly-indicator"></div>
                                    </div>
                                    <div class="info-row">
                                        <span class="info-label">Cluster:</span>
                                        <span class="info-value cluster-info">--</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="content-right">
                            <div class="content-tabs">
                                <button class="tab-btn active" data-tab="overview">Overview</button>
                                <button class="tab-btn" data-tab="analysis">Analysis</button>
                                <button class="tab-btn" data-tab="metadata">Metadata</button>
                                <button class="tab-btn" data-tab="similar">Similar Videos</button>
                            </div>
                            
                            <div class="content-panels">
                                <div class="content-panel active" data-panel="overview">
                                    <div class="description-section">
                                        <h4>Description</h4>
                                        <div class="description-text">Loading...</div>
                                    </div>
                                    
                                    <div class="tags-section">
                                        <h4>Tags</h4>
                                        <div class="tags-container">
                                            <!-- Tags will be populated here -->
                                        </div>
                                    </div>
                                    
                                    <div class="coordinates-section">
                                        <h4>3D Position</h4>
                                        <div class="coordinates-display">
                                            <div class="coord-item">
                                                <span class="coord-label">X:</span>
                                                <span class="coord-value x-coord">--</span>
                                            </div>
                                            <div class="coord-item">
                                                <span class="coord-label">Y:</span>
                                                <span class="coord-value y-coord">--</span>
                                            </div>
                                            <div class="coord-item">
                                                <span class="coord-label">Z:</span>
                                                <span class="coord-value z-coord">--</span>
                                            </div>
                                        </div>
                                        <button class="locate-btn">
                                            <i class="icon-target"></i>
                                            Locate in 3D View
                                        </button>
                                    </div>
                                </div>
                                
                                <div class="content-panel" data-panel="analysis">
                                    <div class="analysis-section">
                                        <h4>Step-by-Step Analysis</h4>
                                        <div class="analysis-text">Loading...</div>
                                    </div>
                                    
                                    <div class="interpretation-section">
                                        <h4>Interpretation</h4>
                                        <div class="interpretation-text">Loading...</div>
                                    </div>
                                    
                                    <div class="anomaly-analysis">
                                        <h4>Anomaly Analysis</h4>
                                        <div class="anomaly-details">
                                            <div class="anomaly-score-breakdown">
                                                <div class="score-item">
                                                    <span class="score-label">Overall Score:</span>
                                                    <span class="score-value overall-score">--</span>
                                                </div>
                                                <div class="score-item">
                                                    <span class="score-label">Embedding Score:</span>
                                                    <span class="score-value embedding-score">--</span>
                                                </div>
                                                <div class="score-item">
                                                    <span class="score-label">Text Score:</span>
                                                    <span class="score-value text-score">--</span>
                                                </div>
                                                <div class="score-item">
                                                    <span class="score-label">Metadata Score:</span>
                                                    <span class="score-value metadata-score">--</span>
                                                </div>
                                            </div>
                                            <div class="anomaly-reasons">
                                                <h5>Anomaly Indicators:</h5>
                                                <ul class="reasons-list">
                                                    <!-- Reasons will be populated here -->
                                                </ul>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="content-panel" data-panel="metadata">
                                    <div class="metadata-grid">
                                        <!-- Metadata will be populated here -->
                                    </div>
                                </div>
                                
                                <div class="content-panel" data-panel="similar">
                                    <div class="similar-videos-section">
                                        <div class="similar-header">
                                            <h4>Similar Videos</h4>
                                            <button class="refresh-similar-btn">
                                                <i class="icon-refresh"></i>
                                                Refresh
                                            </button>
                                        </div>
                                        <div class="similar-videos-list">
                                            <!-- Similar videos will be populated here -->
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        this.container.innerHTML = modalHTML;
        this.modalElement = this.container.querySelector('.detail-modal');
        this.backdropElement = this.container.querySelector('.detail-modal-backdrop');
    }
    
    setupEventListeners() {
        // Close button
        this.container.querySelector('.close-btn').addEventListener('click', () => {
            this.hide();
        });
        
        // Backdrop click
        this.backdropElement.addEventListener('click', this.handleBackdropClick);
        
        // Navigation buttons
        this.container.querySelector('.prev-btn').addEventListener('click', () => {
            this.showPreviousVideo();
        });
        
        this.container.querySelector('.next-btn').addEventListener('click', () => {
            this.showNextVideo();
        });
        
        // Action buttons
        this.container.querySelector('.download-btn').addEventListener('click', () => {
            this.downloadVideo();
        });
        
        this.container.querySelector('.fullscreen-btn').addEventListener('click', () => {
            this.toggleFullscreen();
        });
        
        // Tab buttons
        this.container.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.setActiveTab(e.target.dataset.tab);
            });
        });
        
        // Video player events
        const videoPlayer = this.container.querySelector('.video-player');
        const playOverlay = this.container.querySelector('.play-overlay');
        
        playOverlay.addEventListener('click', () => {
            this.playVideo();
        });
        
        videoPlayer.addEventListener('loadstart', () => {
            this.showVideoLoading(true);
        });
        
        videoPlayer.addEventListener('canplay', () => {
            this.showVideoLoading(false);
        });
        
        videoPlayer.addEventListener('error', (e) => {
            console.error('❌ Video playback error:', e);
            this.showVideoError();
        });
        
        // Locate button
        this.container.querySelector('.locate-btn').addEventListener('click', () => {
            this.locateInVisualization();
        });
        
        // Refresh similar videos
        this.container.querySelector('.refresh-similar-btn').addEventListener('click', () => {
            this.loadSimilarVideos(true);
        });
        
        // Prevent modal content clicks from closing modal
        this.modalElement.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }
    
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', this.handleKeyPress);
    }
    
    handleKeyPress(e) {
        if (!this.isVisible) return;
        
        switch (e.key) {
            case 'Escape':
                this.hide();
                break;
            case 'ArrowLeft':
                this.showPreviousVideo();
                break;
            case 'ArrowRight':
                this.showNextVideo();
                break;
            case ' ':
                if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
                    e.preventDefault();
                    this.toggleVideoPlayback();
                }
                break;
            case 'f':
                if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
                    this.toggleFullscreen();
                }
                break;
            case '1':
            case '2':
            case '3':
            case '4':
                const tabIndex = parseInt(e.key) - 1;
                if (tabIndex < this.availableTabs.length) {
                    this.setActiveTab(this.availableTabs[tabIndex]);
                }
                break;
        }
    }
    
    handleBackdropClick(e) {
        if (e.target === this.backdropElement) {
            this.hide();
        }
    }
    
    async show(videoData) {
        try {
            console.log('📄 Showing video details:', videoData.video_id);
            
            this.currentVideo = videoData;
            this.isVisible = true;
            
            // Show modal with animation
            this.backdropElement.style.display = 'flex';
            this.backdropElement.style.opacity = '0';
            this.modalElement.style.transform = 'scale(0.9) translateY(-20px)';
            
            // Animate in
            requestAnimationFrame(() => {
                this.backdropElement.style.transition = `opacity ${this.animationDuration}ms ease`;
                this.modalElement.style.transition = `transform ${this.animationDuration}ms ease`;
                
                this.backdropElement.style.opacity = this.backdropOpacity;
                this.modalElement.style.transform = 'scale(1) translateY(0)';
            });
            
            // Load video details
            await this.loadVideoDetails(videoData);
            
            // Emit show event
            this.eventBus.emit('modal.show', { videoId: videoData.video_id });
            
        } catch (error) {
            console.error('❌ Failed to show video details:', error);
            this.hide();
        }
    }
    
    hide() {
        if (!this.isVisible) return;
        
        console.log('📄 Hiding video details modal');
        
        this.isVisible = false;
        
        // Animate out
        this.backdropElement.style.opacity = '0';
        this.modalElement.style.transform = 'scale(0.9) translateY(-20px)';
        
        setTimeout(() => {
            this.backdropElement.style.display = 'none';
            this.resetModal();
        }, this.animationDuration);
        
        // Pause video
        this.pauseVideo();
        
        // Emit hide event
        this.eventBus.emit('modal.hide');
    }
    
    async loadVideoDetails(videoData) {
        try {
            // Update basic info immediately
            this.updateBasicInfo(videoData);
            
            // Load full details if needed
            if (!videoData.description || !videoData.interpretation) {
                console.log('📄 Loading full video details...');
                const fullDetails = await this.apiClient.getVideoDetails(videoData.video_id);
                this.currentVideo = { ...videoData, ...fullDetails };
            }
            
            // Update all content
            this.updateVideoInfo(this.currentVideo);
            this.updateTabs(this.currentVideo);
            
            // Load similar videos for the current tab
            if (this.activeTab === 'similar') {
                this.loadSimilarVideos();
            }
            
        } catch (error) {
            console.error('❌ Failed to load video details:', error);
            this.showError('Failed to load video details');
        }
    }
    
    updateBasicInfo(video) {
        // Update title and subtitle
        const titleElement = this.container.querySelector('.video-title');
        const subtitleElement = this.container.querySelector('.video-subtitle');
        
        titleElement.textContent = video.title || video['video-title'] || 'Untitled Video';
        subtitleElement.textContent = `Video ID: ${video.video_id}`;
        
        // Update thumbnail
        const thumbnailImg = this.container.querySelector('.thumbnail-image');
        this.apiClient.getVideoThumbnailUrl(video.video_id).then(thumbnailUrl => {
            if (thumbnailUrl) {
                thumbnailImg.src = thumbnailUrl;
                thumbnailImg.onerror = () => {
                    thumbnailImg.style.display = 'none';
                };
            } else {
                thumbnailImg.style.display = 'none';
            }
        }).catch(() => {
            thumbnailImg.style.display = 'none';
        });
    }
    
    updateVideoInfo(video) {
        // Update video info section
        const eventType = this.container.querySelector('.event-type');
        const location = this.container.querySelector('.location');
        const anomalyScore = this.container.querySelector('.anomaly-score');
        const clusterInfo = this.container.querySelector('.cluster-info');
        const anomalyIndicator = this.container.querySelector('.anomaly-indicator');
        
        eventType.textContent = video.main_event || video['main-event'] || 'Unknown';
        location.textContent = video.location || 'Unknown';
        
        const score = video.anomaly_score || 0;
        anomalyScore.textContent = score.toFixed(3);
        
        // Update anomaly indicator color
        anomalyIndicator.className = 'anomaly-indicator';
        if (score > 0.7) {
            anomalyIndicator.classList.add('high');
        } else if (score > 0.4) {
            anomalyIndicator.classList.add('medium');
        } else {
            anomalyIndicator.classList.add('low');
        }
        
        clusterInfo.textContent = video.cluster_id !== undefined && video.cluster_id !== -1 
            ? `Cluster ${video.cluster_id}` 
            : 'Unclustered';
    }
    
    updateTabs(video) {
        this.updateOverviewTab(video);
        this.updateAnalysisTab(video);
        this.updateMetadataTab(video);
    }
    
    updateOverviewTab(video) {
        // Description
        const descriptionText = this.container.querySelector('.description-text');
        descriptionText.textContent = video.description || video['description-step-by-step'] || 'No description available';
        
        // Tags (generate from metadata)
        const tagsContainer = this.container.querySelector('.tags-container');
        const tags = this.generateTags(video);
        
        tagsContainer.innerHTML = tags.map(tag => 
            `<span class="tag tag-${tag.type}">${tag.label}</span>`
        ).join('');
        
        // Coordinates
        if (video.coordinates) {
            this.container.querySelector('.x-coord').textContent = video.coordinates.x.toFixed(2);
            this.container.querySelector('.y-coord').textContent = video.coordinates.y.toFixed(2);
            this.container.querySelector('.z-coord').textContent = video.coordinates.z.toFixed(2);
        }
    }
    
    updateAnalysisTab(video) {
        // Step-by-step analysis
        const analysisText = this.container.querySelector('.analysis-text');
        analysisText.textContent = video['description-step-by-step'] || video.description || 'No analysis available';
        
        // Interpretation
        const interpretationText = this.container.querySelector('.interpretation-text');
        interpretationText.textContent = video.interpretation || 'No interpretation available';
        
        // Anomaly breakdown
        this.updateAnomalyBreakdown(video);
    }
    
    updateAnomalyBreakdown(video) {
        const overallScore = this.container.querySelector('.overall-score');
        const embeddingScore = this.container.querySelector('.embedding-score');
        const textScore = this.container.querySelector('.text-score');
        const metadataScore = this.container.querySelector('.metadata-score');
        
        overallScore.textContent = (video.anomaly_score || 0).toFixed(3);
        embeddingScore.textContent = (video.embedding_anomaly_score || 0).toFixed(3);
        textScore.textContent = (video.text_anomaly_score || 0).toFixed(3);
        metadataScore.textContent = (video.metadata_anomaly_score || 0).toFixed(3);
        
        // Anomaly reasons
        const reasonsList = this.container.querySelector('.reasons-list');
        const reasons = this.generateAnomalyReasons(video);
        
        reasonsList.innerHTML = reasons.map(reason => 
            `<li class="reason-item reason-${reason.severity}">${reason.text}</li>`
        ).join('');
    }
    
    updateMetadataTab(video) {
        const metadataGrid = this.container.querySelector('.metadata-grid');
        
        const metadata = [
            { label: 'Video ID', value: video.video_id },
            { label: 'Title', value: video.title || video['video-title'] },
            { label: 'Main Event', value: video.main_event || video['main-event'] },
            { label: 'Location', value: video.location },
            { label: 'Zone', value: video.zone },
            { label: 'Light Conditions', value: video['light-conditions'] },
            { label: 'Weather Conditions', value: video['weather-conditions'] },
            { label: 'Video Quality', value: video['video-quality'] },
            { label: 'Cluster ID', value: video.cluster_id },
            { label: 'Anomaly Score', value: video.anomaly_score?.toFixed(3) },
            { label: 'Video Path', value: video.video_path },
        ];
        
        metadataGrid.innerHTML = metadata.map(item => {
            if (item.value === undefined || item.value === null || item.value === '') {
                return '';
            }
            
            return `
                <div class="metadata-item">
                    <div class="metadata-label">${item.label}:</div>
                    <div class="metadata-value">${item.value}</div>
                </div>
            `;
        }).join('');
    }
    
    generateTags(video) {
        const tags = [];
        
        // Event type tag
        if (video.main_event || video['main-event']) {
            tags.push({
                type: 'event',
                label: video.main_event || video['main-event']
            });
        }
        
        // Location tag
        if (video.location) {
            tags.push({
                type: 'location',
                label: video.location
            });
        }
        
        // Anomaly tag
        const anomalyScore = video.anomaly_score || 0;
        if (anomalyScore > 0.5) {
            tags.push({
                type: 'anomaly',
                label: anomalyScore > 0.7 ? 'High Anomaly' : 'Medium Anomaly'
            });
        }
        
        // Weather tag
        if (video['weather-conditions']) {
            tags.push({
                type: 'weather',
                label: video['weather-conditions']
            });
        }
        
        // Quality tag
        if (video['video-quality']) {
            tags.push({
                type: 'quality',
                label: `${video['video-quality']} Quality`
            });
        }
        
        return tags;
    }
    
    generateAnomalyReasons(video) {
        const reasons = [];
        const anomalyScore = video.anomaly_score || 0;
        
        if (anomalyScore > 0.7) {
            reasons.push({
                severity: 'high',
                text: 'Very high overall anomaly score detected'
            });
        }
        
        if (video.embedding_anomaly_score > 0.6) {
            reasons.push({
                severity: 'medium',
                text: 'Unusual semantic content patterns'
            });
        }
        
        if (video.text_anomaly_score > 0.6) {
            reasons.push({
                severity: 'medium',
                text: 'Atypical textual description'
            });
        }
        
        if (video.metadata_anomaly_score > 0.6) {
            reasons.push({
                severity: 'low',
                text: 'Uncommon metadata combination'
            });
        }
        
        // Add specific anomaly keywords if available
        if (video.interpretation && video.interpretation.toLowerCase().includes('accident')) {
            reasons.push({
                severity: 'high',
                text: 'Accident-related content detected'
            });
        }
        
        if (reasons.length === 0) {
            reasons.push({
                severity: 'low',
                text: 'No significant anomalies detected'
            });
        }
        
        return reasons;
    }
    
    async loadSimilarVideos(forceReload = false) {
        if (this.loadingSimilar) return;
        
        if (!forceReload && this.similarVideos.length > 0) {
            this.displaySimilarVideos();
            return;
        }
        
        try {
            this.loadingSimilar = true;
            this.showSimilarLoading(true);
            
            console.log('🔍 Loading similar videos for:', this.currentVideo.video_id);
            
            const response = await this.apiClient.searchVideos({
                video_id: this.currentVideo.video_id,
                similarity_search: true,
                limit: 20
            });
            
            this.similarVideos = (response.videos || []).filter(
                video => video.video_id !== this.currentVideo.video_id
            );
            
            this.displaySimilarVideos();
            
        } catch (error) {
            console.error('❌ Failed to load similar videos:', error);
            this.showSimilarError();
        } finally {
            this.loadingSimilar = false;
            this.showSimilarLoading(false);
        }
    }
    
    displaySimilarVideos() {
        const similarList = this.container.querySelector('.similar-videos-list');
        
        if (this.similarVideos.length === 0) {
            similarList.innerHTML = '<div class=\"empty-state\">No similar videos found</div>';
            return;
        }
        
        similarList.innerHTML = this.similarVideos.map(video => `
            <div class=\"similar-video-item\" data-video-id=\"${video.video_id}\">
                <div class=\"similar-thumbnail\">
                    <img src=\"${this.apiClient.getVideoThumbnailUrl(video.video_id, 'small')}\" 
                         alt=\"Thumbnail\" 
                         onerror=\"this.style.display='none'\">
                </div>
                <div class=\"similar-info\">
                    <div class=\"similar-title\">${video.title || video['video-title'] || 'Untitled'}</div>
                    <div class=\"similar-event\">${video.main_event || video['main-event'] || 'Unknown'}</div>
                    <div class=\"similar-score\">Similarity: ${(video.similarity_score || 0).toFixed(2)}</div>
                </div>
                <div class=\"similar-actions\">
                    <button class=\"similar-view-btn\" title=\"View Details\">
                        <i class=\"icon-eye\"></i>
                    </button>
                    <button class=\"similar-locate-btn\" title=\"Locate in 3D\">
                        <i class=\"icon-target\"></i>
                    </button>
                </div>
            </div>
        `).join('');
        
        // Add click handlers
        similarList.querySelectorAll('.similar-video-item').forEach(item => {
            const videoId = item.dataset.videoId;
            const video = this.similarVideos.find(v => v.video_id === videoId);
            
            item.querySelector('.similar-view-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                this.show(video);
            });
            
            item.querySelector('.similar-locate-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                this.eventBus.emit('video.locate', { videoId: video.video_id });
            });
            
            item.addEventListener('click', () => {
                this.show(video);
            });
        });
    }
    
    showSimilarLoading(show) {
        const similarList = this.container.querySelector('.similar-videos-list');
        
        if (show) {
            similarList.innerHTML = `
                <div class=\"loading-state\">
                    <div class=\"loading-spinner\"></div>
                    <div class=\"loading-text\">Loading similar videos...</div>
                </div>
            `;
        }
    }
    
    showSimilarError() {
        const similarList = this.container.querySelector('.similar-videos-list');
        similarList.innerHTML = `
            <div class=\"error-state\">
                <i class=\"icon-alert-triangle\"></i>
                <div class=\"error-text\">Failed to load similar videos</div>
                <button class=\"retry-btn\">Retry</button>
            </div>
        `;
        
        similarList.querySelector('.retry-btn').addEventListener('click', () => {
            this.loadSimilarVideos(true);
        });
    }
    
    setActiveTab(tabName) {
        if (!this.availableTabs.includes(tabName)) return;
        
        this.activeTab = tabName;
        
        // Update tab buttons
        this.container.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });
        
        // Update panels
        this.container.querySelectorAll('.content-panel').forEach(panel => {
            panel.classList.toggle('active', panel.dataset.panel === tabName);
        });
        
        // Load similar videos if switching to similar tab
        if (tabName === 'similar') {
            this.loadSimilarVideos();
        }
    }
    
    playVideo() {
        const videoPlayer = this.container.querySelector('.video-player');
        const thumbnail = this.container.querySelector('.video-thumbnail');
        
        if (!this.currentVideo) return;
        
        // Set video source
        videoPlayer.src = this.apiClient.getVideoStreamUrl(this.currentVideo.video_id);
        
        // Show player, hide thumbnail
        videoPlayer.style.display = 'block';
        thumbnail.style.display = 'none';
        
        // Play video
        videoPlayer.play().catch(error => {
            console.error('❌ Video play failed:', error);
            this.showVideoError();
        });
    }
    
    pauseVideo() {
        const videoPlayer = this.container.querySelector('.video-player');
        if (!videoPlayer.paused) {
            videoPlayer.pause();
        }
    }
    
    toggleVideoPlayback() {
        const videoPlayer = this.container.querySelector('.video-player');
        
        if (videoPlayer.style.display === 'none') {
            this.playVideo();
        } else {
            if (videoPlayer.paused) {
                videoPlayer.play();
            } else {
                videoPlayer.pause();
            }
        }
    }
    
    showVideoLoading(show) {
        const loadingElement = this.container.querySelector('.video-loading');
        loadingElement.style.display = show ? 'flex' : 'none';
    }
    
    showVideoError() {
        const videoPlayer = this.container.querySelector('.video-player');
        const thumbnail = this.container.querySelector('.video-thumbnail');
        const loading = this.container.querySelector('.video-loading');
        
        videoPlayer.style.display = 'none';
        loading.style.display = 'none';
        thumbnail.style.display = 'flex';
        
        // Show error overlay
        const errorOverlay = document.createElement('div');
        errorOverlay.className = 'video-error-overlay';
        errorOverlay.innerHTML = `
            <i class=\"icon-alert-triangle\"></i>
            <div>Video playback failed</div>
        `;
        
        const wrapper = this.container.querySelector('.video-player-wrapper');
        wrapper.appendChild(errorOverlay);
        
        setTimeout(() => {
            errorOverlay.remove();
        }, 3000);
    }
    
    downloadVideo() {
        if (!this.currentVideo) return;
        
        const downloadUrl = this.apiClient.getVideoDownloadUrl(this.currentVideo.video_id);
        
        // Create temporary link for download
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = `${this.currentVideo.video_id}.mp4`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        console.log('💾 Video download started:', this.currentVideo.video_id);
    }
    
    toggleFullscreen() {
        const videoPlayer = this.container.querySelector('.video-player');
        
        if (!document.fullscreenElement) {
            videoPlayer.requestFullscreen().catch(err => {
                console.error('❌ Fullscreen failed:', err);
            });
        } else {
            document.exitFullscreen();
        }
    }
    
    locateInVisualization() {
        if (!this.currentVideo || !this.currentVideo.coordinates) return;
        
        this.eventBus.emit('video.locate', {
            videoId: this.currentVideo.video_id,
            coordinates: this.currentVideo.coordinates
        });
    }
    
    showPreviousVideo() {
        this.eventBus.emit('modal.navigate', { direction: 'previous' });
    }
    
    showNextVideo() {
        this.eventBus.emit('modal.navigate', { direction: 'next' });
    }
    
    resetModal() {
        // Reset video player
        const videoPlayer = this.container.querySelector('.video-player');
        const thumbnail = this.container.querySelector('.video-thumbnail');
        
        videoPlayer.style.display = 'none';
        videoPlayer.src = '';
        thumbnail.style.display = 'flex';
        
        // Reset to overview tab
        this.setActiveTab('overview');
        
        // Clear similar videos
        this.similarVideos = [];
        
        // Reset current video
        this.currentVideo = null;
    }
    
    showError(message) {
        console.error('❌ Detail Modal Error:', message);
        
        // Create temporary error notification
        const errorDiv = document.createElement('div');
        errorDiv.className = 'modal-error-notification';
        errorDiv.textContent = message;
        
        this.modalElement.appendChild(errorDiv);
        
        setTimeout(() => {
            errorDiv.remove();
        }, 5000);
    }
    
    // Public API methods
    isModalVisible() {
        return this.isVisible;
    }
    
    getCurrentVideo() {
        return this.currentVideo;
    }
    
    getActiveTab() {
        return this.activeTab;
    }
    
    dispose() {
        document.removeEventListener('keydown', this.handleKeyPress);
        
        // Pause and cleanup video
        this.pauseVideo();
        
        console.log('🧹 Detail Modal disposed');
    }
}