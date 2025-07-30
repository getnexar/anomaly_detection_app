// Video Player component with streaming support
export class VideoPlayer {
    constructor({ container, eventBus, apiClient }) {
        this.container = container;
        this.eventBus = eventBus;
        this.apiClient = apiClient;
        
        // Player state
        this.currentVideo = null;
        this.isPlaying = false;
        this.isLoading = false;
        this.isMuted = false;
        this.volume = 1.0;
        this.currentTime = 0;
        this.duration = 0;
        this.playbackRate = 1.0;
        this.quality = 'medium';
        
        // Player elements
        this.videoElement = null;
        this.controlsElement = null;
        
        // Control state
        this.controlsVisible = true;
        this.controlsTimeout = null;
        this.isDragging = false;
        this.isFullscreen = false;
        
        // Streaming state
        this.streamUrl = null;
        this.qualities = ['low', 'medium', 'high'];
        this.bufferHealth = 0;
        this.lastBufferCheck = 0;
        
        // Touch/mouse state
        this.touchStartX = 0;
        this.touchStartY = 0;
        this.doubleTapTimeout = null;
        
        // Performance monitoring
        this.performanceMetrics = {
            loadTime: 0,
            bufferEvents: 0,
            stallEvents: 0,
            bitrateChanges: 0
        };
        
        // Bind methods
        this.handleVideoEvents = this.handleVideoEvents.bind(this);
        this.handleControlsInteraction = this.handleControlsInteraction.bind(this);
        this.handleKeyPress = this.handleKeyPress.bind(this);
        this.updateProgress = this.updateProgress.bind(this);
    }
    
    init() {
        console.log('🎬 Initializing Video Player...');
        
        this.createPlayer();
        this.setupEventListeners();
        this.setupKeyboardShortcuts();
        this.startPerformanceMonitoring();
        
        console.log('✅ Video Player initialized');
    }
    
    createPlayer() {
        this.container.innerHTML = `
            <div class="video-player-container">
                <div class="video-wrapper">
                    <video class="video-element" 
                           preload="metadata"
                           playsinline
                           webkit-playsinline>
                        <source type="video/mp4">
                        Your browser does not support video playback.
                    </video>
                    
                    <div class="video-overlay">
                        <div class="loading-spinner" style="display: none;">
                            <div class="spinner"></div>
                            <div class="loading-text">Loading...</div>
                        </div>
                        
                        <div class="play-button" style="display: none;">
                            <i class="icon-play"></i>
                        </div>
                        
                        <div class="error-message" style="display: none;">
                            <i class="icon-alert-triangle"></i>
                            <div class="error-text">Video playback failed</div>
                            <button class="retry-button">Retry</button>
                        </div>
                        
                        <div class="buffering-indicator" style="display: none;">
                            <div class="buffer-spinner"></div>
                        </div>
                    </div>
                    
                    <div class="video-controls">
                        <div class="controls-background"></div>
                        
                        <div class="progress-container">
                            <div class="progress-track">
                                <div class="progress-buffer"></div>
                                <div class="progress-played"></div>
                                <div class="progress-handle"></div>
                            </div>
                        </div>
                        
                        <div class="controls-row">
                            <div class="controls-left">
                                <button class="control-btn play-pause-btn" title="Play/Pause">
                                    <i class="icon-play"></i>
                                </button>
                                
                                <div class="volume-control">
                                    <button class="control-btn volume-btn" title="Mute/Unmute">
                                        <i class="icon-volume-2"></i>
                                    </button>
                                    <div class="volume-slider">
                                        <div class="volume-track">
                                            <div class="volume-fill"></div>
                                            <div class="volume-handle"></div>
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="time-display">
                                    <span class="current-time">0:00</span>
                                    <span class="time-separator">/</span>
                                    <span class="total-time">0:00</span>
                                </div>
                            </div>
                            
                            <div class="controls-center">
                                <div class="video-title">No video loaded</div>
                            </div>
                            
                            <div class="controls-right">
                                <div class="playback-rate">
                                    <button class="control-btn rate-btn" title="Playback Speed">
                                        <span class="rate-text">1x</span>
                                    </button>
                                    <div class="rate-menu">
                                        <div class="rate-option" data-rate="0.25">0.25x</div>
                                        <div class="rate-option" data-rate="0.5">0.5x</div>
                                        <div class="rate-option" data-rate="0.75">0.75x</div>
                                        <div class="rate-option active" data-rate="1">1x</div>
                                        <div class="rate-option" data-rate="1.25">1.25x</div>
                                        <div class="rate-option" data-rate="1.5">1.5x</div>
                                        <div class="rate-option" data-rate="2">2x</div>
                                    </div>
                                </div>
                                
                                <div class="quality-control">
                                    <button class="control-btn quality-btn" title="Video Quality">
                                        <i class="icon-settings"></i>
                                        <span class="quality-text">Auto</span>
                                    </button>
                                    <div class="quality-menu">
                                        <div class="quality-option active" data-quality="auto">Auto</div>
                                        <div class="quality-option" data-quality="high">High (1080p)</div>
                                        <div class="quality-option" data-quality="medium">Medium (720p)</div>
                                        <div class="quality-option" data-quality="low">Low (480p)</div>
                                    </div>
                                </div>
                                
                                <button class="control-btn pip-btn" title="Picture in Picture">
                                    <i class="icon-picture-in-picture"></i>
                                </button>
                                
                                <button class="control-btn fullscreen-btn" title="Fullscreen">
                                    <i class="icon-maximize"></i>
                                </button>
                            </div>
                        </div>
                        
                        <div class="buffer-indicator">
                            <div class="buffer-health">
                                <div class="buffer-fill"></div>
                            </div>
                            <div class="buffer-text">Buffer: 0%</div>
                        </div>
                    </div>
                </div>
                
                <div class="player-info" style="display: none;">
                    <div class="info-section">
                        <h4>Video Information</h4>
                        <div class="info-grid">
                            <div class="info-item">
                                <span class="info-label">Resolution:</span>
                                <span class="info-value resolution">--</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Bitrate:</span>
                                <span class="info-value bitrate">--</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">FPS:</span>
                                <span class="info-value fps">--</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Codec:</span>
                                <span class="info-value codec">--</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="performance-section">
                        <h4>Performance Metrics</h4>
                        <div class="metrics-grid">
                            <div class="metric-item">
                                <span class="metric-label">Load Time:</span>
                                <span class="metric-value load-time">--</span>
                            </div>
                            <div class="metric-item">
                                <span class="metric-label">Buffer Health:</span>
                                <span class="metric-value buffer-health-text">--</span>
                            </div>
                            <div class="metric-item">
                                <span class="metric-label">Stall Events:</span>
                                <span class="metric-value stall-events">--</span>
                            </div>
                            <div class="metric-item">
                                <span class="metric-label">Quality Changes:</span>
                                <span class="metric-value quality-changes">--</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Get references
        this.videoElement = this.container.querySelector('.video-element');
        this.controlsElement = this.container.querySelector('.video-controls');
    }
    
    setupEventListeners() {
        // Video element events
        this.videoElement.addEventListener('loadstart', this.handleVideoEvents);\n        this.videoElement.addEventListener('loadedmetadata', this.handleVideoEvents);\n        this.videoElement.addEventListener('loadeddata', this.handleVideoEvents);\n        this.videoElement.addEventListener('canplay', this.handleVideoEvents);\n        this.videoElement.addEventListener('canplaythrough', this.handleVideoEvents);\n        this.videoElement.addEventListener('play', this.handleVideoEvents);\n        this.videoElement.addEventListener('pause', this.handleVideoEvents);\n        this.videoElement.addEventListener('ended', this.handleVideoEvents);\n        this.videoElement.addEventListener('error', this.handleVideoEvents);\n        this.videoElement.addEventListener('waiting', this.handleVideoEvents);\n        this.videoElement.addEventListener('playing', this.handleVideoEvents);\n        this.videoElement.addEventListener('timeupdate', this.handleVideoEvents);\n        this.videoElement.addEventListener('progress', this.handleVideoEvents);\n        this.videoElement.addEventListener('seeked', this.handleVideoEvents);\n        this.videoElement.addEventListener('seeking', this.handleVideoEvents);\n        this.videoElement.addEventListener('stalled', this.handleVideoEvents);\n        this.videoElement.addEventListener('suspend', this.handleVideoEvents);\n        this.videoElement.addEventListener('abort', this.handleVideoEvents);\n        this.videoElement.addEventListener('emptied', this.handleVideoEvents);\n        this.videoElement.addEventListener('ratechange', this.handleVideoEvents);\n        this.videoElement.addEventListener('volumechange', this.handleVideoEvents);\n        \n        // Control interactions\n        this.setupControlInteractions();\n        \n        // Mouse/touch events for player\n        this.container.addEventListener('mousemove', this.handleControlsInteraction);\n        this.container.addEventListener('mouseleave', () => this.hideControls());\n        this.container.addEventListener('click', this.handleControlsInteraction);\n        \n        // Touch events\n        this.container.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });\n        this.container.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });\n        this.container.addEventListener('touchend', (e) => this.handleTouchEnd(e));\n        \n        // Fullscreen events\n        document.addEventListener('fullscreenchange', () => this.handleFullscreenChange());\n        document.addEventListener('webkitfullscreenchange', () => this.handleFullscreenChange());\n        \n        // Picture-in-picture events\n        if ('pictureInPictureEnabled' in document) {\n            this.videoElement.addEventListener('enterpictureinpicture', () => {\n                console.log('📺 Entered Picture-in-Picture mode');\n            });\n            \n            this.videoElement.addEventListener('leavepictureinpicture', () => {\n                console.log('📺 Left Picture-in-Picture mode');\n            });\n        }\n    }\n    \n    setupControlInteractions() {\n        // Play/pause button\n        const playPauseBtn = this.container.querySelector('.play-pause-btn');\n        playPauseBtn.addEventListener('click', () => this.togglePlayPause());\n        \n        // Volume control\n        const volumeBtn = this.container.querySelector('.volume-btn');\n        volumeBtn.addEventListener('click', () => this.toggleMute());\n        \n        this.setupVolumeSlider();\n        \n        // Progress bar\n        this.setupProgressBar();\n        \n        // Playback rate\n        this.setupPlaybackRate();\n        \n        // Quality control\n        this.setupQualityControl();\n        \n        // Picture-in-picture\n        const pipBtn = this.container.querySelector('.pip-btn');\n        if ('pictureInPictureEnabled' in document) {\n            pipBtn.addEventListener('click', () => this.togglePictureInPicture());\n        } else {\n            pipBtn.style.display = 'none';\n        }\n        \n        // Fullscreen\n        const fullscreenBtn = this.container.querySelector('.fullscreen-btn');\n        fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());\n        \n        // Large play button overlay\n        const playButton = this.container.querySelector('.play-button');\n        playButton.addEventListener('click', () => {\n            this.play();\n        });\n        \n        // Retry button\n        const retryButton = this.container.querySelector('.retry-button');\n        retryButton.addEventListener('click', () => {\n            this.retry();\n        });\n    }\n    \n    setupVolumeSlider() {\n        const volumeSlider = this.container.querySelector('.volume-slider');\n        const volumeTrack = this.container.querySelector('.volume-track');\n        const volumeFill = this.container.querySelector('.volume-fill');\n        const volumeHandle = this.container.querySelector('.volume-handle');\n        \n        let isDragging = false;\n        \n        const updateVolume = (clientX) => {\n            const rect = volumeTrack.getBoundingClientRect();\n            const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));\n            this.setVolume(percent);\n        };\n        \n        volumeTrack.addEventListener('mousedown', (e) => {\n            isDragging = true;\n            updateVolume(e.clientX);\n            e.preventDefault();\n        });\n        \n        document.addEventListener('mousemove', (e) => {\n            if (isDragging) {\n                updateVolume(e.clientX);\n            }\n        });\n        \n        document.addEventListener('mouseup', () => {\n            isDragging = false;\n        });\n        \n        // Show/hide volume slider on hover\n        const volumeControl = this.container.querySelector('.volume-control');\n        volumeControl.addEventListener('mouseenter', () => {\n            volumeSlider.style.opacity = '1';\n            volumeSlider.style.transform = 'scaleX(1)';\n        });\n        \n        volumeControl.addEventListener('mouseleave', () => {\n            volumeSlider.style.opacity = '0';\n            volumeSlider.style.transform = 'scaleX(0)';\n        });\n    }\n    \n    setupProgressBar() {\n        const progressContainer = this.container.querySelector('.progress-container');\n        const progressTrack = this.container.querySelector('.progress-track');\n        const progressHandle = this.container.querySelector('.progress-handle');\n        \n        let isDragging = false;\n        let wasPaused = false;\n        \n        const updateProgress = (clientX) => {\n            const rect = progressTrack.getBoundingClientRect();\n            const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));\n            const time = percent * this.duration;\n            this.seek(time);\n        };\n        \n        progressTrack.addEventListener('mousedown', (e) => {\n            isDragging = true;\n            wasPaused = this.videoElement.paused;\n            this.pause();\n            updateProgress(e.clientX);\n            e.preventDefault();\n        });\n        \n        document.addEventListener('mousemove', (e) => {\n            if (isDragging) {\n                updateProgress(e.clientX);\n            }\n        });\n        \n        document.addEventListener('mouseup', () => {\n            if (isDragging) {\n                isDragging = false;\n                if (!wasPaused) {\n                    this.play();\n                }\n            }\n        });\n        \n        // Touch events for mobile\n        progressTrack.addEventListener('touchstart', (e) => {\n            isDragging = true;\n            wasPaused = this.videoElement.paused;\n            this.pause();\n            updateProgress(e.touches[0].clientX);\n            e.preventDefault();\n        });\n        \n        progressTrack.addEventListener('touchmove', (e) => {\n            if (isDragging) {\n                updateProgress(e.touches[0].clientX);\n                e.preventDefault();\n            }\n        });\n        \n        progressTrack.addEventListener('touchend', () => {\n            if (isDragging) {\n                isDragging = false;\n                if (!wasPaused) {\n                    this.play();\n                }\n            }\n        });\n    }\n    \n    setupPlaybackRate() {\n        const rateBtn = this.container.querySelector('.rate-btn');\n        const rateMenu = this.container.querySelector('.rate-menu');\n        \n        rateBtn.addEventListener('click', () => {\n            rateMenu.style.display = rateMenu.style.display === 'block' ? 'none' : 'block';\n        });\n        \n        // Click outside to close\n        document.addEventListener('click', (e) => {\n            if (!rateBtn.contains(e.target) && !rateMenu.contains(e.target)) {\n                rateMenu.style.display = 'none';\n            }\n        });\n        \n        // Rate options\n        rateMenu.querySelectorAll('.rate-option').forEach(option => {\n            option.addEventListener('click', () => {\n                const rate = parseFloat(option.dataset.rate);\n                this.setPlaybackRate(rate);\n                \n                // Update active state\n                rateMenu.querySelectorAll('.rate-option').forEach(opt => {\n                    opt.classList.remove('active');\n                });\n                option.classList.add('active');\n                \n                rateMenu.style.display = 'none';\n            });\n        });\n    }\n    \n    setupQualityControl() {\n        const qualityBtn = this.container.querySelector('.quality-btn');\n        const qualityMenu = this.container.querySelector('.quality-menu');\n        \n        qualityBtn.addEventListener('click', () => {\n            qualityMenu.style.display = qualityMenu.style.display === 'block' ? 'none' : 'block';\n        });\n        \n        // Click outside to close\n        document.addEventListener('click', (e) => {\n            if (!qualityBtn.contains(e.target) && !qualityMenu.contains(e.target)) {\n                qualityMenu.style.display = 'none';\n            }\n        });\n        \n        // Quality options\n        qualityMenu.querySelectorAll('.quality-option').forEach(option => {\n            option.addEventListener('click', () => {\n                const quality = option.dataset.quality;\n                this.setQuality(quality);\n                \n                // Update active state\n                qualityMenu.querySelectorAll('.quality-option').forEach(opt => {\n                    opt.classList.remove('active');\n                });\n                option.classList.add('active');\n                \n                qualityMenu.style.display = 'none';\n            });\n        });\n    }\n    \n    setupKeyboardShortcuts() {\n        document.addEventListener('keydown', this.handleKeyPress);\n    }\n    \n    handleKeyPress(e) {\n        // Only handle keys when player is focused or visible\n        if (!this.container.contains(document.activeElement) && \n            !this.container.querySelector('.player-active')) {\n            return;\n        }\n        \n        switch (e.key) {\n            case ' ':\n            case 'k':\n                e.preventDefault();\n                this.togglePlayPause();\n                break;\n            case 'ArrowLeft':\n                e.preventDefault();\n                this.seek(this.currentTime - 10);\n                break;\n            case 'ArrowRight':\n                e.preventDefault();\n                this.seek(this.currentTime + 10);\n                break;\n            case 'ArrowUp':\n                e.preventDefault();\n                this.setVolume(Math.min(1, this.volume + 0.1));\n                break;\n            case 'ArrowDown':\n                e.preventDefault();\n                this.setVolume(Math.max(0, this.volume - 0.1));\n                break;\n            case 'm':\n                this.toggleMute();\n                break;\n            case 'f':\n                this.toggleFullscreen();\n                break;\n            case 'p':\n                if ('pictureInPictureEnabled' in document) {\n                    this.togglePictureInPicture();\n                }\n                break;\n            case '0':\n            case '1':\n            case '2':\n            case '3':\n            case '4':\n            case '5':\n            case '6':\n            case '7':\n            case '8':\n            case '9':\n                e.preventDefault();\n                const percent = parseInt(e.key) / 10;\n                this.seek(this.duration * percent);\n                break;\n        }\n    }\n    \n    handleVideoEvents(e) {\n        const type = e.type;\n        \n        switch (type) {\n            case 'loadstart':\n                this.showLoading(true);\n                this.performanceMetrics.loadTime = Date.now();\n                break;\n                \n            case 'loadedmetadata':\n                this.duration = this.videoElement.duration;\n                this.updateDuration();\n                break;\n                \n            case 'loadeddata':\n                this.showLoading(false);\n                break;\n                \n            case 'canplay':\n                this.performanceMetrics.loadTime = Date.now() - this.performanceMetrics.loadTime;\n                this.updatePerformanceDisplay();\n                break;\n                \n            case 'play':\n                this.isPlaying = true;\n                this.updatePlayPauseButton();\n                this.hidePlayButton();\n                this.eventBus.emit('video.play', { videoId: this.currentVideo?.video_id });\n                break;\n                \n            case 'pause':\n                this.isPlaying = false;\n                this.updatePlayPauseButton();\n                this.eventBus.emit('video.pause', { videoId: this.currentVideo?.video_id });\n                break;\n                \n            case 'ended':\n                this.isPlaying = false;\n                this.updatePlayPauseButton();\n                this.showPlayButton();\n                this.eventBus.emit('video.ended', { videoId: this.currentVideo?.video_id });\n                break;\n                \n            case 'error':\n                this.showError();\n                this.eventBus.emit('video.error', { \n                    videoId: this.currentVideo?.video_id, \n                    error: this.videoElement.error \n                });\n                break;\n                \n            case 'waiting':\n                this.showBuffering(true);\n                this.performanceMetrics.bufferEvents++;\n                break;\n                \n            case 'playing':\n                this.showBuffering(false);\n                break;\n                \n            case 'timeupdate':\n                this.currentTime = this.videoElement.currentTime;\n                this.updateProgress();\n                break;\n                \n            case 'progress':\n                this.updateBufferProgress();\n                break;\n                \n            case 'stalled':\n                this.performanceMetrics.stallEvents++;\n                this.updatePerformanceDisplay();\n                break;\n                \n            case 'ratechange':\n                this.playbackRate = this.videoElement.playbackRate;\n                this.updateRateDisplay();\n                break;\n                \n            case 'volumechange':\n                this.volume = this.videoElement.volume;\n                this.isMuted = this.videoElement.muted;\n                this.updateVolumeDisplay();\n                break;\n        }\n    }\n    \n    handleControlsInteraction() {\n        this.showControls();\n        \n        // Auto-hide controls after 3 seconds\n        clearTimeout(this.controlsTimeout);\n        this.controlsTimeout = setTimeout(() => {\n            if (this.isPlaying) {\n                this.hideControls();\n            }\n        }, 3000);\n    }\n    \n    handleTouchStart(e) {\n        this.touchStartX = e.touches[0].clientX;\n        this.touchStartY = e.touches[0].clientY;\n        \n        // Handle double tap for fullscreen\n        if (this.doubleTapTimeout) {\n            clearTimeout(this.doubleTapTimeout);\n            this.doubleTapTimeout = null;\n            this.toggleFullscreen();\n        } else {\n            this.doubleTapTimeout = setTimeout(() => {\n                this.doubleTapTimeout = null;\n            }, 300);\n        }\n    }\n    \n    handleTouchMove(e) {\n        const touchX = e.touches[0].clientX;\n        const touchY = e.touches[0].clientY;\n        \n        const deltaX = touchX - this.touchStartX;\n        const deltaY = touchY - this.touchStartY;\n        \n        // Horizontal swipe for seeking\n        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {\n            const seekTime = this.currentTime + (deltaX / 10);\n            this.seek(Math.max(0, Math.min(this.duration, seekTime)));\n            e.preventDefault();\n        }\n        \n        // Vertical swipe for volume\n        if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 50) {\n            const volumeChange = -deltaY / 200;\n            this.setVolume(Math.max(0, Math.min(1, this.volume + volumeChange)));\n            e.preventDefault();\n        }\n    }\n    \n    handleTouchEnd(e) {\n        // Single tap to toggle controls\n        if (Math.abs(e.changedTouches[0].clientX - this.touchStartX) < 10 && \n            Math.abs(e.changedTouches[0].clientY - this.touchStartY) < 10) {\n            this.handleControlsInteraction();\n        }\n    }\n    \n    async loadVideo(videoData, autoplay = false) {\n        try {\n            console.log('🎬 Loading video:', videoData.video_id);\n            \n            this.currentVideo = videoData;\n            \n            // Update title\n            const titleElement = this.container.querySelector('.video-title');\n            titleElement.textContent = videoData.title || videoData['video-title'] || 'Untitled Video';\n            \n            // Set stream URL\n            this.streamUrl = this.apiClient.getVideoStreamUrl(videoData.video_id, this.quality);\n            this.videoElement.src = this.streamUrl;\n            \n            // Reset state\n            this.resetPlayer();\n            \n            // Show play button if not autoplay\n            if (!autoplay) {\n                this.showPlayButton();\n            } else {\n                await this.play();\n            }\n            \n            // Emit load event\n            this.eventBus.emit('video.load', { videoId: videoData.video_id });\n            \n        } catch (error) {\n            console.error('❌ Failed to load video:', error);\n            this.showError();\n        }\n    }\n    \n    async play() {\n        try {\n            await this.videoElement.play();\n        } catch (error) {\n            console.error('❌ Video play failed:', error);\n            this.showError();\n        }\n    }\n    \n    pause() {\n        this.videoElement.pause();\n    }\n    \n    togglePlayPause() {\n        if (this.isPlaying) {\n            this.pause();\n        } else {\n            this.play();\n        }\n    }\n    \n    seek(time) {\n        this.videoElement.currentTime = Math.max(0, Math.min(this.duration, time));\n    }\n    \n    setVolume(volume) {\n        this.volume = Math.max(0, Math.min(1, volume));\n        this.videoElement.volume = this.volume;\n        \n        if (this.volume === 0) {\n            this.videoElement.muted = true;\n        } else if (this.isMuted) {\n            this.videoElement.muted = false;\n        }\n    }\n    \n    toggleMute() {\n        this.videoElement.muted = !this.videoElement.muted;\n    }\n    \n    setPlaybackRate(rate) {\n        this.playbackRate = rate;\n        this.videoElement.playbackRate = rate;\n        this.performanceMetrics.bitrateChanges++;\n        this.updatePerformanceDisplay();\n    }\n    \n    async setQuality(quality) {\n        if (!this.currentVideo) return;\n        \n        const currentTime = this.currentTime;\n        const wasPlaying = this.isPlaying;\n        \n        this.quality = quality;\n        \n        // Update stream URL\n        this.streamUrl = this.apiClient.getVideoStreamUrl(this.currentVideo.video_id, quality);\n        this.videoElement.src = this.streamUrl;\n        \n        // Restore position and playback state\n        this.videoElement.addEventListener('loadeddata', () => {\n            this.seek(currentTime);\n            if (wasPlaying) {\n                this.play();\n            }\n        }, { once: true });\n        \n        // Update quality display\n        const qualityText = this.container.querySelector('.quality-text');\n        qualityText.textContent = quality === 'auto' ? 'Auto' : quality.charAt(0).toUpperCase() + quality.slice(1);\n        \n        console.log(`🎬 Quality changed to: ${quality}`);\n    }\n    \n    async toggleFullscreen() {\n        try {\n            if (!document.fullscreenElement) {\n                await this.container.requestFullscreen();\n            } else {\n                await document.exitFullscreen();\n            }\n        } catch (error) {\n            console.error('❌ Fullscreen toggle failed:', error);\n        }\n    }\n    \n    async togglePictureInPicture() {\n        try {\n            if (document.pictureInPictureElement) {\n                await document.exitPictureInPicture();\n            } else {\n                await this.videoElement.requestPictureInPicture();\n            }\n        } catch (error) {\n            console.error('❌ Picture-in-Picture toggle failed:', error);\n        }\n    }\n    \n    handleFullscreenChange() {\n        this.isFullscreen = !!document.fullscreenElement;\n        \n        const fullscreenBtn = this.container.querySelector('.fullscreen-btn i');\n        fullscreenBtn.className = this.isFullscreen ? 'icon-minimize' : 'icon-maximize';\n        \n        this.container.classList.toggle('fullscreen', this.isFullscreen);\n    }\n    \n    showControls() {\n        this.controlsVisible = true;\n        this.controlsElement.style.opacity = '1';\n        this.controlsElement.style.transform = 'translateY(0)';\n        this.container.style.cursor = 'default';\n    }\n    \n    hideControls() {\n        if (this.isDragging) return;\n        \n        this.controlsVisible = false;\n        this.controlsElement.style.opacity = '0';\n        this.controlsElement.style.transform = 'translateY(100%)';\n        this.container.style.cursor = 'none';\n    }\n    \n    showLoading(show) {\n        const spinner = this.container.querySelector('.loading-spinner');\n        spinner.style.display = show ? 'flex' : 'none';\n        this.isLoading = show;\n    }\n    \n    showBuffering(show) {\n        const indicator = this.container.querySelector('.buffering-indicator');\n        indicator.style.display = show ? 'flex' : 'none';\n    }\n    \n    showPlayButton() {\n        const playButton = this.container.querySelector('.play-button');\n        playButton.style.display = 'flex';\n    }\n    \n    hidePlayButton() {\n        const playButton = this.container.querySelector('.play-button');\n        playButton.style.display = 'none';\n    }\n    \n    showError() {\n        const errorMessage = this.container.querySelector('.error-message');\n        errorMessage.style.display = 'flex';\n        \n        this.showLoading(false);\n        this.showBuffering(false);\n    }\n    \n    hideError() {\n        const errorMessage = this.container.querySelector('.error-message');\n        errorMessage.style.display = 'none';\n    }\n    \n    retry() {\n        this.hideError();\n        if (this.currentVideo) {\n            this.loadVideo(this.currentVideo);\n        }\n    }\n    \n    updatePlayPauseButton() {\n        const icon = this.container.querySelector('.play-pause-btn i');\n        icon.className = this.isPlaying ? 'icon-pause' : 'icon-play';\n    }\n    \n    updateVolumeDisplay() {\n        const volumeBtn = this.container.querySelector('.volume-btn i');\n        const volumeFill = this.container.querySelector('.volume-fill');\n        const volumeHandle = this.container.querySelector('.volume-handle');\n        \n        // Update icon\n        if (this.isMuted || this.volume === 0) {\n            volumeBtn.className = 'icon-volume-x';\n        } else if (this.volume < 0.5) {\n            volumeBtn.className = 'icon-volume-1';\n        } else {\n            volumeBtn.className = 'icon-volume-2';\n        }\n        \n        // Update slider\n        const volumePercent = this.isMuted ? 0 : this.volume * 100;\n        volumeFill.style.width = `${volumePercent}%`;\n        volumeHandle.style.left = `${volumePercent}%`;\n    }\n    \n    updateProgress() {\n        if (this.isDragging) return;\n        \n        const progressPlayed = this.container.querySelector('.progress-played');\n        const progressHandle = this.container.querySelector('.progress-handle');\n        const currentTimeDisplay = this.container.querySelector('.current-time');\n        \n        const percent = this.duration > 0 ? (this.currentTime / this.duration) * 100 : 0;\n        \n        progressPlayed.style.width = `${percent}%`;\n        progressHandle.style.left = `${percent}%`;\n        currentTimeDisplay.textContent = this.formatTime(this.currentTime);\n    }\n    \n    updateBufferProgress() {\n        const progressBuffer = this.container.querySelector('.progress-buffer');\n        const bufferFill = this.container.querySelector('.buffer-fill');\n        const bufferText = this.container.querySelector('.buffer-text');\n        \n        if (this.videoElement.buffered.length > 0) {\n            const bufferedEnd = this.videoElement.buffered.end(this.videoElement.buffered.length - 1);\n            const bufferPercent = this.duration > 0 ? (bufferedEnd / this.duration) * 100 : 0;\n            \n            progressBuffer.style.width = `${bufferPercent}%`;\n            \n            // Update buffer health\n            this.bufferHealth = Math.max(0, bufferedEnd - this.currentTime);\n            const healthPercent = Math.min(100, (this.bufferHealth / 30) * 100); // 30 seconds = 100%\n            \n            bufferFill.style.width = `${healthPercent}%`;\n            bufferText.textContent = `Buffer: ${Math.round(this.bufferHealth)}s`;\n        }\n    }\n    \n    updateDuration() {\n        const totalTimeDisplay = this.container.querySelector('.total-time');\n        totalTimeDisplay.textContent = this.formatTime(this.duration);\n    }\n    \n    updateRateDisplay() {\n        const rateText = this.container.querySelector('.rate-text');\n        rateText.textContent = `${this.playbackRate}x`;\n    }\n    \n    updatePerformanceDisplay() {\n        const loadTime = this.container.querySelector('.load-time');\n        const bufferHealthText = this.container.querySelector('.buffer-health-text');\n        const stallEvents = this.container.querySelector('.stall-events');\n        const qualityChanges = this.container.querySelector('.quality-changes');\n        \n        loadTime.textContent = `${this.performanceMetrics.loadTime}ms`;\n        bufferHealthText.textContent = `${Math.round(this.bufferHealth)}s`;\n        stallEvents.textContent = this.performanceMetrics.stallEvents;\n        qualityChanges.textContent = this.performanceMetrics.bitrateChanges;\n    }\n    \n    formatTime(seconds) {\n        if (isNaN(seconds)) return '0:00';\n        \n        const mins = Math.floor(seconds / 60);\n        const secs = Math.floor(seconds % 60);\n        return `${mins}:${secs.toString().padStart(2, '0')}`;\n    }\n    \n    resetPlayer() {\n        this.isPlaying = false;\n        this.currentTime = 0;\n        this.duration = 0;\n        \n        this.hideError();\n        this.hidePlayButton();\n        this.showControls();\n        \n        // Reset performance metrics\n        this.performanceMetrics = {\n            loadTime: 0,\n            bufferEvents: 0,\n            stallEvents: 0,\n            bitrateChanges: 0\n        };\n    }\n    \n    startPerformanceMonitoring() {\n        setInterval(() => {\n            this.updateBufferProgress();\n            \n            // Check for performance issues\n            if (this.bufferHealth < 5 && this.isPlaying) {\n                console.warn('⚠️ Low buffer health:', this.bufferHealth);\n            }\n        }, 1000);\n    }\n    \n    // Public API methods\n    getCurrentVideo() {\n        return this.currentVideo;\n    }\n    \n    getCurrentTime() {\n        return this.currentTime;\n    }\n    \n    getDuration() {\n        return this.duration;\n    }\n    \n    getVolume() {\n        return this.volume;\n    }\n    \n    getPlaybackRate() {\n        return this.playbackRate;\n    }\n    \n    getQuality() {\n        return this.quality;\n    }\n    \n    isVideoPlaying() {\n        return this.isPlaying;\n    }\n    \n    isVideoLoading() {\n        return this.isLoading;\n    }\n    \n    getPerformanceMetrics() {\n        return { ...this.performanceMetrics };\n    }\n    \n    dispose() {\n        // Cleanup video\n        this.pause();\n        this.videoElement.src = '';\n        \n        // Remove event listeners\n        document.removeEventListener('keydown', this.handleKeyPress);\n        \n        // Clear timeouts\n        if (this.controlsTimeout) {\n            clearTimeout(this.controlsTimeout);\n        }\n        \n        if (this.doubleTapTimeout) {\n            clearTimeout(this.doubleTapTimeout);\n        }\n        \n        console.log('🧹 Video Player disposed');\n    }\n}