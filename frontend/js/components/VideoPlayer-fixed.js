// VideoPlayer component - Fixed version for global usage
class VideoPlayer {
    constructor(options) {
        this.container = options.container;
        this.eventBus = options.eventBus;
        this.apiClient = options.apiClient;
        
        this.currentVideoId = null;
        this.player = null;
    }
    
    async init() {
        console.log('🎬 Initializing VideoPlayer...');
        
        if (!this.container) {
            console.warn('VideoPlayer container not found');
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
        
        console.log('✅ VideoPlayer initialized');
    }
    
    show(videoId, videoData) {
        this.currentVideoId = videoId;
        
        this.container.style.display = 'block';
        this.container.classList.add('active');
        document.body.style.overflow = 'hidden';
        
        // Update modal header
        const modalHeader = this.container.querySelector('.modal-header h2');
        if (modalHeader) {
            modalHeader.textContent = videoData.title || 'Video Player';
        }
        
        // Create video player
        const modalBody = this.container.querySelector('.modal-body');
        if (modalBody) {
            modalBody.innerHTML = `
                <div class="video-player-wrapper">
                    <video id="video-element" 
                           controls 
                           autoplay
                           style="width: 100%; max-height: 70vh;">
                        <source src="/api/videos/${videoId}/stream" type="video/mp4">
                        Your browser does not support the video tag.
                    </video>
                    <div class="video-info">
                        <h3>${videoData.title || 'Unknown Video'}</h3>
                        <p>Event: ${videoData.main_event || 'Unknown'}</p>
                        <p>Location: ${videoData.location || 'Unknown'}</p>
                    </div>
                </div>
            `;
        }
        
        this.player = document.getElementById('video-element');
    }
    
    hide() {
        if (this.player) {
            this.player.pause();
            this.player = null;
        }
        
        this.container.classList.add('closing');
        setTimeout(() => {
            this.container.style.display = 'none';
            this.container.classList.remove('active', 'closing');
            document.body.style.overflow = '';
            
            // Clear content
            const modalBody = this.container.querySelector('.modal-body');
            if (modalBody) {
                modalBody.innerHTML = '';
            }
        }, 200);
        
        this.currentVideoId = null;
        this.eventBus.emit('video.close');
    }
    
    isVisible() {
        return this.container && this.container.classList.contains('active');
    }
}

// Make it globally available
window.VideoPlayer = VideoPlayer;